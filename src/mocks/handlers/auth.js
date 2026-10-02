import { http, HttpResponse } from 'msw';
import { API, AUTH_API, withAuth, withLatency, notFound } from './utils';
import { findDemoUserByCredentials, findDemoUserById, makeDemoTokens } from '../data/demoUsers';

// Response shapes follow what src/api/authApi.js reads:
//   login   -> profile fields + id + access_token / refresh_token, or { user: [message] } on bad credentials
//   refresh -> { access, refresh }
export const authHandlers = [
    http.post(`${API}/employees/auth/`, withLatency(async ({ request }) => {
        const { username, password } = await request.json();
        const user = findDemoUserByCredentials(username, password);

        if (!user) {
            return HttpResponse.json({ user: ['Username or Password is incorrect'] }, { status: 400 });
        }

        return HttpResponse.json({ ...user.profile, id: user.id, ...makeDemoTokens(user.id) });
    })),

    http.get(`${API}/employees/:id/`, withAuth(({ params }) => {
        const user = findDemoUserById(params.id);
        return user ? HttpResponse.json(user.profile) : notFound();
    })),

    http.post(`${AUTH_API}/users/token/refresh/`, withLatency(async ({ request }) => {
        const { refresh } = await request.json();
        const match = /^demo-refresh-(\d+)$/.exec(refresh || '');

        if (!match || !findDemoUserById(match[1])) {
            return HttpResponse.json({ detail: 'Token is invalid or expired', code: 'token_not_valid' }, { status: 401 });
        }

        const { access_token, refresh_token } = makeDemoTokens(match[1]);
        return HttpResponse.json({ access: access_token, refresh: refresh_token });
    })),
];
