// Seed data for fabric arrivals (the original backend is unavailable).
// Only the fields read by the vendor payment pages (NewVendorPayment.jsx arrival select,
// PaymentForVendors.jsx "document" column) and the ArrivalList.jsx cards are generated;
// served by src/mocks/handlers/fabricArrivals.js.
// Data is generated with a seeded PRNG so it is identical on every reload.

import { mulberry32 } from './fabrics';
import { DEMO_VENDORS, money } from './vendors';
import { DEMO_USERS } from './demoUsers';

const rand = mulberry32(31102025);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const ARRIVALS_COUNT = 20;

// USD cash rate: PrivatBank's on 09.10.2026 (api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5).
// Seed amounts are converted with it; CurrencyRateInfo shows today's live rate and falls back to this one
// (see src/mocks/handlers/fabricArrivals.js).
export const DEMO_USD_RATE = { buy: '44.50', sale: '45.10' };

const pad = (n) => String(n).padStart(2, '0');
// arrival_date uses the backend's DD.MM.YYYY format (see toBackendDate in IncomingArrivalFabric.jsx)
const toBackendDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

// Vendor payment forms list only the first page of vendors (newest 25), so arrivals use those vendors
const PAYABLE_VENDORS = DEMO_VENDORS.slice(-25);
const RECEIVERS = DEMO_USERS.filter((u) => ['demo_admin', 'demo_storage'].includes(u.username));

// one arrival every ~9 days, oldest first, ending in September 2026
const SEED_START = new Date(2026, 3, 1).getTime();
const SEED_STEP = 9 * 24 * 60 * 60 * 1000;

export const DEMO_FABRIC_ARRIVALS = Array.from({ length: ARRIVALS_COUNT }, (_, i) => {
    const vendor = pick(PAYABLE_VENDORS);
    const receiver = pick(RECEIVERS);
    // the hryvnia slowly weakens: ~43.6–44.2 in April, ~44.5–45.2 by the end of September
    const exchangeRate = 43.6 + i * 0.05 + randInt(0, 60) / 100;
    const usd = randInt(30, 900) * 5;

    return {
        id: i + 1,
        arrival_date: toBackendDate(new Date(SEED_START + i * SEED_STEP)),
        document_num: `РН-${String(1040 + i * 3 + randInt(0, 2)).padStart(5, '0')}`,
        vendor_id: vendor.id,
        receiver: {
            id: receiver.id,
            first_name: receiver.profile.first_name,
            last_name: receiver.profile.last_name,
        },
        uah_amount: money(usd * exchangeRate),
        usd_amount: money(usd),
        exchange_rate: exchangeRate.toFixed(2),
        comment: null,
        fabric_rolls: [],
        warehouse_item_units: [],
    };
});
