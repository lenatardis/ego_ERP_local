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

// Tokens are JWT-shaped (unsigned) because the Orders pages read `user_id` from the access token payload
// (Orders.helpers.js / Order.jsx getUserIdFromToken), as they did with the original backend's JWTs.
const base64Url = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const makeDemoJwt = (id, token_type) => `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ token_type, user_id: Number(id) })}.demo`;

export const makeDemoTokens = (id) => ({
    access_token: makeDemoJwt(id, 'access'),
    refresh_token: makeDemoJwt(id, 'refresh'),
});

/** User id from a demo token of the given type, or null. Accepts the earlier `demo-<type>-<id>` format too. */
export const parseDemoToken = (token, token_type) => {
    const legacy = new RegExp(`^demo-${token_type}-(\\d+)$`).exec(token || '');
    if (legacy) return legacy[1];
    try {
        const payload = JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload.token_type === token_type && payload.user_id != null ? String(payload.user_id) : null;
    } catch {
        return null;
    }
};
