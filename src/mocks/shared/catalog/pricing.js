// How the CRM prices catalog records for an order (workspace CLAUDE.md, "Cross-app contract"). Shared because
// the seed (../seed.js) builds the seed orders' carts – and from them the order totals, bills and bank
// payments – with the same prices the CRM charges when a product is added or a kit is saved.

import { DEMO_PRICELISTS, DEMO_SOURCES } from './pricelists';
import { DEMO_PRICES, LATE_PRICE_IDS } from './prices';

// The price comes from the pricelist of the order's source (DEMO_SOURCES.prices_list_id) while that list is
// active; a record the list has no price for, or an order without a source, takes the price of the default
// list ("Стандартний список ... з якого будуть братись ціни якщо немає іншого активного списку"). No price in
// either -> null.
//
// `live` – what to price from: { sources, pricelists, prices }, each optional, the seed's by default (the seed itself
// prices its carts with the defaults, so they never change). The CRM passes the live shared collections, which the
// ERP edits (sources since step 7.6a, pricelists and prices since step 11, workspace CLAUDE.md): a source moved to
// another pricelist, a list deactivated or made default, a price changed – the CRM prices from it at once.

const isActiveList = (list) => list && list.status === 'ACTIVE' && !list.deleted_at;

const listRecord = (prices, owner, ownerId, listId) =>
    prices.find((x) => x.owner === owner && x.owner_id === Number(ownerId) && x.prices_list_id === listId) ?? null;

/** The price record an order of this source is priced from (source's active list, else the default list), or null. */
const priceRecordFor = (owner, ownerId, sourceId, live = {}) => {
    const { sources = DEMO_SOURCES, pricelists = DEMO_PRICELISTS, prices = DEMO_PRICES } = live;
    const source = sources.find((s) => String(s.id) === String(sourceId));
    const list = source && pricelists.find((pl) => pl.id === source.prices_list_id);
    const fromSource = isActiveList(list) ? listRecord(prices, owner, ownerId, list.id) : null;
    const defaultList = pricelists.find((pl) => pl.is_default && isActiveList(pl));
    return fromSource ?? (defaultList ? listRecord(prices, owner, ownerId, defaultList.id) : null);
};

/**
 * Sell price (number) of a catalog record (owner: 'kit_template', 'warehouse_item_type', ...) for an order source, or
 * null. `live`: see above.
 */
export const priceFor = (owner, ownerId, sourceId, live) => {
    const record = priceRecordFor(owner, ownerId, sourceId, live);
    return record ? Number(record.price) : null;
};

/**
 * True when a kit's price for this source comes only from the default-list price added later (LATE_PRICED_KITS,
 * prices.js) – the seed's carts skip such kits, so they are exactly what they were before those prices existed.
 * Seed only (seed prices).
 */
export const isLatePriced = (owner, ownerId, sourceId) =>
    LATE_PRICE_IDS.has(priceRecordFor(owner, ownerId, sourceId)?.id);

// Kit templates are made for the CRM product types (сатин, бязь, полікотон – kit / component templates'
// fabric_type_id), while fabrics carry the ERP warehouse types: which product type's kits a fabric of a
// warehouse type is sewn into. Types without an entry (Перкаль, Муслін) have no kit templates.
const PRODUCT_TYPE_OF_FABRIC_TYPE = {
    1: 2, // Бязь -> бязь
    2: 1, // Страйп-сатин -> сатин
    3: 1, // Сатин -> сатин
    4: 1, // LUX Digital Sateen -> сатин
    5: 3, // Поплін -> полікотон
    6: 2, // Ранфорс -> бязь
};
export const productTypeOfFabric = (fabric) => PRODUCT_TYPE_OF_FABRIC_TYPE[fabric?.type?.id] ?? null;

export const fabricTotalLength = (f) => f.opened_length_remainder + f.new_length_remainder;

/** Order total after its discount – the CRM's own formula (ego_CRM_local/src/utils/getPriceWithDiscount.js). */
export const priceWithDiscount = (total, discountType, discountValue) => {
    if (!total) return 0;
    return discountType === 'PERC'
        ? Math.ceil(total - (total * discountValue) / 100)
        : total - discountValue;
};
