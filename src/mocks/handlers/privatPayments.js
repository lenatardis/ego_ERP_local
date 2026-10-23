import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toNumberOrNull, toBoolOrUndefined, notFound } from './utils';
import { getCollection, saveCollection } from '../db';
import { DEMO_PRIVAT_ACCOUNTS, DEMO_PRIVAT_PAYMENTS, CUSTOMER_CONTACT_URL } from '../data/privatPayments';
import {
    loadCrmOrderViews, loadSharedBills, loadSharedOrders, saveSharedBills, saveSharedOrders, updatePaidStatus,
} from '../data/crmShared';

// Response shapes follow the original API, as consumed by PaymentForOrders.jsx and PrivatPaymentInfo.jsx:
//   GET   /accounting/private                    -> { count, next, previous, results }  (table rows, 25 per page)
//   GET   /accounting/private/accounts           -> { results: [{ id, account }] }
//   GET   /accounting/private/:id/               -> payment with nested account and payment_bill
//   PATCH /accounting/private/:id/               -> { payment_bill } links the payment to a CRM bill
//   GET   /accounting/payment_bill/coincidence   -> CRM orders whose open bills may match a payment
// Accounts, bills and orders are stored by id and expanded here. Statement lines are ERP-private; bills, orders and
// customers are shared with the CRM demo and re-read on every request (see ../data/crmShared.js).
// Changes are persisted in the visitor's browser (see src/mocks/db.js).

const COLLECTION = 'privatPayments';
const PAGE_SIZE = 25;

// matching rules of the coincidence endpoint
const DATE_RANGE_HOURS = 72;
const AMOUNT_RANGE = 100;
const SIGNIFICANCE = { name_significance: 0.5, date_significance: 0.2, amount_significance: 0.3 };
const MAX_MATCHED_ORDERS = 10;

const payments = () => getCollection(COLLECTION, DEMO_PRIVAT_PAYMENTS);

const findPayment = (id) => payments().find((p) => p.id === Number(id));
const findAccount = (id) => DEMO_PRIVAT_ACCOUNTS.find((a) => a.id === id);

/** The shared bills and the ERP's view of the shared orders, read once per request. */
const loadShared = () => ({ bills: loadSharedBills(), orders: loadCrmOrderViews() });
const findBill = (shared, id) => shared.bills.find((b) => b.id === Number(id));

const pad = (n) => String(n).padStart(2, '0');
const toDDMMYYYY = (iso) => {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}.${m}.${y}`;
};
const toDDMMYYYYHHMM = (iso) => {
    // a bill made in the CRM has no date until the manager sets one
    if (!iso) return null;
    const d = new Date(iso);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** "dd.mm.yyyy" -> "yyyy-mm-dd", or null */
const fromDDMMYYYY = (s) => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s ?? '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** The CRM order a payment is linked to (through its bill), or null. */
const linkedOrder = (shared, payment) => {
    const bill = payment.payment_bill_id ? findBill(shared, payment.payment_bill_id) : null;
    return bill ? shared.orders.get(bill.order_id) ?? null : null;
};

const toRow = (shared, payment) => {
    const order = linkedOrder(shared, payment);
    return {
        id: payment.id,
        datetime: toDDMMYYYY(payment.datetime),
        // the "Рахунок" column holds the payer's account (IBAN), copied by the table's copy button
        order_url: payment.counterparty_iban,
        customer_url: order ? CUSTOMER_CONTACT_URL : null,
        account: findAccount(payment.account_id)?.account ?? '',
        amount: payment.amount,
        currency: payment.currency,
        manager: order?.manager ?? '',
        counterparty: payment.counterparty,
        assignment: payment.assignment,
        operation: payment.operation,
        money_type: payment.money_type,
        receipt_url: payment.receipt_url,
        comment: payment.comment,
        is_linked: Boolean(order),
    };
};

const toDetail = (shared, { account_id, payment_bill_id, ...payment }) => {
    const account = findAccount(account_id);
    const bill = payment_bill_id ? findBill(shared, payment_bill_id) : null;
    return {
        ...payment,
        account: account ? { id: account.id, iban: account.iban, full_name: account.full_name } : null,
        payment_bill: bill
            ? {
                id: bill.id,
                type: bill.type,
                method: bill.method,
                status: bill.status,
                prepayment_datetime: bill.prepayment_datetime,
                paid_datetime: bill.paid_datetime,
                prepayment_amount: bill.prepayment_amount,
                payment_id: bill.payment_id,
                order_id: bill.order_id,
            }
            : null,
    };
};

const includesCI = (value, needle) => String(value ?? '').toLowerCase().includes(needle);

// --- coincidence --------------------------------------------------------------------------------

const nameScore = (customer, payment) => {
    const haystack = `${payment.counterparty} ${payment.assignment}`.toLowerCase();
    const tokens = customer.toLowerCase().split(/\s+/).filter(Boolean);
    return tokens.length ? tokens.filter((t) => haystack.includes(t)).length / tokens.length : 0;
};

const findCoincidences = (shared, payment) => {
    const linkedBillIds = new Set(payments().map((p) => p.payment_bill_id).filter(Boolean));
    const paidAt = new Date(payment.datetime).getTime();
    const amount = Number(payment.amount);

    const byOrder = new Map();
    shared.bills.forEach((bill) => {
        if (bill.status === 'PAID' || linkedBillIds.has(bill.id)) return;
        const order = shared.orders.get(bill.order_id);
        if (!order) return;

        // a bill without a date (made in the CRM, not filled in yet) is matched by name and amount only
        const hours = bill.prepayment_datetime
            ? Math.abs(paidAt - new Date(bill.prepayment_datetime).getTime()) / 3600000
            : Infinity;
        const date = Math.max(0, 1 - hours / DATE_RANGE_HOURS);
        const sum = Math.max(0, 1 - Math.abs(amount - Number(bill.prepayment_amount)) / AMOUNT_RANGE);
        const name = nameScore(order.customer, payment);
        if (!((date > 0 && sum > 0) || name >= 0.67)) return;

        const similarity = Math.round(100 * (
            SIGNIFICANCE.name_significance * name +
            SIGNIFICANCE.date_significance * date +
            SIGNIFICANCE.amount_significance * sum
        ));
        if (!byOrder.has(order.id)) byOrder.set(order.id, []);
        byOrder.get(order.id).push({
            id: bill.id,
            type: bill.type,
            method: bill.method,
            status: bill.status,
            prepayment_amount: bill.prepayment_amount,
            prepayment_datetime: toDDMMYYYYHHMM(bill.prepayment_datetime),
            receipt_url: bill.receipt_url,
            similarity,
        });
    });

    return [...byOrder.entries()]
        .map(([orderId, matched]) => {
            const order = shared.orders.get(orderId);
            const orderBills = shared.bills.filter((b) => b.order_id === orderId);
            const paidCount = orderBills.filter((b) => b.status === 'PAID').length;
            return {
                order_id: orderId,
                customer: order.customer,
                paid_count: paidCount,
                unpaid_count: orderBills.length - paidCount,
                payment_bills: matched.sort((a, b) => b.similarity - a.similarity),
            };
        })
        .sort((a, b) => b.payment_bills[0].similarity - a.payment_bills[0].similarity)
        .slice(0, MAX_MATCHED_ORDERS);
};

const badRequest = (detail) => HttpResponse.json(detail, { status: 400 });

export const privatPaymentHandlers = [
    http.get(`${API}/accounting/private/accounts`, withAuth(() =>
        HttpResponse.json({
            results: DEMO_PRIVAT_ACCOUNTS.map(({ id, account }) => ({ id, account })),
        })
    )),

    http.get(`${API}/accounting/private`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const text = (key) => (isSet(q.get(key)) ? q.get(key).trim().toLowerCase() : '');

        const search = text('search');
        const counterparty = text('counterparty');
        const assignment = text('assignment');
        const account = q.get('account');
        const amount = toNumberOrNull(q.get('amount'));
        const operationType = q.get('operation_type');
        const moneyType = q.get('money_type');
        const isLinked = toBoolOrUndefined(q.get('is_linked'));
        const [from, to] = String(q.get('datetime_range') ?? '').split('-').map(fromDDMMYYYY);

        const shared = loadShared();
        const filtered = payments()
            // newest first: the statement is imported as payments come in
            .slice()
            .sort((a, b) => b.datetime.localeCompare(a.datetime) || b.id - a.id)
            .map((p) => ({ payment: p, row: toRow(shared, p) }))
            .filter(({ payment: p, row }) => {
                if (search && ![p.id, p.counterparty, p.assignment, p.amount, row.account, row.manager, p.comment]
                    .some((f) => includesCI(f, search))) return false;
                if (counterparty && !includesCI(p.counterparty, counterparty)) return false;
                if (assignment && !includesCI(p.assignment, assignment)) return false;
                if (isSet(account) && String(p.account_id) !== account) return false;
                if (amount != null && Number(p.amount) !== amount) return false;
                if (isSet(operationType) && p.operation !== operationType) return false;
                if (isSet(moneyType) && p.money_type !== moneyType) return false;
                if (isLinked !== undefined && row.is_linked !== isLinked) return false;
                const day = p.datetime.slice(0, 10);
                if (from && to && (day < from || day > to)) return false;
                return true;
            })
            .map(({ row }) => row);

        const page = Math.max(1, Number(q.get('page')) || 1);
        const start = (page - 1) * PAGE_SIZE;

        return HttpResponse.json({
            count: filtered.length,
            next: start + PAGE_SIZE < filtered.length ? page + 1 : null,
            previous: page > 1 ? page - 1 : null,
            results: filtered.slice(start, start + PAGE_SIZE),
        });
    })),

    http.get(`${API}/accounting/private/:id/`, withAuth(({ params }) => {
        const payment = findPayment(params.id);
        return payment ? HttpResponse.json(toDetail(loadShared(), payment)) : notFound();
    })),

    // links the payment to a CRM bill: the bill becomes paid by this payment, and its order is paid once all its
    // bills are (the CRM's rule, ../data/crmShared.js updatePaidStatus)
    http.patch(`${API}/accounting/private/:id/`, withAuth(async ({ request, params }) => {
        const payment = findPayment(params.id);
        if (!payment) return notFound();

        const { payment_bill: billId } = await request.json();
        const shared = loadShared();
        const bill = findBill(shared, billId);
        if (!bill) return badRequest({ payment_bill: [`Invalid pk "${billId}" - object does not exist.`] });
        if (payments().some((p) => p.payment_bill_id === bill.id && p.id !== payment.id)) {
            return badRequest({ payment_bill: ['This payment bill is already linked to another payment.'] });
        }

        payment.payment_bill_id = bill.id;
        bill.status = 'PAID';
        bill.paid_datetime = payment.datetime;
        bill.payment_id = payment.payment_id;
        saveCollection(COLLECTION);
        saveSharedBills(shared.bills);

        const orders = loadSharedOrders();
        if (updatePaidStatus(orders, bill.order_id, shared.bills)) saveSharedOrders(orders);

        const { order_url, customer_url } = toRow(shared, payment);
        return HttpResponse.json({ ...toDetail(shared, payment), order_url, customer_url, is_linked: true });
    })),

    http.get(`${API}/accounting/payment_bill/coincidence`, withAuth(({ request }) => {
        const payment = findPayment(new URL(request.url).searchParams.get('privatbank_payment_id'));
        if (!payment) return notFound();

        const results = findCoincidences(loadShared(), payment);
        return HttpResponse.json({
            count: results.length,
            results,
            similarity_ranges: { transaction_date_range: DATE_RANGE_HOURS, amount_range: AMOUNT_RANGE },
            significance_coefficients: SIGNIFICANCE,
        });
    })),
];
