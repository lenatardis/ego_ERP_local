import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toBoolOrUndefined, paginate, notFound } from './utils';
import { getCollection, saveCollection, nextId } from '../db';
import { DEMO_PRICELISTS, DEMO_SOURCES, emptyPriceCount } from '../data/pricelists';
import { toIso } from '../data/vendors';

// Response shapes follow the original API, as consumed by Pricelist.jsx, Sources.jsx and NewPrices.jsx:
//   GET    /warehouses/prices-lists/       -> { prices_lists, total_count, total_pages, current_page }
//   POST   /warehouses/prices-lists/       -> pricelist (400 { is_default: [...] } on a second default)
//   PATCH  /warehouses/prices-lists/:id/   -> pricelist
//   DELETE /warehouses/prices-lists/:id/   -> 204 (400 { is_default: [...] } for the default pricelist)
//   GET    /warehouses/sources/            -> { sources, total_count, total_pages, current_page }
//   POST   /warehouses/sources/            -> source
//   PATCH  /warehouses/sources/:id/        -> source
//   DELETE /warehouses/sources/:id/?ignore_warning=<bool>
//          -> 204, or 400 { error: "Ви дійсно хочете ..." } while the source is used by orders
// Deletes are soft (deleted_at). A source keeps pointing to a deleted pricelist and gets it with its
// deleted_at, which Sources.jsx shows as "—". Changes are persisted in the visitor's browser (src/mocks/db.js).

const PRICELISTS = 'pricelists';
const SOURCES = 'sources';

const MAX_TITLE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 100;
const STATUSES = ['ACTIVE', 'DEPRECATED'];

const pricelists = () => getCollection(PRICELISTS, DEMO_PRICELISTS);
const sources = () => getCollection(SOURCES, DEMO_SOURCES);

const findPricelist = (id) => pricelists().find((p) => p.id === Number(id));
const findActivePricelist = (id) => pricelists().find((p) => p.id === Number(id) && !p.deleted_at);
const findActiveSource = (id) => sources().find((s) => s.id === Number(id) && !s.deleted_at);

const newestFirst = (a, b) => b.created.localeCompare(a.created) || b.id - a.id;
const includesText = (value, search) => String(value ?? '').toLowerCase().includes(search);

const serializePricelist = (pl) => ({
    id: pl.id,
    title: pl.title,
    description: pl.description,
    status: pl.status,
    is_default: pl.is_default,
    price_count: { ...pl.price_count },
    sources: sources()
        .filter((s) => s.prices_list_id === pl.id && !s.deleted_at)
        .sort((a, b) => a.id - b.id)
        .map((s) => ({ id: s.id, name: s.name })),
    created: pl.created,
    modified: pl.modified,
    deleted_at: pl.deleted_at,
});

const serializeSource = (source) => {
    const pl = findPricelist(source.prices_list_id);
    return {
        id: source.id,
        name: source.name,
        prices_list: pl
            ? { id: pl.id, title: pl.title, status: pl.status, is_default: pl.is_default, deleted_at: pl.deleted_at }
            : null,
        created: source.created,
        modified: source.modified,
        deleted_at: source.deleted_at,
    };
};

const badRequest = (data) => HttpResponse.json(data, { status: 400 });

/** Field errors in the DRF format ({ field: [message] }), or null when the pricelist payload is valid. */
const validatePricelist = (payload, currentId = null) => {
    const errors = {};
    const title = String(payload.title ?? '').trim();
    const description = String(payload.description ?? '').trim();

    if (!title) errors.title = ['This field may not be blank.'];
    else if (title.length > MAX_TITLE_LENGTH) errors.title = [`Ensure this field has no more than ${MAX_TITLE_LENGTH} characters.`];
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        errors.description = [`Ensure this field has no more than ${MAX_DESCRIPTION_LENGTH} characters.`];
    }
    if (payload.status !== undefined && !STATUSES.includes(payload.status)) {
        errors.status = [`"${payload.status}" is not a valid choice.`];
    }
    if (payload.is_default && pricelists().some((p) => p.is_default && !p.deleted_at && p.id !== currentId)) {
        errors.is_default = ['Multiple default priceslist is not allowed.'];
    }
    return Object.keys(errors).length ? errors : null;
};

/** Field errors for a source payload, or null when valid. */
const validateSource = (payload) => {
    const errors = {};
    const name = String(payload.name ?? '').trim();

    if (!name) errors.name = ['This field may not be blank.'];
    else if (name.length > MAX_TITLE_LENGTH) errors.name = [`Ensure this field has no more than ${MAX_TITLE_LENGTH} characters.`];
    if (!findActivePricelist(payload.prices_list)) {
        errors.prices_list = [`Invalid pk "${payload.prices_list}" - object does not exist.`];
    }
    return Object.keys(errors).length ? errors : null;
};

const ordersWord = (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'замовленні';
    return 'замовленнях';
};

export const pricelistHandlers = [
    http.get(`${API}/warehouses/prices-lists/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const title = isSet(q.get('title')) ? q.get('title').trim().toLowerCase() : '';
        const status = isSet(q.get('status')) ? q.get('status').trim() : '';
        const isDefault = toBoolOrUndefined(q.get('is_default'));

        const filtered = pricelists()
            .filter((p) => {
                if (p.deleted_at) return false;
                if (title && !includesText(p.title, title)) return false;
                if (status && p.status !== status) return false;
                if (isDefault !== undefined && p.is_default !== isDefault) return false;
                return true;
            })
            // newest first, so a just-created pricelist shows up on page 1
            .sort(newestFirst);

        const { slice, totalPages, current } = paginate(filtered, q.get('page'), q.get('page_size'));

        return HttpResponse.json({
            prices_lists: slice.map(serializePricelist),
            total_count: filtered.length,
            total_pages: totalPages,
            current_page: current,
        });
    })),

    http.post(`${API}/warehouses/prices-lists/`, withAuth(async ({ request }) => {
        const payload = await request.json();
        const errors = validatePricelist(payload);
        if (errors) return badRequest(errors);

        const now = toIso(new Date());
        const pricelist = {
            id: nextId(pricelists()),
            title: payload.title.trim(),
            description: String(payload.description ?? '').trim(),
            status: payload.status ?? 'ACTIVE',
            is_default: !!payload.is_default,
            price_count: emptyPriceCount(),
            created: now,
            modified: now,
            deleted_at: null,
        };

        pricelists().push(pricelist);
        saveCollection(PRICELISTS);

        return HttpResponse.json(serializePricelist(pricelist), { status: 201 });
    })),

    http.patch(`${API}/warehouses/prices-lists/:id/`, withAuth(async ({ request, params }) => {
        const pricelist = findActivePricelist(params.id);
        if (!pricelist) return notFound();

        const payload = await request.json();
        const errors = validatePricelist({ ...pricelist, ...payload }, pricelist.id);
        if (errors) return badRequest(errors);

        if (payload.title !== undefined) pricelist.title = String(payload.title).trim();
        if (payload.description !== undefined) pricelist.description = String(payload.description).trim();
        if (payload.status !== undefined) pricelist.status = payload.status;
        if (payload.is_default !== undefined) pricelist.is_default = !!payload.is_default;
        pricelist.modified = toIso(new Date());
        saveCollection(PRICELISTS);

        return HttpResponse.json(serializePricelist(pricelist));
    })),

    // soft delete: sources keep their link and receive the pricelist with its deleted_at;
    // the default pricelist can't be deleted until another one is made default
    http.delete(`${API}/warehouses/prices-lists/:id/`, withAuth(({ params }) => {
        const pricelist = findActivePricelist(params.id);
        if (!pricelist) return notFound();
        if (pricelist.is_default) return badRequest({ is_default: ['Default priceslist can not be deleted.'] });

        pricelist.deleted_at = toIso(new Date());
        saveCollection(PRICELISTS);

        return new HttpResponse(null, { status: 204 });
    })),

    http.get(`${API}/warehouses/sources/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const name = isSet(q.get('name')) ? q.get('name').trim().toLowerCase() : '';
        const isDeleted = toBoolOrUndefined(q.get('is_deleted'));

        const filtered = sources()
            .filter((s) => {
                if (isDeleted !== undefined && !!s.deleted_at !== isDeleted) return false;
                if (name && !includesText(s.name, name)) return false;
                return true;
            })
            // newest first, so a just-created source shows up on page 1
            .sort(newestFirst);

        const { slice, totalPages, current } = paginate(filtered, q.get('page'), q.get('page_size'));

        return HttpResponse.json({
            sources: slice.map(serializeSource),
            total_count: filtered.length,
            total_pages: totalPages,
            current_page: current,
        });
    })),

    http.post(`${API}/warehouses/sources/`, withAuth(async ({ request }) => {
        const payload = await request.json();
        const errors = validateSource(payload);
        if (errors) return badRequest(errors);

        const now = toIso(new Date());
        const source = {
            id: nextId(sources()),
            name: payload.name.trim(),
            prices_list_id: Number(payload.prices_list),
            orders_count: 0,
            created: now,
            modified: now,
            deleted_at: null,
        };

        sources().push(source);
        saveCollection(SOURCES);

        return HttpResponse.json(serializeSource(source), { status: 201 });
    })),

    http.patch(`${API}/warehouses/sources/:id/`, withAuth(async ({ request, params }) => {
        const source = findActiveSource(params.id);
        if (!source) return notFound();

        const payload = await request.json();
        const errors = validateSource({ name: source.name, prices_list: source.prices_list_id, ...payload });
        if (errors) return badRequest(errors);

        if (payload.name !== undefined) source.name = String(payload.name).trim();
        if (payload.prices_list !== undefined) source.prices_list_id = Number(payload.prices_list);
        source.modified = toIso(new Date());
        saveCollection(SOURCES);

        return HttpResponse.json(serializeSource(source));
    })),

    // soft delete; a source used by orders needs a confirmed second request (ignore_warning=true)
    http.delete(`${API}/warehouses/sources/:id/`, withAuth(({ request, params }) => {
        const source = findActiveSource(params.id);
        if (!source) return notFound();

        const ignoreWarning = new URL(request.url).searchParams.get('ignore_warning') === 'true';
        if (source.orders_count > 0 && !ignoreWarning) {
            return badRequest({
                error:
                    `Джерело «${source.name}» вказане в ${source.orders_count} ${ordersWord(source.orders_count)}.\\n` +
                    'Ви дійсно хочете його видалити? Існуючі замовлення збережуть джерело.',
            });
        }

        source.deleted_at = toIso(new Date());
        saveCollection(SOURCES);

        return new HttpResponse(null, { status: 204 });
    })),
];
