import React from "react";
import styles from './ExpandableTable.module.scss';
import user from '../../../assets/icons/userPurple.svg';

const ExpandedBox = ({ onRemove, onManualLink, onView, row }) => {
    const isLinked = Boolean(row?.is_linked);
    const stop = (e) => e.stopPropagation();

    const toHref = (url) => {
        if (!url) return '';
        const raw = String(url).trim();
        return /^(https?:)?\/\//i.test(raw) ? raw : `https://${raw}`;
    };

    return (
        <div className={styles.expandedBox} onClick={stop}>
            <div className={styles.expandedBox__links}>
                {!isLinked && (
                    <div className={styles.linkWrap}>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <button
                                className={'btnDark'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onManualLink?.(row);
                                }}
                            >
                                <span>Прив'язати замовлення вручну</span>
                            </button>

                            <button
                                className={'btnDark'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onView?.(row);
                                }}
                            >
                                <span>Переглянути</span>
                            </button>
                        </div>

                        <p className={styles.info}>Оберіть, якщо вибір не був автоматичний</p>
                    </div>
                )}

                {isLinked && (
                    <>
                        <a
                            className={styles.expandedBox__callClient}
                            href={toHref(row.customer_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={stop}
                        >
                            <img src={user} alt="" />
                            <span>Зв’язок з клієнтом</span>
                        </a>

                        <button
                            className={'btnDark'}
                            onClick={(e) => {
                                e.stopPropagation();
                                onView?.(row);
                            }}
                        >
                            <span>Переглянути</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ExpandedBox;