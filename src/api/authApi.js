import { getRefreshToken, getAccessToken, setTokens, removeTokens } from './authStorage';
import { setAuth } from '../store/account-slice';

const API_BASE_URL = 'https://dev.panel.egodevelopment.pp.ua/admin_panel/api/v1';

/** ⏳ Refresh token if expired */
export const refreshAccessToken = async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    try {
        const res = await fetch(`https://dev.panel.egodevelopment.pp.ua/api/v1/users/token/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                refresh: refresh,
            })
        });

        const text = await res.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch {
            console.error('❌ Not JSON:', text);
            return null;
        }

        if (res.ok && data.access) {
            const newAccess = data.access;
            const newRefresh = data.refresh || refresh;

            setTokens(newAccess, newRefresh);
            return newAccess;
        } else {
            console.warn('❌ REFRESH RESPONSE ERROR', res.status, data);
            return null;
        }
    } catch (e) {
        console.error("Token refresh error:", e);
        return null;
    }
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

/** ✅ GET /employees/:id/ */
export const getUserById = async (id, token = getAccessToken()) => {
    try {
        const response = await fetch(`${API_BASE_URL}/employees/${id}/`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => getUserById(id, newToken));
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        return { error: 'network' };
    }
};

/** 🔐 Auth */
export const loginUser = async (username, password) => {
    try {
        const response = await fetch(`${API_BASE_URL}/employees/auth/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (data.password) {
            const passwordError = Array.isArray(data.password)
                ? data.password[0]
                : data.password;

            const passwordErrorMessages = {
                'This field may not be null.':
                    'Пароль повинен містити щонайменше 10 символів, включаючи хоча б одну велику літеру і одну цифру',
                'This field may not be blank.':
                    'Пароль повинен містити щонайменше 10 символів, включаючи хоча б одну велику літеру і одну цифру',
            };

            if (passwordError === 'Password must be at least 10 characters long with at least one capital letter and one digit') {
                return {
                    field: 'credentials',
                    error: 'Логін чи пароль невірні',
                };
            }

            return {
                field: 'password',
                error: passwordErrorMessages[passwordError] || passwordError || 'Логін чи пароль невірні',
            };
        }

        if (data.user) {
            const userError = Array.isArray(data.user)
                ? data.user[0]
                : data.user;

            return {
                field: 'credentials',
                error:
                    userError === 'Username or Password is incorrect'
                        ? 'Логін чи пароль невірні'
                        : userError || 'Логін чи пароль невірні',
            };
        }

        if (data?.id && data?.refresh_token) {
            setTokens(data.access_token, data.refresh_token);
        }

        return data;
    } catch (e) {
        return { error: 'Сервер недоступний' };
    }
};

/** 🔓 Logout */
export const logout = (dispatch) => {
    removeTokens();
    dispatch(setAuth(false));
    window.location.href = '/';
};
