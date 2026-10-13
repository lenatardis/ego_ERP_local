import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, paginate, notFound, getRequestUser } from './utils';
import { getCollection, saveCollection } from '../db';
import { DEMO_MANUFACTURING_ORDERS, DEMO_WORKPLACES, DEMO_STAGE_WORKER, HISTORY, historyText } from '../data/manufacturing';
import { DEMO_FABRICS, DEMO_FABRIC_ROLLS } from '../data/fabrics';
import { DEMO_PRODUCTS } from '../data/products';
import { toIso } from '../data/vendors';

// Production orders (Замовлення), as consumed by Orders.jsx, Order.jsx, CutterFabricPopup.jsx and
// WarehouseItemPopup.jsx through src/api/ordersApi.js:
//   GET   /employees/workdesk/manufacturing/       -> { results, count, next, previous }
//   GET   /employees/workdesk/manufacturing/:id/   -> order
//   PATCH /employees/workdesk/manufacturing/:id/   -> order; payload is one of
//           { status }                                 finish the current stage ("Завершити роботу")
//           { component: [{ id, is_sewn | is_packed }] } sewer / packer checkboxes ("Внести виконану роботу")
//           { warehouse_item: { id, cell, unit } }     packer picks the item from a storage cell ("Вибір товару")
//           { warehouse_item: { id, is_packed } }      packer packs the picked item
//   GET   /employees/workdesk/warehouse-item/?warehouse_item=  -> { warehouse_item_units }
//   POST  /production/costs/                       -> cut a fabric roll for the order ("Вибір тканини")
//
// Only the worker assigned to the order's current stage may change it (403 otherwise).
// Handing an order over to the next stage was done outside this panel in the original system
// (the order was assigned to the next worker); the demo does it right away: finishing a stage assigns
// the next stage's demo worker (unless someone is already assigned) and starts that stage.

const orders = () => getCollection('manufacturingOrders', DEMO_MANUFACTURING_ORDERS);
const fabrics = () => getCollection('fabrics', DEMO_FABRICS);
const fabricRolls = () => getCollection('fabricRolls', DEMO_FABRIC_ROLLS); // fabricId -> rolls[]
const products = () => getCollection('products', DEMO_PRODUCTS);

const forbidden = () =>
    HttpResponse.json({ detail: 'You do not have permission to perform this action.' }, { status: 403 });
const badRequest = (field, message) => HttpResponse.json({ [field]: [message] }, { status: 400 });

// ---- Roles and stages ----

const roleOf = (user) => {
    const groups = user?.profile?.groups || [];
    if (groups.includes('Закрійник')) return 'cutter';
    if (groups.includes('Швачка') || groups.includes('Швея')) return 'sewer';
    if (groups.includes('Пакувальник')) return 'packer';
    return null;
};

// statuses in which each role works on an order, and the status "Завершити роботу" sends
const STAGES = {
    cutter: { statuses: ['AWAITING_CUTTING', 'ON_CUT'], finish: 'AWAITING_SEWING' },
    sewer: { statuses: ['AWAITING_SEWING', 'ON_SEWING'], finish: 'AWAITING_PACKAGING' },
    packer: { statuses: ['AWAITING_PACKAGING', 'ON_PACKAGING'], finish: 'SHIPMENT_READY' },
};

const isStageWorker = (order, user, role) => role && order[`${role}_id`] === user.id && STAGES[role].statuses.includes(order.status);

// ---- Response building ----

const workplace = (id) => {
    const found = DEMO_WORKPLACES.find((w) => w.id === id);
    return found ? { id: found.id, name: found.name, scanner_id: found.scanner_id, employee: { ...found.employee } } : null;
};

const findVariant = (variantId) => {
    for (const product of products()) {
        const variant = product.types.find((t) => t.id === Number(variantId));
        if (variant) return { product, variant };
    }
    return null;
};

const fabricById = (id) => fabrics().find((f) => f.id === id) || null;

// Barcode label printed for every order: a Code 128-looking SVG (the demo does not encode a real symbology).
const barcodeUrl = (order) => {
    const value = `MFG-${String(order.id).padStart(6, '0')}`;
    let x = 10;
    let bars = '';
    let seed = 0;
    for (const ch of value + '*') {
        seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
        for (let i = 0; i < 6; i++) {
            const width = ((seed >> i) % 3) + 1;
            if (i % 2 === 0) bars += `<rect x="${x}" y="6" width="${width}" height="44"/>`;
            x += width + 1;
        }
    }
    const width = x + 10;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="70" viewBox="0 0 ${width} 70">`
        + `<rect width="${width}" height="70" fill="#fff"/><g fill="#000">${bars}</g>`
        + `<text x="${width / 2}" y="64" font-family="monospace" font-size="11" text-anchor="middle">${value}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const sizeLabel = (size) => (size ? `${size.width}×${size.length}` : '');

const toResponse = (order) => {
    const { order_id, cutter_id, sewer_id, packer_id, kit, warehouse_item, costs, ...rest } = order;

    let warehouseItem = null;
    if (warehouse_item) {
        const found = findVariant(warehouse_item.id);
        warehouseItem = {
            id: warehouse_item.id,
            name: found?.product.name ?? '',
            category: found?.product.category ?? null,
            color: found?.variant.color ? { id: found.variant.color.id, name: found.variant.color.name } : null,
            size: sizeLabel(found?.variant.size),
            image: found?.product.images?.[0] ?? '',
            cell: warehouse_item.cell,
            is_packed: warehouse_item.is_packed,
        };
    }

    let kitResponse = null;
    if (kit) {
        const { fabric_id, ...kitRest } = kit;
        kitResponse = { ...kitRest, fabric_image: fabricById(fabric_id)?.images?.[0] ?? '' };
    }

    return {
        ...rest,
        order: { id: order_id },
        barcode: barcodeUrl(order),
        kit: kitResponse,
        warehouse_item: warehouseItem,
        cutter: workplace(cutter_id),
        sewer: workplace(sewer_id),
        packer: workplace(packer_id),
        costs: costs.map((cost) => {
            const fabric = fabricById(cost.fabric_id);
            const cutter = workplace(cost.cutter_id)?.employee;
            return {
                id: cost.id,
                used_length: cost.used_length,
                cutter: cutter ? { id: cutter.id, first_name: cutter.first_name, last_name: cutter.last_name } : null,
                fabric_roll: {
                    id: cost.fabric_roll_id,
                    fabric: fabric ? { id: fabric.id, name: fabric.name, type: fabric.type } : null,
                },
            };
        }),
    };
};

// ---- Changes ----

const nextHistoryId = () => orders().reduce((max, o) => Math.max(max, ...o.history.map((h) => h.id)), 0) + 1;
const nextCostId = () => orders().reduce((max, o) => Math.max(max, ...o.costs.map((c) => c.id)), 0) + 1;

const addHistory = (order, text) => {
    const created = toIso(new Date());
    order.history.unshift({ id: nextHistoryId(), created, text: historyText(order.order_id, created, text) });
};

/** Guard for "Завершити роботу": what is still undone; texts match the Order page popup. */
const finishBlocker = (order, role) => {
    const notDone = (field) => (order.kit?.component ?? []).filter((c) => !c[field]).map((c) => c.name);
    if (role === 'cutter') {
        return order.costs.length ? null : 'Спочатку покроїть тканину: натисніть «Вибір тканини» та внесіть довжину крою.';
    }
    if (role === 'sewer') {
        const missing = notDone('is_sewn');
        return missing.length ? `Спочатку позначте всі компоненти як пошиті та натисніть «Внести виконану роботу». Не пошито: ${missing.join(', ')}.` : null;
    }
    if (order.warehouse_item) {
        if (!order.warehouse_item.cell) return 'Спочатку оберіть товар на складі: натисніть «Вибір товару».';
        return order.warehouse_item.is_packed ? null : 'Спочатку позначте товар як спакований та натисніть «Внести виконану роботу».';
    }
    const missing = notDone('is_packed');
    return missing.length ? `Спочатку позначте всі компоненти як спаковані та натисніть «Внести виконану роботу». Не спаковано: ${missing.join(', ')}.` : null;
};

/** "Завершити роботу": the order goes to the next stage's queue and is handed over to its worker. */
const finishStage = (order, role) => {
    if (role === 'cutter') {
        order.status = 'AWAITING_SEWING';
        addHistory(order, HISTORY.awaitingSewing);
        order.sewer_id ??= DEMO_STAGE_WORKER.sewer;
        order.status = 'ON_SEWING';
        addHistory(order, HISTORY.toSewer);
    } else if (role === 'sewer') {
        order.status = 'AWAITING_PACKAGING';
        addHistory(order, HISTORY.sewn);
        order.packer_id ??= DEMO_STAGE_WORKER.packer;
        order.status = 'ON_PACKAGING';
        addHistory(order, HISTORY.toPacker);
    } else {
        order.status = 'SHIPMENT_READY';
        addHistory(order, HISTORY.shipmentReady);
    }
};

const recountFabricRemainders = (fabric, rolls) => {
    const newRolls = rolls.filter((r) => r.status === 'NEW');
    fabric.opened_length_remainder = rolls.filter((r) => r.status === 'OPENED').reduce((s, r) => s + r.current_length, 0);
    fabric.new_fabricrolls_remainder = newRolls.length;
    fabric.new_length_remainder = newRolls.reduce((s, r) => s + r.current_length, 0);
};

const matchesSearch = (order, search) => {
    const found = order.warehouse_item ? findVariant(order.warehouse_item.id) : null;
    return [order.id, order.order_id, order.kit?.name, found?.product.name, order.comment]
        .filter(isSet)
        .some((v) => String(v).toLowerCase().includes(search));
};

const pageUrl = (request, page) => {
    const url = new URL(request.url);
    url.searchParams.set('page', String(page));
    return url.toString();
};

export const manufacturingHandlers = [
    http.get(`${API}/employees/workdesk/manufacturing/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const status = q.get('status');
        const userId = q.get('user');
        const search = isSet(q.get('search')) ? q.get('search').trim().toLowerCase() : '';
        const onlyKit = q.get('only_kit') === 'true'
            // cutters, sewers and packers' kit queue only ever deal with kits
            || ['for_cutter', 'for_sewer', 'for_packer'].some((key) => q.get(key) === 'true');
        const onlyWarehouseItem = q.get('only_warehouse_item') === 'true';

        const filtered = orders()
            .filter((o) => !isSet(status) || o.status === status)
            .filter((o) => !isSet(userId) || [o.cutter_id, o.sewer_id, o.packer_id].includes(Number(userId)))
            .filter((o) => !onlyKit || o.kit)
            .filter((o) => !onlyWarehouseItem || o.warehouse_item)
            .filter((o) => !search || matchesSearch(o, search))
            .sort((a, b) => b.created.localeCompare(a.created));

        const { slice, totalPages, current } = paginate(filtered, q.get('page'), q.get('page_size'));

        return HttpResponse.json({
            count: filtered.length,
            next: current < totalPages ? pageUrl(request, current + 1) : null,
            previous: current > 1 ? pageUrl(request, current - 1) : null,
            results: slice.map(toResponse),
        });
    })),

    http.get(`${API}/employees/workdesk/manufacturing/:id/`, withAuth(({ params }) => {
        const order = orders().find((o) => o.id === Number(params.id));
        return order ? HttpResponse.json(toResponse(order)) : notFound();
    })),

    http.patch(`${API}/employees/workdesk/manufacturing/:id/`, withAuth(async ({ request, params }) => {
        const order = orders().find((o) => o.id === Number(params.id));
        if (!order) return notFound();

        const user = getRequestUser(request);
        const role = roleOf(user);
        if (!isStageWorker(order, user, role)) return forbidden();

        const payload = await request.json();

        if (isSet(payload.status)) {
            if (payload.status !== STAGES[role].finish) {
                return badRequest('status', 'Недопустима зміна статусу для поточного етапу.');
            }
            const blocker = finishBlocker(order, role);
            if (blocker) return badRequest('status', blocker);
            finishStage(order, role);
        } else if (Array.isArray(payload.component)) {
            if (!order.kit) return badRequest('component', 'Замовлення не містить комплекту.');
            const field = role === 'sewer' ? 'is_sewn' : role === 'packer' ? 'is_packed' : null;
            if (!field) return forbidden();

            payload.component.forEach((item) => {
                const component = order.kit.component.find((c) => c.id === Number(item.id));
                if (!component || typeof item[field] !== 'boolean') return;
                if (item[field] && !component[field]) {
                    addHistory(order, field === 'is_sewn'
                        ? HISTORY.componentSewn(component.name)
                        : HISTORY.componentPacked(component.name));
                }
                component[field] = item[field];
            });
        } else if (payload.warehouse_item) {
            const item = order.warehouse_item;
            if (!item || role !== 'packer' || Number(payload.warehouse_item.id) !== item.id) {
                return badRequest('warehouse_item', 'Товар не належить до цього замовлення.');
            }

            if (payload.warehouse_item.unit != null) {
                if (item.cell) return badRequest('warehouse_item', 'Товар вже взято зі складу.');

                const found = findVariant(item.id);
                const unit = found?.variant.units.find((u) => u.id === Number(payload.warehouse_item.unit));
                if (!unit || unit.cell.id !== Number(payload.warehouse_item.cell) || unit.current_quantity < 1) {
                    return badRequest('warehouse_item', 'У вибраній комірці немає цього товару.');
                }

                unit.current_quantity -= 1;
                found.variant.quantity -= 1;
                if (unit.current_quantity === 0) {
                    found.variant.units = found.variant.units.filter((u) => u !== unit);
                }
                saveCollection('products');

                item.cell = structuredClone(unit.cell);
                item.unit_id = unit.id;
            } else if (typeof payload.warehouse_item.is_packed === 'boolean') {
                if (!item.cell) return badRequest('warehouse_item', 'Спочатку оберіть товар на складі.');
                if (payload.warehouse_item.is_packed && !item.is_packed) {
                    addHistory(order, HISTORY.itemPacked(findVariant(item.id)?.product.name ?? ''));
                }
                item.is_packed = payload.warehouse_item.is_packed;
            }
        }

        order.modified = toIso(new Date());
        saveCollection('manufacturingOrders');

        return HttpResponse.json(toResponse(order));
    })),

    http.get(`${API}/employees/workdesk/warehouse-item/`, withAuth(({ request }) => {
        const variantId = new URL(request.url).searchParams.get('warehouse_item');
        const found = isSet(variantId) ? findVariant(variantId) : null;
        if (!found) return notFound();

        return HttpResponse.json({
            warehouse_item_units: found.variant.units
                .filter((u) => u.current_quantity > 0)
                .map((u) => structuredClone(u)),
        });
    })),

    http.post(`${API}/production/costs/`, withAuth(async ({ request }) => {
        const payload = await request.json();
        const order = orders().find((o) => o.id === Number(payload.manufacturing));
        if (!order) return badRequest('manufacturing', 'Замовлення не знайдено.');

        const user = getRequestUser(request);
        if (!order.kit || !isStageWorker(order, user, roleOf(user)) || roleOf(user) !== 'cutter') return forbidden();

        const rollsByFabric = fabricRolls();
        const fabricId = Object.keys(rollsByFabric)
            .find((id) => rollsByFabric[id].some((r) => r.id === Number(payload.fabric_roll)));
        if (!fabricId) return badRequest('fabric_roll', 'Рулон не знайдено.');

        const roll = rollsByFabric[fabricId].find((r) => r.id === Number(payload.fabric_roll));
        const usedLength = Number(payload.used_length);
        if (!Number.isFinite(usedLength) || usedLength <= 0 || usedLength > roll.current_length) {
            return badRequest('used_length', `Не доступна довжина рулона, доступно ${roll.current_length}м`);
        }

        // a cut roll becomes an opened one; a fully used roll leaves the warehouse
        roll.current_length = Math.round((roll.current_length - usedLength) * 100) / 100;
        roll.status = 'OPENED';
        if (roll.current_length <= 0) {
            rollsByFabric[fabricId] = rollsByFabric[fabricId].filter((r) => r !== roll);
        }
        const fabric = fabricById(Number(fabricId));
        if (fabric) recountFabricRemainders(fabric, rollsByFabric[fabricId]);
        saveCollection('fabricRolls');
        saveCollection('fabrics');

        const cost = {
            id: nextCostId(),
            used_length: usedLength,
            cutter_id: user.id,
            fabric_id: Number(fabricId),
            fabric_roll_id: roll.id,
        };
        order.costs.push(cost);
        order.modified = toIso(new Date());
        saveCollection('manufacturingOrders');

        return HttpResponse.json({
            id: cost.id,
            used_length: cost.used_length,
            cutter: user.id,
            manufacturing: order.id,
            fabric_roll: roll.id,
        }, { status: 201 });
    })),
];
