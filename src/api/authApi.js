import { getAccessToken, setTokens, removeTokens } from './authStorage';
import { setAuth } from '../store/account-slice';
import { findDemoUserByCredentials, findDemoUserById, makeDemoTokens } from '../mocks/demoUsers';

const API_BASE_URL = 'https://dev.panel.egodevelopment.pp.ua/admin_panel/api/v1';

/** ⏳ Refresh token if expired
 *  Demo mode: the original backend is unavailable, so there is nothing to refresh against.
 *  Demo tokens never expire; returning null makes callers skip the retry (no retry loops). */
export const refreshAccessToken = async () => {
    return null;
};


/** 🔁 Handle 401 automatically */
const handleUnauthorized = async (retryFunction) => {
    try {
        const newToken = await refreshAccessToken();
        if (newToken) {
            return await retryFunction(newToken);
        }
    } catch (error) {
        console.error("Error refreshing access token:", error);
    }
    return null;
};

/** 📦 Reusable fetch response handler */
const handleResponse = async (response, retryFunction) => {
    if (response.status === 401 || response.statusText === "Unauthorized") {
        return await handleUnauthorized(retryFunction);
    }
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
};

/** ✅ GET /vendor-invoices/payments/ */
export const fetchVendorPayments = async (token = getAccessToken()) => {
    try {
        const response = await fetch(`${API_BASE_URL}/vendor-invoices/payments/`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchVendorPayments(newToken));
    } catch (error) {
        console.error("Error fetching vendor payments:", error);
        return [];
    }
};

/** ✅ GET /employees/:id/ — demo mode: resolved from local demo users */
export const getUserById = async (id, token = getAccessToken()) => {
    if (!token || !String(token).startsWith('demo-access-')) {
        return { error: 'unauthorized' };
    }

    const user = findDemoUserById(id);
    if (!user) {
        return { error: 'not_found' };
    }

    return { ...user.profile };
};

/** 🔐 Auth — demo mode: credentials are validated locally against demo users.
 *  Returns the same shape the original API returned: profile fields + id + access/refresh tokens,
 *  or `{ field, error }` on failure. */
export const loginUser = async (username, password) => {
    const user = findDemoUserByCredentials(username, password);

    if (!user) {
        return {
            field: 'credentials',
            error: 'Логін чи пароль невірні',
        };
    }

    const tokens = makeDemoTokens(user.id);
    const data = { ...user.profile, id: user.id, ...tokens };

    setTokens(data.access_token, data.refresh_token);

    return data;
};

/** 🔓 Logout */
export const logout = (dispatch) => {
    removeTokens();
    dispatch(setAuth(false));
    window.location.href = '/';
};
