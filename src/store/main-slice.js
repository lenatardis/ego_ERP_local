import {createSlice} from "@reduxjs/toolkit";

const initialState = {
    isActivePopup: false,

};

export const mainSlice = createSlice({
    name: 'mainPage',
    initialState,

    reducers: {
        setIsActivePopup(state, {payload}) {
            state.isActivePopup = payload;
            state.isActivePopup ? document.body.style.overflow = "hidden" : document.body.style.overflow = "auto";
        },

    },
})

export default mainSlice.reducer;

export const {
    setIsActivePopup
} = mainSlice.actions;