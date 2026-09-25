import { getAccessToken, getUserId, removeTokens } from "../api/authStorage";
import { setAuth, setProfile } from "../store/account-slice";
import {getUserById} from "../api/authApi";

export const checkSessionAndSetAuth = async (dispatch) => {
    const token = getAccessToken();
    const userId = getUserId();

    if (!token || !userId) {
        return ;
    }

    const res = await getUserById(userId, token);

    if (res && !res.error && typeof res === 'object') {
        dispatch(setAuth(true));
        dispatch(setProfile(res));
    } else {
        logout(dispatch);
    }
};

const logout = (dispatch) => {
    removeTokens();
    dispatch(setAuth(false));
};
