import React, { useState } from "react";
import styles from './AuthForm.module.scss';
import { useForm } from "react-hook-form";
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import InputBox from "../../Common/InputBox/InputBox";
import Preloader from "../../Common/Preloader/Preloader";
import { useAppDispatch } from "../../../hooks/redux";
import { setAuth, setProfile } from "../../../store/account-slice";
import { loginUser } from "../../../api/authApi";
import { setTokens, setUserId } from "../../../api/authStorage";
import CustomSelect from "../../Common/CustomSelect/CustomSelect";
import { DEMO_USERS } from "../../../mocks/data/demoUsers";

const DEMO_ROLE_OPTIONS = DEMO_USERS.map((u) => ({ value: String(u.id), name: u.roleLabel }));

const AuthForm = () => {
    const dispatch = useAppDispatch();
    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    const [demoRole, setDemoRole] = useState('');

    const LOGIN_REQUIREMENTS_MESSAGE =
        'Логін повинен містити щонайменше 3 символи';

    const PASSWORD_REQUIREMENTS_MESSAGE =
        'Пароль повинен містити щонайменше 10 символів, включаючи хоча б одну велику літеру і одну цифру';

    const validationSchema = Yup.object().shape({
        login: Yup.string()
            .trim()
            .required(LOGIN_REQUIREMENTS_MESSAGE)
            .min(3, LOGIN_REQUIREMENTS_MESSAGE)
            .max(30, ''),
        password: Yup.string()
            .required(PASSWORD_REQUIREMENTS_MESSAGE)
            .test(
                'password-requirements',
                PASSWORD_REQUIREMENTS_MESSAGE,
                value => {
                    if (!value) return false;

                    return (
                        value.length >= 10 &&
                        /[A-Z]/.test(value) &&
                        /\d/.test(value)
                    );
                }
            ),
    });

    const {
        register, handleSubmit, formState: { errors }, setError, setValue, clearErrors
    } = useForm({
        resolver: yupResolver(validationSchema),
        defaultValues: {
            login: '',
            password: '',
        }
    });

    const handleDemoRoleChange = (e) => {
        const id = e.target.value;
        setDemoRole(id);
        setAuthError('');
        clearErrors();

        const user = DEMO_USERS.find((u) => String(u.id) === id);
        if (user) {
            setValue('login', user.username);
            setValue('password', user.password);
        }
    };

    const onSubmit = async (data) => {
        setIsLoading(true);
        setAuthError('');

        const result = await loginUser(data.login, data.password);

        if (result?.access_token && result?.id) {
            setTokens(result.access_token, result.refresh_token);
            setUserId(result.id);
            dispatch(setAuth(true));
            dispatch(setProfile(result));
        } else {
            if (result?.field === 'credentials') {
                setAuthError(result?.error || "Не вдалося авторизуватися");
            } else {
                setError(result?.field || "password", {
                    type: "manual",
                    message: result?.error || "Не вдалося авторизуватися",
                });
            }
        }

        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.authForm}>
            <div className={styles.form}>
                <div className={styles.demoRole}>
                    <span className={styles.demoRole__label}>Демо-роль</span>
                    <CustomSelect value={demoRole} onChange={handleDemoRoleChange}
                        options={DEMO_ROLE_OPTIONS} label={'Оберіть демо-роль'} />
                </div>
                <InputBox errors={errors} name={'login'} label={'Логін'} placeholder={'Логін'}
                    type={'text'} options={{
                        ...register('login')
                    }} />
                <InputBox errors={errors} name={'password'} type={'password'} placeholder={'Пароль'}
                    label={'Пароль'} options={{
                        ...register("password")
                    }} />
            </div>

            {authError && (
                <p className={styles.authError}>{authError}</p>
            )}

            <button type="submit" className={`${styles.action} btnDark`} disabled={isLoading}>
                <span>Увійти</span>
            </button>
            {isLoading && (
                <Preloader />
            )}
        </form>
    )
}

export default AuthForm;