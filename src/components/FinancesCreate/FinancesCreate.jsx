import React, {useState} from "react";
import styles from './FinancesCreate.module.scss';
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";
import * as Yup from "yup";
import InputBox from "../Common/InputBox/InputBox";
import WhiteCustomSelect from "../Common/WhiteCustomSelect/WhiteCustomSelect";
import ArrBack from "../Common/ArrBack/ArrBack";

const view = [
    {name: 'Фінансова', value: 'Financial'},
    {name: 'Інвестиційна', value: 'Investment'},
    {name: 'Операційна', value: 'Operating'},
]

const validationSchema = Yup.object().shape({
    date: Yup.string().notRequired().min(3, 'login should be at-least 3 characters').max(30, 'error'),
    sum: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    view: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    type: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    category: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    group: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    currency: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    counterAgent: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    comment: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    else: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    file: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
    bills: Yup.string().transform(value => value === '' ? null : value).notRequired().min(2, 'Password must be at least 6 characters long with at least one capital letter'),
});

const FinancesCreate = () => {
    const [filters, setFilters] = useState({
        view: '',
    });

    const {
        register, handleSubmit, formState: {errors}, setError
    } = useForm({
        resolver: yupResolver(validationSchema),
        defaultValues: {
            date: '',
            sum: '',
            view: '',
            type: '',
            category: '',
            group: '',
            currency: '',
            counterAgent: '',
            comment: '',
            else: '',
            file: '',
            bills: '',
        }
    });

    const onSubmit = (data) => {
        console.log(data)
    }

    const handleFilterChange = (key) => (event) => {
        setFilters((prev) => ({
            ...prev,
            [key]: event.target.value,
        }));
    };

    return (
        <div className={styles.financesCreate}>
            <ArrBack/>
            <h2>Внесення надходження тканини</h2>

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
                <div className={styles.form__content}>
                    <div className={styles.column}>
                        <InputBox errors={errors} name={'date'} placeholder={'Дата операції'}
                                  type={'text'} options={{
                            ...register('date')
                        }}/>
                        <InputBox errors={errors} name={'sum'} placeholder={'Сума'}
                                  type={'text'} options={{
                            ...register('sum')
                        }}/>
                        {/*<InputBox errors={errors} name={'view'} placeholder={'Вид операції'}*/}
                        {/*          type={'text'} options={{*/}
                        {/*    ...register('view')*/}
                        {/*}}/>*/}
                        <WhiteCustomSelect
                            label="Вид операції"
                            value={filters.view}
                            onChange={handleFilterChange('view')}
                            options={view}
                        />
                        <InputBox errors={errors} name={'type'} placeholder={'Тип операції'}
                                  type={'text'} options={{
                            ...register('type')
                        }}/>
                        <InputBox errors={errors} name={'category'} placeholder={'Категорія'}
                                  type={'text'} options={{
                            ...register('category')
                        }}/>
                        <InputBox errors={errors} name={'group'} placeholder={'Група'}
                                  type={'text'} options={{
                            ...register('group')
                        }}/>
                    </div>
                    <div className={styles.column}>
                        <InputBox errors={errors} name={'currency'} placeholder={'Валюта'}
                                  type={'text'} options={{
                            ...register('currency')
                        }}/>
                        <InputBox errors={errors} name={'counterAgent'} placeholder={'Контрагент'}
                                  type={'text'} options={{
                            ...register('counterAgent')
                        }}/>
                        <InputBox errors={errors} name={'comment'} placeholder={'Коментар'}
                                  type={'text'} options={{
                            ...register('comment')
                        }}/>
                        <InputBox errors={errors} name={'else'} placeholder={'Інше'}
                                  type={'text'} options={{
                            ...register('else')
                        }}/>
                        <InputBox errors={errors} name={'file'} placeholder={'Прикріплення файлу'}
                                  type={'text'} options={{
                            ...register('file')
                        }}/>
                        <InputBox errors={errors} name={'bills'} placeholder={'Надходження-витрати (рахунки)'}
                                  type={'text'} options={{
                            ...register('bills')
                        }}/>

                    </div>
                </div>
                <div className={styles.form__action}>
                    <button type='submit' className={'btnDark'}>
                        <span>Зберегти</span>
                    </button>
                </div>
            </form>
        </div>
    )
}

export default FinancesCreate;