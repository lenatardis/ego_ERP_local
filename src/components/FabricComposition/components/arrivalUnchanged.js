// Demo build (2026-11-11, at the user's request): saving an edited arrival that wasn't changed
// is refused on the page. The arrival as loaded is turned into the same payload shape the page
// sends (`arrivalPayloadFromFabricResponse` / `…FromProductResponse`), and both are compared
// normalised: numbers to cents, numeric strings as numbers, empty text / null / undefined alike,
// object keys in any order. If something only looks different (no real edit), the save simply
// goes ahead as before – a real edit is never blocked.

export const NO_CHANGES_MESSAGE =
    'Для збереження відредагованої накладної внесіть зміни: поточна версія не відрізняється від збереженої.';

const parseNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const raw = String(value ?? '').trim().replace(',', '.').replace(/\s+/g, '');
    if (!raw) return NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
};

const cents = (n) => Math.round(n * 100) / 100;

const normalise = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? cents(value) : null;
    if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return null;
        const n = /^-?[\d\s]*[.,]?\d+$/.test(text) ? parseNumber(text) : NaN;
        return Number.isFinite(n) ? cents(n) : text;
    }
    if (Array.isArray(value)) return value.map(normalise);
    if (typeof value === 'object') {
        const out = {};
        Object.keys(value).sort().forEach((key) => {
            out[key] = normalise(value[key]);
        });
        return out;
    }
    return value;
};

export const isSameArrivalPayload = (a, b) =>
    Boolean(a && b) && JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));

const numberOrNull = (value) => {
    const n = parseNumber(value);
    return Number.isFinite(n) ? n : null;
};

const textOrNull = (value) => String(value ?? '').trim() || null;

// header fields, as the pages' onSave builds them; `dateRoundTrip` = the page's
// toBackendDate(fromBackendDate(date)), so the date goes through the same formatting
const headerFromResponse = (resp, dateRoundTrip) => ({
    vendor: Number(resp?.vendor?.id),
    receiver: Number(resp?.receiver?.id),
    arrival_date: dateRoundTrip(resp?.arrival_date),
    document_num: String(resp?.document_num ?? '').trim(),
    uah_amount: numberOrNull(resp?.uah_amount),
    usd_amount: numberOrNull(resp?.usd_amount),
    exchange_rate: numberOrNull(resp?.exchange_rate),
    total_estimate: textOrNull(resp?.total_estimate),
    comment: textOrNull(resp?.comment),
});

// fabric rows, as EditableFabricTable.validateAndBuildPayload builds them in edit mode
export const arrivalPayloadFromFabricResponse = (resp, dateRoundTrip) => ({
    ...headerFromResponse(resp, dateRoundTrip),
    fabric_rolls: (resp?.fabric_rolls || []).map((fr) => {
        const customLen = parseNumber(fr?.item?.initial_custom_length);
        const hasCustom = Number.isFinite(customLen) && customLen > 0;
        const row = {
            quantity: numberOrNull(fr?.quantity),
            item: {
                status: 'NEW',
                ...(hasCustom
                    ? { initial_custom_length: customLen }
                    : { initial_length: Number(fr?.item?.initial_length) }),
                price_uah: numberOrNull(fr?.item?.price_uah) || 0,
                price_usd: numberOrNull(fr?.item?.price_usd) || 0,
                fabric: Number(fr?.fabric?.id),
                cell: Number(fr?.cell_id ?? fr?.cell?.id),
            },
        };
        if (Array.isArray(fr?.ids) && fr.ids.length) row.ids = fr.ids.map(Number);
        return row;
    }),
});

// product units, as EditableProductTable.validateAndBuildPayload builds them in edit mode
export const arrivalPayloadFromProductResponse = (resp, dateRoundTrip) => ({
    ...headerFromResponse(resp, dateRoundTrip),
    fabric_rolls: [],
    warehouse_item_units: (resp?.warehouse_item_units || []).flatMap((t) =>
        (t?.units || []).map((u) => {
            const one = {
                cell: Number(u?.cell_id ?? u?.cell?.id),
                price_uah: numberOrNull(u?.price_uah),
                price_usd: numberOrNull(u?.price_usd),
                initial_quantity: numberOrNull(u?.quantity),
                template: Number(t?.warehouse_item_template?.id),
                size: Number(u?.size?.id),
                color: Number(u?.color?.id),
            };
            if (u?.unit_id != null) one.unit_id = Number(u.unit_id);
            return one;
        })
    ),
});
