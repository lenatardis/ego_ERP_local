import React from "react";
import styles from './InputBox.module.scss';

const InputBox = ({
                      errors,
                      name,
                      label = null,
                      type = 'text',
                      placeholder = '',
                      options,
                      defaultValue = null,
                      disabled = false
                  }) => {

    return (
        <div className={`${styles.inputBox} ${
            disabled ? styles.disabledInput : ''
        }`}>
            {label && (
                <label className={styles.inputBox__label} htmlFor={name}>{label}</label>
            )}
            <input
                className={`${styles.inputBox__input} ${(errors[name] || errors['All']) ? styles.inputBox__error : ''}`}
                type={type}
                placeholder={placeholder} id={name} name={name} {...options} defaultValue={defaultValue}
                disabled={disabled}/>
            {errors && errors[name] && (
                <p className="errorMsg">{errors[name].message}</p>
            )}
        </div>
    )
}

export default InputBox;