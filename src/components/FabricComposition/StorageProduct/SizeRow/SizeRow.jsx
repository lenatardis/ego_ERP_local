import React from "react";
import styles from './SizeRow.module.scss';

const SizeRow = ({sizes}) => {
    return (
        <div className={styles.sizeRow}>
            {sizes?.length > 0 && sizes?.map((el, index) => (
                <span key={index}>
                    <p>{el.title}</p>
                </span>
            ))}
        </div>
    )
}

export default SizeRow;