import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toBoolOrUndefined, notFound } from './utils';
import { getCollection, saveCollection } from '../db';
import { DEMO_PRIVAT_PAYMENTS, DEMO_CRM_ORDERS, DEMO_PAYMENT_BILLS } from '../data/privatPayments';

// Response shapes follow the original API, as consumed by PaymentForCRM.jsx and CRMPaymentInfo.jsx:
//   GET   /accounting/payment_bill/       -> { count, next, previous, results }  (table rows, page_size per page)
//   GET   /accounting/payment_bill/:id/   -> bill with order id, receipts and provider payment
//   PATCH /accounting/payment_bill/:id/   -> { customer_receipt_approved } — the accountant's decision, made once
// Bills are the same collection the "Оплата замовлень" page links Privat payments to (see privatPayments.js).
// Changes are persisted in the visitor's browser (see src/mocks/db.js).

const BILLS = 'paymentBills';
const APPROVAL_VALUES = ['APPROVED', 'DECLINED'];

const bills = () => getCollection(BILLS, DEMO_PAYMENT_BILLS);
const orders = () => getCollection('crmOrders', DEMO_CRM_ORDERS);
const payments = () => getCollection('privatPayments', DEMO_PRIVAT_PAYMENTS);

const findBill = (id) => bills().find((b) => b.id === Number(id));
const findOrder = (id) => orders().find((o) => o.id === id);

const toResponse = ({ order_id, ...bill }) => ({ ...bill, order: order_id });

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
        const linkedBillIds = new Set(payments().map((p) => p.payment_bill_id).filter(Boolean));

        const filtered = bills()
            // newest first: bill ids follow creation time
            .slice()
            .sort((a, b) => b.id - a.id)
            .filter((b) => {
                if (search && ![b.id, b.order_id, b.prepayment_amount, findOrder(b.order_id)?.customer]
                    .some((f) => includesCI(f, search))) return false;
                if (type && b.type !== type) return false;
                if (method && b.method !== method) return false;
                if (status && b.status !== status) return false;
                if (approved && b.customer_receipt_approved !== approved) return false;
                if (paidDate && b.paid_datetime?.slice(0, 10) !== paidDate) return false;
                if (isLinked !== undefined && linkedBillIds.has(b.id) !== isLinked) return false;
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
        const bill = findBill(params.id);
        return bill ? HttpResponse.json(toResponse(bill)) : notFound();
    })),

    http.patch(`${API}/accounting/payment_bill/:id/`, withAuth(async ({ request, params }) => {
        const bill = findBill(params.id);
        if (!bill) return notFound();

        const { customer_receipt_approved: value } = await request.json();
        if (!APPROVAL_VALUES.includes(value)) {
            return badRequest({ customer_receipt_approved: [`"${value}" is not a valid choice.`] });
        }
        if (APPROVAL_VALUES.includes(bill.customer_receipt_approved)) {
            return badRequest({ customer_receipt_approved: ['The payment has already been processed.'] });
        }

        bill.customer_receipt_approved = value;
        saveCollection(BILLS);
        return HttpResponse.json(toResponse(bill));
    })),
];
