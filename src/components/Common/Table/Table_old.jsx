import React from "react";
import styles from './Table.module.scss';


const Table = ({columns, data, subtitle, equalColumns}) => {
    const gridTemplate = {
        gridTemplateColumns: !equalColumns? columns.map(col => col.width || '1fr').join(' ') : columns.map(col =>  '1fr').join(' ')
    }

    return (
        <div className={styles.table}>
            <h3 className={styles.subtitle}>{subtitle}</h3>
            {/* Header */}
            <div className={styles.gridTable__header} style={gridTemplate}>
                {columns.map((col) => (
                    <div key={col.key} className={styles.gridTable__cell}>
                        {col.title}
                    </div>
                ))}
            </div>

            <div className={styles.tableRows}>
                {data.map((row, idx) => (
                    <div key={idx} className={styles.gridTable__row} style={gridTemplate}>
                        {columns.map((col) => (
                            <div key={col.key} className={styles.gridTable__cell}>
                                {col.render ? col.render(row[col.key], row) : row[col.key]}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

        </div>
    );
}

export default Table;