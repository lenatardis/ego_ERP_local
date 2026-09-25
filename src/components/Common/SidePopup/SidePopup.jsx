import React from "react";
import styles from './SidePopup.module.scss';
import {useAppDispatch, useAppSelector} from "../../../hooks/redux";
import {getIsActivePopup} from "../../../store/selectors";
import {setIsActivePopup} from "../../../store/main-slice";

const SidePopup = ({children, title, onClose = () => {}}) => {
    const activePopup = useAppSelector(getIsActivePopup);
    const dispatch = useAppDispatch();

    const close = (e) => {
        e.stopPropagation();
        dispatch(setIsActivePopup(false));
        onClose();
    }

    const popupClass = activePopup
        ? `${styles.sidePopupActive}`
        : `${styles.sidePopup}`;

    return (
        <>
            <span className={styles.outer} onClick={(e) => close(e)}></span>
            <div className={`${popupClass}`}>
                <div className={styles.header}>
                    <p className={styles.header__title}>{title}</p>
                </div>
                <div className={styles.content}>
                    {children}
                </div>
            </div>
        </>
    )
}

export default SidePopup;