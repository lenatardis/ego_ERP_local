// Seed data for the Prices page (Ціни, NewPrices.jsx) — the original backend is unavailable.
// Served by src/mocks/handlers/prices.js, which lists the live products / templates collections and
// attaches to each row its prices (one per pricelist) and its cost price (собівартість).
//
// Every price / cost record points to its owner by `owner` (the API's entity field:
// warehouse_item_type | kit_template | kit_option_template | kit_component_template |
// component_option_template) and `owner_id`.
//
// ARRIVAL_COSTS is what the backend derived from arrivals: the unit cost of the raw material
// (a finished product's purchase price, or a meter of fabric for kits and components) and the
// exchange rate of the last arrival. Owners missing from it have no arrivals ("Немає даних").
// Data is generated with a seeded PRNG so it is identical on every reload.

import { mulberry32 } from './fabrics';
import { DEMO_PRODUCTS } from './products';
import { DEMO_COMPONENT_TEMPLATES, DEMO_KIT_TEMPLATES, DEMO_KIT_OPTION_TEMPLATES, DEMO_COMPONENT_OPTION_TEMPLATES } from './calculatorTemplates';
import { DEMO_PRICELISTS } from './pricelists';
import { DEMO_FABRIC_ARRIVALS, DEMO_USD_RATE } from './fabricArrivals';
import { DEMO_USERS } from './demoUsers';

const rand = mulberry32(9102026);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

const CURRENT_RATE = Number(DEMO_USD_RATE.buy);
const round2 = (n) => Math.round(n * 100) / 100;
// UAH -> USD the way NewPrices.jsx fills the $ inputs (current buy rate, 4 decimals)
const toUsd = (uah) => Number((uah / CURRENT_RATE).toFixed(4));

export const ownerKey = (owner, id) => `${owner}:${id}`;

// ---- Arrival-based raw material costs ----

const RECENT_ARRIVALS = DEMO_FABRIC_ARRIVALS.slice(-8);
const lastArrival = () => {
    const a = pick(RECENT_ARRIVALS);
    return { exchange_rate: a.exchange_rate, arrival_date: a.arrival_date };
};

// UAH per meter of fabric, by CRM fabric type id (сатин, бязь, полікотон)
const FABRIC_METER_UAH = { 1: 212, 2: 138, 3: 118 };
const FABRIC_NAMES = { 1: 'Сатин', 2: 'Бязь', 3: 'Полікотон' };

// fabric meters and sewing cost per component; the rest of the data is in the templates seed
const COMPONENT_WORK = {
    1: { meters: 0.8, labor: 35 },
    2: { meters: 4.2, labor: 75 },
    3: { meters: 2.2, labor: 40 },
    4: { meters: 0.9, labor: 35 },
    5: { meters: 4.6, labor: 80 },
    6: { meters: 2.4, labor: 45 },
    7: { meters: 4.4, labor: 80 },
    8: { meters: 2.3, labor: 40 },
    9: { meters: 4.8, labor: 85 },
    10: { meters: 2.5, labor: 45 },
    11: { meters: 5.1, labor: 90 },
    12: { meters: 2.8, labor: 50 },
};

// owners with no arrivals: out-of-stock products (below), one component, one kit
const NO_ARRIVALS = new Set([ownerKey('kit_component_template', 12), ownerKey('kit_template', 21)]);

export const ARRIVAL_COSTS = {};
export const DEMO_COST_PRICES = [];
// UAH cost each owner's sell prices are based on (also for owners without arrivals)
const basisUah = {};

const addCost = (owner, id, { unitUah, qty, laborUah, packUah, material, hasArrivals, withItem }) => {
    const key = ownerKey(owner, id);
    if (hasArrivals) {
        ARRIVAL_COSTS[key] = { uah: unitUah, usd: toUsd(unitUah), material, ...lastArrival() };
    }
    if (withItem) {
        DEMO_COST_PRICES.push({
            id: DEMO_COST_PRICES.length + 1,
            owner,
            owner_id: id,
            material,
            // without arrivals the backend keeps 0 here (the page then shows "Немає даних")
            raw_material_unit_cost_price_uah: hasArrivals ? unitUah : 0,
            raw_material_unit_cost_price_usd: hasArrivals ? toUsd(unitUah) : 0,
            raw_material_quantity: qty,
            labor_cost_price_uah: laborUah,
            labor_cost_price_usd: toUsd(laborUah),
            packaging_cost_price_uah: packUah,
            packaging_cost_price_usd: toUsd(packUah),
            exchange_rate: CURRENT_RATE,
            manager_id: null,
        });
    }
    basisUah[key] = unitUah * qty + laborUah + packUah;
};

// finished products: bought / sewn per piece, raw material = one unit
DEMO_PRODUCTS.forEach((product) => {
    const isBlanket = product.category.id === 1;
    product.types.forEach((type) => {
        const area = (type.size.width * type.size.length) / 10000;
        const unitUah = Math.round((isBlanket ? 260 + area * 230 : 150 + area * 600) + randInt(-30, 30));
        const outOfStock = !type.units.length && type.quantity === 0;
        addCost('warehouse_item_type', type.id, {
            unitUah,
            qty: 1,
            laborUah: randInt(4, 12) * 10,
            packUah: randInt(15, 45),
            material: product.name,
            hasArrivals: !outOfStock,
            withItem: !outOfStock,
        });
    });
});

// components: fabric meters × price of a meter + sewing
DEMO_COMPONENT_TEMPLATES.forEach((component) => {
    const work = COMPONENT_WORK[component.id] ?? { meters: 1, labor: 40 };
    const key = ownerKey('kit_component_template', component.id);
    addCost('kit_component_template', component.id, {
        unitUah: FABRIC_METER_UAH[component.fabric_type_id] + randInt(-6, 6),
        qty: work.meters,
        laborUah: work.labor,
        packUah: 0,
        material: FABRIC_NAMES[component.fabric_type_id],
        hasArrivals: !NO_ARRIVALS.has(key),
        withItem: true,
    });
});

// kits: fabric of all components + sewing + packaging
DEMO_KIT_TEMPLATES.forEach((kit) => {
    const works = kit.component_ids.map((id) => COMPONENT_WORK[id] ?? { meters: 1, labor: 40 });
    const meters = round2(works.reduce((sum, w) => sum + w.meters, 0) + Number(kit.additional_fabric_consumption_price || 0) / 10);
    const key = ownerKey('kit_template', kit.id);
    const hasArrivals = !NO_ARRIVALS.has(key);
    addCost('kit_template', kit.id, {
        unitUah: FABRIC_METER_UAH[kit.fabric_type_id] + randInt(-6, 6),
        qty: meters,
        laborUah: Math.round(works.reduce((sum, w) => sum + w.labor, 0) * 0.9),
        packUah: randInt(40, 70),
        material: FABRIC_NAMES[kit.fabric_type_id],
        hasArrivals,
        withItem: hasArrivals,
    });
});

// options have no cost price; their prices are flat surcharges
DEMO_KIT_OPTION_TEMPLATES.forEach((o) => { basisUah[ownerKey('kit_option_template', o.id)] = randInt(6, 20) * 10; });
DEMO_COMPONENT_OPTION_TEMPLATES.forEach((o) => { basisUah[ownerKey('component_option_template', o.id)] = randInt(2, 9) * 10; });

// ---- Sell prices ----

// markup over cost per pricelist id; options use half of it (they are already a surcharge)
const MARKUPS = { 1: 1.6, 2: 1.85, 3: 1.4, 4: 2.1, 5: 1.75, 6: 1.5, 7: 1.45, 8: 1.95 };
// share of owners that have a price in a pricelist: the default one is the most complete
const COVERAGE = { 1: 0.3, 2: 0.9 };
const DEFAULT_COVERAGE = 0.5;
const PRICELIST_IDS = DEMO_PRICELISTS.map((pl) => pl.id);

const MANAGERS = DEMO_USERS.filter((u) => ['demo_admin', 'demo_accountant'].includes(u.username));
const OPTION_OWNERS = new Set(['kit_option_template', 'component_option_template']);

export const DEMO_PRICES = [];

Object.entries(basisUah)
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .forEach(([key, basis]) => {
        const [owner, id] = key.split(':');
        // a few records are not priced yet ("Без цін" filter)
        if (chance(0.1)) return;
        const isOption = OPTION_OWNERS.has(owner);
        PRICELIST_IDS.forEach((plId) => {
            if (!chance(COVERAGE[plId] ?? DEFAULT_COVERAGE)) return;
            const markup = isOption ? 1 + (MARKUPS[plId] - 1) / 2 : MARKUPS[plId];
            const price = Math.max(10, Math.round((basis * markup * (0.97 + rand() * 0.06)) / 10) * 10);
            DEMO_PRICES.push({
                id: DEMO_PRICES.length + 1,
                owner,
                owner_id: Number(id),
                prices_list_id: plId,
                price: price.toFixed(2),
                manager_id: MANAGERS.length ? pick(MANAGERS).id : null,
            });
        });
    });
