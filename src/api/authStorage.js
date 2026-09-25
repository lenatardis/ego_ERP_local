const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const USER_ID_KEY = 'userId';

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const getUserId = () => localStorage.getItem(USER_ID_KEY);

export const setTokens = (access, refresh) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
};

export const setUserId = (id) => {
    localStorage.setItem(USER_ID_KEY, id);
};

export const removeTokens = () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_ID_KEY);
};
