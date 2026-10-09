import { http, HttpResponse } from 'msw';
import { API, AUTH_API, withAuth, isSet, toBoolOrUndefined, paginate, notFound, imageFileToUrl } from './utils';
import { getCollection, saveCollection, nextId } from '../db';
import {
    DEMO_PRODUCT_TYPES,
    DEMO_COMPONENT_TYPES,
    DEMO_OPTION_PARTS,
    DEMO_COMPONENT_OPTION_TEMPLATES,
    DEMO_KIT_OPTION_TEMPLATES,
    DEMO_COMPONENT_TEMPLATES,
    DEMO_KIT_SIZES,
    DEMO_KIT_TEMPLATES,
} from '../data/calculatorTemplates';
import { toIso } from '../data/vendors';

// Bedding templates section (Шаблони постільної білизни). Response shapes follow the original API,
// as consumed by the Templates/* pages:
//   GET  /api/v1/products/type/ (CRM)               -> [{ id, type, is_available }]  (fabric types, no pagination)
//   /calculator/component-types/                    -> { component_types, ... }            POST/PATCH: FormData
//   /calculator/option-parts/?type=component|kit    -> { option_parts, ... }               POST/PATCH: JSON { name, type }
//                                                      DELETE needs ?type= (400 without it, like the original)
//   /calculator/component-option-templates/         -> { component_option_templates, ... } POST/PATCH: JSON
//   /calculator/kit-option-templates/               -> { kit_option_templates, ... }       POST/PATCH: FormData
//   /calculator/component-templates/                -> { component_templates, ... }        POST/PATCH: FormData
//   /calculator/kit-sizes/                          -> { kit_sizes, ... }                  POST/PATCH: JSON
//   /calculator/kit-templates/                      -> { kit_templates, ... }              POST/PATCH: FormData
// Lists also carry total_count / total_pages / current_page and sort newest-created first.
// Deletes are soft (deleted_at); related records keep pointing to a deleted record and receive it with its
// deleted_at (the option pages hide deleted parts). Changes are persisted in the visitor's browser (src/mocks/db.js).

const C = {
    productTypes: 'crmProductTypes',
    componentTypes: 'componentTypes',
    optionParts: 'optionParts',
    componentOptions: 'componentOptionTemplates',
    kitOptions: 'kitOptionTemplates',
    componentTemplates: 'componentTemplates',
    kitSizes: 'kitSizes',
    kitTemplates: 'kitTemplates',
};

const SEEDS = {
    [C.productTypes]: DEMO_PRODUCT_TYPES,
    [C.componentTypes]: DEMO_COMPONENT_TYPES,
    [C.optionParts]: DEMO_OPTION_PARTS,
    [C.componentOptions]: DEMO_COMPONENT_OPTION_TEMPLATES,
    [C.kitOptions]: DEMO_KIT_OPTION_TEMPLATES,
    [C.componentTemplates]: DEMO_COMPONENT_TEMPLATES,
    [C.kitSizes]: DEMO_KIT_SIZES,
    [C.kitTemplates]: DEMO_KIT_TEMPLATES,
};

const col = (name) => getCollection(name, SEEDS[name]);
const findIn = (name, id) => col(name).find((x) => x.id === Number(id));
const findActiveIn = (name, id) => col(name).find((x) => x.id === Number(id) && !x.deleted_at);

const PART_TYPES = ['component', 'kit'];
const MONO_FABRIC_TYPES = ['A', 'B', 'AB'];
const MAX_NAME = 100;
const MAX_SHORT = 10;

const findPart = (id, type) => col(C.optionParts).find((p) => p.id === Number(id) && p.type === type);
const nextPartId = (type) => nextId(col(C.optionParts).filter((p) => p.type === type));

const newestFirst = (a, b) => b.created.localeCompare(a.created) || b.id - a.id;
const lower = (v) => (isSet(v) ? String(v).trim().toLowerCase() : '');
const includesText = (value, search) => String(value ?? '').toLowerCase().includes(search);
const toIds = (v) => (isSet(v) ? String(v).split(',').map(Number).filter(Number.isFinite) : []);
const now = () => toIso(new Date());

const badRequest = (errors) => HttpResponse.json(errors, { status: 400 });
const noContent = () => new HttpResponse(null, { status: 204 });

const listResponse = (key, items, q, serialize) => {
    const { slice, totalPages, current } = paginate(items.sort(newestFirst), q.get('page'), q.get('page_size'));
    return HttpResponse.json({
        [key]: slice.map(serialize),
        total_count: items.length,
        total_pages: totalPages,
        current_page: current,
    });
};

/** Shared list filters: is_deleted + text search on the given fields (query param name = field name). */
const baseFilter = (q, textFields) => {
    const isDeleted = toBoolOrUndefined(q.get('is_deleted'));
    const texts = textFields.map((f) => [f, lower(q.get(f))]).filter(([, v]) => v);
    return (item) => {
        if (isDeleted !== undefined && !!item.deleted_at !== isDeleted) return false;
        return texts.every(([f, v]) => includesText(item[f], v));
    };
};

// ---- validation (DRF error format { field: [message] }) ----

const blank = ['This field may not be blank.'];
const tooLong = (n) => [`Ensure this field has no more than ${n} characters.`];
const missing = (v) => [`Invalid pk "${v}" - object does not exist.`];

const checkText = (errors, field, value, max, required = true) => {
    const s = String(value ?? '').trim();
    if (required && !s) errors[field] = blank;
    else if (s.length > max) errors[field] = tooLong(max);
};

const checkRef = (errors, field, collection, id) => {
    if (!findActiveIn(collection, id)) errors[field] = missing(id);
};

const checkParts = (errors, partIds, type) => {
    const bad = partIds.find((id) => !findPart(id, type) || findPart(id, type).deleted_at);
    if (bad !== undefined) errors.part = missing(bad);
};

const result = (errors) => (Object.keys(errors).length ? errors : null);

// ---- FormData helpers ----

const fdText = (fd, key) => (fd.has(key) ? String(fd.get(key)) : undefined);

const fdIdList = (fd, key) => {
    if (!fd.has(key)) return undefined;
    try {
        const arr = JSON.parse(String(fd.get(key)));
        return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    } catch {
        return [];
    }
};

/** Reads an uploaded `image` file; undefined when the request did not send one (keep the old image). */
const fdImage = async (fd) => {
    const file = fd.get('image');
    return file instanceof File && file.size > 0 ? imageFileToUrl(file) : undefined;
};

// ---- serializers: related records are expanded from their ids ----

const ref = (record, fields) => (record ? Object.fromEntries(['id', ...fields, 'deleted_at'].map((f) => [f, record[f]])) : null);

const serializeProductTypeRef = (id) => ref(findIn(C.productTypes, id), ['type']);
const serializeComponentType = (t) => ({ ...t });
const serializePart = (p) => ({ id: p.id, name: p.name, type: p.type, created: p.created, deleted_at: p.deleted_at });
const expandParts = (ids, type) => ids.map((id) => findPart(id, type)).filter(Boolean).map(serializePart);

const serializeComponentOption = ({ type_id, part_ids, ...o }) => ({
    ...o,
    type: ref(findIn(C.componentTypes, type_id), ['name', 'mono_fabric_type', 'image']),
    part: expandParts(part_ids, 'component'),
});

const serializeKitOption = ({ part_ids, ...o }) => ({ ...o, part: expandParts(part_ids, 'kit') });

const serializeComponentTemplate = ({ type_id, fabric_type_id, ...t }) => ({
    ...t,
    type: ref(findIn(C.componentTypes, type_id), ['name']),
    fabric_type: serializeProductTypeRef(fabric_type_id),
});

const serializeKitSize = (s) => ({ ...s });

const serializeKitTemplate = ({ kit_size_id, fabric_type_id, component_ids, ...k }) => ({
    ...k,
    template: ref(findIn(C.kitSizes, kit_size_id), ['name', 'short_name']),
    fabric_type: serializeProductTypeRef(fabric_type_id),
    component_size: [...component_ids],
});

// ---- generic CRUD for the simple collections ----

/**
 * GET list / POST / PATCH / DELETE for a collection.
 * `read(request)` turns the request body into a plain patch, `validate(merged)` returns DRF errors or null,
 * `apply(record, patch)` copies the patch onto the record.
 */
const crud = ({ path, collection, listKey, textFilters, extraFilter, serialize, read, validate, apply, defaults }) => [
    http.get(`${API}${path}`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const matches = baseFilter(q, textFilters);
        const extra = extraFilter ? extraFilter(q) : () => true;
        const items = col(collection).filter((x) => matches(x) && extra(x));
        return listResponse(listKey, items, q, serialize);
    })),

    http.post(`${API}${path}`, withAuth(async ({ request }) => {
        const patch = await read(request);
        const errors = validate({ ...defaults, ...patch });
        if (errors) return badRequest(errors);

        const ts = now();
        const record = { id: nextId(col(collection)), ...defaults, created: ts, modified: ts, deleted_at: null };
        apply(record, patch);
        col(collection).push(record);
        saveCollection(collection);

        return HttpResponse.json(serialize(record), { status: 201 });
    })),

    http.patch(`${API}${path}:id/`, withAuth(async ({ request, params }) => {
        const record = findActiveIn(collection, params.id);
        if (!record) return notFound();

        const patch = await read(request);
        const errors = validate({ ...record, ...patch });
        if (errors) return badRequest(errors);

        apply(record, patch);
        record.modified = now();
        saveCollection(collection);

        return HttpResponse.json(serialize(record));
    })),

    http.delete(`${API}${path}:id/`, withAuth(({ params }) => {
        const record = findActiveIn(collection, params.id);
        if (!record) return notFound();

        record.deleted_at = now();
        saveCollection(collection);
        return noContent();
    })),
];

/** Copies the defined keys of a patch onto a record (trimming strings). */
const assignDefined = (record, patch) => {
    Object.entries(patch).forEach(([key, value]) => {
        if (value !== undefined) record[key] = typeof value === 'string' ? value.trim() : value;
    });
};

const withoutUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export const calculatorTemplateHandlers = [
    // fabric types live in the CRM (shared with the Ego CRM demo); no pagination
    http.get(`${AUTH_API}/products/type/`, withAuth(() =>
        HttpResponse.json(col(C.productTypes).map((t) => ({ ...t })))
    )),

    // ---- Типи компонентів ----
    ...crud({
        path: '/calculator/component-types/',
        collection: C.componentTypes,
        listKey: 'component_types',
        textFilters: ['name'],
        serialize: serializeComponentType,
        defaults: { name: '', mono_fabric_type: 'A', image: '' },
        read: async (request) => {
            const fd = await request.formData();
            return withoutUndefined({
                name: fdText(fd, 'name'),
                mono_fabric_type: fdText(fd, 'mono_fabric_type'),
                image: await fdImage(fd),
            });
        },
        validate: (t) => {
            const errors = {};
            checkText(errors, 'name', t.name, MAX_NAME);
            if (!MONO_FABRIC_TYPES.includes(t.mono_fabric_type)) {
                errors.mono_fabric_type = [`"${t.mono_fabric_type}" is not a valid choice.`];
            }
            return result(errors);
        },
        apply: assignDefined,
    }),

    // ---- Частини опцій: two id spaces (component / kit), the request's `type` picks one ----
    http.get(`${API}/calculator/option-parts/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const matches = baseFilter(q, ['name']);
        const type = isSet(q.get('type')) ? q.get('type').trim() : '';
        const items = col(C.optionParts).filter((p) => matches(p) && (!type || p.type === type));
        return listResponse('option_parts', items, q, serializePart);
    })),

    // `id` is honoured when free: OptionParts.jsx moves a part to the other type as delete + create with the same id
    http.post(`${API}/calculator/option-parts/`, withAuth(async ({ request }) => {
        const payload = await request.json();
        const errors = {};
        checkText(errors, 'name', payload.name, MAX_NAME);
        if (!PART_TYPES.includes(payload.type)) errors.type = [`"${payload.type ?? ''}" is not a valid choice.`];
        if (result(errors)) return badRequest(errors);

        const wanted = Number(payload.id);
        const id = Number.isInteger(wanted) && wanted > 0 && !findPart(wanted, payload.type)
            ? wanted
            : nextPartId(payload.type);
        const part = { id, name: payload.name.trim(), type: payload.type, created: now(), deleted_at: null };
        col(C.optionParts).push(part);
        saveCollection(C.optionParts);

        return HttpResponse.json(serializePart(part), { status: 201 });
    })),

    http.patch(`${API}/calculator/option-parts/:id/`, withAuth(async ({ request, params }) => {
        const payload = await request.json();
        const part = findPart(params.id, payload.type);
        if (!part || part.deleted_at) return notFound();

        const errors = {};
        checkText(errors, 'name', payload.name ?? part.name, MAX_NAME);
        if (result(errors)) return badRequest(errors);

        if (payload.name !== undefined) part.name = String(payload.name).trim();
        saveCollection(C.optionParts);

        return HttpResponse.json(serializePart(part));
    })),

    http.delete(`${API}/calculator/option-parts/:id/`, withAuth(({ request, params }) => {
        const type = new URL(request.url).searchParams.get('type');
        if (!PART_TYPES.includes(type)) return badRequest({ type: ["Can't delete option part if type isn't known"] });

        const part = findPart(params.id, type);
        if (!part || part.deleted_at) return notFound();

        part.deleted_at = now();
        saveCollection(C.optionParts);
        return noContent();
    })),

    // ---- Опції компонентів ----
    ...crud({
        path: '/calculator/component-option-templates/',
        collection: C.componentOptions,
        listKey: 'component_option_templates',
        textFilters: ['name'],
        extraFilter: (q) => {
            const typeIds = toIds(q.get('type_ids'));
            const partIds = toIds(q.get('part_ids'));
            return (o) =>
                (!typeIds.length || typeIds.includes(o.type_id))
                && (!partIds.length || o.part_ids.some((id) => partIds.includes(id)));
        },
        serialize: serializeComponentOption,
        defaults: { name: '', description: '', type_id: null, part_ids: [] },
        read: async (request) => {
            const p = await request.json();
            return withoutUndefined({
                name: p.name,
                description: p.description,
                type_id: p.type !== undefined ? Number(p.type) : undefined,
                part_ids: Array.isArray(p.part) ? p.part.map(Number) : undefined,
            });
        },
        validate: (o) => {
            const errors = {};
            checkText(errors, 'name', o.name, MAX_NAME);
            checkText(errors, 'description', o.description, MAX_NAME, false);
            checkRef(errors, 'type', C.componentTypes, o.type_id);
            checkParts(errors, o.part_ids, 'component');
            return result(errors);
        },
        apply: assignDefined,
    }),

    // ---- Опції комплектів ----
    ...crud({
        path: '/calculator/kit-option-templates/',
        collection: C.kitOptions,
        listKey: 'kit_option_templates',
        textFilters: ['name'],
        serialize: serializeKitOption,
        defaults: { name: '', description: '', image: '', part_ids: [] },
        read: async (request) => {
            const fd = await request.formData();
            return withoutUndefined({
                name: fdText(fd, 'name'),
                description: fdText(fd, 'description'),
                part_ids: fdIdList(fd, 'part'),
                image: await fdImage(fd),
            });
        },
        validate: (o) => {
            const errors = {};
            checkText(errors, 'name', o.name, MAX_NAME);
            checkText(errors, 'description', o.description, MAX_NAME, false);
            checkParts(errors, o.part_ids, 'kit');
            return result(errors);
        },
        apply: assignDefined,
    }),

    // ---- Компоненти ----
    ...crud({
        path: '/calculator/component-templates/',
        collection: C.componentTemplates,
        listKey: 'component_templates',
        textFilters: ['name', 'short_name'],
        extraFilter: (q) => {
            const typeId = isSet(q.get('type_id')) ? Number(q.get('type_id')) : null;
            const fabricTypeId = isSet(q.get('fabric_type_id')) ? Number(q.get('fabric_type_id')) : null;
            return (t) =>
                (typeId == null || t.type_id === typeId)
                && (fabricTypeId == null || t.fabric_type_id === fabricTypeId);
        },
        serialize: serializeComponentTemplate,
        defaults: {
            name: '', short_name: '', size: '', type_id: null, fabric_type_id: null,
            fabric_a_count: null, fabric_b_count: null, image: '',
        },
        read: async (request) => {
            const fd = await request.formData();
            const int = (key) => (fd.has(key) ? Number(fd.get(key)) : undefined);
            return withoutUndefined({
                name: fdText(fd, 'name'),
                short_name: fdText(fd, 'short_name'),
                size: fdText(fd, 'size'),
                fabric_a_count: int('fabric_a_count'),
                fabric_b_count: int('fabric_b_count'),
                type_id: int('type'),
                fabric_type_id: int('fabric_type'),
                image: await fdImage(fd),
            });
        },
        validate: (t) => {
            const errors = {};
            checkText(errors, 'name', t.name, MAX_NAME);
            checkText(errors, 'short_name', t.short_name, MAX_SHORT);
            checkText(errors, 'size', t.size, MAX_SHORT, false);
            checkRef(errors, 'type', C.componentTypes, t.type_id);
            checkRef(errors, 'fabric_type', C.productTypes, t.fabric_type_id);
            return result(errors);
        },
        apply: assignDefined,
    }),

    // ---- Розміри комплектів ----
    ...crud({
        path: '/calculator/kit-sizes/',
        collection: C.kitSizes,
        listKey: 'kit_sizes',
        textFilters: ['name', 'short_name'],
        serialize: serializeKitSize,
        defaults: { name: '', short_name: '' },
        read: async (request) => {
            const p = await request.json();
            return withoutUndefined({ name: p.name, short_name: p.short_name });
        },
        validate: (s) => {
            const errors = {};
            checkText(errors, 'name', s.name, MAX_NAME);
            checkText(errors, 'short_name', s.short_name, MAX_SHORT);
            return result(errors);
        },
        apply: assignDefined,
    }),

    // ---- Комплекти ----
    ...crud({
        path: '/calculator/kit-templates/',
        collection: C.kitTemplates,
        listKey: 'kit_templates',
        textFilters: ['name', 'short_name'],
        serialize: serializeKitTemplate,
        defaults: {
            name: '', short_name: '', additional_fabric_consumption_price: '0',
            kit_size_id: null, fabric_type_id: null, component_ids: [], image: '',
        },
        read: async (request) => {
            const fd = await request.formData();
            return withoutUndefined({
                name: fdText(fd, 'name'),
                short_name: fdText(fd, 'short_name'),
                additional_fabric_consumption_price: fdText(fd, 'additional_fabric_consumption_price'),
                component_ids: fdIdList(fd, 'component_size'),
                kit_size_id: fd.has('template') ? Number(fd.get('template')) : undefined,
                fabric_type_id: fd.has('fabric_type') ? Number(fd.get('fabric_type')) : undefined,
                image: await fdImage(fd),
            });
        },
        validate: (k) => {
            const errors = {};
            checkText(errors, 'name', k.name, MAX_NAME);
            checkText(errors, 'short_name', k.short_name, MAX_SHORT);
            checkText(errors, 'additional_fabric_consumption_price', k.additional_fabric_consumption_price, MAX_SHORT, false);
            checkRef(errors, 'template', C.kitSizes, k.kit_size_id);
            checkRef(errors, 'fabric_type', C.productTypes, k.fabric_type_id);
            const bad = k.component_ids.find((id) => !findActiveIn(C.componentTemplates, id));
            if (bad !== undefined) errors.component_size = missing(bad);
            return result(errors);
        },
        apply: assignDefined,
    }),
];
