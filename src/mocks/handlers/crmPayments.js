import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toBoolOrUndefined, notFound } from './utils';
import { getCollection } from '../db';
import { DEMO_PRIVAT_PAYMENTS } from '../data/privatPayments';
import {
    linkedBillIds, loadCrmOrderViews, loadSharedBills, loadSharedOrders, nowIso, resolveBillAssets, saveSharedBills,
    saveSharedOrders, updatePaidStatus,
} from '../data/crmShared';

// Response shapes follow the original API, as consumed by PaymentForCRM.jsx and CRMPaymentInfo.jsx:
//   GET   /accounting/payment_bill/       -> { count, next, previous, results }  (table rows, page_size per page)
//   GET   /accounting/payment_bill/:id/   -> bill with order id, receipts and provider payment
//   PATCH /accounting/payment_bill/:id/   -> { customer_receipt_approved } — the accountant's decision, made once;
//                                            approving also marks the bill paid (and its order, by the CRM's rule),
//                                            declining marks an unpaid bill not paid — both as in the CRM
// Bills (and the orders / customers they belong to) are shared with the CRM demo and re-read on every request
// (see ../data/crmShared.js); the "Оплата замовлень" page links Privat payments to the same bills.

const APPROVAL_VALUES = ['APPROVED', 'DECLINED'];

const payments = () => getCollection('privatPayments', DEMO_PRIVAT_PAYMENTS);

const findBill = (bills, id) => bills.find((b) => b.id === Number(id));

const toResponse = ({ order_id, ...bill }) => ({ ...resolveBillAssets(bill), order: order_id });

const includesCI = (value, needle) => String(value ?? '').toLowerCase().includes(needle);

const badRequest = (detail) => HttpResponse.json(detail, { status: 400 });

export const crmPaymentHandlers = [
    http.get(`${API}/accounting/payment_bill/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const param = (key) => (isSet(q.get(key)) ? q.get(key).trim() : '');

        const search = param('search').toLowerCase();
        const type = param('type');
        const method = param('method');
        const status = param('status');
        const approved = param('receipt_approved');
        const paidDate = param('paid_date'); // yyyy-mm-dd
        const isLinked = toBoolOrUndefined(q.get('is_linked'));
        const bills = loadSharedBills();
        const linked = linkedBillIds(payments(), bills);

        const orders = loadCrmOrderViews();
        const filtered = bills
            // newest first: bill ids follow creation time
            .slice()
            .sort((a, b) => b.id - a.id)
            .filter((b) => {
                if (search && ![b.id, b.order_id, b.prepayment_amount, orders.get(b.order_id)?.customer]
                    .some((f) => includesCI(f, search))) return false;
                if (type && b.type !== type) return false;
                if (method && b.method !== method) return false;
                if (status && b.status !== status) return false;
                if (approved && b.customer_receipt_approved !== approved) return false;
                if (paidDate && b.paid_datetime?.slice(0, 10) !== paidDate) return false;
                if (isLinked !== undefined && linked.has(b.id) !== isLinked) return false;
                return true;
            });

        const page = Math.max(1, Number(q.get('page')) || 1);
        const pageSize = Math.max(1, Number(q.get('page_size')) || 25);
        const start = (page - 1) * pageSize;

        return HttpResponse.json({
            count: filtered.length,
            next: start + pageSize < filtered.length ? page + 1 : null,
            previous: page > 1 ? page - 1 : null,
            results: filtered.slice(start, start + pageSize).map(toResponse),
        });
    })),

    http.get(`${API}/accounting/payment_bill/:id/`, withAuth(({ params }) => {
        const bill = findBill(loadSharedBills(), params.id);
        return bill ? HttpResponse.json(toResponse(bill)) : notFound();
    })),

    http.patch(`${API}/accounting/payment_bill/:id/`, withAuth(async ({ request, params }) => {
        const bills = loadSharedBills();
        const bill = findBill(bills, params.id);
        if (!bill) return notFound();

        const { customer_receipt_approved: value } = await request.json();
        if (!APPROVAL_VALUES.includes(value)) {
            return badRequest({ customer_receipt_approved: [`"${value}" is not a valid choice.`] });
        }
        if (APPROVAL_VALUES.includes(bill.customer_receipt_approved)) {
            return badRequest({ customer_receipt_approved: ['The payment has already been processed.'] });
        }

        bill.customer_receipt_approved = value;
        // an approved receipt means the money arrived: the bill is paid, as when the CRM approves it
        if (value === 'APPROVED' && bill.status !== 'PAID') {
            bill.status = 'PAID';
            bill.paid_datetime = nowIso();
        }
        // a declined receipt leaves an unpaid bill not paid, as when the CRM declines it
        if (value === 'DECLINED' && bill.status !== 'PAID') bill.status = 'NOT_PAID';
        saveSharedBills(bills);
        if (value === 'APPROVED') {
            const orders = loadSharedOrders();
            if (updatePaidStatus(orders, bill.order_id, bills)) saveSharedOrders(orders);
        }
        return HttpResponse.json(toResponse(bill));
    })),
];
