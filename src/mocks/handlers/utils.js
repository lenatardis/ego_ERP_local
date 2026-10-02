import { HttpResponse, delay } from 'msw';
import { findDemoUserById } from '../data/demoUsers';

// Same paths the API layer uses (src/api/*Api.js API_BASE_URL); the token refresh endpoint
// lived outside /admin_panel in the original backend.
export const API = '/admin_panel/api/v1';
export const AUTH_API = '/api/v1';

// Small artificial latency so loaders / AbortController flows behave as with a real server.
const LATENCY_MS = 250;

const ACCESS_TOKEN_RE = /^Bearer demo-access-(\d+)$/;

/** The demo user behind the request's bearer token, or null. */
export const getRequestUser = (request) => {
    const match = ACCESS_TOKEN_RE.exec(request.headers.get('Authorization') || '');
    return match ? findDemoUserById(match[1]) : null;
};

export const unauthorized = () =>
    HttpResponse.json({ detail: 'Given token not valid for any token type' }, { status: 401 });

export const notFound = () => HttpResponse.json({ detail: 'Not found.' }, { status: 404 });

/** Wraps a resolver: adds latency and rejects requests without a valid demo access token. */
export const withAuth = (resolver) => async (info) => {
    await delay(LATENCY_MS);
    if (!getRequestUser(info.request)) return unauthorized();
    return resolver(info);
};

/** Adds latency only (for public endpoints such as login / token refresh). */
export const withLatency = (resolver) => async (info) => {
    await delay(LATENCY_MS);
    return resolver(info);
};

export const isSet = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/** Parses a numeric query param the way the API layer sends it ("1 000,5" -> 1000.5); null when absent. */
export const toNumberOrNull = (v) => {
    if (!isSet(v)) return null;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isNaN(n) ? null : n;
};

/** "true" / "false" query param -> boolean, anything else -> undefined. */
export const toBoolOrUndefined = (v) => (v === 'true' ? true : v === 'false' ? false : undefined);

export const paginate = (items, page, pageSize) => {
    const size = Number(pageSize) || 25;
    const current = Number(page) || 1;
    const start = (current - 1) * size;
    return { slice: items.slice(start, start + size), totalPages: Math.ceil(items.length / size), current };
};
