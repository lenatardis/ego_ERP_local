import React from "react";
import styles from './PopupCloser.module.scss';

const PopupCloser = ({isShow, onClose}) => {

    return (
        <button onClick={() => onClose()} className={isShow ? styles.popupCloserActive : styles.popupCloser} />
    )
}

export default PopupCloser;