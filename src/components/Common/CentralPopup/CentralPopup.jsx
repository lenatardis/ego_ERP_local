import React from "react";
import styles from './CentralPopup.module.scss';
import {useAppDispatch, useAppSelector} from "../../../hooks/redux";
import {getIsActivePopup} from "../../../store/selectors";
import {setIsActivePopup} from "../../../store/main-slice";
import cross from '../../../assets/icons/cross.svg';

const CentralPopup = ({children, title, onClose = () => {}, bigPopup, verticalScroll, infoPopup}) => {
    const activePopup = useAppSelector(getIsActivePopup);
    const dispatch = useAppDispatch();

    const close = (e) => {
        e.stopPropagation();
        dispatch(setIsActivePopup(false));
        onClose();
    }

    const base = activePopup ? styles.centerPopupActive : styles.centerPopup;
    const popupClass = [base, styles.popup, bigPopup && styles.bigPopup, verticalScroll && styles.verticalScroll, infoPopup && styles.infoPopup]
        .filter(Boolean)
        .join(' ');

    return (
        <>
            <span className={styles.outer} onClick={(e) => close(e)}></span>
            <div className={`${popupClass} ${styles.popup}`}>
                <div className={styles.header}>
                    <p className={styles.header__title}>{title}</p>
                    <button className={styles.cross} onClick={(e) => close(e)}>
                        <p>Закрити</p>
                        <span>
                            <img src={cross} alt=""/>
                        </span>
                    </button>
                </div>
                <div className={styles.content}>
                    {children}
                </div>
            </div>
        </>
    )
}

export default CentralPopup;