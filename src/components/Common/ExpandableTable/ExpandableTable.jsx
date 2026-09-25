import React, { useState } from "react";
import styles from './ExpandableTable.module.scss';

const ExpandableTable = ({
    columns,
    data,
    expandedRowRender,
    gridTemplate,
    hideHeader = false,
    className = "",
    tableRowsClassName = "",
    rowClassName = "",
    tableWithStickyHeader = false,
    centered = false
}) => {
    const [expandedRowIndex, setExpandedRowIndex] = useState(null);

    const handleRowClick = (index) => {
        setExpandedRowIndex((prev) => (prev === index ? null : index));
    };

    const gridTemplateStyle = gridTemplate ?? {
        gridTemplateColumns: columns.map((col) => col.width || '1fr').join(' ')
    };

    return (
        <div className={`${styles.table} ${tableWithStickyHeader ? styles.tableWithStickyHeader : ''} ${centered ? styles.centered : ""} ${className}`.trim()}>
            {!hideHeader && (
                <div className={styles.gridTable__header} style={gridTemplateStyle}>
                    {columns.map((col) => (
                        <div key={col.key} className={styles.gridTable__cell}>
                            {col.title}
                        </div>
                    ))}
                </div>
            )}

            <div className={`${styles.tableRows} ${tableRowsClassName}`.trim()}>
                {data.map((row, idx) => (
                    <React.Fragment key={idx}>
                        <div
                            className={`${styles.gridTable__row} ${styles.clickable} ${rowClassName}`.trim()}
                            style={gridTemplateStyle}
                            onClick={() => handleRowClick(idx)}
                        >
                            {columns.map((col) => {
                                const dynamicClass =
                                    typeof col.cellClassName === "function"
                                        ? (col.cellClassName(row[col.key], row, { isSubrow: false }) || "")
                                        : (col.cellClassName || "");

                                return (
                                    <div
                                        key={col.key}
                                        className={`${styles.gridTable__cell} ${dynamicClass}`.trim()}
                                    >
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </div>
                                );
                            })}
                        </div>

                        {expandedRowIndex === idx && (
                            <div className={styles.expandedRow}>
                                {expandedRowRender(row)}
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default ExpandableTable;