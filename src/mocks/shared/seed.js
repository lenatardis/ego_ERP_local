// Seed data shared by the ERP and CRM demos — ONE FILE, KEPT IDENTICAL IN BOTH REPOS:
//   ego_ERP_local/src/mocks/shared/seed.js  ==  ego_CRM_local/src/mocks/shared/seed.js
// Edit it in one repo, copy it to the other and run `node scripts/check-shared-seed.mjs` (in either repo).
// See ../../CLAUDE.md of the workspace, "Cross-app contract".
//
// Collections shared by both apps (stored under `ego-demo:shared:` once changed):
//   SEED_ORDERS        — CRM orders (full CRM shape; the CRM owns them), payment embedded
//   SEED_CUSTOMERS     — their customers
//   SEED_PAYMENT_BILLS — payment bills of the orders ("рахунки")
// Reference data: SEED_MANAGERS (CRM demo users), SEED_SOURCES (order sources, owned by the ERP — same ids
// and names as the ERP's pricelists.js), and the ERP-private bank statement lines SEED_PRIVAT_PAYMENTS /
// SEED_PRIVAT_ACCOUNTS. The statement lines are generated here, in the same PRNG stream as the orders and
// bills they pay, so that every id and value stays exactly as the ERP demo had it before the split;
// the CRM ignores them.
//
// Environment-neutral on purpose (CRA and Vite): no bundler globals. Demo assets are stored as paths
// relative to the app's base URL (`demo/...`) — resolve them with resolveDemoAsset() when building a response.

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
                customer: spec.customer,
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
    const billSum = bills.reduce((sum, b) => sum + Number(b.prepayment_amount), 0);
    // a prepaid order without its "on delivery" bill yet: the rest is still to be billed
    const isOpenPrepayment = bills.length === 1 && bills[0].method === 'PREPAYMENT';
    const finalAmount = isOpenPrepayment ? billSum + ordInt(70, 450) * 10 : billSum;

    // discounts: Payment.jsx / DiscountField.jsx — PERC is a percentage, VAL an amount in UAH
    let discount_type = 'NONE';
    let discount_amount = 0;
    let amount = finalAmount;
    const discountRoll = randOrd();
    if (discountRoll < 0.12) {
        discount_type = 'PERC';
        discount_amount = ordPick([5, 10]);
        amount = Math.round(finalAmount / (1 - discount_amount / 100));
    } else if (discountRoll < 0.2) {
        discount_type = 'VAL';
        discount_amount = ordPick([100, 150, 200]);
        amount = finalAmount + discount_amount;
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
            amount: money(amount),
            final_amount: money(finalAmount),
            discount_type,
            discount_amount,
            post_paid_amount: null,
            receipt_url: null,
        },
    };
});

export const SEED_PAYMENT_BILLS = seed.paymentBills;
export const SEED_PRIVAT_PAYMENTS = seed.payments;
