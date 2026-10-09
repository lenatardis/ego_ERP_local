// Seed data for the bedding templates section (Шаблони постільної білизни, /calculator/* endpoints).
// The original backend is unavailable; record shapes mirror what the Templates/* pages read.
// Served by src/mocks/handlers/calculatorTemplates.js.
//
// Relations are stored by id (`type_id`, `part_ids`) and expanded when a response is built,
// so renaming a component type or option part propagates to the options that use it.
// Option parts are numbered per `type` ('component' | 'kit'), as in the original API.

import { toIso } from './vendors';

const at = (y, m, d, h = 10, min = 0) => toIso(new Date(y, m - 1, d, h, min, 0));

// Типи компонентів. `mono_fabric_type`: A | B | AB, `image`: URL or ''.
export const DEMO_COMPONENT_TYPES = [
    { id: 1, name: 'Наволочка', mono_fabric_type: 'A', image: '', created: at(2025, 2, 3), deleted_at: null },
    { id: 2, name: 'Простирадло', mono_fabric_type: 'A', image: '', created: at(2025, 2, 3, 10, 5), deleted_at: null },
    { id: 3, name: 'Підковдра', mono_fabric_type: 'AB', image: '', created: at(2025, 2, 3, 10, 10), deleted_at: null },
];

// Частини опцій (component parts only for now; kit parts are added with the kit options page).
export const DEMO_OPTION_PARTS = [];

// Опції компонентів. Order on the page is newest-created first: 7, 1, 4, 3.
export const DEMO_COMPONENT_OPTION_TEMPLATES = [
    {
        id: 3,
        name: 'Одношарове з текстурою',
        description: 'Одношарова накладка для простирадла',
        type_id: 3,
        part_ids: [],
        created: at(2025, 3, 10),
        modified: at(2025, 3, 10),
        deleted_at: null,
    },
    {
        id: 4,
        name: 'Протектор',
        description: 'Додатковий Протектор для підковдри',
        type_id: 2,
        part_ids: [],
        created: at(2025, 3, 12),
        modified: at(2025, 3, 12),
        deleted_at: null,
    },
    {
        id: 1,
        name: 'Замок',
        description: 'Замок для наволочки',
        type_id: 1,
        part_ids: [],
        created: at(2025, 3, 14),
        modified: at(2025, 3, 14),
        deleted_at: null,
    },
    {
        id: 7,
        name: 'Вушка',
        description: 'Вушка до наволочки',
        type_id: 1,
        part_ids: [],
        created: at(2025, 4, 2),
        modified: at(2025, 4, 2),
        deleted_at: null,
    },
];
