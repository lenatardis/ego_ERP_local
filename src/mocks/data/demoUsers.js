// Local demo users for the portfolio build (the original backend is unavailable).
// `groups` use the exact group names checked by the existing role-based UI
// (Authorized.jsx, Navigation.jsx, Orders.jsx, Order.jsx).
// Passwords satisfy the existing AuthForm validation (>=10 chars, uppercase, digit).

const DEMO_PASSWORD = 'DemoPass123';

const makeUser = (id, roleLabel, username, first_name, last_name, groups, extra = {}) => ({
    id,
    roleLabel,
    username,
    password: DEMO_PASSWORD,
    profile: {
        id,
        created: '2025-01-01T09:00:00Z',
        email: `${username}@demo.local`,
        first_name,
        groups,
        is_staff: false,
        is_superuser: false,
        last_login: null,
        last_name,
        middle_name: '',
        photo: null,
        url: null,
        username,
        ...extra,
    },
});

export const DEMO_USERS = [
    makeUser(1, 'Адміністратор (повний доступ)', 'demo_admin', 'Олександр', 'Демченко', [],
        { is_staff: true, is_superuser: true }),
    makeUser(3, 'Бухгалтер', 'demo_accountant', 'Ірина', 'Бондар', ['Бухгалтер']),
    makeUser(4, 'Складовщик', 'demo_storage', 'Петро', 'Савчук', ['Складовщик']),
    makeUser(5, 'Закрійник', 'demo_cutter', 'Андрій', 'Мельник', ['Закрійник']),
    makeUser(6, 'Швачка', 'demo_seamstress', 'Оксана', 'Ткаченко', ['Швачка']),
    makeUser(8, 'Пакувальник', 'demo_packer', 'Віктор', 'Кравчук', ['Пакувальник']),
];

export const findDemoUserByCredentials = (username, password) =>
    DEMO_USERS.find((u) => u.username === username?.trim() && u.password === password) || null;

export const findDemoUserById = (id) =>
    DEMO_USERS.find((u) => String(u.id) === String(id)) || null;

export const makeDemoTokens = (id) => ({
    access_token: `demo-access-${id}`,
    refresh_token: `demo-refresh-${id}`,
});
