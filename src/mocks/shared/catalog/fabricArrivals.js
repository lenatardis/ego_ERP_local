// Seed data for arrivals (Надходження) of fabrics and finished products (the original backend is unavailable).
// Read by ArrivalList.jsx, IncomingArrivalFabric.jsx / IncomingArrivalProduct.jsx (with their editable tables),
// NewVendorPayment.jsx (arrival select) and PaymentForVendors.jsx ("document" column);
// served by src/mocks/handlers/fabricArrivals.js.
// Data is generated with a seeded PRNG so it is identical on every reload.
//
// An arrival is stored with ids only (vendor, receiver, fabrics, products, cells) and expanded by the handler:
//   fabric_lines  -> `fabric_rolls`: one line per fabric / length / cell; `ids` are the storage rolls it brought
//   product_lines -> `warehouse_item_units`: one line per product variant / cell; `unit_id` is the storage unit
// The goods of the seed arrivals are part of the storage seed: their rolls / units are appended to
// DEMO_FABRIC_ROLLS / DEMO_PRODUCTS below, so the storage pages show them and editing an arrival changes them.

import { mulberry32, DEMO_FABRICS, DEMO_FABRIC_ROLLS, recountFabricRemainders } from './fabrics';
import { DEMO_PRODUCTS } from './products';
import { DEMO_VENDORS, money } from './vendors';
import { DEMO_USERS } from './demoUsers';
import { FABRIC_CELLS, PRODUCT_CELLS, STANDARD_LENGTHS, rollCellRef, unitCellRef } from './warehouse';

const rand = mulberry32(31102025);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// separate PRNG for the arrival lines, so vendors / dates / rates above keep their sequence
const randLines = mulberry32(14102026);
const lineInt = (min, max) => Math.floor(randLines() * (max - min + 1)) + min;
const linePick = (arr) => arr[Math.floor(randLines() * arr.length)];

const ARRIVALS_COUNT = 20;

// USD cash rate: PrivatBank's on 09.10.2026 (api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5).
// CurrencyRateInfo shows today's live rate and falls back to this one (see src/mocks/handlers/fabricArrivals.js).
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

// Same rounding as the arrival tables (toMoney): prices in UAH follow the USD price × the arrival's rate,
// row sums are quantity × price (× roll length), so the document sums match "Перевірка суми".
export const toMoney = (n) => Number(Number(n).toFixed(2));

// every third arrival brings finished products, the others fabric rolls
const isProductArrival = (index) => index % 3 === 2;

const COMMENTS = [null, null, null, 'Частина рулонів з дефектом кромки, узгоджено знижку', 'Доставка Новою поштою', null, 'Передоплата 50%'];
const ESTIMATES = [null, null, 'Кошторис на сезон', null, 'Закупівля під осінній сезон'];

// ---- Goods of the seed arrivals (appended to the storage seed) ----

const IN_STOCK_FABRICS = DEMO_FABRICS.filter((f) => DEMO_FABRIC_ROLLS[f.id]?.length);
const IN_STOCK_VARIANTS = DEMO_PRODUCTS.flatMap((product) =>
    product.types.filter((t) => t.units.length).map((type) => ({ product, type })));

let nextRollId = Math.max(0, ...Object.values(DEMO_FABRIC_ROLLS).flat().map((r) => r.id)) + 1;
let nextUnitId = Math.max(0, ...DEMO_PRODUCTS.flatMap((p) => p.types.flatMap((t) => t.units.map((u) => u.id)))) + 1;

const makeFabricLines = (rate) => {
    const fabricsUsed = new Set();
    return Array.from({ length: lineInt(1, 4) }, () => {
        let fabric;
        do fabric = linePick(IN_STOCK_FABRICS); while (fabricsUsed.has(fabric.id));
        fabricsUsed.add(fabric.id);

        const quantity = lineInt(1, 5);
        const isCustom = randLines() < 0.2;
        const standard = linePick(STANDARD_LENGTHS);
        const length = isCustom ? lineInt(30, 60) / 2 : standard.length; // custom: 15–30 m
        const cell = linePick(FABRIC_CELLS);
        const priceUsd = lineInt(250, 750) / 100;

        const ids = Array.from({ length: quantity }, () => {
            const roll = { id: nextRollId++, fabric: fabric.id, status: 'NEW', current_length: length, cell: rollCellRef(cell) };
            DEMO_FABRIC_ROLLS[fabric.id].push(roll);
            return roll.id;
        });

        return {
            fabric_id: fabric.id,
            quantity,
            initial_length: isCustom ? null : standard.id,
            initial_custom_length: isCustom ? length : null,
            price_usd: priceUsd,
            price_uah: toMoney(priceUsd * rate),
            cell_id: cell.id,
            ids,
        };
    });
};

const makeProductLines = (rate) => {
    const variantsUsed = new Set();
    return Array.from({ length: lineInt(1, 4) }, () => {
        let found;
        do found = linePick(IN_STOCK_VARIANTS); while (variantsUsed.has(found.type.id));
        variantsUsed.add(found.type.id);

        const { product, type } = found;
        const quantity = lineInt(4, 16);
        const cell = linePick(PRODUCT_CELLS);
        const area = (type.size.width * type.size.length) / 10000;
        const priceUsd = toMoney((product.category.id === 2 ? 3 + area * 14 : 6 + area * 5) + lineInt(-50, 50) / 100);

        const unit = { id: nextUnitId++, current_quantity: quantity, cell: unitCellRef(cell) };
        type.units.push(unit);
        type.quantity += quantity;

        return {
            unit_id: unit.id,
            template_id: product.id,
            color_id: type.color.id,
            size_id: type.size.id,
            quantity,
            price_usd: priceUsd,
            price_uah: toMoney(priceUsd * rate),
            cell_id: cell.id,
        };
    });
};

const STANDARD_LENGTH_BY_ID = Object.fromEntries(STANDARD_LENGTHS.map((s) => [s.id, s.length]));

/** Row sums as the arrival tables compute them. */
export const fabricLineSums = (line) => {
    const length = line.initial_custom_length ?? STANDARD_LENGTH_BY_ID[line.initial_length] ?? 0;
    return {
        uah: toMoney(line.quantity * line.price_uah * length),
        usd: toMoney(line.quantity * line.price_usd * length),
    };
};

export const productLineSums = (line) => ({
    uah: toMoney(line.quantity * line.price_uah),
    usd: toMoney(line.quantity * line.price_usd),
});

export const standardLengthOf = (id) => STANDARD_LENGTH_BY_ID[id] ?? null;

export const DEMO_FABRIC_ARRIVALS = Array.from({ length: ARRIVALS_COUNT }, (_, i) => {
    const vendor = pick(PAYABLE_VENDORS);
    const receiver = pick(RECEIVERS);
    // the hryvnia slowly weakens: ~43.6–44.2 in April, ~44.5–45.2 by the end of September
    const exchangeRate = Number((43.6 + i * 0.05 + randInt(0, 60) / 100).toFixed(2));
    rand(); // former document amount draw: keeps the PRNG sequence (amounts now follow the lines)

    const fabricLines = isProductArrival(i) ? [] : makeFabricLines(exchangeRate);
    const productLines = isProductArrival(i) ? makeProductLines(exchangeRate) : [];
    const sums = [...fabricLines.map(fabricLineSums), ...productLines.map(productLineSums)];

    return {
        id: i + 1,
        arrival_date: toBackendDate(new Date(SEED_START + i * SEED_STEP)),
        document_num: `РН-${String(1040 + i * 3 + randInt(0, 2)).padStart(5, '0')}`,
        vendor_id: vendor.id,
        receiver_id: receiver.id,
        uah_amount: money(sums.reduce((s, x) => s + x.uah, 0)),
        usd_amount: money(sums.reduce((s, x) => s + x.usd, 0)),
        exchange_rate: exchangeRate.toFixed(2),
        total_estimate: linePick(ESTIMATES),
        comment: linePick(COMMENTS),
        fabric_lines: fabricLines,
        product_lines: productLines,
    };
});

IN_STOCK_FABRICS.forEach((fabric) => recountFabricRemainders(fabric, DEMO_FABRIC_ROLLS[fabric.id]));
