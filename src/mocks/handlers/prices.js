import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toBoolOrUndefined, paginate, notFound, getRequestUser } from './utils';
import { getCollection, saveCollection, nextId } from '../db';
import { C, col } from './calculatorTemplates';
import { DEMO_PRODUCTS } from '../data/products';
import { DEMO_PRICELISTS, PRICE_COUNT_KEYS } from '../data/pricelists';
import { DEMO_PRICES, DEMO_COST_PRICES, ARRIVAL_COSTS, ownerKey } from '../data/prices';

// Response shapes follow the original API, as consumed by NewPrices.jsx:
//   GET    /warehouses/prices/items/?is_warehouse_item_type|is_kit|is_kit_option|is_kit_component|
//          is_kit_component_option=true&page&name&has_price&prices_list_id
//          -> { items, total_count, total_pages, current_page }
//          item: { id, type, name, size, fabric_type, color, prices: [{ id, prices_list_id, price, manager_id }],
//                  cost_price: { item, auto_calculation: { uah, usd } | null, warning, last_exchange_rate } }
//   POST   /warehouses/prices/              { sell_price, prices_list, <owner field>: id } -> price
//   PATCH  /warehouses/prices/:id/          { sell_price } -> price
//   DELETE /warehouses/prices/:id/          -> 204; 400 when it is the owner's last price
//   POST   /production/cost_prices/         -> cost price item
//   PATCH  /production/cost_prices/:id/     -> cost price item
//   DELETE /production/cost_prices/:id/     -> 204
// Rows are built from the live products / templates collections, so renames and deletions there show up
// here. auto_calculation is the total cost: raw material (unit cost × quantity) + labor + packaging;
// without a cost price item it is the raw material unit cost from the last arrival, and without
// arrivals there is none (the page shows "Немає даних"). Only non-deleted pricelists count.
// Changes are persisted in the visitor's browser (src/mocks/db.js).

const PRICES = 'prices';
const COST_PRICES = 'costPrices';
const PAGE_SIZE = 25;

const prices = () => getCollection(PRICES, DEMO_PRICES);
const costPrices = () => getCollection(COST_PRICES, DEMO_COST_PRICES);
const products = () => getCollection('products', DEMO_PRODUCTS);
const pricelists = () => getCollection('pricelists', DEMO_PRICELISTS);

const activePricelistIds = () => new Set(pricelists().filter((pl) => !pl.deleted_at).map((pl) => pl.id));

const newestFirst = (a, b) => b.created.localeCompare(a.created) || b.id - a.id;
const named = (record) => record?.name ?? '';
const fabricTypeName = (id) => col(C.productTypes).find((t) => t.id === id)?.type ?? '';
const componentTypeName = (id) => named(col(C.componentTypes).find((t) => t.id === id));

const activeTemplates = (name) => col(name).filter((t) => !t.deleted_at).sort(newestFirst);

// owner field (as in the API payloads) -> list flag and the rows it lists, newest first
const OWNERS = {
    warehouse_item_type: {
        flag: 'is_warehouse_item_type',
        rows: () => [...products()]
            .sort((a, b) => b.id - a.id)
            .flatMap((product) => product.types.map((type) => ({
                id: type.id,
                type: named(product.category),
                name: product.name,
                size: type.size ? `${type.size.width}x${type.size.length}` : '',
                fabric_type: '',
                color: type.color?.hex ?? null,
            }))),
    },
    kit_template: {
        flag: 'is_kit',
        rows: () => activeTemplates(C.kitTemplates).map((kit) => ({
            id: kit.id,
            type: 'Комплект',
            name: kit.name,
            size: named(col(C.kitSizes).find((s) => s.id === kit.kit_size_id)),
            fabric_type: fabricTypeName(kit.fabric_type_id),
            color: null,
        })),
    },
    kit_option_template: {
        flag: 'is_kit_option',
        rows: () => activeTemplates(C.kitOptions).map((option) => ({
            id: option.id,
            type: 'Опція комплекту',
            name: option.name,
            size: '',
            fabric_type: '',
            color: null,
        })),
    },
    kit_component_template: {
        flag: 'is_kit_component',
        rows: () => activeTemplates(C.componentTemplates).map((component) => ({
            id: component.id,
            type: componentTypeName(component.type_id),
            name: component.name,
            size: component.size ?? '',
            fabric_type: fabricTypeName(component.fabric_type_id),
            color: null,
        })),
    },
    component_option_template: {
        flag: 'is_kit_component_option',
        rows: () => activeTemplates(C.componentOptions).map((option) => ({
            id: option.id,
            type: componentTypeName(option.type_id),
            name: option.name,
            size: '',
            fabric_type: '',
            color: null,
        })),
    },
};

const findOwnerRow = (owner, id) => OWNERS[owner]?.rows().find((row) => row.id === Number(id)) ?? null;

/** The owner field present in a payload ({ kit_template: 5, ... } -> ['kit_template', 5]), or null. */
const ownerFromPayload = (payload) => {
    const owner = PRICE_COUNT_KEYS.find((key) => isSet(payload[key]));
    return owner ? [owner, Number(payload[owner])] : null;
};

/** Prices of an owner in non-deleted pricelists. */
const ownerPrices = (owner, id, activeIds = activePricelistIds()) =>
    prices().filter((p) => p.owner === owner && p.owner_id === id && activeIds.has(p.prices_list_id));

/** Pricelist.jsx "price_count": prices of the pricelist per owner kind (deleted owners not counted). */
export const priceCountFor = (pricelistId) => {
    const listed = prices().filter((p) => p.prices_list_id === pricelistId);
    return Object.fromEntries(PRICE_COUNT_KEYS.map((owner) => {
        const ids = new Set(OWNERS[owner].rows().map((row) => row.id));
        return [owner, listed.filter((p) => p.owner === owner && ids.has(p.owner_id)).length];
    }));
};

// ---- Cost prices ----

const uah = (n) => Number(n ?? 0).toFixed(2);
const usd = (n) => Number(n ?? 0).toFixed(4);

const serializeCostItem = (item) => ({
    id: item.id,
    [item.owner]: item.owner_id,
    material: item.material,
    raw_material_unit_cost_price_uah: uah(item.raw_material_unit_cost_price_uah),
    raw_material_unit_cost_price_usd: usd(item.raw_material_unit_cost_price_usd),
    raw_material_quantity: Number(item.raw_material_quantity ?? 0).toFixed(2),
    labor_cost_price_uah: uah(item.labor_cost_price_uah),
    labor_cost_price_usd: usd(item.labor_cost_price_usd),
    packaging_cost_price_uah: uah(item.packaging_cost_price_uah),
    packaging_cost_price_usd: usd(item.packaging_cost_price_usd),
    exchange_rate: item.exchange_rate,
    manager: item.manager_id,
});

const autoCalculation = (arrival, item) => {
    if (!arrival) return null;
    if (!item) return { uah: uah(arrival.uah), usd: uah(arrival.usd) };
    const qty = Number(item.raw_material_quantity) || 0;
    const total = (unit, labor, packaging) => (Number(unit) || 0) * qty + (Number(labor) || 0) + (Number(packaging) || 0);
    return {
        uah: uah(total(item.raw_material_unit_cost_price_uah, item.labor_cost_price_uah, item.packaging_cost_price_uah)),
        usd: uah(total(item.raw_material_unit_cost_price_usd, item.labor_cost_price_usd, item.packaging_cost_price_usd)),
    };
};

const serializeCostPrice = (owner, id) => {
    const arrival = ARRIVAL_COSTS[ownerKey(owner, id)] ?? null;
    const item = costPrices().find((c) => c.owner === owner && c.owner_id === id) ?? null;
    return {
        item: item ? serializeCostItem(item) : null,
        auto_calculation: autoCalculation(arrival, item),
        warning: null,
        last_exchange_rate: arrival ? { exchange_rate: arrival.exchange_rate, arrival_date: arrival.arrival_date } : null,
    };
};

const COST_NUMBER_FIELDS = [
    'raw_material_unit_cost_price_uah',
    'raw_material_unit_cost_price_usd',
    'raw_material_quantity',
    'labor_cost_price_uah',
    'labor_cost_price_usd',
    'packaging_cost_price_uah',
    'packaging_cost_price_usd',
];

/** Field errors in the DRF format, or null when the cost price fields that were sent are valid. */
const validateCostFields = (payload) => {
    const errors = {};
    COST_NUMBER_FIELDS.forEach((field) => {
        if (payload[field] === undefined) return;
        const n = Number(payload[field]);
        if (!Number.isFinite(n)) errors[field] = ['A valid number is required.'];
        else if (n < 0) errors[field] = ['Ensure this value is greater than or equal to 0.'];
    });
    return Object.keys(errors).length ? errors : null;
};

const applyCostFields = (item, payload) => {
    COST_NUMBER_FIELDS.forEach((field) => {
        if (payload[field] !== undefined) item[field] = Number(payload[field]);
    });
    if (payload.exchange_rate != null) item.exchange_rate = Number(payload.exchange_rate);
};

// ---- Prices ----

const serializePrice = (price) => {
    const pl = pricelists().find((p) => p.id === price.prices_list_id);
    return {
        id: price.id,
        [price.owner]: price.owner_id,
        sell_price: price.price,
        price: price.price,
        prices_list: pl ? { id: pl.id, title: pl.title } : null,
        prices_list_id: price.prices_list_id,
        manager_id: price.manager_id,
    };
};

/** Validated sell price as a "0.00" string, or null. */
const parseSellPrice = (v) => {
    const n = Number(v);
    return isSet(v) && Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
};

const badRequest = (data) => HttpResponse.json(data, { status: 400 });

export const priceHandlers = [
    http.get(`${API}/warehouses/prices/items/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const owner = Object.keys(OWNERS).find((key) => q.get(OWNERS[key].flag) === 'true') ?? 'warehouse_item_type';
        // case-sensitive like the original backend (NewPrices.jsx retries with the first letter's case toggled)
        const name = isSet(q.get('name')) ? q.get('name').trim() : '';
        const hasPrice = toBoolOrUndefined(q.get('has_price'));
        const pricesListId = isSet(q.get('prices_list_id')) ? Number(q.get('prices_list_id')) : null;
        const activeIds = activePricelistIds();

        const filtered = OWNERS[owner].rows()
            .map((row) => ({ row, rowPrices: ownerPrices(owner, row.id, activeIds) }))
            .filter(({ row, rowPrices }) => {
                if (name && !row.name.includes(name)) return false;
                if (hasPrice !== undefined && (rowPrices.length > 0) !== hasPrice) return false;
                if (pricesListId != null && !rowPrices.some((p) => p.prices_list_id === pricesListId)) return false;
                return true;
            });

        const { slice, totalPages, current } = paginate(filtered, q.get('page'), q.get('page_size') || PAGE_SIZE);

        return HttpResponse.json({
            items: slice.map(({ row, rowPrices }) => ({
                ...row,
                prices: rowPrices.map((p) => ({
                    id: p.id,
                    prices_list_id: p.prices_list_id,
                    price: p.price,
                    manager_id: p.manager_id,
                })),
                cost_price: serializeCostPrice(owner, row.id),
            })),
            total_count: filtered.length,
            total_pages: totalPages,
            current_page: current,
        });
    })),

    http.post(`${API}/warehouses/prices/`, withAuth(async ({ request }) => {
        const payload = await request.json();
        const errors = {};
        const ownerRef = ownerFromPayload(payload);
        const sellPrice = parseSellPrice(payload.sell_price);
        const plId = Number(payload.prices_list);

        if (!ownerRef || !findOwnerRow(...ownerRef)) errors.non_field_errors = ['Price must belong to an existing item.'];
        if (!activePricelistIds().has(plId)) errors.prices_list = [`Invalid pk "${payload.prices_list}" - object does not exist.`];
        if (sellPrice == null) errors.sell_price = ['A valid number is required.'];
        if (!Object.keys(errors).length) {
            const [owner, ownerId] = ownerRef;
            if (prices().some((p) => p.owner === owner && p.owner_id === ownerId && p.prices_list_id === plId)) {
                errors.non_field_errors = ['The item already has a price in this pricelist.'];
            }
        }
        if (Object.keys(errors).length) return badRequest(errors);

        const [owner, ownerId] = ownerRef;
        const price = {
            id: nextId(prices()),
            owner,
            owner_id: ownerId,
            prices_list_id: plId,
            price: sellPrice,
            manager_id: getRequestUser(request)?.id ?? null,
        };
        prices().push(price);
        saveCollection(PRICES);

        return HttpResponse.json(serializePrice(price), { status: 201 });
    })),

    http.patch(`${API}/warehouses/prices/:id/`, withAuth(async ({ request, params }) => {
        const price = prices().find((p) => p.id === Number(params.id));
        if (!price) return notFound();

        const payload = await request.json();
        if (payload.sell_price !== undefined) {
            const sellPrice = parseSellPrice(payload.sell_price);
            if (sellPrice == null) return badRequest({ sell_price: ['A valid number is required.'] });
            price.price = sellPrice;
        }
        price.manager_id = getRequestUser(request)?.id ?? price.manager_id;
        saveCollection(PRICES);

        return HttpResponse.json(serializePrice(price));
    })),

    // an item must keep at least one price in the (non-deleted) pricelists
    http.delete(`${API}/warehouses/prices/:id/`, withAuth(({ params }) => {
        const index = prices().findIndex((p) => p.id === Number(params.id));
        if (index === -1) return notFound();

        const price = prices()[index];
        if (!ownerPrices(price.owner, price.owner_id).some((p) => p.id !== price.id)) {
            return badRequest({ error: 'Can not delete the last price of the item.' });
        }

        prices().splice(index, 1);
        saveCollection(PRICES);

        return new HttpResponse(null, { status: 204 });
    })),

    http.post(`${API}/production/cost_prices/`, withAuth(async ({ request }) => {
        const payload = await request.json();
        const ownerRef = ownerFromPayload(payload);
        if (!ownerRef || !findOwnerRow(...ownerRef)) {
            return badRequest({ non_field_errors: ['Cost price must belong to an existing item.'] });
        }
        const [owner, ownerId] = ownerRef;
        if (costPrices().some((c) => c.owner === owner && c.owner_id === ownerId)) {
            return badRequest({ non_field_errors: ['The item already has a cost price.'] });
        }
        const errors = validateCostFields(payload);
        if (errors) return badRequest(errors);

        const arrival = ARRIVAL_COSTS[ownerKey(owner, ownerId)];
        const item = {
            id: nextId(costPrices()),
            owner,
            owner_id: ownerId,
            material: arrival?.material ?? findOwnerRow(owner, ownerId).name,
            // not sent while there are no arrivals ("Немає даних"): the backend stores 0
            ...Object.fromEntries(COST_NUMBER_FIELDS.map((field) => [field, 0])),
            exchange_rate: null,
            manager_id: payload.manager ?? getRequestUser(request)?.id ?? null,
        };
        applyCostFields(item, payload);
        costPrices().push(item);
        saveCollection(COST_PRICES);

        return HttpResponse.json(serializeCostItem(item), { status: 201 });
    })),

    http.patch(`${API}/production/cost_prices/:id/`, withAuth(async ({ request, params }) => {
        const item = costPrices().find((c) => c.id === Number(params.id));
        if (!item) return notFound();

        const payload = await request.json();
        const errors = validateCostFields(payload);
        if (errors) return badRequest(errors);

        applyCostFields(item, payload);
        if (payload.manager != null) item.manager_id = payload.manager;
        saveCollection(COST_PRICES);

        return HttpResponse.json(serializeCostItem(item));
    })),

    http.delete(`${API}/production/cost_prices/:id/`, withAuth(({ params }) => {
        const index = costPrices().findIndex((c) => c.id === Number(params.id));
        if (index === -1) return notFound();

        costPrices().splice(index, 1);
        saveCollection(COST_PRICES);

        return new HttpResponse(null, { status: 204 });
    })),
];
