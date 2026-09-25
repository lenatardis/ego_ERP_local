import React from "react";
import styles from "./RadioButton.module.scss";

const RadioButton = ({
                         name,
                         value,
                         checked,
                         onChange,
                         title,
                         disabled = false,
                     }) => {
    const handleChange = () => {
        if (disabled) return;
        if (onChange) onChange(value);
    };

    return (
        <label className={`${styles.radio} ${disabled ? styles.disabled : ""}`}>
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={handleChange}
                disabled={disabled}
            />
            <span className={styles.radioMark} />
            <span className={styles.label}>{title}</span>
        </label>
    );
};

export default RadioButton;
