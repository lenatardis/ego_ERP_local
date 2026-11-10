import React from "react";
import styles from './Auth.module.scss';
import AuthForm from "./AuthForm/AuthForm";
import logo from '../../assets/img/logo.jpg';

// Demo build: logo and form sit in a card with a demo-access hint (same layout as the CRM's start page)
const Auth = () => {
    return (
        <div className={`${styles.auth} wrapper`}>
            <div className={styles.card}>
                <div className={styles.auth__logo}>
                    <img src={logo} alt="Ego Textile"/>
                </div>
                <h1 className={styles.card__title}>Вхід в ERP</h1>
                <p className={styles.card__hint}>
                    Демо-доступ: оберіть роль у списку – логін і пароль заповняться самі.
                </p>
                <AuthForm/>
            </div>
        </div>
    )
}

export default Auth;
