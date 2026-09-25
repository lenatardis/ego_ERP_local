import { combineReducers, configureStore } from '@reduxjs/toolkit';

import mainSlice from './main-slice';
import accountSlice from "./account-slice";


const rootReducers = combineReducers({
    main: mainSlice,
    account: accountSlice,
});

export const store = configureStore({
    reducer: rootReducers
});
