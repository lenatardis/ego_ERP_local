import React, { useState } from "react";
import styles from './Auth.module.scss';
import AuthForm from "./AuthForm/AuthForm";
import logo from '../../assets/img/logo.jpg';
import { t } from '../../i18n';
import LanguageSwitcher from '../Common/LanguageSwitcher/LanguageSwitcher';

// Demo build (2026-11-26, at the user's request): a few ERP -> CRM links a visitor might try, collapsed, as examples
// (module-level t() is fine: a language switch reloads the ERP)
const CROSS_APP_IDEAS = [
    t('Бухгалтер підтверджує квитанцію в «CRM платежі» – у CRM замовлення стає оплаченим.'),
    t('Пакувальник завершує пакування – у CRM замовлення стає «Готово до відправки».'),
    t('Адміністратор змінює ціну на сторінці «Ціни» – калькулятор CRM рахує за новою.'),
];

const CrossAppIdeas = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className={styles.ideas}>
            <button type="button" className={styles.ideas__toggle} aria-expanded={isOpen}
                    onClick={() => setIsOpen((v) => !v)}>
                {t('Що можна спробувати')}
                <span className={`${styles.ideas__arrow} ${isOpen ? styles.ideas__arrowOpen : ''}`}>▾</span>
            </button>
            {isOpen && (
                <div className={styles.ideas__body}>
                    <p>{t('ERP і CRM пов’язані між собою. Наприклад:')}</p>
                    <ul>
                        {CROSS_APP_IDEAS.map((idea) => <li key={idea}>{idea}</li>)}
                    </ul>
                    <p>{t('CRM відкривається кнопкою «Перейти в CRM» у меню.')}</p>
                </div>
            )}
        </div>
    );
};

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
                    <br/>{t('Усі дані вигадані.')}
                </p>
                <CrossAppIdeas/>
                <AuthForm/>
            </div>
        </div>
    )
}

export default Auth;
