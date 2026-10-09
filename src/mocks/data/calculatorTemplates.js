// Seed data for the bedding templates section (Шаблони постільної білизни, /calculator/* endpoints)
// and the CRM fabric (product) types it uses. The original backend is unavailable; records are taken
// from screenshots of the original admin panel, shapes mirror what the Templates/* pages read.
// Served by src/mocks/handlers/calculatorTemplates.js.
//
// Relations are stored by id (`type_id`, `part_ids`, `kit_size_id`, `fabric_type_id`, `component_ids`)
// and expanded when a response is built, so renames propagate across pages.
// Option parts are numbered per `type` ('component' | 'kit'), as in the original API.

import { toIso } from './vendors';

const at = (y, m, d, h = 10, min = 0) => toIso(new Date(y, m - 1, d, h, min, 0));

// ---- "Photos": small procedural SVGs (pillowcase / sheet / duvet cover / kit) ----

const svgUrl = (body) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">`
        + `<rect width="200" height="200" fill="#f4f1f7"/>${body}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const pillowPath = (x, y, w, h) =>
    `M${x} ${y} Q${x + w / 2} ${y + h * 0.15} ${x + w} ${y} Q${x + w - w * 0.08} ${y + h / 2} ${x + w} ${y + h}`
    + ` Q${x + w / 2} ${y + h * 0.85} ${x} ${y + h} Q${x + w * 0.08} ${y + h / 2} ${x} ${y}Z`;

const pillowSvg = (x, y, w, h, color) =>
    `<path d="${pillowPath(x, y, w, h)}" fill="${color}" stroke="#000" stroke-opacity=".15"/>`
    + `<path d="${pillowPath(x, y, w, h)}" fill="url(#h)"/>`;

const HIGHLIGHT = `<defs><radialGradient id="h" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></radialGradient></defs>`;

// two stacked pillows
const PILLOWCASE_IMAGE = svgUrl(HIGHLIGHT + pillowSvg(40, 40, 120, 80, '#ffffff') + pillowSvg(30, 85, 130, 85, '#fbfbfd'));

// folded sheet: a stack of white layers
const SHEET_IMAGE = svgUrl(
    [0, 1, 2, 3].map((i) =>
        `<rect x="${35 - i * 2}" y="${55 + i * 22}" width="${130 + i * 4}" height="30" rx="6" fill="#fff" stroke="#000" stroke-opacity=".12"/>`
    ).join('')
);

// folded duvet cover on a bed: dusty pink with a turned-down edge
const DUVET_IMAGE = svgUrl(
    `<rect x="20" y="60" width="160" height="110" rx="8" fill="#d9b8bd" stroke="#000" stroke-opacity=".12"/>`
    + `<rect x="20" y="60" width="160" height="28" rx="8" fill="#ead3d6"/>`
    + `<path d="M20 88 H180" stroke="#000" stroke-opacity=".15"/>`
    + `<path d="M50 120 q20 -8 40 0 t40 0 t40 0" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`
    + HIGHLIGHT + pillowSvg(35, 35, 60, 38, '#f2e4e6') + pillowSvg(105, 35, 60, 38, '#f2e4e6')
);

// kit "photo": a red satin cushion
const KIT_IMAGE = svgUrl(HIGHLIGHT + pillowSvg(35, 35, 130, 130, '#d0111c'));

const TYPE_IMAGES = { 1: PILLOWCASE_IMAGE, 2: SHEET_IMAGE, 3: DUVET_IMAGE };

// ---- CRM fabric types (GET /api/v1/products/type/), shared with the Ego CRM demo ----

export const DEMO_PRODUCT_TYPES = [
    { id: 1, type: 'сатин', is_available: true },
    { id: 2, type: 'бязь', is_available: true },
    { id: 3, type: 'полікотон', is_available: true },
];

// ---- Типи компонентів. `mono_fabric_type`: A | B | AB ----

export const DEMO_COMPONENT_TYPES = [
    { id: 1, name: 'Наволочка', mono_fabric_type: 'A', image: PILLOWCASE_IMAGE, created: at(2025, 11, 3), deleted_at: null },
    { id: 2, name: 'Простирадло', mono_fabric_type: 'A', image: SHEET_IMAGE, created: at(2025, 11, 3, 10, 5), deleted_at: null },
    { id: 3, name: 'Підковдра', mono_fabric_type: 'AB', image: DUVET_IMAGE, created: at(2025, 11, 3, 10, 10), deleted_at: null },
];

// ---- Частини опцій ----

export const DEMO_OPTION_PARTS = [
    { id: 1, name: 'Собачка', type: 'component', created: at(2025, 12, 1), deleted_at: null },
    { id: 2, name: 'Накладка', type: 'component', created: at(2025, 12, 2), deleted_at: null },
    { id: 4, name: 'Застібачка', type: 'component', created: at(2026, 2, 10), deleted_at: null },
    { id: 1, name: 'Собачка', type: 'kit', created: at(2025, 12, 1, 11), deleted_at: null },
];

// ---- Опції компонентів. Shown newest-created first: 7, 1, 4, 3 ----

export const DEMO_COMPONENT_OPTION_TEMPLATES = [
    { id: 3, name: 'Одношарове з текстурою', description: 'Одношарова накладка для простирадла', type_id: 3, part_ids: [], created: at(2025, 12, 10) },
    { id: 4, name: 'Протектор', description: 'Додатковий Протектор для підковдри', type_id: 2, part_ids: [], created: at(2025, 12, 12) },
    { id: 1, name: 'Замок', description: 'Замок для наволочки', type_id: 1, part_ids: [1], created: at(2025, 12, 14) },
    { id: 7, name: 'Вушка', description: 'Вушка до наволочки', type_id: 1, part_ids: [4], created: at(2026, 2, 12) },
].map((o) => ({ ...o, modified: o.created, deleted_at: null }));

// ---- Опції комплектів (no screenshots of this page survived: illustrative records) ----

export const DEMO_KIT_OPTION_TEMPLATES = [
    { id: 1, name: 'Подарункове пакування', description: 'Комплект у подарунковій коробці зі стрічкою', image: '', part_ids: [], created: at(2026, 1, 12) },
    { id: 2, name: 'Сумка-чохол', description: 'Тканинна сумка для зберігання комплекту', image: '', part_ids: [1], created: at(2026, 1, 14) },
    { id: 3, name: 'Прокладка', description: '', image: '', part_ids: [], created: at(2026, 1, 16) },
].map((o) => ({ ...o, modified: o.created, deleted_at: null }));

// ---- Компоненти. Shown newest-created first: 6, 5, 11, 12, 9, 7, 10, 8, 4, 3, 2, 1 ----

// [id, name, short_name, size, type_id]
const COMPONENT_SPECS = [
    [1, 'Наволочка 5x7', 'Нав 5x7', '5×7', 1],
    [2, 'Підковдра 5x7', 'Ков 5x7', '5×7', 3],
    [3, 'Простирадло 5x7', 'Прос 5x7', '5×7', 2],
    [4, 'Наволочка 7x7', 'Нав 7x7', '7×7', 1],
    [8, 'Простирадло 150x215', 'Пст 150215', '150x215', 2],
    [10, 'Простирадло 200x220', 'Прт 200220', '200x220', 2],
    [7, 'Підковдра 150x215', 'Ков 150215', '150x215', 3],
    [9, 'Підковдра 180x215', 'Ков 180215', '180x215', 3],
    [12, 'Простирадло 220x240', 'Прт 220240', '220x240', 2],
    [11, 'Підковдра 200x215', 'Ков 200215', '200x215', 3],
    [5, 'Підковдра 7x7', 'Ков 7x7', '7×7', 3],
    [6, 'Простирадло 7x7', 'Прос 7x7', '7×7', 2],
];

export const DEMO_COMPONENT_TEMPLATES = COMPONENT_SPECS.map(([id, name, short_name, size, type_id], i) => ({
    id,
    name,
    short_name,
    size,
    type_id,
    fabric_type_id: 1, // сатин
    fabric_a_count: 1,
    fabric_b_count: 1,
    image: TYPE_IMAGES[type_id],
    created: at(2025, 12, 15, 9 + i),
    modified: at(2025, 12, 15, 9 + i),
    deleted_at: null,
}));

// ---- Розміри комплектів. Shown newest-created first: 5, 4, 3, 2, 1 ----

export const DEMO_KIT_SIZES = [
    [1, 'Полуторний', '1.5'],
    [2, 'Двоспальний', '2.0'],
    [3, 'Євро', 'Є'],
    [4, 'Євро Макс', 'Є max'],
    [5, 'Сімейний', '7,Я'],
].map(([id, name, short_name]) => ({
    id,
    name,
    short_name,
    created: at(2025, 12, 20, 10 + id),
    modified: at(2025, 12, 20, 10 + id),
    deleted_at: null,
}));

// ---- Комплекти. Shown newest-created first: 27, 16, 2, 1 ----
// `component_ids` repeats an id once per piece (Наволочка ×2 -> [1, 1, ...]), as the original API did.

export const DEMO_KIT_TEMPLATES = [
    {
        id: 1,
        name: 'Satin Полуторний 5x7',
        short_name: 'sat1.5 5×7',
        additional_fabric_consumption_price: '3',
        kit_size_id: 1,
        fabric_type_id: 1,
        component_ids: [1, 1, 7, 8],
        image: KIT_IMAGE,
        created: at(2025, 12, 22),
    },
    {
        id: 2,
        name: 'Satin Полуторний 7x7',
        short_name: 'sat1.5 7×7',
        additional_fabric_consumption_price: '0',
        kit_size_id: 1,
        fabric_type_id: 1,
        component_ids: [4, 4, 7, 8],
        image: KIT_IMAGE,
        created: at(2025, 12, 23),
    },
    {
        id: 16,
        name: 'Bazz Сімейний 5x7',
        short_name: 'baz7,Я 5x7',
        additional_fabric_consumption_price: '0',
        kit_size_id: 5,
        fabric_type_id: 2,
        component_ids: [1, 1, 7, 7, 10],
        image: '',
        created: at(2025, 12, 29),
    },
    {
        id: 27,
        name: 'Polikoton Двоспальний 5x7',
        short_name: 'pol2.0 5×7',
        additional_fabric_consumption_price: '1',
        kit_size_id: 2,
        fabric_type_id: 3,
        component_ids: [1, 1, 9, 10],
        image: '',
        created: at(2026, 1, 5),
    },
].map((k) => ({ ...k, modified: k.created, deleted_at: null }));
