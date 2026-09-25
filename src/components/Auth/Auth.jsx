import React from "react";
import styles from './Auth.module.scss';
import AuthForm from "./AuthForm/AuthForm";
import logo from '../../assets/img/logo.jpg';

const Auth = () => {
    return (
        <div className={`${styles.auth} wrapper`}>
            <div className={styles.auth__logo}>
                <img src={logo} alt=""/>
            </div>
            <AuthForm/>
        </div>
    )
}

export default Auth;