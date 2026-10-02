// Seed data for the "Взаєморозрахунок з постачальниками" page (the original backend is unavailable).
// Record shapes mirror the original API, as consumed by PaymentForVendors.jsx and NewVendorPayment.jsx;
// served by src/mocks/handlers/vendorPayments.js. Vendors and arrivals are stored by id and expanded
// into nested objects when a response is built.
// Data is generated with a seeded PRNG so it is identical on every reload.

import { mulberry32 } from './fabrics';
import { money } from './vendors';
import { DEMO_FABRIC_ARRIVALS } from './fabricArrivals';

const rand = mulberry32(14092026);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const COMPANY_IBANS = [
    'UA213052990000026007015012345',
    'UA903204780000026000924401234',
];
const CASH_DESKS = ['Каса №1 (склад)', 'Каса №2 (офіс)'];
// "Інше" payments go from company cards
const COMPANY_CARDS = ['Картка ФОП 5375 41** **** 2817', 'Картка 4149 60** **** 0934'];
const PAYERS = [
    'Бондар Ірина',
    'Демченко Олександр',
    'ФОП Демченко О.В.',
    'Савчук Петро',
    'Коваль Марина',
    'Гнатюк Юрій',
    'Мороз Катерина',
    'ФОП Коваль М.С.',
];
const COMMENTS = [
    '',
    '',
    'Оплата згідно з рахунком',
    'Доплата',
    'Оплата за тканину, повний розрахунок',
];

// UA + 2 check digits + 6-digit bank code + 19-digit account = 29 characters
const randomIban = () => `UA${randInt(10, 99)}${randInt(300000, 399999)}000002600${randInt(1e9, 9e9)}`;

// every vendor has one account that receives all of its payments (bank, cash desk deposit or other)
const vendorIbans = {};
const vendorIban = (vendorId) => (vendorIbans[vendorId] ??= randomIban());

const pad = (n) => String(n).padStart(2, '0');
const toIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromBackendDate = (s) => {
    const [d, m, y] = s.split('.').map(Number);
    return new Date(y, m - 1, d);
};

// 1–3 payments per arrival, paid in the weeks after it; recent arrivals are more often still unpaid
const buildPayments = () => {
    const payments = [];

    DEMO_FABRIC_ARRIVALS.forEach((arrival, index) => {
        const isRecent = index >= DEMO_FABRIC_ARRIVALS.length - 5;
        const count = randInt(1, 3);
        const totalUsd = Number(arrival.usd_amount);
        let remainingUsd = totalUsd;

        for (let k = 0; k < count && remainingUsd > 0; k++) {
            const isLast = k === count - 1;
            const usd = isLast ? remainingUsd : Math.round((totalUsd / count) * (0.8 + rand() * 0.4));
            remainingUsd = Math.max(0, remainingUsd - usd);

            const source = rand() < 0.7 ? 'BANK' : rand() < 0.85 ? 'CASH' : 'OTHER';
            const rate = Number(arrival.exchange_rate) + randInt(-15, 25) / 100;
            const opDate = new Date(fromBackendDate(arrival.arrival_date).getTime() + randInt(k * 5, k * 5 + 6) * 86400000);

            const statusRoll = rand();
            const status = isRecent
                ? (statusRoll < 0.4 ? 'UNPAID' : statusRoll < 0.75 ? 'WAIT_FOR_PAY' : 'PAID')
                : (statusRoll < 0.85 ? 'PAID' : 'WAIT_FOR_PAY');

            payments.push({
                source,
                operation_date: toIsoDate(opDate),
                payer_account: pick(source === 'BANK' ? COMPANY_IBANS : source === 'CASH' ? CASH_DESKS : COMPANY_CARDS),
                recipient_account: vendorIban(arrival.vendor_id),
                payer: pick(PAYERS),
                vendor_id: arrival.vendor_id,
                fabric_arrival_id: arrival.id,
                status,
                document: null,
                uah_amount: money(usd * rate),
                usd_amount: money(usd),
                exchange_rate: rate.toFixed(2),
                comment: pick(COMMENTS),
            });
        }
    });

    // ids and created timestamps follow the operation date, like records entered as payments happen
    return payments
        .sort((a, b) => a.operation_date.localeCompare(b.operation_date))
        .map((p, i) => ({
            id: i + 1,
            ...p,
            created: `${p.operation_date}T${pad(9 + (i % 8))}:${pad((i * 7) % 60)}:00`,
            deleted_at: null,
        }));
};

export const DEMO_VENDOR_PAYMENTS = buildPayments();
