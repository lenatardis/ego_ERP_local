import React, { useEffect, useRef } from "react";
import styles from "./ExpandableTable.module.scss";

const ExpandableTableFixedHeader = ({
    columns,
    gridTemplate,
    scrollContainerRef,
    minWidth,
    stickyTop = 0,
    stickyZIndex = 70,
    centered = false
}) => {
    const headerInnerRef = useRef(null);

    const gridTemplateStyle = gridTemplate ?? {
        gridTemplateColumns: columns.map((col) => col.width || "1fr").join(" "),
    };

    useEffect(() => {
        const scroller = scrollContainerRef?.current;
        const headerInner = headerInnerRef.current;
        if (!scroller || !headerInner) return;

        const handleScroll = () => {
            headerInner.style.transform = `translateX(-${scroller.scrollLeft}px)`;
        };

        scroller.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => {
            scroller.removeEventListener("scroll", handleScroll);
        };
    }, [scrollContainerRef]);

    const minWidthStyle =
    minWidth != null
        ? typeof minWidth === "number"
            ? `${Math.max(minWidth - 32, 0)}px`
            : String(minWidth)
        : undefined;

    return (
        <div
            className={`${styles.tableFixedRoot} ${centered ? styles.centered : ""}`.trim()}
            style={{ top: stickyTop, zIndex: stickyZIndex }}
        >
            <div className={styles.stickyHeaderWrap}>
                <div
                    ref={headerInnerRef}
                    className={styles.gridTable__header}
                    style={{
                        ...gridTemplateStyle,
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

export default ExpandableTableFixedHeader;