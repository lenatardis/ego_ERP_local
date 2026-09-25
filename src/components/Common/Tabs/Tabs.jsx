import React from "react";
import styles from './Tabs.module.scss';

const Tabs = ({tabs, handleChange, activeTab}) => {
    return (
        <div className={styles.tabs}>
            {tabs && tabs.map((tab, index) => (
                    <div key={index} className={styles.tab}>
                        <p>{tab}</p>
                        <input checked={activeTab === tab} onChange={() => handleChange(tab)} name={'tabs'} type="radio"/>
                    </div>
                ))}
        </div>
    )
}

export default Tabs;