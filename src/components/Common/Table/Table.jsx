import React from "react";
import styles from './Table.module.scss';


const Table = ({columns, data, subtitle, equalColumns, subrows, centered, priceTable, hideHeader = false, popupTable, zeroPdTable}) => {
    const gridTemplate = {
        gridTemplateColumns: !equalColumns ? columns.map(col => col.width || '1fr').join(' ') : columns.map(col => '1fr').join(' ')
    }

    return (
        <div className={`${styles.table} ${centered ? styles.centered : ''} ${priceTable ? styles.priceTable : ''} ${hideHeader ? styles.tableWithStickyHeader : ''} ${popupTable ? styles.popupTable : ''} ${zeroPdTable ? styles.zeroPdTable : ''}`}>
            {subtitle && <h3 className={styles.subtitle}>{subtitle}</h3>}
            {/* Header */}
            {!hideHeader && (
                <div className={styles.gridTable__header} style={gridTemplate}>
                    {columns.map((col) => (
                        <div key={col.key} className={styles.gridTable__cell}>
                            {col.title}
                        </div>
                    ))}
                </div>
            )}
            <div className={styles.tableRows}>
                {data.map((row, idx) => {
                    const sub = typeof subrows === 'function' ? (subrows(row) || []) : [];
                    return (
                        <React.Fragment key={idx}>
                            {/* основний рядок */}
                            <div className={styles.gridTable__row} style={gridTemplate}>
                                {columns.map((col) => {
                                    const cellClassKey = col.cellClassKey || col.bodyCellClassKey;
                                    const extraClass = cellClassKey ? styles[cellClassKey] : '';

                                    const dynamicClass =
                                        typeof col.cellClassName === "function"
                                            ? (col.cellClassName(row[col.key], row, { isSubrow: false }) || "")
                                            : (col.cellClassName || "");

                                    return (
                                        <div
                                            key={col.key}
                                            className={`${styles.gridTable__cell} ${extraClass} ${dynamicClass}`}
                                        >
                                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* підрядки, якщо є */}
                            {sub.map((srow, sIdx) => (
                                <div
                                    key={`${idx}-sub-${sIdx}`}
                                    className={`${styles.gridTable__row} ${styles.gridTable__subrow || ''}`}
                                    style={gridTemplate}
                                >
                                    {columns.map((col) => (
                                        <div key={col.key} className={styles.gridTable__cell}>
                                            {col.render ? col.render(srow[col.key], srow, {
                                                isSubrow: true,
                                                parent: row
                                            }) : srow[col.key]}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </React.Fragment>
                    );
                })}
            </div>

        </div>
    );
}

export default Table;