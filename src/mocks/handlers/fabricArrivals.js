import { http, HttpResponse, bypass } from 'msw';
import { API, withAuth, isSet, paginate, notFound, getRequestUser } from './utils';
import { getCollection, saveCollection, nextId } from '../db';
import {
    DEMO_FABRIC_ARRIVALS, DEMO_USD_RATE, toMoney, fabricLineSums, productLineSums, standardLengthOf,
} from '../data/fabricArrivals';
import { DEMO_VENDORS, money } from '../data/vendors';
import { DEMO_FABRICS, DEMO_FABRIC_ROLLS, recountFabricRemainders } from '../data/fabrics';
import { DEMO_PRODUCTS, PRODUCT_COLORS, PRODUCT_SIZES } from '../data/products';
import { findDemoUserById } from '../data/demoUsers';
import { findWarehouseCell, rollCellRef, unitCellRef } from '../data/warehouse';
import { cellCapacity, liveOccupancy } from './warehouse';

// Response shapes follow the original API, as consumed by ArrivalList.jsx, IncomingArrivalFabric.jsx,
// IncomingArrivalProduct.jsx (+ EditableFabricTable / EditableProductTable) and NewVendorPayment.jsx.
// Fabric and product arrivals share one endpoint; a product arrival has empty `fabric_rolls`:
//   GET   /warehouses/fabric-arrivals/             -> { fabric_arrivals, total_count, total_pages, current_page }
//         filters: with_fabric_rolls, with_warehouse_item_units, vendor
//   POST  /warehouses/fabric-arrivals/             -> arrival (201)
//   GET   /warehouses/fabric-arrivals/:id/         -> arrival
//   PATCH /warehouses/fabric-arrivals/:id/         -> arrival (the forms always send the full table)
//   GET   /warehouses/fabric-arrivals/currencies/  -> { exchange_rate: { buy, sale } }
//       today's USD cash rate: Monobank (buy / sell), else the NBU official rate (as both),
//       else the PrivatBank snapshot DEMO_USD_RATE (PrivatBank's API can't be called from a browser: no CORS)
//
// An arrival puts its goods into storage: every fabric line becomes `quantity` NEW rolls in its cell
// (Склад → Тканини), every product line one unit of the product variant (Склад → Готова продукція).
// Editing an arrival changes those rolls / units: quantity up or down, other cell, other length.
// Once rolls of a line are opened / cut, or items are taken from the cell, they are in use:
//   - the quantity can't go below what is in use (those can't be "un-arrived");
//   - the roll length can't change (the remaining length of the opened rolls was measured from the old one).
// Such a save is rejected (400) with the reason, which the forms show in their error banner; nothing is saved.
// So is a save that would overfill a cell, like the forms' own capacity check.

const ARRIVALS_PAGE_SIZE = 25;

// ---- Today's USD cash rate ----

const RATE_CACHE_KEY = 'ego-demo:erp:usdRate';
// Monobank's public endpoint answers 429 when called too often, so a fetched rate is reused for a while
const RATE_TTL_MS = 30 * 60 * 1000;
const RATE_RETRY_MS = 5 * 60 * 1000;
const RATE_TIMEOUT_MS = 4000;
const USD = 840;
const UAH = 980;

const toRate = (buy, sale) => {
    const b = Number(buy);
    const s = Number(sale);
    return b > 0 && s > 0 ? { buy: b.toFixed(2), sale: s.toFixed(2) } : null;
};

const fetchJson = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RATE_TIMEOUT_MS);
    try {
        // bypass(): a real request, not intercepted by the mock worker
        const response = await fetch(bypass(new Request(url, { signal: controller.signal })));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

const RATE_SOURCES = [
    async () => {
        const list = await fetchJson('https://api.monobank.ua/bank/currency');
        const usd = list.find((r) => r.currencyCodeA === USD && r.currencyCodeB === UAH);
        return toRate(usd?.rateBuy, usd?.rateSell);
    },
    async () => {
        const [usd] = await fetchJson('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json');
        return toRate(usd?.rate, usd?.rate);
    },
];

const readCachedRate = () => {
    try {
        const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY));
        return cached && Date.now() < cached.expires ? cached.rate : null;
    } catch {
        return null;
    }
};

const cacheRate = (rate, ttl) => {
    try {
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, expires: Date.now() + ttl }));
    } catch {
        // storage unavailable: the rate is fetched again next time
    }
};

let pendingRate = null;

/** Today's USD cash rate { buy, sale }; several pages asking at once share one lookup. */
const getUsdRate = () => {
    const cached = readCachedRate();
    if (cached) return Promise.resolve(cached);

    pendingRate ??= (async () => {
        for (const source of RATE_SOURCES) {
            try {
                const rate = await source();
                if (rate) {
                    cacheRate(rate, RATE_TTL_MS);
                    return rate;
                }
            } catch (error) {
                console.warn('[demo] USD rate source failed:', error);
            }
        }
        cacheRate(DEMO_USD_RATE, RATE_RETRY_MS);
        return DEMO_USD_RATE;
    })().finally(() => {
        pendingRate = null;
    });

    return pendingRate;
};

const arrivals = () => getCollection('fabricArrivals', DEMO_FABRIC_ARRIVALS);
const vendors = () => getCollection('vendors', DEMO_VENDORS);
const fabrics = () => getCollection('fabrics', DEMO_FABRICS);
const fabricRolls = () => getCollection('fabricRolls', DEMO_FABRIC_ROLLS); // fabricId -> rolls[]
const products = () => getCollection('products', DEMO_PRODUCTS);

export const findFabricArrival = (id) => arrivals().find((a) => a.id === Number(id)) || null;

// ---- Serialization (stored ids -> nested objects, read live so renames propagate) ----

const decimal = (n) => money(Number(n) || 0);

const serializeFabricLine = (line) => {
    const fabric = fabrics().find((f) => f.id === line.fabric_id);
    const sums = fabricLineSums(line);
    return {
        quantity: line.quantity,
        ids: [...line.ids],
        cell_id: line.cell_id,
        fabric: fabric
            ? { id: fabric.id, name: fabric.name, type_name: fabric.type?.type ?? '', mono_fabric_type: fabric.mono_fabric_type ?? [] }
            : { id: line.fabric_id, name: '', type_name: '', mono_fabric_type: [] },
        item: {
            status: 'NEW',
            initial_length: line.initial_length,
            initial_custom_length: line.initial_custom_length,
            price_uah: decimal(line.price_uah),
            price_usd: decimal(line.price_usd),
            total_price_uah: decimal(sums.uah),
            total_price_usd: decimal(sums.usd),
        },
    };
};

// product lines are grouped by product (warehouse item template), in the order they were entered
const serializeProductLines = (lines) => {
    const groups = [];
    lines.forEach((line) => {
        let group = groups.find((g) => g.warehouse_item_template.id === line.template_id);
        if (!group) {
            const product = products().find((p) => p.id === line.template_id);
            group = {
                warehouse_item_template: {
                    id: line.template_id,
                    name: product?.name ?? '',
                    category_id: product?.category?.id ?? null,
                    category_name: product?.category?.name ?? '',
                },
                units: [],
            };
            groups.push(group);
        }
        const sums = productLineSums(line);
        group.units.push({
            unit_id: line.unit_id,
            color: PRODUCT_COLORS.find((c) => c.id === line.color_id) ?? null,
            size: PRODUCT_SIZES.find((s) => s.id === line.size_id) ?? null,
            quantity: line.quantity,
            cell_id: line.cell_id,
            price_uah: decimal(line.price_uah),
            price_usd: decimal(line.price_usd),
            total_price_uah: decimal(sums.uah),
            total_price_usd: decimal(sums.usd),
        });
    });
    return groups;
};

/** Stored arrival -> API shape. */
const serializeArrival = ({ vendor_id, receiver_id, fabric_lines, product_lines, ...arrival }) => {
    const vendor = vendors().find((v) => v.id === vendor_id);
    const receiver = findDemoUserById(receiver_id);
    return {
        ...arrival,
        vendor: vendor ? { id: vendor.id, full_name: vendor.full_name } : null,
        receiver: receiver
            ? { id: receiver.id, first_name: receiver.profile.first_name, last_name: receiver.profile.last_name }
            : null,
        fabric_rolls: fabric_lines.map(serializeFabricLine),
        warehouse_item_units: serializeProductLines(product_lines),
    };
};

// ---- Validation ----

class ArrivalError extends Error {
    constructor(field, message) {
        super(message);
        this.field = field;
    }
}

const fail = (field, message) => {
    throw new ArrivalError(field, message);
};

const toPositiveInt = (value, field, message) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) fail(field, message);
    return n;
};

const toPrice = (value, field) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n) || n < 0) fail(field, 'Ціна не може бути від\'ємною.');
    return toMoney(n);
};

const requireCell = (id, field) => findWarehouseCell(id) || fail(field, 'Комірку не знайдено.');

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;

/** Copies the header fields of a create / edit payload onto a stored arrival. */
const applyHeader = (arrival, body, isCreate) => {
    const has = (key) => isCreate || Object.prototype.hasOwnProperty.call(body, key);

    if (has('vendor')) {
        const vendor = vendors().find((v) => v.id === Number(body.vendor) && !v.deleted_at);
        if (!vendor) fail('vendor', 'Постачальника не знайдено.');
        arrival.vendor_id = vendor.id;
    }
    if (has('receiver')) {
        if (!findDemoUserById(body.receiver)) fail('receiver', 'Користувача не знайдено.');
        arrival.receiver_id = Number(body.receiver);
    }
    if (has('arrival_date')) {
        if (!DATE_RE.test(String(body.arrival_date ?? ''))) fail('arrival_date', 'Дата має бути у форматі DD.MM.YYYY.');
        arrival.arrival_date = body.arrival_date;
    }
    if (has('document_num')) arrival.document_num = String(body.document_num ?? '').trim();
    ['uah_amount', 'usd_amount', 'exchange_rate'].forEach((key) => {
        if (!has(key)) return;
        const n = Number(body[key]);
        if (!Number.isFinite(n) || n < 0) fail(key, 'Некоректне значення.');
        arrival[key] = money(n);
    });
    ['total_estimate', 'comment'].forEach((key) => {
        if (has(key)) arrival[key] = isSet(body[key]) ? String(body[key]).trim() : null;
    });
};

// ---- Fabric lines <-> storage rolls ----

// ids of rolls already cut up stay in their arrival line, so they are never handed out again
const maxRollId = () => Math.max(0,
    ...Object.values(fabricRolls()).flat().map((r) => r.id),
    ...arrivals().flatMap((a) => a.fabric_lines.flatMap((l) => l.ids)));

const findRoll = (id) => {
    for (const [fabricId, rolls] of Object.entries(fabricRolls())) {
        const roll = rolls.find((r) => r.id === Number(id));
        if (roll) return { fabricId: Number(fabricId), roll };
    }
    return null;
};

const removeRoll = (fabricId, roll) => {
    const rollsByFabric = fabricRolls();
    rollsByFabric[fabricId] = rollsByFabric[fabricId].filter((r) => r !== roll);
};

/**
 * Brings the arrival's fabric lines in line with the submitted table (`fabric_rolls` of the payload).
 * A row with `ids` is a saved line: its rolls are moved / resized, added or removed to match `quantity`.
 */
const syncFabricLines = (arrival, rows) => {
    const rollsByFabric = fabricRolls();
    const touchedFabrics = new Set();
    const usedLines = new Set();
    let lastRollId = maxRollId();

    const lines = rows.map((row, index) => {
        const field = `fabric_rolls[${index}]`;
        const item = row?.item || {};
        const fabric = fabrics().find((f) => f.id === Number(item.fabric)) || fail(field, 'Тканину не знайдено.');
        const quantity = toPositiveInt(row.quantity, field, 'Кількість рулонів має бути цілим числом ≥ 1.');
        const cell = requireCell(item.cell, field);
        const customLength = Number(item.initial_custom_length);
        const hasCustom = isSet(item.initial_custom_length) && customLength > 0;
        const standardLength = hasCustom ? null : standardLengthOf(Number(item.initial_length));
        if (!hasCustom && !standardLength) fail(field, 'Вкажіть довжину рулону.');
        const length = hasCustom ? customLength : standardLength;

        const rowIds = (row.ids || []).map(Number);
        const saved = rowIds.length
            ? arrival.fabric_lines.find((l) => !usedLines.has(l) && l.ids.some((id) => rowIds.includes(id)))
            : null;
        if (saved) usedLines.add(saved);

        let ids = saved ? [...saved.ids] : [];
        rollsByFabric[fabric.id] ??= [];
        touchedFabrics.add(fabric.id);

        // opened / cut rolls are in use: they stay in the line and keep the length they were cut from
        const usedRolls = ids.filter((id) => findRoll(id)?.roll.status !== 'NEW').length;
        const savedLength = saved && (saved.initial_custom_length ?? standardLengthOf(saved.initial_length));
        if (usedRolls && savedLength !== length) {
            fail(field, `У рядку ${index + 1} (тканина ${fabric.name}) довжину рулону не можна змінити з ${savedLength} м на ${length} м: `
                + `${usedRolls} з ${ids.length} рулонів цієї позиції вже розкрито або використано у виробництві (розкрій), `
                + `і їхній залишок рахувався від довжини ${savedLength} м. Поверніть довжину ${savedLength} м.`);
        }
        // fewer rolls: only unopened rolls can leave storage again
        if (quantity < usedRolls) {
            fail(field, `У рядку ${index + 1} (тканина ${fabric.name}) кількість рулонів не можна зменшити до ${quantity}: `
                + `${usedRolls} з ${ids.length} рулонів цієї позиції вже розкрито або використано у виробництві (розкрій), `
                + `а прибрати з накладної можна лише нерозкриті рулони. Мінімально можлива кількість — ${usedRolls}.`);
        }
        while (ids.length > quantity) {
            const removable = [...ids].reverse()
                .map((id) => ({ id, found: findRoll(id) }))
                .find(({ found }) => found?.roll.status === 'NEW');
            removeRoll(removable.found.fabricId, removable.found.roll);
            touchedFabrics.add(removable.found.fabricId);
            ids = ids.filter((id) => id !== removable.id);
        }

        // rolls still in storage follow the line: cell, fabric and (while unopened) length
        ids.forEach((id) => {
            const found = findRoll(id);
            if (!found) return;
            found.roll.cell = rollCellRef(cell);
            if (found.roll.status === 'NEW') found.roll.current_length = length;
            if (found.fabricId !== fabric.id) {
                removeRoll(found.fabricId, found.roll);
                found.roll.fabric = fabric.id;
                rollsByFabric[fabric.id].push(found.roll);
                touchedFabrics.add(found.fabricId);
            }
        });

        // more rolls: new NEW rolls in the cell
        while (ids.length < quantity) {
            const roll = { id: ++lastRollId, fabric: fabric.id, status: 'NEW', current_length: length, cell: rollCellRef(cell) };
            rollsByFabric[fabric.id].push(roll);
            ids.push(roll.id);
        }

        return {
            fabric_id: fabric.id,
            quantity,
            initial_length: hasCustom ? null : Number(item.initial_length),
            initial_custom_length: hasCustom ? customLength : null,
            price_uah: toPrice(item.price_uah, field),
            price_usd: toPrice(item.price_usd, field),
            cell_id: cell.id,
            ids,
        };
    });

    // assumption: saved lines missing from the payload are dropped with their unopened rolls (the forms never do this)
    arrival.fabric_lines.filter((l) => !usedLines.has(l)).forEach((line) => {
        line.ids.forEach((id) => {
            const found = findRoll(id);
            if (found?.roll.status === 'NEW') {
                removeRoll(found.fabricId, found.roll);
                touchedFabrics.add(found.fabricId);
            }
        });
    });

    arrival.fabric_lines = lines;
    touchedFabrics.forEach((id) => {
        const fabric = fabrics().find((f) => f.id === id);
        if (fabric) recountFabricRemainders(fabric, rollsByFabric[id] || []);
    });
};

// ---- Product lines <-> storage units ----

const allTypes = () => products().flatMap((p) => p.types.map((type) => ({ product: p, type })));
// ids of units already emptied stay in their arrival line, so they are never handed out again
const maxUnitId = () => Math.max(0,
    ...allTypes().flatMap(({ type }) => type.units.map((u) => u.id)),
    ...arrivals().flatMap((a) => a.product_lines.map((l) => l.unit_id)));
const nextTypeId = () => Math.max(0, ...allTypes().map(({ type }) => type.id)) + 1;

const findUnit = (id) => {
    for (const { product, type } of allTypes()) {
        const index = type.units.findIndex((u) => u.id === Number(id));
        if (index !== -1) return { product, type, index, unit: type.units[index] };
    }
    return null;
};

const recountVariant = (type) => {
    type.quantity = type.units.reduce((s, u) => s + u.current_quantity, 0);
};

/**
 * Brings the arrival's product lines in line with the submitted table (`warehouse_item_units` of the payload).
 * A position with `unit_id` is a saved line: its storage unit gets the new quantity / cell / variant;
 * items already taken from the unit (packed for orders) stay taken.
 */
const syncProductLines = (arrival, rows) => {
    const usedLines = new Set();
    const touchedTypes = new Set();
    let lastUnitId = maxUnitId();

    const lines = rows.map((row, index) => {
        const field = `warehouse_item_units[${index}]`;
        const product = products().find((p) => p.id === Number(row?.template)) || fail(field, 'Товар не знайдено.');
        const color = PRODUCT_COLORS.find((c) => c.id === Number(row.color)) || fail(field, 'Колір не знайдено.');
        const size = PRODUCT_SIZES.find((s) => s.id === Number(row.size)) || fail(field, 'Розмір не знайдено.');
        const quantity = toPositiveInt(row.initial_quantity, field, 'Кількість має бути цілим числом ≥ 1.');
        const cell = requireCell(row.cell, field);

        const saved = row.unit_id != null
            ? arrival.product_lines.find((l) => !usedLines.has(l) && l.unit_id === Number(row.unit_id))
            : null;
        if (saved) usedLines.add(saved);

        const unitId = saved?.unit_id ?? ++lastUnitId;
        let inStorage = quantity;
        let previous = null;
        if (saved) {
            previous = findUnit(saved.unit_id);
            const taken = saved.quantity - (previous?.unit.current_quantity ?? 0);
            inStorage = quantity - taken;
            if (inStorage < 0) {
                fail(field, `Позиція ${product.name} (${color.name}, ${size.width}x${size.length}): кількість не можна зменшити до ${quantity}, `
                    + `бо ${taken} од. з цієї накладної вже взято зі складу для замовлень (пакування). `
                    + `Мінімально можлива кількість — ${taken}.`);
            }
            if (previous) {
                previous.type.units.splice(previous.index, 1);
                touchedTypes.add(previous.type);
            }
        }

        let type = product.types.find((t) => t.color.id === color.id && t.size.id === size.id);
        if (!type) {
            type = { id: nextTypeId(), color, size, quantity: 0, units: [] };
            product.types.push(type);
        }
        touchedTypes.add(type);

        if (inStorage > 0) {
            const unit = { id: unitId, current_quantity: inStorage, cell: unitCellRef(cell) };
            // a unit staying in its variant keeps its place in the list
            if (previous?.type === type) type.units.splice(previous.index, 0, unit);
            else type.units.push(unit);
        }

        return {
            unit_id: unitId,
            template_id: product.id,
            color_id: color.id,
            size_id: size.id,
            quantity,
            price_uah: toPrice(row.price_uah, field),
            price_usd: toPrice(row.price_usd, field),
            cell_id: cell.id,
        };
    });

    // assumption: saved lines missing from the payload are dropped with what is left of their units (the forms never do this)
    arrival.product_lines.filter((l) => !usedLines.has(l)).forEach((line) => {
        const found = findUnit(line.unit_id);
        if (found) {
            found.type.units.splice(found.index, 1);
            touchedTypes.add(found.type);
        }
    });

    arrival.product_lines = lines;
    touchedTypes.forEach(recountVariant);
};

// ---- Saving with storage side effects ----

const restoreInPlace = (target, backup) => {
    if (Array.isArray(target)) {
        target.splice(0, target.length, ...backup);
    } else {
        Object.keys(target).forEach((key) => delete target[key]);
        Object.assign(target, backup);
    }
};

/**
 * Runs `change` on the live collections; if it fails or overfills a cell, everything is put back as it was
 * and a 400 response is returned. Otherwise the collections are persisted and null is returned.
 */
const saveWithStorage = (change) => {
    const live = { fabricArrivals: arrivals(), fabricRolls: fabricRolls(), fabrics: fabrics(), products: products() };
    const backup = structuredClone(live);
    const before = liveOccupancy();

    try {
        change();

        const after = liveOccupancy();
        // only cells this save puts more into: a cell already over capacity may keep what it holds
        const overfilled = Object.keys(after).find((cellId) =>
            after[cellId] > (before[cellId] ?? 0) && after[cellId] > cellCapacity(Number(cellId)));
        if (overfilled) {
            const cell = findWarehouseCell(overfilled);
            fail('cell', `Перевищено місткість комірки: склад ${cell.rack.warehouse.name} / стелаж ${cell.rack.name} / комірка ${cell.number} `
                + `(місткість ${cellCapacity(cell.id)}, разом з цією накладною ${after[overfilled]}).`);
        }
    } catch (error) {
        Object.entries(live).forEach(([name, collection]) => restoreInPlace(collection, backup[name]));
        if (error instanceof ArrivalError) {
            return HttpResponse.json({ [error.field]: [error.message] }, { status: 400 });
        }
        throw error;
    }

    Object.keys(live).forEach(saveCollection);
    return null;
};

const readJson = async (request) => {
    try {
        return await request.json();
    } catch {
        return {};
    }
};

export const fabricArrivalHandlers = [
    http.get(`${API}/warehouses/fabric-arrivals/currencies/`, withAuth(async () =>
        HttpResponse.json({ exchange_rate: await getUsdRate() })
    )),

    http.get(`${API}/warehouses/fabric-arrivals/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;

        const filtered = arrivals()
            .filter((a) => {
                if (q.get('with_fabric_rolls') === 'true' && !a.fabric_lines.length) return false;
                if (q.get('with_warehouse_item_units') === 'true' && !a.product_lines.length) return false;
                if (isSet(q.get('vendor')) && a.vendor_id !== Number(q.get('vendor'))) return false;
                return true;
            })
            // newest first, so a just-created arrival shows up on page 1
            .sort((a, b) => b.id - a.id);

        const { slice, totalPages, current } = paginate(filtered, q.get('page'), q.get('page_size') || ARRIVALS_PAGE_SIZE);

        return HttpResponse.json({
            fabric_arrivals: slice.map(serializeArrival),
            total_count: filtered.length,
            total_pages: totalPages,
            current_page: current,
        });
    })),

    http.post(`${API}/warehouses/fabric-arrivals/`, withAuth(async ({ request }) => {
        const body = await readJson(request);
        const fabricRows = Array.isArray(body.fabric_rolls) ? body.fabric_rolls : [];
        const productRows = Array.isArray(body.warehouse_item_units) ? body.warehouse_item_units : [];

        const arrival = {
            id: nextId(arrivals()),
            arrival_date: '',
            document_num: '',
            vendor_id: null,
            receiver_id: getRequestUser(request).id,
            uah_amount: money(0),
            usd_amount: money(0),
            exchange_rate: money(0),
            total_estimate: null,
            comment: null,
            fabric_lines: [],
            product_lines: [],
        };

        const error = saveWithStorage(() => {
            applyHeader(arrival, body, true);
            if (!fabricRows.length && !productRows.length) fail('fabric_rolls', 'Додайте хоча б одну позицію.');
            syncFabricLines(arrival, fabricRows);
            syncProductLines(arrival, productRows);
            arrivals().push(arrival);
        });
        if (error) return error;

        return HttpResponse.json(serializeArrival(arrival), { status: 201 });
    })),

    http.get(`${API}/warehouses/fabric-arrivals/:id/`, withAuth(({ params }) => {
        const arrival = findFabricArrival(params.id);
        return arrival ? HttpResponse.json(serializeArrival(arrival)) : notFound();
    })),

    http.patch(`${API}/warehouses/fabric-arrivals/:id/`, withAuth(async ({ request, params }) => {
        const arrival = findFabricArrival(params.id);
        if (!arrival) return notFound();
        const body = await readJson(request);

        const error = saveWithStorage(() => {
            applyHeader(arrival, body, false);
            // the product form also sends `fabric_rolls: []`; only a non-empty table replaces the other kind of goods
            if (Array.isArray(body.fabric_rolls) && (body.fabric_rolls.length || arrival.fabric_lines.length)) {
                syncFabricLines(arrival, body.fabric_rolls);
            }
            if (Array.isArray(body.warehouse_item_units)) syncProductLines(arrival, body.warehouse_item_units);
            if (!arrival.fabric_lines.length && !arrival.product_lines.length) fail('fabric_rolls', 'Додайте хоча б одну позицію.');
        });
        if (error) return error;

        return HttpResponse.json(serializeArrival(arrival));
    })),
];
