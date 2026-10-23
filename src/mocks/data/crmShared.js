// CRM orders, customers and payment bills, shared with the CRM demo (../../../CLAUDE.md, "Cross-app contract").
// They live once, in the CRM's record shape, under `ego-demo:shared:*` (src/mocks/db.js), and are re-read on every
// request because the CRM may change them in another tab. The ERP edits only two things on them: a bill's
// `customer_receipt_approved` ("CRM платежі") and a bill paid by a linked Privat payment ("Оплата замовлень");
// the Privat statement lines themselves stay ERP-private.
//
// Production status, shared the other way round: the ERP owns `production` ({ id, order_id, order_product_id, status },
// one record per manufacturing order, seeded from SEED_PRODUCTION) and updates it as its orders move through
// production; the CRM reads it (cart lines' "Статус виробництва", the delete guard).
//
// The ERP pages read orders as `crmOrders` rows ({ id, customer_id, customer, manager, created }, names as strings):
// that view is built here from the shared orders and customers instead of being stored.

import { getSharedCollection, saveSharedCollection } from '../db';
import {
    SEED_CUSTOMERS, SEED_MANAGERS, SEED_ORDERS, SEED_PAYMENT_BILLS, SEED_PRODUCTION, crmStatusOfProduction, resolveDemoAsset,
    toIso,
} from '../shared/seed';

export const loadSharedOrders = () => getSharedCollection('orders', SEED_ORDERS);
export const saveSharedOrders = (orders) => saveSharedCollection('orders', orders);
export const loadSharedCustomers = () => getSharedCollection('customers', SEED_CUSTOMERS);
export const loadSharedBills = () => getSharedCollection('paymentBills', SEED_PAYMENT_BILLS);
export const saveSharedBills = (bills) => saveSharedCollection('paymentBills', bills);

export const nowIso = () => toIso(new Date());

const customerName = (c) => (c ? `${c.last_name} ${c.first_name} ${c.middle_name}` : '');
const managerName = (id) => {
    const m = SEED_MANAGERS.find((x) => x.id === id);
    return m ? `${m.last_name} ${m.first_name}` : '';
};

/** The ERP's `crmOrders` rows, keyed by order id. */
export const loadCrmOrderViews = () => {
    const customers = new Map(loadSharedCustomers().map((c) => [c.id, c]));
    return new Map(loadSharedOrders().map((o) => [o.id, {
        id: o.id,
        customer_id: o.customer_id,
        customer: customerName(customers.get(o.customer_id)),
        manager: managerName(o.manager_id),
        created: o.created,
    }]));
};

/** Stored demo asset paths (`demo/...`) as URLs of this app. */
export const resolveBillAssets = (bill) => ({
    ...bill,
    customer_receipt: resolveDemoAsset(bill.customer_receipt, import.meta.env.BASE_URL),
});

/**
 * An order is paid once all its bills are paid and they cover its total — the same rule the CRM applies after a
 * receipt approval or an online payment (ego_CRM_local src/mocks/data/orders.js updatePaidStatus).
 * Changes the order in `orders`; returns true when it did.
 */
export const updatePaidStatus = (orders, orderId, bills) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order?.payment || order.payment.status === 'PAID') return false;
    const own = bills.filter((b) => b.order_id === orderId);
    const paid = own.filter((b) => b.status === 'PAID').reduce((sum, b) => sum + Number(b.prepayment_amount), 0);
    if (!own.length || !own.every((b) => b.status === 'PAID') || paid < Number(order.payment.final_amount)) return false;
    order.payment.status = 'PAID';
    order.modified = nowIso();
    return true;
};

/**
 * The bill a Privat payment is linked to, or null. A link counts only while the bill still exists and carries this
 * payment (`payment_id`, set by the seed and by the link): a bill deleted in the CRM, or a new bill that later got
 * the same id, is not mistaken for the linked one. (The CRM refuses to delete paid bills, so this is a safety net.)
 */
export const linkedBillOf = (payment, bills) => {
    if (!payment.payment_bill_id) return null;
    const bill = bills.find((b) => b.id === payment.payment_bill_id);
    return bill && bill.payment_id === payment.payment_id ? bill : null;
};

/** Ids of the bills that have a Privat payment linked to them. */
export const linkedBillIds = (payments, bills) => new Set(payments.map((p) => linkedBillOf(p, bills)?.id).filter(Boolean));

const PRODUCTION_SEED = SEED_PRODUCTION.map(({ id, order_id, order_product_id, status }) => ({ id, order_id, order_product_id, status }));

/**
 * After a manufacturing order changed status: the shared production record follows, and the CRM order becomes
 * ready to ship once all its items are (an order in production that is now ready; nothing else is touched).
 */
export const syncProduction = (manufacturingOrder) => {
    const production = getSharedCollection('production', PRODUCTION_SEED);
    const record = production.find((p) => p.id === manufacturingOrder.id);
    if (!record || record.status === manufacturingOrder.status) return;
    record.status = manufacturingOrder.status;
    saveSharedCollection('production', production);

    const orders = loadSharedOrders();
    const order = orders.find((o) => o.id === record.order_id);
    if (!order || order.status !== 'IN_PRODUCTION') return;
    const items = production.filter((p) => p.order_id === order.id);
    if (items.every((p) => crmStatusOfProduction(p.status) !== 'IN_PRODUCTION')) {
        order.status = 'SHIPMENT_READY';
        order.modified = nowIso();
        saveSharedOrders(orders);
    }
};

