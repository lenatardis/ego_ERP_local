import React from "react";
import styles from './Auth.module.scss';
import AuthForm from "./AuthForm/AuthForm";
import logo from '../../assets/img/logo.jpg';
import { t } from '../../i18n';
import LanguageSwitcher from '../Common/LanguageSwitcher/LanguageSwitcher';

// Demo build: logo and form sit in a card with a demo-access hint (same layout as the CRM's start page)
const Auth = () => {
    return (
        <div className={`${styles.auth} wrapper`}>
            <div className={styles.card}>
                <LanguageSwitcher className={styles.card__lang}/>
                <div className={styles.auth__logo}>
                    <img src={logo} alt="Ego Textile"/>
                </div>
                <h1 className={styles.card__title}>{t('Вхід в ERP')}</h1>
                <p className={styles.card__hint}>
                    {t('Демо-доступ: оберіть роль у списку – логін і пароль заповняться самі.')}
                </p>
                <AuthForm/>
            </div>
        </div>
    )
}

export default Auth;
