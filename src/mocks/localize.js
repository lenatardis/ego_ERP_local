import { HttpResponse } from 'msw';
import i18n from '../i18n';
import { localizeCatalogText } from './shared/catalog/en';
import * as calculatorTemplates from './shared/catalog/calculatorTemplates';
import * as fabrics from './shared/catalog/fabrics';
import * as products from './shared/catalog/products';
import * as warehouse from './shared/catalog/warehouse';
import * as pricelists from './shared/catalog/pricelists';

// Demo build (2026-11-18): the mock server answers in the visitor's language, as a localized backend would
// (same as the CRM's src/mocks/localize.js). In English:
// - responses: catalog names (fabrics, products, kit templates, components, options, sizes, warehouses,
//   pricelists, order sources) under the keys below, the fixed phrases of production history entries and of
//   the seeded bank payment purposes, and the ERP seed's fixed values (VALUES_EN);
//   people, vendors, comments and addresses stay as entered;
// - requests: the ERP's catalog is editable, so a seed name sent back in English (an edit form saved in
//   English) is stored as its Ukrainian original – only an exact match of a known seed name, so text the user
//   typed is stored as typed.
// Messages the mocks send are translated where they are made (t() in the handlers).

const LOCALIZED_KEYS = new Set([
    'name', 'type', 'short_name', 'kit_type', 'fabric_type', 'category', 'color', 'description', 'title', 'value',
    'size_name', 'warehouse_name', 'rack_name',
]);

// production history (src/mocks/data/manufacturing.js HISTORY / historyText): "CRM Замовлення №… / дата / подія"
const HISTORY_PHRASES = [
    [/^CRM Замовлення №/, 'CRM order #'],
    [/ \/ Створено$/, ' / Created'],
    [/ \/ Очікує крійки$/, ' / Awaiting cutting'],
    [/ \/ Передано закрійнику$/, ' / Handed over to the cutter'],
    [/ \/ Очікує пошивки$/, ' / Awaiting sewing'],
    [/ \/ Передано швачці$/, ' / Handed over to the seamstress'],
    [/ \/ Пошито$/, ' / Sewn'],
    [/ \/ Очікує пакування$/, ' / Awaiting packaging'],
    [/ \/ Передано пакувальнику$/, ' / Handed over to the packer'],
    [/ \/ Готово до відправки$/, ' / Ready to ship'],
    [/ \/ Доставлено$/, ' / Delivered'],
    [/ \/ Компонент (.+) пошито$/, (_, name) => ` / Component ${localizeCatalogText(name)} sewn`],
    [/ \/ Компонент (.+) спаковано$/, (_, name) => ` / Component ${localizeCatalogText(name)} packed`],
    [/ \/ Товар (.+) спаковано$/, (_, name) => ` / Item ${localizeCatalogText(name)} packed`],
];
const localizeHistoryText = (text) => (typeof text === 'string' && text.startsWith('CRM Замовлення №')
    ? HISTORY_PHRASES.reduce((acc, [re, to]) => acc.replace(re, to), text)
    : text);

// fixed system values of the ERP's own seed (cash desks, company cards, workplaces, automatic / seeded comments),
// translated wherever they appear – whole values only, so text the user typed is never touched
const VALUES_EN = {
    'створено автоматично': 'created automatically',
    'створено автоматично; повернуто платнику': 'created automatically; refunded to the payer',
    'Каса №1 (склад)': 'Cash desk No. 1 (warehouse)',
    'Каса №2 (офіс)': 'Cash desk No. 2 (office)',
    'Робоче місце закрійника': 'Cutter\'s workplace',
    'Робоче місце швачки': 'Seamstress\'s workplace',
    'Робоче місце пакувальника': 'Packer\'s workplace',
    'Оплата згідно з рахунком': 'Payment per invoice',
    'Доплата': 'Additional payment',
    'Оплата за тканину, повний розрахунок': 'Payment for fabric, full settlement',
};
// company cards: 'Картка ФОП 5375 41** **** 2817' / 'Картка 4149 60** **** 0934'
const CARD_NUMBER = '(\\d{4} \\d{2}\\*\\* \\*{4} \\d{4})';
const CARD_UK = new RegExp(`^Картка( ФОП)? ${CARD_NUMBER}$`);
const CARD_EN = new RegExp(`^(Business )?[Cc]ard ${CARD_NUMBER}$`);
const localizeValue = (value) => {
    if (typeof value !== 'string') return value;
    if (VALUES_EN[value]) return VALUES_EN[value];
    const card = value.match(CARD_UK);
    if (card) return `${card[1] ? 'Business card' : 'Card'} ${card[2]}`;
    return value;
};

// payment purposes of the seeded Privat statement lines (shared seed `assignmentFor`): fixed bank phrases
// around the payer's name – the phrases are translated, the names stay
const ASSIGNMENT_PHRASES = [
    [/^Внесення готівки через термінал самообслуговування, /, 'Cash deposit via self-service terminal, '],
    [/^Сплата за товар за /, 'Payment for goods on behalf of '],
    [/^Сплата за товар, без ПДВ /, 'Payment for goods, VAT exempt, '],
    [/^Сплата за товар, /, 'Payment for goods, '],
    [/^Сплата за товар /, 'Payment for goods, '],
    [/^(\S+) Платник (.+), код платника (\d+)$/, '$1 Payer $2, payer code $3'],
];
export const localizeAssignment = (text) => {
    if (typeof text !== 'string') return text;
    const rule = ASSIGNMENT_PHRASES.find(([re]) => re.test(text));
    return rule ? text.replace(rule[0], rule[1]) : text;
};

const localizeDeep = (value, key) => {
    if (Array.isArray(value)) return value.map((item) => localizeDeep(item, key));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localizeDeep(v, k)]));
    }
    if (key === 'text') return localizeHistoryText(value);
    if (key === 'assignment') return localizeAssignment(value);
    const fixed = localizeValue(value);
    if (fixed !== value) return fixed;
    return LOCALIZED_KEYS.has(key) ? localizeCatalogText(value) : value;
};

/** The response with catalog names in the current language (unchanged in Ukrainian and for non-JSON). */
export const localizeResponse = async (response) => {
    if (i18n.language !== 'en' || !(response instanceof Response)) return response;
    if (!(response.headers.get('Content-Type') || '').includes('application/json')) return response;
    const body = await response.clone().json().catch(() => undefined);
    if (body === undefined) return response;
    return HttpResponse.json(localizeDeep(body), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
};

// ---- requests: English seed names -> stored Ukrainian ones

let seedNames = null;
/** English name -> Ukrainian seed name, for every seed catalog string that has an English version. */
const getSeedNames = () => {
    if (seedNames) return seedNames;
    const found = new Map();
    const ambiguous = new Set();
    const seen = new Set();
    const walk = (value) => {
        if (typeof value === 'string') {
            const english = localizeCatalogText(value);
            if (english === value) return;
            if (found.has(english) && found.get(english) !== value) ambiguous.add(english);
            found.set(english, value);
        } else if (value && typeof value === 'object' && !seen.has(value)) {
            seen.add(value);
            Object.values(value).forEach(walk);
        }
    };
    [calculatorTemplates, fabrics, products, warehouse, pricelists].forEach((module) => Object.values(module).forEach(walk));
    Object.entries(VALUES_EN).forEach(([ukrainian, english]) => found.set(english, ukrainian));
    ambiguous.forEach((english) => found.delete(english));
    seedNames = found;
    return seedNames;
};

const delocalizeValue = (value) => {
    if (typeof value !== 'string') return value;
    const card = value.match(CARD_EN);
    if (card) return `${card[1] ? 'Картка ФОП' : 'Картка'} ${card[2]}`;
    return getSeedNames().get(value) ?? value;
};
const delocalizeDeep = (value) => {
    if (Array.isArray(value)) return value.map(delocalizeDeep);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, delocalizeDeep(v)]));
    }
    return delocalizeValue(value);
};

/** The request with English seed names turned back into the stored Ukrainian ones (only in English). */
export const delocalizeRequest = async (request) => {
    if (i18n.language !== 'en' || request.method === 'GET' || request.method === 'HEAD') return request;
    const type = request.headers.get('Content-Type') || '';
    try {
        if (type.includes('application/json')) {
            const body = await request.clone().json();
            return new Request(request.url, {
                method: request.method,
                headers: request.headers,
                body: JSON.stringify(delocalizeDeep(body)),
            });
        }
        if (type.includes('multipart/form-data')) {
            const form = await request.clone().formData();
            const next = new FormData();
            for (const [k, v] of form.entries()) next.append(k, delocalizeValue(v));
            const headers = new Headers(request.headers);
            headers.delete('Content-Type'); // a new multipart boundary
            return new Request(request.url, { method: request.method, headers, body: next });
        }
    } catch {
        // not parseable: leave it to the handler as it was
    }
    return request;
};
