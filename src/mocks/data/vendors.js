// Seed data for the Vendors pages (the original backend is unavailable).
// Record shapes mirror the original API, as consumed by VendorManagement.jsx, VendorDebtList.jsx,
// NewVendorPayment.jsx and the fabric/product arrival forms; served by src/mocks/handlers/vendors.js.
// Data is generated with a seeded PRNG so it is identical on every reload.

import { mulberry32 } from './fabrics';

const rand = mulberry32(5112020);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

// [full_name, email, phone]
const VENDOR_SPECS = [
    ['ТОВ "Текстиль-Контакт"', 'sales@textile-contact.com.ua', '+380442390415'],
    ['ФОП Коваленко Ірина Василівна', 'kovalenko.iryna@gmail.com', '+380672145830'],
    ['ТОВ "Вілана Текстиль"', 'opt@vilana.ua', '+380577285501'],
    ['ФОП Мельник Олег Петрович', '', '+380503318742'],
    ['ТОВ "Ярослав"', 'zakaz@yaroslav.ua', '+380472640112'],
    ['ФОП Шевчук Наталія Іванівна', 'shevchuk.tkanyny@ukr.net', '+380979031156'],
    ['ТОВ "Холлофайбер Україна"', 'info@hollofiber.ua', '+380445937720'],
    ['ФОП Бондаренко Андрій Сергійович', 'a.bondarenko@i.ua', '+380636410925'],
    ['ТОВ "ТексПром Груп"', 'manager@texprom.com.ua', '+380563701448'],
    ['ФОП Ткаченко Світлана Миколаївна', '', '+380955627304'],
    ['ПП "Нитка-Плюс"', 'nytka.plus@gmail.com', '+380322451873'],
    ['ФОП Кравчук Василь Богданович', 'kravchuk.vb@gmail.com', '+380681192467'],
    ['ТОВ "ЕкоПух"', 'ecopuh.opt@gmail.com', '+380612204590'],
    ['ФОП Олійник Тетяна Романівна', 'oliinyk.tr@ukr.net', '+380937740318'],
    ['ТОВ "Руно"', 'runo@runo.com.ua', '+380352436609'],
    ['ФОП Поліщук Дмитро Олександрович', '', '+380667283015'],
    ['ТОВ "Фурнітура Опт"', 'order@furnitura-opt.ua', '+380444961237'],
    ['ФОП Савченко Оксана Юріївна', 'savchenko.oksana@gmail.com', '+380982316640'],
    ['ТОВ "Бязь-Сервіс"', 'byaz.service@ukr.net', '+380577124098'],
    ['ФОП Лисенко Ігор Віталійович', 'lysenko.igor@gmail.com', '+380501849327'],
    ['ТОВ "Пак-Інвест"', 'pak-invest@pak.com.ua', '+380482379055'],
    ['ФОП Марченко Юлія Андріївна', '', '+380734650812'],
    ['ТОВ "Сатин Люкс"', 'info@satinlux.ua', '+380443308861'],
    ['ФОП Руденко Максим Олегович', 'rudenko.maks@i.ua', '+380961275403'],
    ['ТОВ "Тіротекс-Україна"', 'ukraine@tirotex.com', '+380442284716'],
    ['ФОП Гончаренко Людмила Петрівна', 'goncharenko.lp@gmail.com', '+380675503927'],
    ['ТОВ "Синтепон-Центр"', 'sintepon.center@gmail.com', '+380567891324'],
    ['ФОП Павленко Роман Ігорович', '', '+380508826159'],
    ['ТОВ "Логістик Текс"', 'logistic.tex@ukr.net', '+380312647035'],
    ['ФОП Захарченко Алла Віталіївна', 'zakharchenko.alla@gmail.com', '+380993018462'],
    ['ТОВ "Нова Нитка"', 'nova.nytka@gmail.com', '+380432551870'],
    ['ФОП Литвиненко Сергій Михайлович', 'lytvynenko.sm@ukr.net', '+380687420193'],
];

const pad = (n) => String(n).padStart(2, '0');
export const toIso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const money = (n) => n.toFixed(2);

const generateDept = () => {
    // ~30% of vendors are fully paid off; the rest owe UAH and sometimes USD
    if (rand() < 0.3) {
        return { uah: money(0), usd: money(0), dept_paid_off: true };
    }
    const uah = randInt(15, 4200) * 50;
    const usd = rand() < 0.4 ? randInt(5, 900) * 10 : 0;
    return { uah: money(uah), usd: money(usd), dept_paid_off: false };
};

// spread creation dates over the last ~2 years, oldest first
const SEED_START = new Date(2024, 9, 1, 9, 0, 0).getTime();
const SEED_STEP = 20 * 24 * 60 * 60 * 1000;

export const DEMO_VENDORS = VENDOR_SPECS.map(([full_name, email, phone], i) => {
    const created = new Date(SEED_START + i * SEED_STEP + randInt(0, 8 * 60) * 60 * 1000);
    const modified = new Date(created.getTime() + randInt(0, 90) * 24 * 60 * 60 * 1000);
    return {
        id: i + 1,
        full_name,
        email,
        phone,
        dept: generateDept(),
        created: toIso(created),
        modified: toIso(modified),
        deleted_at: null,
    };
});
