import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toNumberOrNull, toBoolOrUndefined, paginate } from './utils';
import { getCollection } from '../db';
import { DEMO_FABRICS, DEMO_FABRIC_ROLLS, FABRIC_TYPES, FABRIC_TAGS } from '../data/fabrics';

// Response shapes follow the original API, as consumed by FabricComposition.jsx,
// EditableFabricTable.jsx and NewFabric.jsx:
//   GET /warehouses/fabrics/                   -> { fabrics, total_pages, count }
//   GET /warehouses/fabrics/types-tags/        -> { types, tags }
//   GET /warehouses/fabrics/:id/fabric-rolls/  -> { "fabric-rolls", total_pages, count }

const FABRICS_PAGE_SIZE = 25;
const DEFAULT_ROLLS_PAGE_SIZE = 20;

const fabrics = () => getCollection('fabrics', DEMO_FABRICS);
const fabricRolls = () => getCollection('fabricRolls', DEMO_FABRIC_ROLLS); // fabricId -> rolls[]

const hasStock = (f) => f.new_fabricrolls_remainder > 0 || f.opened_length_remainder > 0;

export const fabricHandlers = [
    http.get(`${API}/warehouses/fabrics/types-tags/`, withAuth(() =>
        HttpResponse.json({
            types: FABRIC_TYPES.map(({ id, type }) => ({ id, type })),
            tags: FABRIC_TAGS,
        })
    )),

    http.get(`${API}/warehouses/fabrics/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const typeId = q.get('type_id');
        const search = isSet(q.get('name')) ? q.get('name').trim().toLowerCase() : '';
        const remainderMin = toNumberOrNull(q.get('new_fabricroll_remainder_min'));
        const remainderMax = toNumberOrNull(q.get('new_fabricroll_remainder_max'));
        const inStock = toBoolOrUndefined(q.get('in_stock'));

        const filtered = fabrics().filter((f) => {
            if (isSet(typeId) && f.type.id !== Number(typeId)) return false;
            if (search && !f.name.toLowerCase().includes(search)) return false;
            if (remainderMin != null && f.new_fabricrolls_remainder < remainderMin) return false;
            if (remainderMax != null && f.new_fabricrolls_remainder > remainderMax) return false;
            if (inStock === true && !hasStock(f)) return false;
            if (inStock === false && hasStock(f)) return false;
            return true;
        });

        const { slice, totalPages } = paginate(filtered, q.get('page'), FABRICS_PAGE_SIZE);

        return HttpResponse.json({ count: filtered.length, total_pages: totalPages, fabrics: slice });
    })),

    http.get(`${API}/warehouses/fabrics/:id/fabric-rolls/`, withAuth(({ request, params }) => {
        const q = new URL(request.url).searchParams;
        const statuses = q.getAll('status');

        const rolls = (fabricRolls()[params.id] || [])
            .filter((r) => statuses.length === 0 || statuses.includes(r.status));

        const { slice } = paginate(rolls, q.get('page'), q.get('page_size') || DEFAULT_ROLLS_PAGE_SIZE);
        const size = Number(q.get('page_size')) || DEFAULT_ROLLS_PAGE_SIZE;

        return HttpResponse.json({
            count: rolls.length,
            total_pages: Math.max(1, Math.ceil(rolls.length / size)),
            'fabric-rolls': slice,
        });
    })),
];
