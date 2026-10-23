// Seed data shared by the ERP and CRM demos — ONE FILE, KEPT IDENTICAL IN BOTH REPOS:
//   ego_ERP_local/src/mocks/shared/seed.js  ==  ego_CRM_local/src/mocks/shared/seed.js
// Edit it in one repo, copy it to the other and run `node scripts/check-shared-seed.mjs` (in either repo).
// See ../../CLAUDE.md of the workspace, "Cross-app contract".
//
// Collections shared by both apps (stored under `ego-demo:shared:` once changed):
//   SEED_ORDERS        — CRM orders (full CRM shape; the CRM owns them), payment embedded
//   SEED_CUSTOMERS     — their customers
//   SEED_PAYMENT_BILLS — payment bills of the orders ("рахунки")
// SEED_ORDER_PRODUCTS — what each seed order contains (kits, warehouse items), priced from the shared catalog;
//   order totals, bills and bank statement lines are derived from it. The CRM stores it privately.
// SEED_PRODUCTION — the ERP's manufacturing orders: which CRM order and cart line each one makes, and its status;
//   the shared `production` collection (owned by the ERP) starts from it.
// Reference data: SEED_MANAGERS (CRM demo users), SEED_SOURCES (order sources, owned by the ERP — same ids
// and names as the ERP's pricelists.js), and the ERP-private bank statement lines SEED_PRIVAT_PAYMENTS /
// SEED_PRIVAT_ACCOUNTS. The statement lines are generated here, in the same PRNG stream as the orders and
// bills they pay, so that ids, dates and links stayed as the ERP demo had them before the split (amounts now
// follow the orders' carts); the CRM ignores them.
//
// Environment-neutral on purpose (CRA and Vite): no bundler globals. Demo assets are stored as paths
// relative to the app's base URL (`demo/...`) — resolve them with resolveDemoAsset() when building a response.
// Carts are priced from the catalog seed (./catalog/, also identical in both repos), whose only app-specific
// input is src/mocks/appBaseUrl.js.

import { DEMO_FABRICS } from './catalog/fabrics';
import { DEMO_PRODUCTS } from './catalog/products';
import { DEMO_KIT_OPTION_TEMPLATES, DEMO_KIT_TEMPLATES } from './catalog/calculatorTemplates';
import { fabricTotalLength, priceFor, priceWithDiscount, productTypeOfFabric } from './catalog/pricing';

export const mulberry32 = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pad = (n) => String(n).padStart(2, '0');
export const toIso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const money = (n) => n.toFixed(2);

/** A demo asset path (`demo/...`) as an absolute URL under the given app base URL (e.g. '/ego_CRM_local/'). */
export const resolveDemoAsset = (path, baseUrl) =>
    (path && path.startsWith('demo/') ? `${window.location.origin}${baseUrl.replace(/\/?$/, '/')}${path}` : path);

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
export const SEED_PRIVAT_ACCOUNTS = [
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
        name,
        patronymic,
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

// CRM demo users (ego_CRM_local/src/mocks/data/demoUsers.js); ids don't overlap with the ERP's demo users
export const SEED_MANAGERS = [
    { id: 21, username: 'demo_manager', first_name: 'Дарина', last_name: 'Литвин' },
    { id: 22, username: 'demo_manager2', first_name: 'Анастасія', last_name: 'Кошова' },
    { id: 23, username: 'demo_manager3', first_name: 'Вадим', last_name: 'Петренко' },
    { id: 24, username: 'demo_manager4', first_name: 'Ольга', last_name: 'Семенюк' },
];
const MANAGERS = SEED_MANAGERS;

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

// bill id -> { payment: its statement line, diff: bill amount - payment amount (fees, rounding) }
const BILL_PAYMENTS = new Map();

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
            // the statement line this bill is (or will be) paid by; its amount follows the bill (see below)
            paymentRef: payment,
            amountDiff: billAmount - amount,
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
                customer: spec.customer,
                manager: spec.manager,
                created: toIso(spec.created),
            });
            spec.bills.forEach(({ linkedPayment, paymentRef, amountDiff, ...bill }) => {
                const id = 7301 + paymentBills.length;
                paymentBills.push({ id, order_id: orderId, ...bill, receipt_url: null });
                if (linkedPayment) linkedPayment.payment_bill_id = id;
                if (paymentRef) BILL_PAYMENTS.set(id, { payment: paymentRef, diff: amountDiff });
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
// customer receipts were uploaded files; the demo serves one sample image (public/demo/ in both apps)
const CUSTOMER_RECEIPT_URL = 'demo/customer-receipt.svg';

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


// --- CRM orders and customers ------------------------------------------------------------------
// Fields the CRM reads besides the ones above (ego_CRM_local: Main/Order, OrderCreate, OrderStatus, Products):
// the customer's contacts, the order's source, flags and its payment (totals, discount, status).
// Separate PRNG, so everything above stays the same.

const randOrd = mulberry32(23102026);
const ordInt = (min, max) => Math.floor(randOrd() * (max - min + 1)) + min;
const ordPick = (arr) => arr[Math.floor(randOrd() * arr.length)];

// Order (lead) sources: owned by the ERP (ego_ERP_local/src/mocks/data/pricelists.js, SOURCE_SPECS) — same ids
// and names. `weight` (≈ the ERP's orders_count) only steers how often seed orders use a source;
// deleted sources (OLX) and those without orders are not used by seed orders.
export const SEED_SOURCES = [
    { id: 1, name: 'Viber-розсилка', weight: 12 },
    { id: 2, name: 'Сайт', weight: 214 },
    { id: 3, name: 'Інстаграм', weight: 167 },
    { id: 4, name: 'Facebook', weight: 48 },
    { id: 6, name: 'Rozetka', weight: 131 },
    { id: 7, name: 'Prom.ua', weight: 86 },
    { id: 8, name: 'Оптовий відділ', weight: 38 },
    { id: 10, name: 'Дропшипінг-партнери', weight: 6 },
];
const SOURCE_WEIGHT_TOTAL = SEED_SOURCES.reduce((sum, s) => sum + s.weight, 0);
const pickSource = () => {
    let roll = randOrd() * SOURCE_WEIGHT_TOTAL;
    return SEED_SOURCES.find((s) => (roll -= s.weight) < 0) ?? SEED_SOURCES[0];
};

const TRANSLIT = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i',
    й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh',
    ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '',
};
const translit = (s) => [...s.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join('');
const MOBILE_CODES = ['50', '66', '67', '68', '73', '93', '95', '96', '97', '98', '99'];
const NICK_STYLES = [
    (c) => `${translit(c.name)}_${translit(c.surname)}`,
    (c) => `${translit(c.name)}.${translit(c.surname)}${ordInt(1, 99)}`,
    (c) => `${translit(c.surname)}_${ordInt(1980, 2005)}`,
    (c) => `${translit(c.name)}${ordInt(10, 999)}`,
];

const ORDER_COMMENTS = [
    'Подарункове пакування',
    'Передзвонити перед відправкою',
    'Клієнтка просить фото готового комплекту',
    'Відправити разом із попереднім замовленням',
    'Без паперового чека в посилці',
    'Уточнити колір підковдри',
];

const SEED_END = SEED_START + SEED_DAYS * DAY;
const ageDays = (iso) => (SEED_END - new Date(iso).getTime()) / DAY;

// payment type as OrderStatus.jsx derives it from the bills (mapBillTypeToPaymentType / getPaymentTypeFromBills)
const BILL_TYPE_TO_PAYMENT_TYPE = { ONLINE: 'ONLINE', IBAN: 'REQ', TAX: 'POSTPAID' };
const paymentTypeOf = (bills) => {
    const [first, second] = bills;
    if (!first) return null;
    if (first.method === 'FULL' || !second) return BILL_TYPE_TO_PAYMENT_TYPE[first.type] ?? null;
    return BILL_TYPE_TO_PAYMENT_TYPE[second.type] ?? null;
};

const usedCustomers = new Map();
seed.crmOrders.forEach((o) => usedCustomers.set(o.customer.id, o.customer));

export const SEED_CUSTOMERS = [...usedCustomers.values()]
    .sort((a, b) => a.id - b.id)
    .map((c) => ({
        id: c.id,
        first_name: c.name,
        last_name: c.surname,
        middle_name: c.patronymic,
        phone: `+380${ordPick(MOBILE_CODES)}${Array.from({ length: 7 }, () => ordInt(0, 9)).join('')}`,
        username: ordPick(NICK_STYLES)(c),
        // no real accounts in the demo: the contact link is the Instagram start page (as in the ERP)
        url: CUSTOMER_CONTACT_URL,
    }));

const billsByOrder = new Map();
seed.paymentBills.forEach((b) => {
    if (!billsByOrder.has(b.order_id)) billsByOrder.set(b.order_id, []);
    billsByOrder.get(b.order_id).push(b);
});

export const SEED_ORDERS = seed.crmOrders.map((o, i) => {
    const bills = billsByOrder.get(o.id) ?? [];
    // a prepaid order without its "on delivery" bill yet: the rest is still to be billed.
    // (This draw sized the rest when totals came from the bills; kept so the draws below stay the same.)
    if (bills.length === 1 && bills[0].method === 'PREPAYMENT') ordInt(70, 450);

    // discounts: Payment.jsx / DiscountField.jsx — PERC is a percentage, VAL an amount in UAH.
    // The amounts themselves come from the order's cart (applyCartTotals below).
    let discount_type = 'NONE';
    let discount_amount = 0;
    const discountRoll = randOrd();
    if (discountRoll < 0.12) {
        discount_type = 'PERC';
        discount_amount = ordPick([5, 10]);
    } else if (discountRoll < 0.2) {
        discount_type = 'VAL';
        discount_amount = ordPick([100, 150, 200]);
    }

    let paymentStatus = 'PAY_WAIT';
    if (bills.some((b) => b.status === 'NOT_PAID')) paymentStatus = 'NOT_PAID';
    else if (bills.length && bills.every((b) => b.status === 'PAID')) paymentStatus = 'PAID';
    const somethingPaid = bills.some((b) => b.status === 'PAID');

    // production starts once something is paid; a prepaid order is paid off on delivery
    const age = ageDays(o.created);
    const productionRoll = randOrd();
    let status = 'NEW';
    if (paymentStatus === 'PAID') {
        if (age > 30 || (age > 14 && productionRoll < 0.6)) status = 'DELIVERED';
        else if (age > 7) status = 'SHIPMENT_READY';
        else status = 'IN_PRODUCTION';
    } else if (somethingPaid) {
        status = age > 7 ? 'SHIPMENT_READY' : 'IN_PRODUCTION';
    }

    const order_hash = Array.from({ length: 32 }, () => '0123456789abcdef'[ordInt(0, 15)]).join('');
    const is_immediate = randOrd() < 0.1;
    const is_favourite = randOrd() < 0.08;
    const comment = randOrd() < 0.25 ? ordPick(ORDER_COMMENTS) : null;
    const source = pickSource();

    return {
        id: o.id,
        created: o.created,
        modified: o.created,
        status,
        is_general: true,
        general_order_id: null,
        is_immediate,
        is_favourite,
        comment,
        order_hash,
        manager_id: o.manager.id,
        customer_id: o.customer.id,
        source_id: source.id,
        payment: {
            id: 5101 + i,
            status: paymentStatus,
            type: paymentTypeOf(bills),
            amount: null,
            final_amount: null,
            discount_type,
            discount_amount,
            post_paid_amount: null,
            receipt_url: null,
        },
    };
});

// --- production: the ERP's manufacturing orders and the CRM orders they belong to ----------------
// In the ERP a manufacturing order ("Замовлення" in production) is one kit or one warehouse item of a CRM order.
// SEED_PRODUCTION places the ERP's demo manufacturing orders (ego_ERP_local/src/mocks/data/manufacturing.js keeps
// their scenario details: who works on them, comments, what is sewn / packed) on CRM orders whose state fits:
// production starts once something is paid and after the order was taken; a delivered item belongs to a fully
// paid order. Such an order's cart is exactly its production item, and its status follows production:
// `IN_PRODUCTION` while an item is being made, then `SHIPMENT_READY`, `DELIVERED` (an order without production
// items is never `IN_PRODUCTION`). Deterministic, no PRNG: the data above stays the same.
//
// SEED_PRODUCTION records, newest first (the ERP's ids follow creation time, so the newest has the highest id):
//   { id, stage, status, created, order_id, order_product_id,
//     kit: { kit_template_id, fabric_id, option } | null, warehouse_item: { product_id, type_id } | null }
// `status` is the ERP's manufacturing status; the shared `production` collection starts from these records
// ({ id, order_id, order_product_id, status }) and the ERP updates it as orders move through production.

// the ERP's newest manufacturing order was created then; one about every 10 hours before it
export const PRODUCTION_NEWEST = new Date(2026, 9, 12, 16, 40).getTime();
const PRODUCTION_STEP = 10 * HOUR;

export const PRODUCTION_STAGES = ['awaitingCutting', 'onCut', 'awaitingSewing', 'onSewing', 'awaitingPackaging', 'onPackaging', 'shipmentReady', 'delivered'];
export const PRODUCTION_STAGE_STATUS = {
    awaitingCutting: 'AWAITING_CUTTING',
    onCut: 'ON_CUT',
    awaitingSewing: 'AWAITING_SEWING',
    onSewing: 'ON_SEWING',
    awaitingPackaging: 'AWAITING_PACKAGING',
    onPackaging: 'ON_PACKAGING',
    shipmentReady: 'SHIPMENT_READY',
    delivered: 'DELIVERED',
};
/** The CRM order status that a manufacturing status means (an order is ready once all its items are). */
export const crmStatusOfProduction = (status) =>
    (status === 'DELIVERED' ? 'DELIVERED' : status === 'SHIPMENT_READY' ? 'SHIPMENT_READY' : 'IN_PRODUCTION');

// what is made, newest first — kits by kit template (fabric: an in-stock fabric of the template's type),
// warehouse items by product name and variant index (the ERP's packaging scenarios depend on these products).
// Only what the CRM can sell: every kit, option and variant here has a price (kit template 1, the option
// "Прокладка" and a few variants the ERP's demo used before have none in the pricelists). "Подушка Бамбук" is
// out of stock on purpose: the packer finds nothing to pick.
const OPTION_GIFT = DEMO_KIT_OPTION_TEMPLATES[0].id; // Подарункове пакування
const OPTION_BAG = DEMO_KIT_OPTION_TEMPLATES[1].id; // Сумка-чохол
const PRODUCTION_ITEMS = [
    { stage: 'onCut', kit: 10 },
    { stage: 'onCut', kit: 12, option: [OPTION_BAG] },
    { stage: 'onCut', kit: 3 },
    { stage: 'awaitingCutting', kit: 11 },
    { stage: 'awaitingCutting', kit: 5 },
    { stage: 'awaitingCutting', kit: 16 },
    { stage: 'awaitingCutting', kit: 5 },
    { stage: 'awaitingCutting', kit: 27 },
    { stage: 'onSewing', kit: 10, option: [OPTION_BAG] },
    { stage: 'onSewing', kit: 12 },
    { stage: 'awaitingSewing', kit: 11 },
    { stage: 'awaitingSewing', kit: 3 },
    { stage: 'awaitingSewing', kit: 16 },
    { stage: 'onPackaging', kit: 10 },
    { stage: 'onPackaging', kit: 5, option: [OPTION_GIFT] },
    { stage: 'awaitingPackaging', kit: 5 },
    { stage: 'awaitingPackaging', kit: 27 },
    { stage: 'awaitingPackaging', kit: 12 },
    { stage: 'onPackaging', product: 'Ковдра Холофайбер' },
    { stage: 'onPackaging', product: 'Red Pillow' },
    { stage: 'onPackaging', product: 'Подушка Бамбук' },
    { stage: 'awaitingPackaging', product: 'Подушка Еко Пух', variant: 3 },
    { stage: 'awaitingPackaging', product: 'Ковдра Літня' },
    { stage: 'awaitingPackaging', product: 'Подушка Анатомічна' },
    { stage: 'shipmentReady', kit: 11 },
    { stage: 'shipmentReady', product: 'Подушка 4 сезони' },
    { stage: 'shipmentReady', kit: 5 },
    { stage: 'shipmentReady', product: 'Ковдра Дитяча' },
    { stage: 'shipmentReady', kit: 3 },
    { stage: 'delivered', kit: 10, option: [OPTION_GIFT] },
    { stage: 'delivered', product: 'Ковдра 4 сезони', variant: 2 },
    { stage: 'delivered', kit: 16 },
    { stage: 'delivered', product: 'Подушка Літня', variant: 1 },
    { stage: 'delivered', kit: 12 },
];

// fabrics the cutter can find rolls of ("Вибір тканини"), taken in turn for each fabric type
const IN_STOCK_FABRICS = DEMO_FABRICS.filter((f) => f.new_fabricrolls_remainder > 0 || f.opened_length_remainder > 0);
const fabricTurns = new Map();
const nextFabricOfType = (typeId) => {
    const fabrics = IN_STOCK_FABRICS.filter((f) => productTypeOfFabric(f) === typeId);
    if (!fabrics.length) throw new Error(`seed: no in-stock fabric of product type ${typeId}`);
    const turn = fabricTurns.get(typeId) ?? 0;
    fabricTurns.set(typeId, turn + 1);
    return fabrics[turn % fabrics.length];
};

/** The cart line of a production item, priced for the order's source, or null when the source has no price. */
const productionLine = (item, sourceId) => {
    if (item.kit) {
        const template = DEMO_KIT_TEMPLATES.find((t) => t.id === item.kit);
        const option = item.option ?? [];
        const parts = [priceFor('kit_template', template.id, sourceId), ...option.map((id) => priceFor('kit_option_template', id, sourceId))];
        if (parts.some((price) => price === null)) return null;
        return {
            warehouse_item: null,
            kit: {
                fabric_id: item.fabric_id,
                kit_template_id: template.id,
                is_split: false,
                price: parts.reduce((sum, price) => sum + price, 0),
                comment: null,
                custom_size: null,
                option,
                additional_fabric_consumption_count: Number(template.additional_fabric_consumption_price || 0) / 10,
                components: template.component_ids.map((id) => ({
                    component_template_id: id, option: [], comment: null, custom_size: null, mono_fabric_type: null, is_custom: false,
                })),
            },
        };
    }
    const price = priceFor('warehouse_item_type', item.type_id, sourceId);
    return price === null ? null : { warehouse_item: { product_id: item.product_id, type_id: item.type_id, price, source_id: sourceId }, kit: null };
};

const isPaidAtAll = (order) => (billsByOrder.get(order.id) ?? []).some((b) => b.status === 'PAID');

export const SEED_PRODUCTION = [];
const productionLines = new Map(); // order id -> the cart line it gets instead of a random one

{
    // newest paid orders first; each production item takes the newest one that fits
    const candidates = SEED_ORDERS.filter(isPaidAtAll).sort((a, b) => b.created.localeCompare(a.created));
    const used = new Set();
    PRODUCTION_ITEMS.forEach((spec, index) => {
        const item = { ...spec };
        if (spec.kit) {
            const template = DEMO_KIT_TEMPLATES.find((t) => t.id === spec.kit);
            item.fabric_id = nextFabricOfType(template.fabric_type_id).id;
        } else {
            const product = DEMO_PRODUCTS.find((p) => p.name === spec.product);
            item.product_id = product.id;
            item.type_id = product.types[spec.variant ?? 0].id;
        }
        const created = PRODUCTION_NEWEST - index * PRODUCTION_STEP;
        const order = candidates.find((o) => !used.has(o.id)
            // taken at least a day before production started
            && new Date(o.created).getTime() < created - 3 * HOUR - DAY
            && (spec.stage !== 'delivered' || o.payment.status === 'PAID')
            && productionLine(item, o.source_id) !== null);
        if (!order) throw new Error(`seed: no CRM order fits production item ${index}`);
        used.add(order.id);
        productionLines.set(order.id, productionLine(item, order.source_id));
        SEED_PRODUCTION.push({
            id: PRODUCTION_ITEMS.length - index,
            stage: spec.stage,
            status: PRODUCTION_STAGE_STATUS[spec.stage],
            created: toIso(new Date(created)),
            order_id: order.id,
            order_product_id: null, // set with the carts below
            kit: spec.kit ? { kit_template_id: spec.kit, fabric_id: item.fabric_id, option: spec.option ?? [] } : null,
            warehouse_item: spec.kit ? null : { product_id: item.product_id, type_id: item.type_id },
        });
        order.status = crmStatusOfProduction(PRODUCTION_STAGE_STATUS[spec.stage]);
    });
    // an order without production items is not being made
    SEED_ORDERS.forEach((o) => {
        if (o.status === 'IN_PRODUCTION' && !used.has(o.id)) o.status = 'SHIPMENT_READY';
    });
}

// --- carts of the seed orders and the money that follows from them ----------------------------
// What each seed order contains (CRM "Товар": warehouse items and kits), priced the way the CRM prices them
// for the order's source (./catalog/pricing.js). The order total is the cart total; its bills and the bank
// statement lines that pay them follow from it, so the numbers agree everywhere. Separate PRNG, so the data
// above (ids, dates, people, statuses) stays the same.
//
// SEED_ORDER_PRODUCTS records (the CRM keeps them in its private store, `ego-demo:crm:orderProducts`):
//   { id, order_id, created, warehouse_item: { product_id, type_id, price, source_id } | null,
//     kit: { fabric_id, kit_template_id, is_split, price, comment, custom_size, option, additional_fabric_consumption_count,
//            components: [{ component_template_id, option, comment, custom_size, mono_fabric_type, is_custom }] } | null }
// A kit's price is its template price plus its options — what the CRM calculator charges for the same kit.

const randCart = mulberry32(24102026);
const cartPick = (arr) => arr[Math.floor(randCart() * arr.length)];

const KIT_FABRICS = DEMO_FABRICS.filter((f) => productTypeOfFabric(f) && fabricTotalLength(f) > 0);
const STOCK_VARIANTS = DEMO_PRODUCTS.flatMap((p) => p.types.filter((t) => t.quantity > 0).map((t) => ({ product: p, type: t })));

const makeKitLine = (sourceId) => {
    // a fabric whose kits have a price for this source (most do; retry a few fabrics otherwise)
    for (let attempt = 0; attempt < 10; attempt++) {
        const fabric = cartPick(KIT_FABRICS);
        const templates = DEMO_KIT_TEMPLATES.filter((t) => t.fabric_type_id === productTypeOfFabric(fabric)
            && priceFor('kit_template', t.id, sourceId) !== null);
        if (!templates.length) continue;
        const template = cartPick(templates);
        const pricedOptions = DEMO_KIT_OPTION_TEMPLATES.filter((opt) => priceFor('kit_option_template', opt.id, sourceId) !== null);
        const option = pricedOptions.length && randCart() < 0.2 ? [cartPick(pricedOptions).id] : [];
        const price = priceFor('kit_template', template.id, sourceId)
            + option.reduce((sum, id) => sum + priceFor('kit_option_template', id, sourceId), 0);
        return {
            warehouse_item: null,
            kit: {
                fabric_id: fabric.id,
                kit_template_id: template.id,
                is_split: false,
                price,
                comment: null,
                custom_size: null,
                option,
                additional_fabric_consumption_count: Number(template.additional_fabric_consumption_price || 0) / 10,
                components: template.component_ids.map((id) => ({
                    component_template_id: id, option: [], comment: null, custom_size: null, mono_fabric_type: null, is_custom: false,
                })),
            },
        };
    }
    return null;
};

const makeWarehouseLine = (sourceId) => {
    for (let attempt = 0; attempt < 10; attempt++) {
        const { product, type } = cartPick(STOCK_VARIANTS);
        const price = priceFor('warehouse_item_type', type.id, sourceId);
        if (price !== null) {
            return { warehouse_item: { product_id: product.id, type_id: type.id, price, source_id: sourceId }, kit: null };
        }
    }
    return null;
};

export const SEED_ORDER_PRODUCTS = [];

const lineTotal = (line) => (line.kit ? line.kit.price : line.warehouse_item.price);

SEED_ORDERS.forEach((order) => {
    // mostly bedding: one kit, sometimes two; now and then a pillow / blanket from the warehouse too,
    // and some orders are warehouse items only
    const lines = [];
    const roll = randCart();
    if (roll < 0.15) {
        lines.push(makeWarehouseLine(order.source_id));
        if (randCart() < 0.3) lines.push(makeWarehouseLine(order.source_id));
    } else {
        lines.push(makeKitLine(order.source_id));
        if (roll > 0.8) lines.push(makeKitLine(order.source_id));
        if (randCart() < 0.2) lines.push(makeWarehouseLine(order.source_id));
    }
    // an order in production holds exactly its production item (the draws above still run, so that the other
    // orders' carts stay the same)
    const production = productionLines.get(order.id);
    (production ? [production] : lines.filter(Boolean)).forEach((line) => SEED_ORDER_PRODUCTS.push({
        id: SEED_ORDER_PRODUCTS.length + 1,
        order_id: order.id,
        created: order.created,
        ...line,
    }));
    if (production) SEED_PRODUCTION.find((p) => p.order_id === order.id).order_product_id = SEED_ORDER_PRODUCTS.length;
});

// order totals from the carts, then the bills and the statement lines that pay them
SEED_ORDERS.forEach((order) => {
    const total = SEED_ORDER_PRODUCTS.filter((p) => p.order_id === order.id).reduce((sum, p) => sum + lineTotal(p), 0);
    const finalAmount = priceWithDiscount(total, order.payment.discount_type, order.payment.discount_amount);
    order.payment.amount = money(total);
    order.payment.final_amount = money(finalAmount);

    // a full payment bills the whole order; a prepayment keeps its deposit and the "on delivery" bill takes the rest
    const bills = billsByOrder.get(order.id) ?? [];
    const prepaid = bills.filter((b) => b.method === 'PREPAYMENT').reduce((sum, b) => sum + Number(b.prepayment_amount), 0);
    bills.forEach((bill) => {
        if (bill.method === 'FULL') bill.prepayment_amount = money(finalAmount);
        if (bill.method === 'POSTPAID') bill.prepayment_amount = money(finalAmount - prepaid);
        const link = BILL_PAYMENTS.get(bill.id);
        if (link) link.payment.amount = money(Number(bill.prepayment_amount) - link.diff);
    });
});

export const SEED_PAYMENT_BILLS = seed.paymentBills;
export const SEED_PRIVAT_PAYMENTS = seed.payments;
