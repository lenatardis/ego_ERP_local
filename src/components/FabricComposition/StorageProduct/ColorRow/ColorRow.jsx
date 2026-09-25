import React from "react";
import styles from './ColorRow.module.scss';

const ColorRow = ({colors}) => {

    return (
        <>
            {colors?.length > 0 && (
                <div className={styles.colorsRow}>
                    {colors?.map((el, index) => (
                        <span
                            key={index}
                            style={{
                                backgroundColor: el.title,
                                border: '1px solid #D9D1E0'
                            }}
                        >
                                </span>
                    ))}
                </div>
            )}
        </>

    )
}

export default ColorRow;