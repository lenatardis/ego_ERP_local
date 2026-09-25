// src/components/Common/Table/TableFixedHeader.jsx
import React, {useEffect, useRef} from "react";
import styles from "./Table.module.scss";

const TableFixedHeader = ({
                              columns,
                              subtitle,
                              equalColumns,
                              centered,
                              priceTable,
                              scrollContainerRef,
                              minWidth,
                              stickyTop = 0,
                              stickyZIndex = 70,
                          }) => {
    const headerInnerRef = useRef(null);

    const gridTemplate = {
        gridTemplateColumns: !equalColumns
            ? columns.map(col => col.width || '1fr').join(' ')
            : columns.map(col => '1fr').join(' ')
    };

    useEffect(() => {
        const scroller = scrollContainerRef?.current;
        const headerInner = headerInnerRef.current;
        if (!scroller || !headerInner) return;

        const handleScroll = () => {
            headerInner.style.transform = `translateX(-${scroller.scrollLeft}px)`;
        };

        scroller.addEventListener("scroll", handleScroll, {passive: true});
        handleScroll(); // початкове вирівнювання

        return () => {
            scroller.removeEventListener("scroll", handleScroll);
        };
    }, [scrollContainerRef]);


    // Нормалізуємо minWidth
    const minWidthStyle =
        minWidth != null
            ? (typeof minWidth === "number"
                    ? `${Math.max(minWidth - 32, 0)}px`
                    : String(minWidth)
            )
            : undefined;


    return (
        <div
            className={`${styles.tableFixedRoot} ${centered ? styles.centered : ''}`}
            style={{ top: stickyTop, zIndex: stickyZIndex }}
        >
            {subtitle && <h3 className={styles.subtitle}>{subtitle}</h3>}

            <div className={styles.stickyHeaderWrap}>
                <div
                    ref={headerInnerRef}
                    className={styles.gridTable__header}
                    style={{
                        ...gridTemplate,
                        ...(minWidthStyle ? { minWidth: minWidthStyle } : {}),
                    }}
                >
                    {columns.map((col) => (
                        <div key={col.key} className={styles.gridTable__cell}>
                            {col.title}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TableFixedHeader;
