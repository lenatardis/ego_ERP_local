// Seed data for the Storage / Finished products page (the original backend is unavailable).
// Record shapes mirror the original API, as consumed by StorageProduct.jsx,
// NewProduct.jsx and EditableProductTable.jsx; served by src/mocks/handlers/products.js.
// Data is generated with a seeded PRNG so it is identical on every reload.

import { mulberry32 } from './fabrics';
import { WAREHOUSES, unitCellAt } from './warehouse';

const rand = mulberry32(19031987);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

export const PRODUCT_CATEGORIES = [
    { id: 1, name: 'Ковдра' },
    { id: 2, name: 'Подушка' },
    { id: 3, name: 'Наматрацник' },
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
    // mattress protectors
    { id: 11, width: 160, length: 200 },
    { id: 12, width: 180, length: 200 },
];

const colorById = (id) => PRODUCT_COLORS.find(c => c.id === id);
const sizeById = (id) => PRODUCT_SIZES.find(s => s.id === id);

// colors / sizes are ids; photo -> public/demo/media/products/<photo>.jpg (the company's own product photos,
// recolored to the product's first color where there was no original); outOfStock -> every variant has quantity 0 and no units
const PRODUCT_SPECS = [
    { name: 'Red Pillow', category: 2, colors: [6], sizes: [3], photo: 'red-pillow' },
    { name: 'Ковдра Холофайбер', category: 1, colors: [1, 2], sizes: [8, 9, 10], photo: 'blanket-holofiber' },
    { name: 'Ковдра ЕкоПух', category: 1, colors: [1], sizes: [8, 9], photo: 'blanket-ekopukh' },
    { name: 'Ковдра 4 сезони', category: 1, colors: [3, 1], sizes: [8, 9, 10], photo: 'blanket-4-seasons' },
    { name: 'Подушка 4 сезони', category: 2, colors: [3, 1], sizes: [3, 4], photo: 'pillow-4-seasons' },
    { name: 'Подушка Еко Пух', category: 2, colors: [2, 1], sizes: [2, 3, 4], photo: 'pillow-ekopukh' },
    { name: 'Подушка Літня', category: 2, colors: [4, 7], sizes: [3], photo: 'pillow-summer' },
    { name: 'Ковдра Літня', category: 1, colors: [4, 7], sizes: [7, 8], photo: 'blanket-summer' },
    { name: 'Ковдра Дитяча', category: 1, colors: [5, 4], sizes: [5, 6], photo: 'blanket-kids' },
    { name: 'Подушка Дитяча', category: 2, colors: [5], sizes: [1], photo: 'pillow-kids' },
    { name: 'Ковдра Бамбук', category: 1, colors: [2], sizes: [9], outOfStock: true, photo: 'blanket-bamboo' },
    { name: 'Подушка Бамбук', category: 2, colors: [2], sizes: [3, 4], outOfStock: true, photo: 'pillow-bamboo' },
    { name: 'Ковдра Вовняна', category: 1, colors: [3, 2], sizes: [8, 10], photo: 'blanket-wool' },
    { name: 'Подушка Анатомічна', category: 2, colors: [3], sizes: [1], photo: 'pillow-anatomic' },
    { name: 'Наматрацник Моніка', category: 3, colors: [1], sizes: [11, 12], photo: 'mattress-protector-monika' },
];

// ---- Generation ----

// units are kept on racks D–E of the shared warehouse structure (src/mocks/data/warehouse.js)
const RACKS = WAREHOUSES.flatMap((w) => ['D', 'E'].map((name) => ({ name, warehouse: w })));

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
        const cellNumber = randInt(1, 20);
        const rack = pick(RACKS);
        units.push({
            id: nextUnitId++,
            current_quantity: q,
            cell: unitCellAt(rack.warehouse.id, rack.name, cellNumber),
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
        images: [`${import.meta.env.BASE_URL}demo/media/products/${spec.photo}.jpg`],
        types,
    };
});
