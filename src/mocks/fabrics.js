// Local demo data for the Storage / Fabrics page (the original backend is unavailable).
// Shapes mirror the original API responses consumed by FabricComposition.jsx,
// EditableFabricTable.jsx and NewFabric.jsx:
//   GET /warehouses/fabrics/                   -> { fabrics, total_pages, count }
//   GET /warehouses/fabrics/types-tags/        -> { types, tags }
//   GET /warehouses/fabrics/:id/fabric-rolls/  -> { "fabric-rolls", total_pages, count }
// Data is generated with a seeded PRNG so it is identical on every reload.

export const FABRICS_PAGE_SIZE = 25;
const DEFAULT_ROLLS_PAGE_SIZE = 20;
const FABRICS_COUNT = 56;
const IN_STOCK_COUNT = 8; // only the first fabrics have rolls; the rest are out of stock

const mulberry32 = (seed) => () => {
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

export const FABRIC_TAGS = [
    { id: 1, name: 'Однотонна' },
    { id: 2, name: 'Принт' },
    { id: 3, name: 'Смужка' },
    { id: 4, name: 'Дитяча' },
    { id: 5, name: 'Преміум' },
    { id: 6, name: 'Сезонна' },
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
            return `<linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset=".45" stop-color="#fff" stop-opacity=".45"/><stop offset=".55" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="${accent}" stop-opacity=".4"/></linearGradient>`;
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
        + `<defs>${patternSvg(pattern, colors)}`
        + `<linearGradient id="fold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".12"/><stop offset=".3" stop-color="#fff" stop-opacity=".12"/><stop offset=".6" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient></defs>`
        + `<rect width="200" height="200" fill="${colors[0]}"/>`
        + `<rect width="200" height="200" fill="url(#p)"/>`
        + `<rect width="200" height="200" fill="url(#fold)"/>`
        + `</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

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

const WAREHOUSES = [
    { id: 1, name: 'Основний склад' },
    { id: 2, name: 'Склад №2' },
];
const RACKS = WAREHOUSES.flatMap((w, wi) =>
    ['A', 'B', 'C'].map((letter, ri) => ({ id: wi * 10 + ri + 1, name: letter, warehouse: w })));

let nextRollId = 1;
const makeRoll = (fabricId, status, length, rng = rand) => {
    const rack = pick(RACKS, rng);
    const cellId = randInt(1, 12, rng);
    return {
        id: nextRollId++,
        fabric: fabricId,
        status,
        current_length: Math.round(length),
        cell: { id: cellId, name: String(cellId), rack },
    };
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
    }
    DEMO_FABRIC_ROLLS[id] = rolls;

    const newRolls = rolls.filter(r => r.status === 'NEW');
    const openedRolls = rolls.filter(r => r.status === 'OPENED');

    DEMO_FABRICS.push({
        id,
        name: makeCode(usedCodes),
        description: '',
        type: { id: type.id, type: type.type },
        tags: [pick(FABRIC_TAGS).id],
        mono_fabric_type: pick(MONO_TYPES),
        is_available: true,
        images: [makeFabricImage(type.pattern, colors)],
        opened_length_remainder: (openedRolls.reduce((s, r) => s + r.current_length, 0)),
        new_fabricrolls_remainder: newRolls.length,
        new_length_remainder: (newRolls.reduce((s, r) => s + r.current_length, 0)),
    });
}

// ---- Query helpers (emulate server-side filtering / pagination) ----

const hasStock = (f) =>
    f.new_fabricrolls_remainder > 0 || f.opened_length_remainder > 0;

export const queryDemoFabrics = ({
    page = 1,
    type_id,
    name,
    new_fabricroll_remainder_min,
    new_fabricroll_remainder_max,
    in_stock,
} = {}) => {
    const search = name != null ? String(name).trim().toLowerCase() : '';

    const filtered = DEMO_FABRICS.filter(f => {
        if (type_id != null && type_id !== '' && f.type.id !== Number(type_id)) return false;
        if (search && !f.name.toLowerCase().includes(search)) return false;
        if (new_fabricroll_remainder_min != null && f.new_fabricrolls_remainder < Number(new_fabricroll_remainder_min)) return false;
        if (new_fabricroll_remainder_max != null && f.new_fabricrolls_remainder > Number(new_fabricroll_remainder_max)) return false;
        if (in_stock === true && !hasStock(f)) return false;
        if (in_stock === false && hasStock(f)) return false;
        return true;
    });

    const total_pages = Math.ceil(filtered.length / FABRICS_PAGE_SIZE);
    const start = (Number(page) - 1) * FABRICS_PAGE_SIZE;

    return {
        count: filtered.length,
        total_pages,
        fabrics: filtered.slice(start, start + FABRICS_PAGE_SIZE),
    };
};

export const queryDemoFabricRolls = (fabricId, { page = 1, page_size, status } = {}) => {
    const size = Number(page_size) || DEFAULT_ROLLS_PAGE_SIZE;
    const statuses = status == null ? null : (Array.isArray(status) ? status : [status]);

    const rolls = (DEMO_FABRIC_ROLLS[fabricId] || [])
        .filter(r => !statuses || statuses.includes(r.status));

    const start = (Number(page) - 1) * size;

    return {
        count: rolls.length,
        total_pages: Math.max(1, Math.ceil(rolls.length / size)),
        'fabric-rolls': rolls.slice(start, start + size),
    };
};

export const getDemoFabricFilters = () => ({
    types: FABRIC_TYPES.map(({ id, type }) => ({ id, type })),
    tags: FABRIC_TAGS,
});

// Small artificial latency so the existing Preloader / AbortController flow behaves as with a real server.
export const mockDelay = (signal, ms = 250) => new Promise((resolve, reject) => {
    if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
});
