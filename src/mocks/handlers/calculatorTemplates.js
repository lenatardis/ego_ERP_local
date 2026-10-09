import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toBoolOrUndefined, paginate, notFound } from './utils';
import { getCollection, saveCollection, nextId } from '../db';
import {
    DEMO_COMPONENT_TYPES,
    DEMO_OPTION_PARTS,
    DEMO_COMPONENT_OPTION_TEMPLATES,
} from '../data/calculatorTemplates';
import { toIso } from '../data/vendors';

// Response shapes follow the original API, as consumed by the Templates/* pages:
//   GET    /calculator/component-types/                 -> { component_types, total_count, total_pages, current_page }
//   GET    /calculator/option-parts/?type=component|kit -> { option_parts, total_count, total_pages, current_page }
//   GET    /calculator/component-option-templates/      -> { component_option_templates, total_count, total_pages, current_page }
//          filters: name, type_ids="1,2", part_ids="4,7", is_deleted
//   POST   /calculator/component-option-templates/      -> template   (payload { name, description, type, part: [ids] })
//   PATCH  /calculator/component-option-templates/:id/  -> template
//   DELETE /calculator/component-option-templates/:id/  -> 204 (soft delete)
// A template is returned with `type` and `part` expanded into objects (deleted parts keep their deleted_at,
// ComponentOptions.jsx hides them). Changes are persisted in the visitor's browser (src/mocks/db.js).

const COMPONENT_TYPES = 'componentTypes';
const OPTION_PARTS = 'optionParts';
const COMPONENT_OPTIONS = 'componentOptionTemplates';

const MAX_TEXT_LENGTH = 100;

const componentTypes = () => getCollection(COMPONENT_TYPES, DEMO_COMPONENT_TYPES);
const optionParts = () => getCollection(OPTION_PARTS, DEMO_OPTION_PARTS);
const componentOptions = () => getCollection(COMPONENT_OPTIONS, DEMO_COMPONENT_OPTION_TEMPLATES);

const findComponentType = (id) => componentTypes().find((t) => t.id === Number(id));
const findOptionPart = (id, type) => optionParts().find((p) => p.id === Number(id) && p.type === type);
const findActiveComponentOption = (id) => componentOptions().find((o) => o.id === Number(id) && !o.deleted_at);

const newestFirst = (a, b) => b.created.localeCompare(a.created) || b.id - a.id;
const includesText = (value, search) => String(value ?? '').toLowerCase().includes(search);
const toIds = (v) => (isSet(v) ? String(v).split(',').map(Number).filter(Number.isFinite) : []);

const listResponse = (key, items, q) => {
    const { slice, totalPages, current } = paginate(items, q.get('page'), q.get('page_size'));
    return HttpResponse.json({
        [key]: slice,
        total_count: items.length,
        total_pages: totalPages,
        current_page: current,
    });
};

const serializeComponentType = (t) => ({ ...t });
const serializeOptionPart = (p) => ({ id: p.id, name: p.name, type: p.type, deleted_at: p.deleted_at });

const serializeComponentOption = (o) => {
    const type = findComponentType(o.type_id);
    return {
        id: o.id,
        name: o.name,
        description: o.description,
        type: type ? serializeComponentType(type) : null,
        part: o.part_ids
            .map((id) => findOptionPart(id, 'component'))
            .filter(Boolean)
            .map(serializeOptionPart),
        created: o.created,
        modified: o.modified,
        deleted_at: o.deleted_at,
    };
};

const badRequest = (data) => HttpResponse.json(data, { status: 400 });

/** Field errors in the DRF format ({ field: [message] }), or null when the payload is valid. */
const validateComponentOption = (payload) => {
    const errors = {};
    const name = String(payload.name ?? '').trim();
    const description = String(payload.description ?? '');

    if (!name) errors.name = ['This field may not be blank.'];
    else if (name.length > MAX_TEXT_LENGTH) errors.name = [`Ensure this field has no more than ${MAX_TEXT_LENGTH} characters.`];
    if (description.length > MAX_TEXT_LENGTH) {
        errors.description = [`Ensure this field has no more than ${MAX_TEXT_LENGTH} characters.`];
    }

    const type = findComponentType(payload.type);
    if (!type || type.deleted_at) errors.type = [`Invalid pk "${payload.type}" - object does not exist.`];

    const parts = Array.isArray(payload.part) ? payload.part : [];
    const badPart = parts.find((id) => {
        const p = findOptionPart(id, 'component');
        return !p || p.deleted_at;
    });
    if (badPart !== undefined) errors.part = [`Invalid pk "${badPart}" - object does not exist.`];

    return Object.keys(errors).length ? errors : null;
};

export const calculatorTemplateHandlers = [
    http.get(`${API}/calculator/component-types/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const name = isSet(q.get('name')) ? q.get('name').trim().toLowerCase() : '';
        const isDeleted = toBoolOrUndefined(q.get('is_deleted'));

        const filtered = componentTypes()
            .filter((t) => {
                if (isDeleted !== undefined && !!t.deleted_at !== isDeleted) return false;
                if (name && !includesText(t.name, name)) return false;
                return true;
            })
            .sort(newestFirst)
            .map(serializeComponentType);

        return listResponse('component_types', filtered, q);
    })),

    http.get(`${API}/calculator/option-parts/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const name = isSet(q.get('name')) ? q.get('name').trim().toLowerCase() : '';
        const type = isSet(q.get('type')) ? q.get('type').trim() : '';
        const isDeleted = toBoolOrUndefined(q.get('is_deleted'));

        const filtered = optionParts()
            .filter((p) => {
                if (isDeleted !== undefined && !!p.deleted_at !== isDeleted) return false;
                if (type && p.type !== type) return false;
                if (name && !includesText(p.name, name)) return false;
                return true;
            })
            .sort(newestFirst)
            .map(serializeOptionPart);

        return listResponse('option_parts', filtered, q);
    })),

    http.get(`${API}/calculator/component-option-templates/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const name = isSet(q.get('name')) ? q.get('name').trim().toLowerCase() : '';
        const typeIds = toIds(q.get('type_ids'));
        const partIds = toIds(q.get('part_ids'));
        const isDeleted = toBoolOrUndefined(q.get('is_deleted'));

        const filtered = componentOptions()
            .filter((o) => {
                if (isDeleted !== undefined && !!o.deleted_at !== isDeleted) return false;
                if (name && !includesText(o.name, name)) return false;
                if (typeIds.length && !typeIds.includes(o.type_id)) return false;
                if (partIds.length && !o.part_ids.some((id) => partIds.includes(id))) return false;
                return true;
            })
            // newest first, so a just-created option shows up on page 1
            .sort(newestFirst)
            .map(serializeComponentOption);

        return listResponse('component_option_templates', filtered, q);
    })),

    http.post(`${API}/calculator/component-option-templates/`, withAuth(async ({ request }) => {
        const payload = await request.json();
        const errors = validateComponentOption(payload);
        if (errors) return badRequest(errors);

        const now = toIso(new Date());
        const option = {
            id: nextId(componentOptions()),
            name: payload.name.trim(),
            description: String(payload.description ?? ''),
            type_id: Number(payload.type),
            part_ids: (payload.part ?? []).map(Number),
            created: now,
            modified: now,
            deleted_at: null,
        };

        componentOptions().push(option);
        saveCollection(COMPONENT_OPTIONS);

        return HttpResponse.json(serializeComponentOption(option), { status: 201 });
    })),

    http.patch(`${API}/calculator/component-option-templates/:id/`, withAuth(async ({ request, params }) => {
        const option = findActiveComponentOption(params.id);
        if (!option) return notFound();

        const payload = await request.json();
        const errors = validateComponentOption({
            name: option.name,
            description: option.description,
            type: option.type_id,
            part: option.part_ids,
            ...payload,
        });
        if (errors) return badRequest(errors);

        if (payload.name !== undefined) option.name = String(payload.name).trim();
        if (payload.description !== undefined) option.description = String(payload.description);
        if (payload.type !== undefined) option.type_id = Number(payload.type);
        if (payload.part !== undefined) option.part_ids = payload.part.map(Number);
        option.modified = toIso(new Date());
        saveCollection(COMPONENT_OPTIONS);

        return HttpResponse.json(serializeComponentOption(option));
    })),

    http.delete(`${API}/calculator/component-option-templates/:id/`, withAuth(({ params }) => {
        const option = findActiveComponentOption(params.id);
        if (!option) return notFound();

        option.deleted_at = toIso(new Date());
        saveCollection(COMPONENT_OPTIONS);

        return new HttpResponse(null, { status: 204 });
    })),
];
