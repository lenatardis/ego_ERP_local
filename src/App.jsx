import './Base.scss';
import './Variables.scss';
import React, { useEffect, useState } from "react";
import Authorized from "./components/Authorized";
import Auth from "./components/Auth/Auth";
import Preloader from "./components/Common/Preloader/Preloader";
import { useAppDispatch, useAppSelector } from "./hooks/redux";
import { getIsAuth } from "./store/selectors";
import { checkSessionAndSetAuth } from "./utils/sessionManager";

function App() {
    const dispatch = useAppDispatch();
    const isAuth = useAppSelector(getIsAuth);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkSessionAndSetAuth(dispatch).finally(() => setTimeout(() => setIsLoading(false), 500));
    }, []);

    return (
        <>
            {isAuth ? <Authorized /> : <Auth />}
            {isLoading && <Preloader auth />}
        </>
    );
}

export default App;
