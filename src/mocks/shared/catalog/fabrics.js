// Seed data for the Storage / Fabrics page (the original backend is unavailable).
// Record shapes mirror the original API, as consumed by FabricComposition.jsx,
// EditableFabricTable.jsx and NewFabric.jsx; served by src/mocks/handlers/fabrics.js.
// Data is generated with a seeded PRNG so it is identical on every reload.

import { WAREHOUSES, rollCellAt } from './warehouse';
import { APP_BASE_URL } from '../../appBaseUrl';

const FABRICS_COUNT = 56;
const IN_STOCK_COUNT = 8; // the first fabrics have rolls from the main PRNG (manufacturing seeds rely on them)
// Most of the other fabrics also have rolls (separate PRNG, so codes and other seed data stay unchanged);
// every 7th one stays out of stock.
const isOutOfStock = (index) => index >= IN_STOCK_COUNT && index % 7 === 6;

export const mulberry32 = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rand = mulberry32(20240517);
const randExtra = mulberry32(7785);
const randInt = (min, max, rng = rand) => Math.floor(rng() * (max - min + 1)) + min;
const randIntExtra = (min, max) => randInt(min, max, randExtra);
const pick = (arr, rng = rand) => arr[Math.floor(rng() * arr.length)];

export const FABRIC_TYPES = [
    { id: 1, type: 'Бязь', pattern: 'plain' },
    { id: 2, type: 'Страйп-сатин', pattern: 'stripe' },
    { id: 3, type: 'Сатин', pattern: 'sheen' },
    { id: 4, type: 'LUX Digital Sateen', pattern: 'print' },
    { id: 5, type: 'Поплін', pattern: 'grid' },
    { id: 6, type: 'Ранфорс', pattern: 'dots' },
    { id: 7, type: 'Перкаль', pattern: 'check' },
    { id: 8, type: 'Муслін', pattern: 'crinkle' },
];

// Tag list from the original server (misspelled duplicates dropped).
export const FABRIC_TAGS = [
    { id: 1, name: 'дитяче' },
    { id: 2, name: 'транспортна тематика' },
    { id: 3, name: 'дитячий Тачка Маквін' },
    { id: 4, name: 'різнокольоровий' },
    { id: 5, name: 'з геометричним принтом' },
    { id: 6, name: 'однотонний білий' },
    { id: 7, name: 'ліловий' },
    { id: 8, name: 'орнамент' },
    { id: 9, name: 'з котиками' },
    { id: 10, name: 'в ромби' },
    { id: 11, name: 'гірчичний' },
    { id: 12, name: 'з мультиплікаційним принтом' },
    { id: 13, name: 'фіолетовий' },
    { id: 14, name: 'бордовий' },
    { id: 15, name: 'для дівчинки рожевий' },
    { id: 16, name: 'з текстовим принтом' },
    { id: 17, name: 'молочний' },
    { id: 18, name: 'сірий з помаранчевим' },
    { id: 19, name: 'з малюнком птахів' },
    { id: 20, name: 'космос' },
    { id: 21, name: 'червоний' },
    { id: 22, name: 'персиковий' },
    { id: 23, name: 'темно-сірий' },
    { id: 24, name: 'кремовий' },
    { id: 25, name: 'шоколад' },
    { id: 26, name: 'фіолетовий з квітами' },
    { id: 27, name: 'коричневий' },
    { id: 28, name: 'з геометричним малюнком' },
    { id: 29, name: 'білий з колосками' },
    { id: 30, name: 'з динозаврами' },
    { id: 31, name: 'з урбаністичним принтом' },
    { id: 32, name: 'з квітами' },
    { id: 33, name: 'дитячий з малюнком тварин' },
    { id: 34, name: 'з рисунком тварин' },
    { id: 35, name: 'чорний' },
    { id: 36, name: 'білий' },
    { id: 37, name: 'помаранчевий' },
    { id: 38, name: 'з квітковим принтом' },
    { id: 39, name: 'сірий' },
    { id: 40, name: 'бежевий' },
    { id: 41, name: 'однотонний сірий' },
    { id: 42, name: 'зірки' },
    { id: 43, name: 'дитячий' },
    { id: 44, name: 'з малюнком тварин' },
    { id: 45, name: 'в смужку' },
    { id: 46, name: 'рожевий' },
    { id: 47, name: 'однотонний' },
    { id: 48, name: 'зелений' },
    { id: 49, name: 'світло-сірий' },
    { id: 50, name: 'жовтий' },
    { id: 51, name: 'з рослинним принтом' },
    { id: 52, name: 'з сердечками' },
    { id: 53, name: 'в клітинку' },
    { id: 54, name: 'блакитний' },
    { id: 55, name: 'абстракція' },
];

const COLORS = [
    ['#e8dccb', '#cdbba1'], ['#f3f0ea', '#d9d3c7'], ['#c9d6df', '#8fa6b8'],
    ['#dfe8d8', '#a9bf9c'], ['#efd9d6', '#cf9f98'], ['#d8d2e6', '#a79bc6'],
    ['#2f3b4c', '#4d5d74'], ['#f2e3c2', '#d8b872'], ['#bcc7c0', '#7d9187'],
    ['#e9c9b4', '#c98d6b'], ['#9fb3c8', '#5f7b99'], ['#f6f6f4', '#dcdcd6'],
];

// ---- Fabric "photos": small procedural SVG textures, one look per category ----

const patternSvg = (pattern, [base, accent]) => {
    switch (pattern) {
        case 'stripe':
            return `<pattern id="p" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="7" height="10" fill="${accent}" opacity=".35"/></pattern>`;
        case 'sheen':
            // satin weave: fine diagonal floats, no glare
            return `<pattern id="p" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="6" height="2" fill="${accent}" opacity=".18"/></pattern>`;
        case 'print':
            return `<pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="6" fill="${accent}" opacity=".7"/><circle cx="10" cy="10" r="2.5" fill="${base}"/><circle cx="30" cy="30" r="8" fill="none" stroke="${accent}" stroke-width="2" opacity=".6"/><path d="M28 6 q6 4 0 10 q-6-4 0-10z" fill="${accent}" opacity=".5"/></pattern>`;
        case 'grid':
            return `<pattern id="p" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0H4M0 0V4" stroke="${accent}" stroke-width=".6" opacity=".5"/></pattern>`;
        case 'dots':
            return `<pattern id="p" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.8" fill="${accent}" opacity=".8"/></pattern>`;
        case 'check':
            return `<pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="10" height="20" fill="${accent}" opacity=".25"/><rect width="20" height="10" fill="${accent}" opacity=".25"/></pattern>`;
        case 'crinkle':
            return `<pattern id="p" width="24" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 q6-4 12 0 t12 0" fill="none" stroke="${accent}" stroke-width="1" opacity=".45"/></pattern>`;
        case 'plain':
        default:
            return `<pattern id="p" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1.5" height="1.5" fill="${accent}" opacity=".35"/><rect x="1.5" y="1.5" width="1.5" height="1.5" fill="${accent}" opacity=".35"/></pattern>`;
    }
};

const makeFabricImage = (pattern, colors) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">`
        + `<defs>${patternSvg(pattern, colors)}</defs>`
        + `<rect width="200" height="200" fill="${colors[0]}"/>`
        + `<rect width="200" height="200" fill="url(#p)"/>`
        + `</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// ---- Real photos (public/demo/media/fabrics/) for the first fabrics: [code, tag id] ----
// The photo file name is the fabric code, as in the original panel; the rest use the procedural textures.

const DEMO_MEDIA_URL = `${APP_BASE_URL}demo/media`;

const FABRIC_PHOTOS = [
    ['1M', 23], ['10M', 46], ['3M', 48], ['829Z', 20], ['8M', 24], ['9M', 21],
    ['12M', 7], ['2M', 39], ['4M', 49], ['7M', 22], ['11M', 46],
];

// ---- Generation ----

const CODE_CHARS = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';
const makeCode = (used) => {
    let code;
    do {
        // mostly digits with an occasional letter, e.g. "7785F"
        code = Array.from({ length: 5 }, () => (rand() < 0.75
            ? String(randInt(0, 9))
            : CODE_CHARS[randInt(10, CODE_CHARS.length - 1)])).join('');
    } while (used.has(code));
    used.add(code);
    return code;
};

// rolls are kept on racks A–C of the shared warehouse structure (src/mocks/data/warehouse.js)
const RACKS = WAREHOUSES.flatMap((w) => ['A', 'B', 'C'].map((name) => ({ name, warehouse: w })));

let nextRollId = 1;
const makeRoll = (fabricId, status, length, rng = rand) => {
    const rack = pick(RACKS, rng);
    const cellNumber = randInt(1, 12, rng);
    return {
        id: nextRollId++,
        fabric: fabricId,
        status,
        current_length: Math.round(length),
        cell: rollCellAt(rack.warehouse.id, rack.name, cellNumber),
    };
};

/** Storage remainders of a fabric, derived from its rolls (also after arrivals / cutting change them). */
export const recountFabricRemainders = (fabric, rolls) => {
    const newRolls = rolls.filter((r) => r.status === 'NEW');
    fabric.opened_length_remainder = rolls.filter((r) => r.status === 'OPENED').reduce((s, r) => s + r.current_length, 0);
    fabric.new_fabricrolls_remainder = newRolls.length;
    fabric.new_length_remainder = newRolls.reduce((s, r) => s + r.current_length, 0);
};

const usedCodes = new Set();
const MONO_TYPES = [['A'], ['B'], ['A', 'B']];

export const DEMO_FABRICS = [];
export const DEMO_FABRIC_ROLLS = {}; // fabricId -> rolls[]

for (let i = 0; i < FABRICS_COUNT; i++) {
    const id = i + 1;
    const type = FABRIC_TYPES[i % FABRIC_TYPES.length];
    const colors = pick(COLORS);

    const rolls = [];
    if (i < IN_STOCK_COUNT) {
        const closedCount = randInt(1, 9);
        for (let r = 0; r < closedCount; r++) rolls.push(makeRoll(id, 'NEW', randInt(40, 60)));
        if (rand() < 0.75) rolls.push(makeRoll(id, 'OPENED', randInt(1, 9)));
        // every in-stock fabric gets an opened roll; a separate PRNG keeps the rest of the data unchanged
        else rolls.push(makeRoll(id, 'OPENED', randIntExtra(1, 9), randExtra));
    } else if (!isOutOfStock(i)) {
        const closedCount = randIntExtra(1, 5);
        for (let r = 0; r < closedCount; r++) rolls.push(makeRoll(id, 'NEW', randIntExtra(40, 60), randExtra));
        if (randExtra() < 0.7) rolls.push(makeRoll(id, 'OPENED', randIntExtra(1, 9), randExtra));
    }
    DEMO_FABRIC_ROLLS[id] = rolls;

    const newRolls = rolls.filter(r => r.status === 'NEW');
    const openedRolls = rolls.filter(r => r.status === 'OPENED');

    // generated values are always drawn, so the PRNG sequence (and the rest of the seed data) stays unchanged
    const code = makeCode(usedCodes);
    const tag = pick(FABRIC_TAGS).id;
    const photo = FABRIC_PHOTOS[i];

    DEMO_FABRICS.push({
        id,
        name: photo ? photo[0] : code,
        description: '',
        type: { id: type.id, type: type.type },
        tags: [photo ? photo[1] : tag],
        mono_fabric_type: pick(MONO_TYPES),
        is_available: true,
        images: [photo ? `${DEMO_MEDIA_URL}/fabrics/${photo[0]}.jpg` : makeFabricImage(type.pattern, colors)],
        opened_length_remainder: (openedRolls.reduce((s, r) => s + r.current_length, 0)),
        new_fabricrolls_remainder: newRolls.length,
        new_length_remainder: (newRolls.reduce((s, r) => s + r.current_length, 0)),
    });
}
