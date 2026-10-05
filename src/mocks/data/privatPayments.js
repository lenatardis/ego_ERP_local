// Seed data for the "Оплата замовлень" and "CRM платежі" pages (the original backend is unavailable).
// Record shapes mirror the original API, as consumed by PaymentForOrders.jsx, PrivatPaymentInfo.jsx,
// PaymentForCRM.jsx and CRMPaymentInfo.jsx; served by src/mocks/handlers/privatPayments.js and crmPayments.js.
//
// Three collections are generated together because they reference each other:
//   - privatPayments  — incoming PrivatBank statement lines (ERP side)
//   - crmOrders       — CRM orders the payments are for (CRM side)
//   - paymentBills    — CRM payment bills of those orders; a payment linked to an order points to one bill
// Orders and bills are CRM entities kept in their own collections so they can be shared with the CRM demo later.
// Data is generated with a seeded PRNG so it is identical on every reload.

import { mulberry32 } from './fabrics';
import { money, toIso } from './vendors';

const rand = mulberry32(28052026);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const digits = (n) => Array.from({ length: n }, () => randInt(0, 9)).join('');

// "Зв'язок з клієнтом" opened the customer's Instagram account; the demo has no real accounts,
// so every customer links to the Instagram start page.
export const CUSTOMER_CONTACT_URL = 'https://www.instagram.com/';
// payment receipts ("Чек") were bank pages; the demo links to the bank's start page
const RECEIPT_URL = 'https://www.monobank.ua/';

const iban = (mfo) => `UA${randInt(10, 99)}${mfo}00000${digits(14)}`;

// company accounts that receive the payments ("Отримувач")
export const DEMO_PRIVAT_ACCOUNTS = [
    { id: 1, full_name: 'Мирошник Вікторія Олегівна', iban: iban('305299') },
    { id: 2, full_name: 'Мирошник Андрій Петрович', iban: iban('305299') },
].map((a) => {
    const [surname, name] = a.full_name.split(' ');
    return { ...a, account: `${surname} ${name}` };
});

const BANKS = [
    ['305299', 'АТ КБ "ПРИВАТБАНК"', 'Дніпро'],
    ['305299', 'АТ КБ "ПРИВАТБАНК"', 'Дніпро'],
    ['322001', 'АТ "УНІВЕРСАЛ БАНК"', 'Київ'],
    ['322001', 'АТ "УНІВЕРСАЛ БАНК"', 'Київ'],
    ['300465', 'АТ "ОЩАДБАНК"', 'Київ'],
    ['380805', 'АТ "РАЙФФАЙЗЕН БАНК"', 'Київ'],
    ['351005', 'АТ "УКРСИББАНК"', 'Київ'],
    ['334851', 'АТ "ПУМБ"', 'Київ'],
];

const SURNAMES = [
    'Шевченко', 'Бойко', 'Коваленко', 'Ткачук', 'Кравець', 'Олійник', 'Мельничук', 'Гуменюк', 'Остапенко',
    'Федорчук', 'Яременко', 'Пасічник', 'Дорошенко', 'Карпенко', 'Романюк', 'Головко', 'Тарасюк', 'Слободян',
    'Гаврилюк', 'Довгань', 'Бабенко', 'Лозинська', 'Кушнір', 'Присяжнюк', 'Онищенко', 'Захарчук', 'Вакуленко',
    'Стельмах', 'Гончарук', 'Лещенко', 'Мартинюк', 'Сидоренко', 'Пилипчук', 'Литвиненко', 'Нестеренко',
];
const FEMALE = [
    ['Олена', 'Наталія', 'Ірина', 'Яна', 'Оксана', 'Людмила', 'Тетяна', 'Марія', 'Світлана', 'Катерина',
        'Юлія', 'Галина', 'Анна', 'Вікторія', 'Алла', 'Інна'],
    ['Володимирівна', 'Олександрівна', 'Петрівна', 'Іванівна', 'Миколаївна', 'Сергіївна', 'Василівна',
        'Андріївна', 'Михайлівна', 'Юріївна'],
];
const MALE = [
    ['Олександр', 'Андрій', 'Сергій', 'Дмитро', 'Іван', 'Василь', 'Олег', 'Микола', 'Юрій', 'Роман'],
    ['Іванович', 'Петрович', 'Олександрович', 'Миколайович', 'Васильович', 'Сергійович'],
];
// "-ська" surnames are female-only in this list
const toMale = (surname) => surname.replace(/ська$/, 'ський');

const makePerson = (id) => {
    const female = rand() < 0.8;
    const [names, patronymics] = female ? FEMALE : MALE;
    const surname = female ? pick(SURNAMES) : toMale(pick(SURNAMES));
    const name = pick(names);
    const patronymic = pick(patronymics);
    const [mfo, mfo_name, mfo_city] = pick(BANKS);
    return {
        id,
        surname,
        full_name: `${surname} ${name} ${patronymic}`,
        initials: `${surname} ${name[0]}.${patronymic[0]}.`,
        crf: digits(10),
        mfo,
        mfo_name,
        mfo_city,
        iban: iban(mfo),
    };
};

const CUSTOMERS = Array.from({ length: 70 }, (_, i) => makePerson(1201 + i));
// people who sometimes pay for somebody else's order
const OTHER_PAYERS = Array.from({ length: 12 }, (_, i) => makePerson(9001 + i));

const MANAGERS = ['Литвин Дарина', 'Кошова Анастасія', 'Петренко Вадим', 'Семенюк Ольга'];

const AUTO_COMMENT = 'створено автоматично';

// assignment texts follow the formats seen in real PrivatBank statements
const assignmentFor = (payer, customer, moneyType) => {
    if (moneyType === 'CASH') return `Внесення готівки через термінал самообслуговування, ${customer.full_name}`;
    if (payer !== customer) return `Сплата за товар за ${customer.full_name}`;
    const roll = rand();
    if (roll < 0.35) return `Сплата за товар, без ПДВ ${customer.surname}, ${customer.full_name}`;
    if (roll < 0.6) return `Сплата за товар ${customer.full_name}`;
    if (roll < 0.85) return `Сплата за товар, ${customer.initials}, ${customer.full_name}`;
    return `${customer.surname} Платник ${customer.full_name.toUpperCase()}, код платника ${customer.crf}`;
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const SEED_START = new Date(2026, 5, 1).getTime();
const SEED_DAYS = 124; // up to early October 2026
const PAYMENTS_COUNT = 150;

const atWorkingTime = (dayStart) => new Date(dayStart + randInt(8 * 60, 21 * 60) * 60 * 1000 + randInt(0, 59) * 1000);
// Managers issue bills during working hours (08:00–21:59). A time outside them is moved by whole hours
// (minutes kept, no extra PRNG draws), so the rest of the seed stays the same:
//   'earlier' — to the previous evening (a bill issued before the payment stays before it);
//   'later'   — to the next morning.
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 21;
const toWorkingHours = (date, direction) => {
    const h = date.getHours();
    if (h >= WORK_START_HOUR && h <= WORK_END_HOUR) return date;
    const shifted = new Date(date);
    if (direction === 'earlier') {
        // 22–23 -> 20–21 the same day, 00–07 -> 14–21 the day before
        shifted.setHours(h > WORK_END_HOUR ? h - 2 : h - 10);
    } else {
        // 22–23 -> 08–09 the next day, 00–07 -> 08–15 the same day
        shifted.setHours(h > WORK_END_HOUR ? h + 10 : h + WORK_START_HOUR);
    }
    return shifted;
};

const amountPrepayment = () => pick([200, 200, 300, 300, 400, 500]);
const amountFull = () => randInt(70, 450) * 10;

const build = () => {
    const payments = [];
    const orders = []; // order specs: { created, customer, manager, bills: [bill specs] }

    const paymentDays = Array.from({ length: PAYMENTS_COUNT }, () => randInt(0, SEED_DAYS - 1)).sort((a, b) => a - b);

    paymentDays.forEach((dayIndex, i) => {
        const datetime = atWorkingTime(SEED_START + dayIndex * DAY);
        const isRecent = dayIndex >= SEED_DAYS - 14;
        const customer = pick(CUSTOMERS);
        const payer = rand() < 0.1 ? pick(OTHER_PAYERS) : customer;
        const money_type = rand() < 0.08 ? 'CASH' : 'NON_CASH';
        const isPrepayment = rand() < 0.45;
        const amount = isPrepayment ? amountPrepayment() : amountFull();
        const isRefunded = !isRecent && rand() < 0.02;
        const isLinked = !isRefunded && rand() < (isRecent ? 0.45 : 0.8);

        const payment = {
            id: 26801 + i,
            datetime: toIso(datetime),
            account_id: rand() < 0.75 ? 1 : 2,
            operation: 'INCOME',
            money_type,
            transaction_id: `${randInt(1, 9)}${digits(9)}`,
            num_doc: money_type === 'CASH' ? `@2PL${digits(6)}` : `${randInt(1, 9)}${digits(5)}`,
            payment_id: `${digits(4)}${String.fromCharCode(65 + randInt(0, 25))}${digits(7)}.P`,
            amount: money(amount),
            currency: 'UAH',
            course: null,
            counterparty: payer.full_name,
            counterparty_crf: payer.crf,
            counterparty_mfo: payer.mfo,
            counterparty_iban: payer.iban,
            counterparty_mfo_name: payer.mfo_name,
            counterparty_mfo_city: payer.mfo_city,
            assignment: assignmentFor(payer, customer, money_type),
            comment: isRefunded ? `${AUTO_COMMENT}; повернуто платнику` : AUTO_COMMENT,
            is_refunded: isRefunded,
            payment_bill_id: null,
            receipt_url: rand() < 0.5 ? RECEIPT_URL : null,
        };
        payments.push(payment);

        // ~20% of the not linked payments come without a bill in the CRM (nothing to match)
        if (!isLinked && rand() < 0.2) return;

        // the bill is issued up to two days before the customer pays it
        const billDate = toWorkingHours(new Date(datetime.getTime() - randInt(1, 48) * HOUR), 'earlier');
        // a not linked payment sometimes differs a little from its bill (fees, rounding)
        const billAmount = isLinked || rand() < 0.6 ? amount : amount + pick([-50, -20, -10, 10, 20, 50]);
        const bills = [{
            type: rand() < 0.85 ? 'IBAN' : 'ONLINE',
            method: isPrepayment ? 'PREPAYMENT' : 'FULL',
            status: isLinked ? 'PAID' : 'PAY_WAIT',
            prepayment_amount: money(billAmount),
            prepayment_datetime: toIso(billDate),
            paid_datetime: isLinked ? payment.datetime : null,
            payment_id: isLinked ? payment.payment_id : null,
            linkedPayment: isLinked ? payment : null,
        }];
        // the rest of a prepaid order is paid on delivery
        if (isPrepayment) {
            const delivered = !isRecent && rand() < 0.85;
            const paidAt = new Date(datetime.getTime() + randInt(3, 8) * DAY);
            bills.push({
                type: 'TAX',
                method: 'POSTPAID',
                status: delivered ? 'PAID' : 'PAY_WAIT',
                prepayment_amount: money(amountFull() + 500),
                prepayment_datetime: toIso(new Date(billDate.getTime() + 5 * DAY)),
                paid_datetime: delivered ? toIso(paidAt) : null,
                payment_id: null,
                linkedPayment: null,
            });
        }
        orders.push({ created: billDate, customer, manager: pick(MANAGERS), bills });
    });

    // orders whose customers haven't paid (yet): candidates that don't match any statement line
    for (let k = 0; k < 40; k++) {
        const created = atWorkingTime(SEED_START + randInt(0, SEED_DAYS - 1) * DAY);
        const isOld = created.getTime() < SEED_START + (SEED_DAYS - 21) * DAY;
        const isPrepayment = rand() < 0.5;
        orders.push({
            created,
            customer: pick(CUSTOMERS),
            manager: pick(MANAGERS),
            bills: [{
                type: rand() < 0.85 ? 'IBAN' : 'ONLINE',
                method: isPrepayment ? 'PREPAYMENT' : 'FULL',
                status: isOld && rand() < 0.7 ? 'NOT_PAID' : 'PAY_WAIT',
                prepayment_amount: money(isPrepayment ? amountPrepayment() : amountFull()),
                prepayment_datetime: toIso(toWorkingHours(new Date(created.getTime() + randInt(0, 24) * HOUR), 'later')),
                paid_datetime: null,
                payment_id: null,
                linkedPayment: null,
            }],
        });
    }

    // ids follow creation time, like records created as orders come in
    const crmOrders = [];
    const paymentBills = [];
    orders
        .sort((a, b) => a.created - b.created)
        .forEach((spec, i) => {
            const orderId = 4101 + i;
            crmOrders.push({
                id: orderId,
                customer_id: spec.customer.id,
                customer: spec.customer.full_name,
                manager: spec.manager,
                created: toIso(spec.created),
            });
            spec.bills.forEach(({ linkedPayment, ...bill }) => {
                const id = 7301 + paymentBills.length;
                paymentBills.push({ id, order_id: orderId, ...bill, receipt_url: null });
                if (linkedPayment) linkedPayment.payment_bill_id = id;
            });
        });

    return { payments, crmOrders, paymentBills };
};

const seed = build();

// --- CRM side of the bills ("CRM платежі", src/mocks/handlers/crmPayments.js) -------------------
// Fields the CRM page reads besides the ones above: the fiscal receipt of an online payment,
// the customer's own receipt (a transfer screenshot sent to the manager), the accountant's approval
// and the payment service invoice. Separate PRNG, so the statement / order data above stays the same.

const randCrm = mulberry32(5102026);
const crmInt = (min, max) => Math.floor(randCrm() * (max - min + 1)) + min;
const crmChars = (alphabet, n) => Array.from({ length: n }, () => alphabet[crmInt(0, alphabet.length - 1)]).join('');
const HEX = '0123456789abcdef';
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const uuid = () => [8, 4, 4, 4, 12].map((n) => crmChars(HEX, n)).join('-');

// fiscal receipts were Checkbox pages and invoices were Monobank pages: the demo links to their start pages
const FISCAL_RECEIPT_URL = 'https://checkbox.ua/';
const INVOICE_URL = 'https://www.monobank.ua/';
// customer receipts were uploaded files; the demo serves one sample image (public/demo/)
const CUSTOMER_RECEIPT_URL = `${window.location.origin}${import.meta.env.BASE_URL}demo/customer-receipt.svg`;

// bills paid during the last two weeks may still wait for the accountant
const RECENT_FROM = SEED_START + (SEED_DAYS - 14) * DAY;

const crmFields = (bill) => {
    const isPaid = bill.status === 'PAID';
    const isRecent = new Date(bill.paid_datetime ?? bill.prepayment_datetime).getTime() >= RECENT_FROM;

    // online payments go through the Monobank invoice; a paid one gets a fiscal receipt
    const provider_payment = bill.type === 'ONLINE'
        ? (() => {
            const order_id = `${bill.prepayment_datetime.slice(2, 10).replace(/-/g, '')}${crmChars(ALNUM, 14)}`;
            return { type: 'monobank', order_id, invoice_url: INVOICE_URL };
        })()
        : null;
    const receipt_id = bill.type === 'ONLINE' && isPaid ? uuid() : null;

    // transfers to the account: customers often send a screenshot of the payment
    const hasCustomerReceipt = bill.type === 'IBAN' && randCrm() < (isPaid ? 0.6 : bill.status === 'PAY_WAIT' ? 0.35 : 0.25);

    let customer_receipt_approved = null;
    if (isPaid) customer_receipt_approved = isRecent && randCrm() < 0.5 ? 'IN_PROC' : 'APPROVED';
    else if (bill.status === 'NOT_PAID' && hasCustomerReceipt) customer_receipt_approved = 'DECLINED';
    else if (hasCustomerReceipt) customer_receipt_approved = 'IN_PROC';

    return {
        receipt_id,
        receipt_url: receipt_id ? FISCAL_RECEIPT_URL : bill.receipt_url,
        customer_receipt: hasCustomerReceipt ? CUSTOMER_RECEIPT_URL : null,
        customer_receipt_approved,
        provider_payment,
    };
};

seed.paymentBills.forEach((bill) => Object.assign(bill, crmFields(bill)));

export const DEMO_PRIVAT_PAYMENTS = seed.payments;
export const DEMO_CRM_ORDERS = seed.crmOrders;
export const DEMO_PAYMENT_BILLS = seed.paymentBills;
