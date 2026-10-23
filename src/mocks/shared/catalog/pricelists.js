// Seed data for the Pricelist (Прайслісти) and Sources (Джерела) pages (the original backend is unavailable).
// Record shapes mirror the original API, as consumed by Pricelist.jsx, Sources.jsx and NewPrices.jsx;
// served by src/mocks/handlers/pricelists.js.
// A source references its pricelist by `prices_list_id`; the handler expands it into `prices_list`
// and builds each pricelist's `sources`, so renames propagate. Sources are the order (lead) sources
// shared with the CRM; `orders_count` is how many orders use a source (drives the delete warning).
// `price_count` is not stored: the handler counts the prices of src/mocks/data/prices.js.
// Data is generated with a seeded PRNG so it is identical on every reload.

import { mulberry32 } from './fabrics';
import { toIso } from './vendors';

const rand = mulberry32(7032021);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

export const PRICE_COUNT_KEYS = [
    'warehouse_item_type',
    'kit_template',
    'kit_option_template',
    'kit_component_template',
    'component_option_template',
];

// [title, description, status, is_default, deleted]
const PRICELIST_SPECS = [
    ['Старий прайс 2024', 'Ціни до подорожчання тканин у 2025 році', 'DEPRECATED', false, true],
    ['Стандартний список', 'Список із стандартними цінами, з якого будуть братись ціни якщо немає іншого активного списку', 'ACTIVE', true, false],
    ['Оптовий', 'Ціни для оптових покупців від 10 комплектів', 'ACTIVE', false, false],
    ['Маркетплейси', 'Ціни для Rozetka, Prom та Епіцентр з урахуванням комісії', 'ACTIVE', false, false],
    ['Соцмережі і месенджери', 'Акційні ціни для замовлень із соцмереж і месенджерів', 'ACTIVE', false, false],
    ['Дропшипінг', 'Ціни для партнерів, які продають під своїм брендом', 'ACTIVE', false, false],
    ['Готелі', 'Ціни для готелів і хостелів', 'ACTIVE', false, false],
    ['Шоуруми', 'Ціни для продажу в шоурумах', 'ACTIVE', false, false],
];

// [name, pricelist index in PRICELIST_SPECS, orders_count, deleted]
const SOURCE_SPECS = [
    ['Viber-розсилка', 4, 12, false],
    ['Сайт', 1, 214, false],
    ['Інстаграм', 4, 167, false],
    ['Facebook', 4, 48, false],
    ['OLX', 1, 9, true],
    ['Rozetka', 3, 131, false],
    ['Prom.ua', 3, 86, false],
    ['Оптовий відділ', 2, 38, false],
    ['Епіцентр', 3, 0, false],
    ['Дропшипінг-партнери', 5, 6, false],
    ['Готельні замовлення', 6, 0, false],
    ['Шоурум (Київ)', 7, 0, false],
];

// spread creation dates over the last ~2 years, oldest first
const SEED_START = new Date(2024, 8, 2, 10, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

const createdAt = (i, step) => new Date(SEED_START + i * step * DAY + randInt(0, 8 * 60) * 60 * 1000);

export const DEMO_PRICELISTS = PRICELIST_SPECS.map(([title, description, status, is_default, deleted], i) => {
    const created = createdAt(i, 55);
    const modified = new Date(created.getTime() + randInt(0, 40) * DAY);
    return {
        id: i + 1,
        title,
        description,
        status,
        is_default,
        created: toIso(created),
        modified: toIso(modified),
        deleted_at: deleted ? toIso(new Date(modified.getTime() + 30 * DAY)) : null,
    };
});

export const DEMO_SOURCES = SOURCE_SPECS.map(([name, plIndex, orders_count, deleted], i) => {
    const created = createdAt(i, 38);
    const modified = new Date(created.getTime() + randInt(0, 30) * DAY);
    return {
        id: i + 1,
        name,
        prices_list_id: plIndex + 1,
        orders_count,
        created: toIso(created),
        modified: toIso(modified),
        deleted_at: deleted ? toIso(new Date(modified.getTime() + 20 * DAY)) : null,
    };
});
