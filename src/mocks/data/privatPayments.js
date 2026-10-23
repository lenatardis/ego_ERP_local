// Seed data for the "Оплата замовлень" and "CRM платежі" pages (the original backend is unavailable).
// Record shapes mirror the original API, as consumed by PaymentForOrders.jsx, PrivatPaymentInfo.jsx,
// PaymentForCRM.jsx and CRMPaymentInfo.jsx; served by src/mocks/handlers/privatPayments.js and crmPayments.js.
//
// Generated in src/mocks/shared/seed.js, together with the CRM demo (same file in both repos):
//   - privatPayments  — incoming PrivatBank statement lines (ERP side)
//   - crmOrders       — the ERP's view of the CRM orders the payments are for (customer and manager as names)
//   - paymentBills    — CRM payment bills of those orders; a payment linked to an order points to one bill

import {
    SEED_PRIVAT_ACCOUNTS,
    SEED_PRIVAT_PAYMENTS,
    SEED_ORDERS,
    SEED_CUSTOMERS,
    SEED_MANAGERS,
    SEED_PAYMENT_BILLS,
    CUSTOMER_CONTACT_URL,
    resolveDemoAsset,
} from '../shared/seed';

export { CUSTOMER_CONTACT_URL };

const customerName = (id) => {
    const c = SEED_CUSTOMERS.find((x) => x.id === id);
    return c ? `${c.last_name} ${c.first_name} ${c.middle_name}` : '';
};
const managerName = (id) => {
    const m = SEED_MANAGERS.find((x) => x.id === id);
    return m ? `${m.last_name} ${m.first_name}` : '';
};

export const DEMO_PRIVAT_ACCOUNTS = SEED_PRIVAT_ACCOUNTS;
export const DEMO_PRIVAT_PAYMENTS = SEED_PRIVAT_PAYMENTS;
export const DEMO_CRM_ORDERS = SEED_ORDERS.map((o) => ({
    id: o.id,
    customer_id: o.customer_id,
    customer: customerName(o.customer_id),
    manager: managerName(o.manager_id),
    created: o.created,
}));
export const DEMO_PAYMENT_BILLS = SEED_PAYMENT_BILLS.map((b) => ({
    ...b,
    customer_receipt: resolveDemoAsset(b.customer_receipt, import.meta.env.BASE_URL),
}));
