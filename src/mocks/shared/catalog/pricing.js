// How the CRM prices catalog records for an order (workspace CLAUDE.md, "Cross-app contract"). Shared because
// the seed (../seed.js) builds the seed orders' carts — and from them the order totals, bills and bank
// payments — with the same prices the CRM charges when a product is added or a kit is saved.

import { DEMO_PRICELISTS, DEMO_SOURCES } from './pricelists';
import { DEMO_PRICES } from './prices';

// The price comes from the pricelist of the order's source (DEMO_SOURCES.prices_list_id) while that list is
// active; a record the list has no price for, or an order without a source, takes the price of the default
// list ("Стандартний список ... з якого будуть братись ціни якщо немає іншого активного списку"). No price in
// either -> null.

const isActiveList = (list) => list && list.status === 'ACTIVE' && !list.deleted_at;
const DEFAULT_LIST = DEMO_PRICELISTS.find((pl) => pl.is_default && isActiveList(pl));

const listPrice = (owner, ownerId, listId) => {
    const p = DEMO_PRICES.find((x) => x.owner === owner && x.owner_id === Number(ownerId) && x.prices_list_id === listId);
    return p ? Number(p.price) : null;
};

/** Sell price (number) of a catalog record (owner: 'kit_template', 'warehouse_item_type', ...) for an order source, or null. */
export const priceFor = (owner, ownerId, sourceId) => {
    const source = DEMO_SOURCES.find((s) => String(s.id) === String(sourceId));
    const list = source && DEMO_PRICELISTS.find((pl) => pl.id === source.prices_list_id);
    const fromSource = isActiveList(list) ? listPrice(owner, ownerId, list.id) : null;
    return fromSource ?? (DEFAULT_LIST ? listPrice(owner, ownerId, DEFAULT_LIST.id) : null);
};

// Kit templates are made for the CRM product types (сатин, бязь, полікотон — kit / component templates'
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

/** Order total after its discount — the CRM's own formula (ego_CRM_local/src/utils/getPriceWithDiscount.js). */
export const priceWithDiscount = (total, discountType, discountValue) => {
    if (!total) return 0;
    return discountType === 'PERC'
        ? Math.ceil(total - (total * discountValue) / 100)
        : total - discountValue;
};
