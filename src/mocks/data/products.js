// Seed data for the Storage / Finished products page (the original backend is unavailable).
// Record shapes mirror the original API, as consumed by StorageProduct.jsx,
// NewProduct.jsx and EditableProductTable.jsx; served by src/mocks/handlers/products.js.
// Data is generated with a seeded PRNG so it is identical on every reload.

import { mulberry32 } from './fabrics';

const rand = mulberry32(19031987);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

export const PRODUCT_CATEGORIES = [
    { id: 1, name: 'Ковдра' },
    { id: 2, name: 'Подушка' },
];

// `name` is shown to users (filters, location popup); `hex` is the swatch color rendered by ColorRow.
export const PRODUCT_COLORS = [
    { id: 1, name: 'Білий', hex: '#FFFFFF' },
    { id: 2, name: 'Бежевий', hex: '#C9A06E' },
    { id: 3, name: 'Сірий', hex: '#6B7280' },
    { id: 4, name: 'Блакитний', hex: '#7EC8E3' },
    { id: 5, name: 'Рожевий', hex: '#F4A6C1' },
    { id: 6, name: 'Червоний', hex: '#E0262B' },
    { id: 7, name: 'Салатовий', hex: '#9BD770' },
];

export const PRODUCT_SIZES = [
    // pillows
    { id: 1, width: 40, length: 60 },
    { id: 2, width: 50, length: 50 },
    { id: 3, width: 50, length: 70 },
    { id: 4, width: 70, length: 70 },
    // blankets
    { id: 5, width: 100, length: 100 },
    { id: 6, width: 110, length: 140 },
    { id: 7, width: 90, length: 180 },
    { id: 8, width: 140, length: 205 },
    { id: 9, width: 172, length: 205 },
    { id: 10, width: 200, length: 220 },
];

const colorById = (id) => PRODUCT_COLORS.find(c => c.id === id);
const sizeById = (id) => PRODUCT_SIZES.find(s => s.id === id);

// colors / sizes are ids; outOfStock -> every variant has quantity 0 and no units
const PRODUCT_SPECS = [
    { name: 'Red Pillow', category: 2, colors: [6], sizes: [3] },
    { name: 'Ковдра Холофайбер', category: 1, colors: [1, 2], sizes: [8, 9, 10] },
    { name: 'Ковдра ЕкоПух', category: 1, colors: [1], sizes: [8, 9] },
    { name: 'Ковдра 4 сезони', category: 1, colors: [3, 1], sizes: [8, 9, 10] },
    { name: 'Подушка 4 сезони', category: 2, colors: [3, 1], sizes: [3, 4] },
    { name: 'Подушка Еко Пух', category: 2, colors: [2, 1], sizes: [2, 3, 4] },
    { name: 'Подушка Літня', category: 2, colors: [4, 7], sizes: [3] },
    { name: 'Ковдра Літня', category: 1, colors: [4, 7], sizes: [7, 8] },
    { name: 'Ковдра Дитяча', category: 1, colors: [5, 4], sizes: [5, 6] },
    { name: 'Подушка Дитяча', category: 2, colors: [5], sizes: [1] },
    { name: 'Ковдра Бамбук', category: 1, colors: [2], sizes: [9], outOfStock: true },
    { name: 'Подушка Бамбук', category: 2, colors: [2], sizes: [3, 4], outOfStock: true },
    { name: 'Ковдра Вовняна', category: 1, colors: [3, 2], sizes: [8, 10] },
    { name: 'Подушка Анатомічна', category: 2, colors: [3], sizes: [1] },
];

// ---- Product "photos": small procedural SVGs (quilted blanket / puffy pillow) ----

const makeProductImage = (categoryId, color) => {
    const body = categoryId === 1
        // blanket: folded quilt with diamond stitching
        ? `<pattern id="q" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H22M0 0V22" stroke="#000" stroke-opacity=".18" stroke-width="1" stroke-dasharray="3 2"/></pattern></defs>`
          + `<rect x="22" y="40" width="156" height="120" rx="10" fill="${color}" stroke="#000" stroke-opacity=".15"/>`
          + `<rect x="22" y="40" width="156" height="120" rx="10" fill="url(#q)"/>`
          + `<path d="M22 118 H178" stroke="#000" stroke-opacity=".2" stroke-width="2"/>`
          + `<rect x="22" y="118" width="156" height="42" rx="10" fill="#000" fill-opacity=".06"/>`
        // pillow: puffy cushion with pinched corners and a centre highlight
        : `<radialGradient id="h" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></radialGradient></defs>`
          + `<path d="M30 45 Q100 62 170 45 Q155 100 170 155 Q100 138 30 155 Q45 100 30 45Z" fill="${color}" stroke="#000" stroke-opacity=".18"/>`
          + `<path d="M30 45 Q100 62 170 45 Q155 100 170 155 Q100 138 30 155 Q45 100 30 45Z" fill="url(#h)"/>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">`
        + `<rect width="200" height="200" fill="#f4f1f7"/><defs>${body}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// ---- Generation ----

const WAREHOUSES = [
    { id: 1, name: 'Основний склад' },
    { id: 2, name: 'Склад №2' },
];
const RACKS = WAREHOUSES.flatMap((w, wi) =>
    ['D', 'E'].map((letter, ri) => ({ id: wi * 10 + ri + 1, name: letter, warehouse: w })));

let nextCellId = 1;
let nextUnitId = 1;
let nextTypeId = 1;

// Splits a variant's quantity across 1–3 storage cells.
const makeUnits = (quantity) => {
    const parts = Math.min(quantity, randInt(1, 3));
    const units = [];
    let left = quantity;
    for (let i = 0; i < parts; i++) {
        const q = i === parts - 1 ? left : randInt(1, left - (parts - i - 1));
        left -= q;
        units.push({
            id: nextUnitId++,
            current_quantity: q,
            cell: { id: nextCellId++, number: randInt(1, 20), rack: pick(RACKS) },
        });
    }
    return units;
};

export const DEMO_PRODUCTS = PRODUCT_SPECS.map((spec, i) => {
    const types = [];
    spec.colors.forEach(colorId => {
        spec.sizes.forEach(sizeId => {
            const quantity = spec.outOfStock ? 0 : randInt(3, 40);
            types.push({
                id: nextTypeId++,
                color: colorById(colorId),
                size: sizeById(sizeId),
                quantity,
                units: quantity > 0 ? makeUnits(quantity) : [],
            });
        });
    });

    const category = PRODUCT_CATEGORIES.find(c => c.id === spec.category);

    return {
        id: i + 1,
        name: spec.name,
        category,
        images: [makeProductImage(category.id, colorById(spec.colors[0]).hex)],
        types,
    };
});
