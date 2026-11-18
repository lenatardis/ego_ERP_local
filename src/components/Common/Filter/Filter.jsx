import React from "react";
import styles from './Filter.module.scss';
import RemoveFilter from "../../../assets/icons/filter-remove-icon.svg";
import CloseIcon from "../../../assets/icons/close.svg";
import useScrollLock from "../../../hooks/useScrollLock";
import { t } from '../../../i18n';



const Filter = ({children, isShow, deleteFilters = null, onClose = null}) => {
    useScrollLock(isShow);

    return (
        <div className={isShow ? styles.filterShow : styles.filter}>
            {/* all widths; on phones the panel covers the screen, so the overlay behind it can't be tapped */}
            {onClose && (
                <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('Закрити фільтр')}>
                    <img src={CloseIcon} alt=""/>
                </button>
            )}
            <h3>{t('Фільтр')}</h3>
            <div className={styles.selects}>
                <button className={styles.removeFilters} onClick={deleteFilters}>
                    <img src={RemoveFilter} alt="remove_filters"/>
                </button>
                {children}
            </div>
        </div>
    )
}

export default Filter;