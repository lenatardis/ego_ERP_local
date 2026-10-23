// Seed data for the production orders section (Замовлення: Orders.jsx, Order.jsx and its popups;
// /employees/workdesk/manufacturing/ endpoints). The original backend is unavailable; record shapes
// follow the original API as seen in screenshots of the original panel and as read by the components.
// Served by src/mocks/handlers/manufacturing.js.
//
// Stored by id and expanded when a response is built:
//   order_id     -> `order` (the CRM order; which one, and what is made, comes from SEED_PRODUCTION in the seed
//                   shared with the CRM — ../shared/seed.js — so the CRM's cart line is the same kit / item)
//   cutter_id / sewer_id / packer_id -> workplace { id, name, scanner_id, employee }
//   kit.fabric_id -> `kit.fabric_image` (the fabric photo from the Storage page)
//   warehouse_item.id (a variant of a finished product) -> name / category / color / size / image
//   costs[].fabric_roll_id / cutter_id -> fabric roll with its fabric, cutter's name

import { mulberry32, DEMO_FABRICS } from './fabrics';
import { DEMO_PRODUCTS } from './products';
import { DEMO_COMPONENT_TEMPLATES, DEMO_KIT_TEMPLATES, DEMO_KIT_SIZES, DEMO_KIT_OPTION_TEMPLATES } from './calculatorTemplates';
import { PRODUCTION_NEWEST, PRODUCTION_STAGES, PRODUCTION_STAGE_STATUS, SEED_PRODUCTION } from '../shared/seed';
import { toIso } from './vendors';

const rand = mulberry32(13102026);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

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

const COMMENTS = [
    'Терміново, клієнт чекає до п\'ятниці',
    'Упакувати в подарункову коробку',
    'Без етикетки',
    'Клієнт просив щільніше прострочити шви',
    'Замовлення покроїно, зараз на пошиві',
];

let nextId = 1;
let nextComponentId = 1;
let nextHistoryId = 1;
let nextCostId = 1;

// creation dates: one order every ~10 hours going back from the newest one, newest specs first
const NEWEST = PRODUCTION_NEWEST;
const HOUR = 60 * 60 * 1000;

const later = (iso, minHours, maxHours) =>
    toIso(new Date(new Date(iso).getTime() + randInt(minHours * 60, maxHours * 60) * 60 * 1000));

/**
 * One seed order: what is made and how far it got (`stage`) come from SEED_PRODUCTION[index]:
 *   awaitingCutting | onCut | awaitingSewing | onSewing | awaitingPackaging | onPackaging | shipmentReady | delivered
 * `spec` holds the scenario: `assign` overrides who is assigned to the stage the order is waiting for / working on.
 */
const buildOrder = (scenario, index) => {
    const production = SEED_PRODUCTION[index];
    const spec = { ...scenario, stage: production.stage };
    const id = nextId++;
    if (id !== production.id) throw new Error(`manufacturing seed: id ${id} != shared production id ${production.id}`);
    const crmOrder = { id: production.order_id };
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

    if (production.kit) {
        const template = DEMO_KIT_TEMPLATES.find((k) => k.id === production.kit.kit_template_id);
        const fabric = DEMO_FABRICS.find((f) => f.id === production.kit.fabric_id);
        const options = production.kit.option.map((optionId) => DEMO_KIT_OPTION_TEMPLATES.find((o) => o.id === optionId));
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
        const product = DEMO_PRODUCTS.find((p) => p.id === production.warehouse_item.product_id);
        const variant = product.types.find((t) => t.id === production.warehouse_item.type_id);
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

const STAGES = PRODUCTION_STAGES;
const STAGE_STATUS = PRODUCTION_STAGE_STATUS;

// Newest first. Each demo role gets: orders in "Мої активні", queue orders already assigned to them
// (open from "Всі доступні"), and queue orders that are unassigned or belong to a colleague (read-only).
// What each one makes, its stage and its CRM order are SEED_PRODUCTION[i] (../shared/seed.js, same order);
// the comments name them. Only the scenario lives here.
const SPECS = [
    // --- Закрійник (demo_cutter, id 5) ---
    {}, // kit 10, на крійці
    { comment: COMMENTS[0] }, // kit 12 + сумка-чохол, на крійці
    { costs: 1 }, // kit 3, на крійці, один рулон уже покроєно
    { assign: 5 }, // kit 11, очікує крійки
    { assign: 5, comment: COMMENTS[2] }, // kit 5, очікує крійки
    {}, // kit 16, очікує крійки
    { assign: OTHER.cutter }, // kit 5, очікує крійки
    {}, // kit 27, очікує крійки

    // --- Швачка (demo_seamstress, id 6) ---
    { comment: COMMENTS[4] }, // kit 10 + сумка-чохол, на пошитті
    { sewn: 2 }, // kit 12, на пошитті
    { assign: 6 }, // kit 11, очікує пошиття
    { assign: OTHER.sewer[0], comment: COMMENTS[3] }, // kit 3, очікує пошиття
    {}, // kit 16, очікує пошиття

    // --- Пакувальник (demo_packer, id 8): комплекти ---
    {}, // kit 10, на пакуванні
    { packed: 2, comment: COMMENTS[1] }, // kit 5 + подарункове пакування, на пакуванні
    { assign: 8 }, // kit 5, очікує пакування
    { assign: OTHER.packer }, // kit 27, очікує пакування
    {}, // kit 12, очікує пакування

    // --- Пакувальник: товари зі складу ---
    {}, // Ковдра Холофайбер, на пакуванні
    { picked: true, comment: COMMENTS[1] }, // Red Pillow, на пакуванні, уже взято зі складу
    {}, // Подушка Бамбук, на пакуванні — немає на складі: нічого взяти
    { assign: 8 }, // Подушка Еко Пух, очікує пакування
    {}, // Ковдра Літня, очікує пакування
    { assign: OTHER.packer }, // Подушка Анатомічна, очікує пакування

    // --- Архів: готові до відправки / доставлені ---
    {}, // kit 11, готово до відправки
    {}, // Подушка 4 сезони
    { comment: COMMENTS[1] }, // kit 5
    {}, // Ковдра Дитяча
    { sewer: OTHER.sewer[1], packer: OTHER.packer }, // kit 3
    {}, // kit 10 + подарункове пакування, доставлено
    {}, // Ковдра 4 сезони
    { cutter: OTHER.cutter, sewer: OTHER.sewer[0] }, // kit 16
    {}, // Подушка Літня
    {}, // kit 12
];

if (SPECS.length !== SEED_PRODUCTION.length) {
    throw new Error(`manufacturing seed: ${SPECS.length} scenarios for ${SEED_PRODUCTION.length} production items`);
}

// ids follow creation time (oldest = 1, as SEED_PRODUCTION numbers them), the list shows newest first
export const DEMO_MANUFACTURING_ORDERS = SPECS
    .map((spec, i) => ({ spec, i }))
    .reverse()
    .map(({ spec, i }) => buildOrder(spec, i));
