// Seed data for the production orders section (Замовлення: Orders.jsx, Order.jsx and its popups;
// /employees/workdesk/manufacturing/ endpoints). The original backend is unavailable; record shapes
// follow the original API as seen in screenshots of the original panel and as read by the components.
// Served by src/mocks/handlers/manufacturing.js.
//
// Stored by id and expanded when a response is built:
//   order_id     -> `order` (the CRM order, shared ids with DEMO_CRM_ORDERS)
//   cutter_id / sewer_id / packer_id -> workplace { id, name, scanner_id, employee }
//   kit.fabric_id -> `kit.fabric_image` (the fabric photo from the Storage page)
//   warehouse_item.id (a variant of a finished product) -> name / category / color / size / image
//   costs[].fabric_roll_id / cutter_id -> fabric roll with its fabric, cutter's name

import { mulberry32, DEMO_FABRICS } from './fabrics';
import { DEMO_PRODUCTS } from './products';
import { DEMO_CRM_ORDERS } from './privatPayments';
import { DEMO_COMPONENT_TEMPLATES, DEMO_KIT_TEMPLATES, DEMO_KIT_SIZES, DEMO_KIT_OPTION_TEMPLATES } from './calculatorTemplates';
import { toIso } from './vendors';

const rand = mulberry32(13102026);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const HEX = '0123456789abcdef';
const uuid = () => [8, 4, 4, 4, 12].map((n) => Array.from({ length: n }, () => HEX[randInt(0, 15)]).join('')).join('-');

// ---- Workplaces --------------------------------------------------------------------------------
// The original API returned the assigned worker as a workplace ("Робоче місце закрійника") holding the
// employee. Order.jsx compares `worker.employee.id` with the user id, Orders.jsx compares `worker.id`,
// so every workplace has the same id as its employee. Demo users 5 / 6 / 8 log in through the Auth page;
// the other employees exist only to show orders that belong to someone else.

const WORKPLACE_NAMES = {
    cutter: 'Робоче місце закрійника',
    sewer: 'Робоче місце швачки',
    packer: 'Робоче місце пакувальника',
};

// [employee id, role, first_name, last_name]
const EMPLOYEES = [
    [5, 'cutter', 'Андрій', 'Мельник'],
    [6, 'sewer', 'Оксана', 'Ткаченко'],
    [8, 'packer', 'Віктор', 'Кравчук'],
    [21, 'cutter', 'Сергій', 'Бойко'],
    [22, 'sewer', 'Наталія', 'Шевчук'],
    [23, 'sewer', 'Галина', 'Лисенко'],
    [24, 'packer', 'Олег', 'Руденко'],
];

export const DEMO_WORKPLACES = EMPLOYEES.map(([id, role, first_name, last_name]) => ({
    id,
    role,
    name: WORKPLACE_NAMES[role],
    scanner_id: uuid(),
    employee: { id, first_name, last_name },
}));

/** The demo user's workplace that takes over an order handed to the next stage. */
export const DEMO_STAGE_WORKER = { cutter: 5, sewer: 6, packer: 8 };

const OTHER = { cutter: 21, sewer: [22, 23], packer: 24 };

// ---- History texts -------------------------------------------------------------------------------
// "CRM Замовлення №1666 / 22.04.26 12:45 / Очікує пошивки" — newest first, as the original API sent them.

const pad = (n) => String(n).padStart(2, '0');
const historyDate = (iso) => {
    const d = new Date(iso);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const historyText = (crmOrderId, iso, text) => `CRM Замовлення №${crmOrderId} / ${historyDate(iso)} / ${text}`;

export const HISTORY = {
    created: 'Створено',
    awaitingCutting: 'Очікує крійки',
    toCutter: 'Передано закрійнику',
    awaitingSewing: 'Очікує пошивки',
    toSewer: 'Передано швачці',
    sewn: 'Пошито',
    awaitingPackaging: 'Очікує пакування',
    toPacker: 'Передано пакувальнику',
    shipmentReady: 'Готово до відправки',
    delivered: 'Доставлено',
    componentSewn: (name) => `Компонент ${name} пошито`,
    componentPacked: (name) => `Компонент ${name} спаковано`,
    itemPacked: (name) => `Товар ${name} спаковано`,
};

// ---- Seed generation -------------------------------------------------------------------------------

const componentName = (id) => DEMO_COMPONENT_TEMPLATES.find((c) => c.id === id)?.name || '—';
const kitSizeName = (id) => DEMO_KIT_SIZES.find((s) => s.id === id)?.name || '';

// fabrics with rolls in stock (the cutter finds them by code in "Вибір тканини")
const IN_STOCK_FABRICS = DEMO_FABRICS.filter((f) => f.new_fabricrolls_remainder > 0 || f.opened_length_remainder > 0);

const KIT_TEMPLATE_IDS = [10, 11, 12, 16, 1, 3, 5, 27];

const COMMENTS = [
    'Терміново, клієнт чекає до п\'ятниці',
    'Упакувати в подарункову коробку',
    'Без етикетки',
    'Клієнт просив щільніше прострочити шви',
    'Замовлення покроїно, зараз на пошиві',
];

const variantOf = (productName, index = 0) => {
    const product = DEMO_PRODUCTS.find((p) => p.name === productName);
    return product.types[index];
};

let nextId = 1;
let nextComponentId = 1;
let nextHistoryId = 1;
let nextCostId = 1;

// creation dates: one order every ~10 hours going back from the newest one, newest specs first
const NEWEST = new Date(2026, 9, 12, 16, 40).getTime();
const HOUR = 60 * 60 * 1000;

const later = (iso, minHours, maxHours) =>
    toIso(new Date(new Date(iso).getTime() + randInt(minHours * 60, maxHours * 60) * 60 * 1000));

/**
 * One seed order. `stage` is how far it got:
 *   awaitingCutting | onCut | awaitingSewing | onSewing | awaitingPackaging | onPackaging | shipmentReady | delivered
 * `assign` overrides who is assigned to the stage the order is waiting for / working on.
 */
const buildOrder = (spec, index) => {
    const id = nextId++;
    const crmOrder = DEMO_CRM_ORDERS[DEMO_CRM_ORDERS.length - 1 - index];
    const created = toIso(new Date(NEWEST - index * 10 * HOUR - randInt(0, 120) * 60 * 1000));
    const history = [];
    let time = created;
    const log = (text, min = 1, max = 20) => {
        time = later(time, min, max);
        history.unshift({ id: nextHistoryId++, created: time, text: historyText(crmOrder.id, time, text) });
    };
    history.push({ id: nextHistoryId++, created, text: historyText(crmOrder.id, created, HISTORY.created) });

    const order = {
        id,
        order_id: crmOrder.id,
        created,
        modified: created,
        status: '',
        comment: spec.comment ?? null,
        kit: null,
        warehouse_item: null,
        cutter_id: null,
        sewer_id: null,
        packer_id: null,
        costs: [],
        history,
    };

    const reached = (stage) => STAGES.indexOf(spec.stage) >= STAGES.indexOf(stage);

    if (spec.kit) {
        const template = DEMO_KIT_TEMPLATES.find((k) => k.id === spec.kit);
        const fabric = IN_STOCK_FABRICS[spec.fabric ?? index % IN_STOCK_FABRICS.length];
        const options = spec.options ?? (rand() < 0.4 ? [pick(DEMO_KIT_OPTION_TEMPLATES)] : []);
        order.kit = {
            id: 600 + id,
            name: `${fabric.name} - ${template.short_name}`,
            fabric: `A: ${fabric.name}`,
            fabric_id: fabric.id,
            type: kitSizeName(template.kit_size_id),
            component: template.component_ids.map((componentId) => ({
                id: nextComponentId++,
                name: componentName(componentId),
                is_sewn: false,
                is_packed: false,
            })),
            option: options.map(({ id: optionId, name }) => ({ id: optionId, name })),
        };

        log(HISTORY.awaitingCutting, 0, 2);
        if (reached('onCut')) {
            order.cutter_id = spec.cutter ?? DEMO_STAGE_WORKER.cutter;
            log(HISTORY.toCutter, 1, 8);
        } else if (spec.assign !== undefined) {
            order.cutter_id = spec.assign;
        }

        if (reached('awaitingSewing') || spec.costs) {
            // one or two rolls of the kit's fabric were cut for the order
            const rolls = [1, 2].slice(0, spec.costs ?? randInt(1, 2));
            rolls.forEach(() => {
                order.costs.push({
                    id: nextCostId++,
                    used_length: randInt(2, 9),
                    cutter_id: order.cutter_id,
                    fabric_id: fabric.id,
                    fabric_roll_id: 900 + randInt(1, 99),
                });
            });
        }

        if (reached('awaitingSewing')) log(HISTORY.awaitingSewing, 2, 20);
        if (reached('onSewing')) {
            order.sewer_id = spec.sewer ?? DEMO_STAGE_WORKER.sewer;
            log(HISTORY.toSewer, 0, 1);
        } else if (spec.stage === 'awaitingSewing' && spec.assign !== undefined) {
            order.sewer_id = spec.assign;
        }

        const sewnCount = reached('awaitingPackaging') ? order.kit.component.length : (spec.sewn ?? 0);
        order.kit.component.slice(0, sewnCount).forEach((c) => {
            c.is_sewn = true;
            log(HISTORY.componentSewn(c.name), 0, 3);
        });

        if (reached('awaitingPackaging')) log(HISTORY.sewn, 1, 6);
        if (reached('onPackaging')) {
            order.packer_id = spec.packer ?? DEMO_STAGE_WORKER.packer;
            log(HISTORY.toPacker, 0, 1);
        } else if (spec.stage === 'awaitingPackaging' && spec.assign !== undefined) {
            order.packer_id = spec.assign;
        }

        const packedCount = reached('shipmentReady') ? order.kit.component.length : (spec.packed ?? 0);
        order.kit.component.slice(0, packedCount).forEach((c) => {
            c.is_packed = true;
            log(HISTORY.componentPacked(c.name), 0, 2);
        });
    } else {
        // finished product from the warehouse: goes straight to packaging
        const variant = variantOf(spec.product, spec.variant);
        const product = DEMO_PRODUCTS.find((p) => p.types.includes(variant));
        const unit = reached('shipmentReady') || spec.picked ? variant.units[0] : null;
        order.warehouse_item = {
            id: variant.id,
            cell: unit ? structuredClone(unit.cell) : null,
            unit_id: unit?.id ?? null,
            is_packed: reached('shipmentReady'),
        };

        log(HISTORY.awaitingPackaging, 0, 3);
        if (reached('onPackaging')) {
            order.packer_id = spec.packer ?? DEMO_STAGE_WORKER.packer;
            log(HISTORY.toPacker, 1, 8);
        } else if (spec.assign !== undefined) {
            order.packer_id = spec.assign;
        }

        if (reached('shipmentReady')) log(HISTORY.itemPacked(product.name), 1, 6);
    }

    if (reached('shipmentReady')) log(HISTORY.shipmentReady, 0, 1);
    if (reached('delivered')) log(HISTORY.delivered, 20, 72);

    order.status = STAGE_STATUS[spec.stage];
    order.modified = history[0].created;
    return order;
};

const STAGES = ['awaitingCutting', 'onCut', 'awaitingSewing', 'onSewing', 'awaitingPackaging', 'onPackaging', 'shipmentReady', 'delivered'];

const STAGE_STATUS = {
    awaitingCutting: 'AWAITING_CUTTING',
    onCut: 'ON_CUT',
    awaitingSewing: 'AWAITING_SEWING',
    onSewing: 'ON_SEWING',
    awaitingPackaging: 'AWAITING_PACKAGING',
    onPackaging: 'ON_PACKAGING',
    shipmentReady: 'SHIPMENT_READY',
    delivered: 'DELIVERED',
};

// Newest first. Each demo role gets: orders in "Мої активні", queue orders already assigned to them
// (open from "Всі доступні"), and queue orders that are unassigned or belong to a colleague (read-only).
const SPECS = [
    // --- Закрійник (demo_cutter, id 5) ---
    { kit: 10, stage: 'onCut', fabric: 0 },
    { kit: 12, stage: 'onCut', fabric: 1, comment: COMMENTS[0], options: [DEMO_KIT_OPTION_TEMPLATES[2]] },
    { kit: 3, stage: 'onCut', fabric: 2, costs: 1 },
    { kit: 11, stage: 'awaitingCutting', fabric: 3, assign: 5 },
    { kit: 1, stage: 'awaitingCutting', fabric: 4, assign: 5, comment: COMMENTS[2] },
    { kit: 16, stage: 'awaitingCutting', fabric: 5 },
    { kit: 5, stage: 'awaitingCutting', fabric: 6, assign: OTHER.cutter },
    { kit: 27, stage: 'awaitingCutting', fabric: 7 },

    // --- Швачка (demo_seamstress, id 6) ---
    { kit: 10, stage: 'onSewing', fabric: 1, comment: COMMENTS[4], options: [DEMO_KIT_OPTION_TEMPLATES[2]] },
    { kit: 12, stage: 'onSewing', fabric: 2, sewn: 2 },
    { kit: 11, stage: 'awaitingSewing', fabric: 0, assign: 6 },
    { kit: 3, stage: 'awaitingSewing', fabric: 3, assign: OTHER.sewer[0], comment: COMMENTS[3] },
    { kit: 16, stage: 'awaitingSewing', fabric: 4 },

    // --- Пакувальник (demo_packer, id 8): комплекти ---
    { kit: 10, stage: 'onPackaging', fabric: 5 },
    { kit: 1, stage: 'onPackaging', fabric: 6, packed: 2, comment: COMMENTS[1] },
    { kit: 5, stage: 'awaitingPackaging', fabric: 7, assign: 8 },
    { kit: 27, stage: 'awaitingPackaging', fabric: 0, assign: OTHER.packer },
    { kit: 12, stage: 'awaitingPackaging', fabric: 1 },

    // --- Пакувальник: товари зі складу ---
    { product: 'Ковдра Холофайбер', variant: 1, stage: 'onPackaging' },
    { product: 'Red Pillow', stage: 'onPackaging', picked: true, comment: COMMENTS[1] },
    { product: 'Подушка Бамбук', stage: 'onPackaging' }, // out of stock: no locations to pick from
    { product: 'Подушка Еко Пух', variant: 2, stage: 'awaitingPackaging', assign: 8 },
    { product: 'Ковдра Літня', stage: 'awaitingPackaging' },
    { product: 'Подушка Анатомічна', stage: 'awaitingPackaging', assign: OTHER.packer },

    // --- Архів: готові до відправки / доставлені ---
    { kit: 11, stage: 'shipmentReady', fabric: 2 },
    { product: 'Подушка 4 сезони', stage: 'shipmentReady' },
    { kit: 1, stage: 'shipmentReady', fabric: 3, comment: COMMENTS[1] },
    { product: 'Ковдра Дитяча', stage: 'shipmentReady' },
    { kit: 3, stage: 'shipmentReady', fabric: 4, sewer: OTHER.sewer[1], packer: OTHER.packer },
    { kit: 10, stage: 'delivered', fabric: 5 },
    { product: 'Ковдра 4 сезони', variant: 2, stage: 'delivered' },
    { kit: 16, stage: 'delivered', fabric: 6, cutter: OTHER.cutter, sewer: OTHER.sewer[0] },
    { product: 'Подушка Літня', stage: 'delivered' },
    { kit: 12, stage: 'delivered', fabric: 7 },
];

// ids follow creation time (oldest = 1), the list shows newest first
export const DEMO_MANUFACTURING_ORDERS = SPECS
    .map((spec, i) => ({ spec, i }))
    .reverse()
    .map(({ spec, i }) => buildOrder(spec, i));
