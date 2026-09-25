import React from "react";
import styles from './Filter.module.scss';
import RemoveFilter from "../../../assets/icons/filter-remove-icon.svg";



const Filter = ({children, isShow, deleteFilters = null}) => {

    return (
        <div className={isShow ? styles.filterShow : styles.filter}>
            <h3>Фільтр</h3>
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