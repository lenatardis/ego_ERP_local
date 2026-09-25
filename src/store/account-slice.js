import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    isAuth: false,
    profile: null,
};

export const accountSlice = createSlice({
    name: 'accountPage',
    initialState,
    reducers: {
        setAuth(state, { payload }) {
            state.isAuth = payload;
        },
        setProfile(state, { payload }) {
            if (!payload || typeof payload !== 'object') return;
            const {created, email, first_name, groups, is_staff, is_superuser, last_login, last_name, middle_name,
                photo, url, username,
            } = payload;

            state.profile = {created, email, first_name, groups, is_staff, is_superuser, last_login, last_name,
                middle_name, photo, url, username,
            };
        },
    }
});

export default accountSlice.reducer;

export const {
    setAuth,
    setProfile,
} = accountSlice.actions;
