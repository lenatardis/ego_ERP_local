import React from "react";
import styles from "./CustomCheckbox.module.scss";

const CustomCheckbox = ({
                            name,
                            value,
                            isChecked = false,
                            isLoading = false,
                            onChange,
                            label,
                            darkText = false,
                        }) => {
    const textClass = [
        label ? styles.labelText : "",
        darkText ? styles.darkText : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={`${styles.customCheckbox} ${isLoading ? styles.disabled : ""} ${darkText? styles.min : ""}`}>
            <input
                name={name}
                type="checkbox"
                value={value}
                checked={isChecked}
                disabled={isLoading}
                onChange={(e) => onChange?.(e.target.checked)}
            />
            <span/>
            <p className={textClass}>{name}</p>
        </div>
    );
};

export default CustomCheckbox;
