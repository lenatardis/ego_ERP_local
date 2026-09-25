import React, { useEffect, useState, useRef } from "react";
import { useAppDispatch } from "../../../../hooks/redux.jsx";
import { setIsActivePopup } from "../../../../store/main-slice";
import CentralPopup from "../../../Common/CentralPopup/CentralPopup.jsx";
import styles from '../IncomingArrival.module.scss';
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import InputBox from "../../../Common/InputBox/InputBox";
import Preloader from "../../../Common/Preloader/Preloader";
import EditableProductTable from "../EditableProductTable/EditableProductTable.jsx";
import { createFabricArrival, fetchVendors, fetchSpecificArrival, editSpecificArrival, fetchCurrentCashRate } from '../../../../api/tablesApi.js';
import { getAccessToken, getUserId } from "../../../../api/authStorage.js";
import { getUserById } from "../../../../api/authApi.js";
import { useSelector } from "react-redux";
import { getProfile } from "../../../../store/selectors.js";
import { useNavigate, useParams } from "react-router";
import NewCustomSelect from "../../../Common/NewCustomSelect/NewCustomSelect.jsx";
import CurrencyRateInfo from "../../../Common/CurrencyRateInfo/CurrencyRateInfo.jsx";
import ArrBack from "../../../Common/ArrBack/ArrBack.jsx";


const parseDecimal = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : NaN;
    }
    const raw = String(value ?? '')
        .trim()
        .replace(',', '.')    // кома → крапка
        .replace(/\s+/g, ''); // забираємо пробіли

    if (!raw) return NaN;

    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
};

/* Yup scheme for upper form */
const headerSchema = Yup.object({
    date: Yup.string().required('Оберіть дату'),
    providerOption: Yup.number()
        .transform(v => (isNaN(v) ? undefined : v))
        .integer().positive('Оберіть постачальника')
        .required('Оберіть постачальника'),
    docNumber: Yup.string().trim().min(1, 'Вкажіть номер документа'),
    docSumUAH: Yup.number()
        .transform((value, originalValue) => {
            const n = parseDecimal(originalValue);
            return Number.isNaN(n) ? undefined : n;
        })
        .moreThan(0, 'Сума в грн має бути > 0')
        .required('Вкажіть суму в грн'),
    docSumUSD: Yup.number()
        .transform((value, originalValue) => {
            const n = parseDecimal(originalValue);
            return Number.isNaN(n) ? undefined : n;
        })
        .moreThan(0, 'Сума в $ має бути > 0')
        .required('Вкажіть суму в $'),
    acceptedBy: Yup.number()
        .transform(v => (isNaN(v) ? undefined : v))
        .integer().positive('Немає ідентифікатора користувача')
        .required('Немає ідентифікатора користувача'),
    exchangeRate: Yup.number()
        .transform((value, originalValue) => {
            const n = parseDecimal(originalValue);
            return Number.isNaN(n) ? undefined : n;
        })
        .moreThan(0, 'Курс має бути > 0')
        .required('Вкажіть закупівельний курс долара'),

    totalEstimate: Yup.string().max(100, 'До 100 символів').nullable(),
    comment: Yup.string().max(200, 'До 200 символів').nullable(),
});

const IncomingArrivalProduct = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [vendorOptions, setVendorOptions] = useState([]);
    const [bannerMsg, setBannerMsg] = useState(null);
    const [currentUsdRate, setCurrentUsdRate] = useState(null);
    const [currentUsdSaleRate, setCurrentUsdSaleRate] = useState(null);
    const [hasSavedExchangeRate, setHasSavedExchangeRate] = useState(true);
    const FAIL_BANNER = 'Переконайтесь, будь ласка, що ви заповнили всі необхідні дані';

    const { id } = useParams();
    const isReadMode = window.location.pathname.endsWith('/read');
    const mode = isReadMode ? 'read' : id ? 'edit' : 'create';
    const isReadonly = mode === 'read';
    const [isProductValidationPopupOpen, setIsProductValidationPopupOpen] = useState(false);
    const [productValidationInfo, setProductValidationInfo] = useState([]);
    const [isCapacityValidationPopupOpen, setIsCapacityValidationPopupOpen] = useState(false);
    const [capacityValidationInfo, setCapacityValidationInfo] = useState({
        hasErrors: false,
        violations: [],
        summaryText: '',
    });
    const [pendingCapacityPopupInfo, setPendingCapacityPopupInfo] = useState(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        setValue,
        control,
        clearErrors,
        watch,
    } = useForm({
        resolver: yupResolver(headerSchema),
        mode: 'onChange',
        reValidateMode: 'onChange',
        defaultValues: {
            date: '',
            providerOption: '',
            docNumber: '',
            docSumUAH: '',
            docSumUSD: '',
            acceptedBy: '',
            totalEstimate: '',
            exchangeRate: '',
            comment: '',
        },
    });

    const {
        ref: exchangeRateRef,
        onChange: exchangeRateOnChange,
        ...exchangeRateRest
    } = register('exchangeRate');

    const {
        ref: docSumUAHRef,
        onChange: docSumUAHOnChange,
        ...docSumUAHRest
    } = register('docSumUAH');

    const {
        ref: docSumUSDRef,
        onChange: docSumUSDOnChange,
        ...docSumUSDRest
    } = register('docSumUSD');

    const productRef = useRef(null);
    const userId = getUserId();
    const profile = useSelector(getProfile);
    const [acceptedByDisplayName, setAcceptedByDisplayName] = useState('');

    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [isConfirmPopupOpen, setIsConfirmPopupOpen] = useState(false);
    const [pendingPayload, setPendingPayload] = useState(null);

    useEffect(() => {
        if (mode !== 'create') return;

        if (!profile) {
            setAcceptedByDisplayName('');
            return;
        }

        const name =
            profile.first_name && profile.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : (profile.username ?? '');
        setAcceptedByDisplayName(name);
    }, [mode, profile]);

    /* vendor fetching */
    useEffect(() => {
        (async () => {
            try {
                const token = getAccessToken();
                const resp = await fetchVendors(token);
                const results = resp?.vendors || [];
                const opts = results.map(v => ({ name: v.full_name, value: v.id }));
                setVendorOptions(opts);
            } catch (e) {
                console.error(e);
                setVendorOptions([]);
            }
        })();
    }, []);

    /* acceptedBy fetching*/
    useEffect(() => {
        if (mode !== 'create') return;
        setValue('acceptedBy', userId ? Number(userId) : '', { shouldDirty: false });
    }, [setValue, userId, mode]);

    /* поточний безготівковий курс USD */
   /* поточний курс USD */
    useEffect(() => {
        (async () => {
            try {
                const token = getAccessToken();
                const resp = await fetchCurrentCashRate(token);

                const usd = resp?.exchange_rate;

                const buyNum = parseDecimal(usd?.buy);
                const saleNum = parseDecimal(usd?.sale);

                if (Number.isFinite(buyNum) && buyNum > 0) {
                    setCurrentUsdRate(buyNum);

                    // тільки при створенні — ставимо цей курс у поле exchangeRate
                    if (mode === 'create') {
                        setValue('exchangeRate', buyNum, { shouldDirty: false });
                    }
                } else {
                    setCurrentUsdRate(null);
                }

                if (Number.isFinite(saleNum) && saleNum > 0) {
                    setCurrentUsdSaleRate(saleNum);
                } else {
                    setCurrentUsdSaleRate(null);
                }
            } catch (e) {
                console.error('Failed to fetch current cash rate:', e);
                setCurrentUsdRate(null);
                setCurrentUsdSaleRate(null);
            }
        })();
    }, [mode, setValue]);

    // date → dd.mm.yyyy
    const toBackendDate = (s) => {
        if (!s) return '';
        const [y, m, d] = s.split('-');
        return `${d}.${m}.${y}`;
    };

    const fromBackendDate = (s) => {
        if (!s) return '';
        const [d, m, y] = s.split('.');
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    // sum
    const EPS = 0.01;
    const near = (a, b) => Math.abs(a - b) < EPS;

    // універсальний парсер "1,56" / "1.56" → число


    const toNum = (v) => {
        const n = parseDecimal(v);
        return Number.isFinite(n) ? n : 0;
    };

    const fmt2 = (n) => toNum(n).toFixed(2);


    // checkSum btn

    const calcProductTotals = (rows = []) =>
        rows.reduce((acc, row) => {
            (row.variants || []).forEach(v => {
                const q = toNum(v.quantity);
                const uah = toNum(v.priceUAH);
                const usd = toNum(v.priceUSD);

                if (q > 0 && uah > 0) acc.uah += q * uah;
                if (q > 0 && usd > 0) acc.usd += q * usd;
            });
            return acc;
        }, { uah: 0, usd: 0 });


    const onCheckSum = () => {
        const pRows = productRef.current?.getRows?.() || [];
        const { uah: tableUAH, usd: tableUSD } = calcProductTotals(pRows);

        const docUAH = toNum(watch('docSumUAH'));
        const docUSD = toNum(watch('docSumUSD'));
        const uahOk = near(docUAH, tableUAH);
        const usdOk = near(docUSD, tableUSD);

        clearErrors(['docSumUSD', 'docSumUAH']);

        if (!usdOk) {
            setError('docSumUSD', {
                type: 'manual',
                message: `Не збігається з рядками (${fmt2(tableUSD)})`,
            });
        }

        if (!uahOk) {
            setError('docSumUAH', {
                type: 'manual',
                message: `Не збігається з рядками (${fmt2(tableUAH)})`,
            });
        }

        if (uahOk && usdOk) {
            setBannerMsg(`Суми співпадають ✓  ($: ${fmt2(tableUSD)}, грн: ${fmt2(tableUAH)})`);
        } else {
            const parts = [];
            if (!usdOk) parts.push(`✓ $: загальна форма внесення надходження ${fmt2(docUSD)} ≠ по рядках детальної форми ${fmt2(tableUSD)}`);
            if (!uahOk) parts.push(`✓ грн: загальна форма внесення надходження ${fmt2(docUAH)} ≠ по рядках детальної форми ${fmt2(tableUAH)}`);
            setBannerMsg(`Невідповідність сум!\n${parts.join('\n')}`);
        }
    };

    const onInvalid = () => {
        const p = productRef.current?.validateAndBuildPayload?.();
        const pEmpty = !p || (p.payload?.length ?? 0) === 0;
        const capacityInfo = p?.capacityValidationInfo;

        if (pEmpty) {
            setBannerMsg('Додайте хоча б один рядок у таблиці продукції');

            if (capacityInfo?.hasErrors) {
                setPendingCapacityPopupInfo(capacityInfo);
            }

            if (p?.productValidationInfo?.length) {
                openProductValidationPopup(p.productValidationInfo);
            } else if (capacityInfo?.hasErrors) {
                openCapacityValidationPopup(capacityInfo);
            }

            return;
        }

        setBannerMsg(FAIL_BANNER);

        if (capacityInfo?.hasErrors) {
            setPendingCapacityPopupInfo(capacityInfo);
        }

        if (p?.productValidationInfo?.length) {
            openProductValidationPopup(p.productValidationInfo);
        } else if (capacityInfo?.hasErrors) {
            openCapacityValidationPopup(capacityInfo);
        }
    };

    // дозволяємо тільки цифри, крапку та кому з клавіатури
    const handleDecimalKeyDown = (e) => {
        const allowedControlKeys = [
            'Backspace',
            'Delete',
            'Tab',
            'ArrowLeft',
            'ArrowRight',
            'Home',
            'End',
            'Enter',
        ];

        if (allowedControlKeys.includes(e.key)) return;

        if (e.ctrlKey || e.metaKey) return; // шорткати

        if (e.key >= '0' && e.key <= '9') return;

        if (e.key === '.' || e.key === ',') return;

        e.preventDefault();
    };



    // Submit
    const onSave = (formData) => {
        const products = productRef.current?.validateAndBuildPayload?.() || { isValid: false, payload: [] };

        const hasP = (products.payload?.length ?? 0) > 0;

        if (!hasP) {
            const capacityInfo = products.capacityValidationInfo;

            setBannerMsg('Додайте хоча б один рядок у таблиці продукції');

            if (capacityInfo?.hasErrors) {
                setPendingCapacityPopupInfo(capacityInfo);
            }

            if (products.productValidationInfo?.length) {
                openProductValidationPopup(products.productValidationInfo);
            } else if (capacityInfo?.hasErrors) {
                openCapacityValidationPopup(capacityInfo);
            }

            return;
        }

        if (!products.isValid) {
            const capacityInfo = products.capacityValidationInfo;

            if (capacityInfo?.hasErrors) {
                setBannerMsg('Перевірте кількість у продукції, де в комірці на складі перевищено доступну місткість');
                setPendingCapacityPopupInfo(capacityInfo);
            } else {
                setBannerMsg(FAIL_BANNER);
            }

            if (products.productValidationInfo?.length) {
                openProductValidationPopup(products.productValidationInfo);
            } else if (capacityInfo?.hasErrors) {
                openCapacityValidationPopup(capacityInfo);
            }

            return;
        }

        const pRows = productRef.current?.getRows?.() || [];
        const { uah: tableUAH, usd: tableUSD } = calcProductTotals(pRows);

        let sumsOk = true;
        const docSumUAHNum = toNum(formData.docSumUAH);
        const docSumUSDNum = toNum(formData.docSumUSD);

        if (!near(docSumUAHNum, tableUAH)) {
            setError('docSumUAH', {
                type: 'manual',
                message: `Не збігається з рядками (${fmt2(tableUAH)})`,
            });
            sumsOk = false;
        }

        if (!near(docSumUSDNum, tableUSD)) {
            setError('docSumUSD', {
                type: 'manual',
                message: `Не збігається з рядками (${fmt2(tableUSD)})`,
            });
            sumsOk = false;
        }

        if (!sumsOk) {
            setBannerMsg('Невідповідність сум');
            return;
        }

        const payload = {
            vendor: Number(formData.providerOption),
            receiver: Number(formData.acceptedBy),
            fabric_rolls: [],
            warehouse_item_units: products.payload,
            arrival_date: toBackendDate(formData.date),
            document_num: (formData.docNumber || '').trim(),
            uah_amount: docSumUAHNum,
            usd_amount: docSumUSDNum,
            exchange_rate: toNum(formData.exchangeRate),
            total_estimate: (formData.totalEstimate || '').trim() || null,
            comment: (formData.comment || '').trim() || null,
        };


        openConfirmPopup(payload);

    };

    //edit mode
    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                setIsLoading(true);
                const token = getAccessToken();
                const resp = await fetchSpecificArrival(token, id);
                console.log('Fetched arrival by id:', id, resp);

                // upper form
                setValue('date', fromBackendDate(resp.arrival_date), { shouldDirty: false });
                setValue('providerOption', resp.vendor?.id ?? '', { shouldDirty: false });
                setValue('docNumber', resp.document_num ?? '', { shouldDirty: false });
                setValue('docSumUAH', resp.uah_amount ?? '', { shouldDirty: false });
                setValue('docSumUSD', resp.usd_amount ?? '', { shouldDirty: false });
                setValue('acceptedBy', resp.receiver?.id ?? '', { shouldDirty: false });
                setValue('totalEstimate', resp.total_estimate ?? '', { shouldDirty: false });
                setValue('comment', resp.comment ?? '', { shouldDirty: false });

                const receiverId = resp.receiver?.id;
                if (receiverId) {
                    try {
                        const userInfo = await getUserById(receiverId, token);
                        const displayName =
                            userInfo?.first_name && userInfo?.last_name
                                ? `${userInfo.first_name} ${userInfo.last_name}`
                                : (userInfo?.username ?? '');
                        setAcceptedByDisplayName(displayName);
                    } catch (err) {
                        console.error('Failed to fetch receiver user by id:', receiverId, err);
                        setAcceptedByDisplayName('');
                    }
                } else {
                    setAcceptedByDisplayName('');
                }

                const exRateNum = parseDecimal(resp.exchange_rate);

                if (Number.isFinite(exRateNum) && exRateNum > 0) {
                    setHasSavedExchangeRate(true);
                    setValue('exchangeRate', exRateNum, { shouldDirty: false });
                } else {
                    setHasSavedExchangeRate(false);
                    setValue('exchangeRate', '', { shouldDirty: false });
                }

                // fabric table
                productRef.current?.loadFromEdit?.(resp.warehouse_item_units || []);
            } catch (e) {
                console.error('Failed to fetch arrival by id:', id, e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [id]);

    const stopEnterSubmit = (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    };

    const openConfirmPopup = (payload) => {
        setPendingPayload(payload);
        setIsConfirmPopupOpen(true);
        dispatch(setIsActivePopup(true));
    };

    const closeConfirmPopup = () => {
        setIsConfirmPopupOpen(false);
        setPendingPayload(null);
        dispatch(setIsActivePopup(false));
    };

    const openProductValidationPopup = (messages = []) => {
        if (!messages.length) return;

        setProductValidationInfo(messages);
        setIsProductValidationPopupOpen(true);
        dispatch(setIsActivePopup(true));
    };

    const closeProductValidationPopup = () => {
        setIsProductValidationPopupOpen(false);
        setProductValidationInfo([]);
        dispatch(setIsActivePopup(false));

        if (pendingCapacityPopupInfo?.violations?.length) {
            const nextPopupInfo = pendingCapacityPopupInfo;
            setPendingCapacityPopupInfo(null);

            setTimeout(() => {
                openCapacityValidationPopup(nextPopupInfo);
            }, 0);
        }
    };
    const formatCapacityNumber = (value) => {
        const n = parseDecimal(value);
        if (!Number.isFinite(n)) return '0';
        return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
    };

const handleCapacityValidationChange = (info) => {
    setCapacityValidationInfo(info || {
        hasErrors: false,
        violations: [],
        summaryText: '',
    });
};

    const openCapacityValidationPopup = (info) => {
        const safeInfo = info || {
            hasErrors: false,
            violations: [],
            summaryText: '',
        };

        if (!safeInfo.violations?.length) return;

        setPendingCapacityPopupInfo(null);
        setCapacityValidationInfo(safeInfo);
        setIsCapacityValidationPopupOpen(true);
        dispatch(setIsActivePopup(true));
    };

    const closeCapacityValidationPopup = () => {
        setIsCapacityValidationPopupOpen(false);
        dispatch(setIsActivePopup(false));
    };

    const submitArrival = async (payload) => {
        try {
            setIsLoading(true);
            setBannerMsg(null);
            const token = getAccessToken();
            const resp = id
                ? await editSpecificArrival(token, id, payload)
                : await createFabricArrival(token, payload);

            console.log(resp);

            if (!resp || (resp.id == null && !Array.isArray(resp.warehouse_item_units))) {
                setBannerMsg('Неочікувана відповідь від сервера.');
                return;
            }

            if (mode === 'edit') {
                productRef.current?.loadFromEditAndRecalc?.(resp.warehouse_item_units || []);
            }

            if (mode === 'create') {
                navigate('/arrivalList');
            }
        } catch (e) {
            console.log(e);
            setBannerMsg(
                'Вибачте, здається, щось пішло не так.' +
                ' Повторіть, будь ласка, спробу пізніше.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmSave = async () => {
        const payload = pendingPayload;
        closeConfirmPopup();

        if (!payload) return;

        await submitArrival(payload);
    };


    return (
        <div className={styles.incomingFabric} key={id ?? 'new'}>
            <ArrBack/>
            <div className={styles.titleBlock}>
                <h2>
                    {mode === 'read'
                        ? 'Перегляд надходження товарів'
                        : id
                            ? 'Редагування надходження товарів'
                            : 'Внесення надходження товарів'}
                </h2>
                {!isReadonly && (
                    <div className={styles.form__action}>
                        <button className={'btnLight'} type="button" onClick={onCheckSum}>
                            <span>Перевірка суми</span>
                        </button>
                        <button className={'btnDark'} type="submit" form="incoming-product-form">
                            <span>Зберегти</span>
                        </button>
                    </div>
                )}
            </div>

            {bannerMsg && <div className={styles.bannerError}>{bannerMsg}</div>}

            <form id="incoming-product-form" onSubmit={isReadonly ? (e) => e.preventDefault() : handleSubmit(onSave, onInvalid)} autoComplete="off" onKeyDownCapture={stopEnterSubmit}>
                <div className={`${styles.form} ${styles.upperForm}`}>
                    <h3>Форма внесення надходження на склад:</h3>
                    <div className={styles.titleWrap}>
                        <h4>Загальна інформація про надходження</h4>
                        <CurrencyRateInfo
                            buyRate={currentUsdRate}
                            saleRate={currentUsdSaleRate}
                        />
                    </div>
                    <div className={styles.form__content}>
                        <div className={`${styles.column} ${styles.select}`}>
                            <div className={styles.fieldLabel}>Дата надходження</div>
                            <div className={styles.dateWrapper}>
                                <input
                                    id="date"
                                    type="date"
                                    className={`${styles.dateField} ${watch('date') ? styles.filled : ''} ${errors.date ? styles.error : ''}`}
                                    {...register('date')}
                                    disabled={isReadonly}
                                />
                                <span className={styles.datePlaceholder}>Дата надходження</span>
                            </div>
                            {errors.date && <p className={styles.errorText}>{errors.date.message}</p>}

                            <div className={styles.fieldLabel}>Постачальник</div>
                            <Controller
                                name="providerOption"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <>
                                        <NewCustomSelect
                                            label="Постачальник"
                                            value={field.value}
                                            onChange={(e) => field.onChange(e.target.value)}
                                            options={vendorOptions}
                                            disabled={vendorOptions.length === 0 || isReadonly}
                                            className={fieldState.error ? styles.error : ''}
                                            error={!!fieldState.error}
                                            greyPlaceholder
                                        />
                                        {fieldState.error && <p className={styles.errorText}>{fieldState.error.message}</p>}
                                    </>
                                )}
                            />

                            <div className={styles.fieldLabel}>Номер документа</div>
                            <InputBox
                                errors={errors}
                                name="docNumber"
                                placeholder="Номер документа"
                                type="text"
                                disabled={isReadonly}
                                options={{ ...register('docNumber'), readOnly: isReadonly }}
                            />

                            <div className={styles.fieldLabel}>Сума за документом в доларах</div>
                            <InputBox
                                errors={errors}
                                name="docSumUSD"
                                placeholder="Сума за документом в доларах"
                                type="text"
                                disabled={isReadonly}
                                options={{
                                    ...docSumUSDRest,
                                    ref: docSumUSDRef,
                                    inputMode: 'decimal',
                                    readOnly: isReadonly,
                                    disabled: isReadonly,
                                    onKeyDown: handleDecimalKeyDown,
                                    onChange: (e) => {
                                        const raw = e.target.value;
                                        let cleaned = raw.replace(/[^0-9.,]/g, '');
                                        const parts = cleaned.split(/[.,]/);
                                        if (parts.length > 2) {
                                            cleaned = parts[0] + '.' + parts.slice(1).join('');
                                        }
                                        if (raw !== cleaned) {
                                            e.target.value = cleaned;
                                        }
                                        docSumUSDOnChange(e);
                                    },
                                }}
                            />
                               <div className={styles.fieldLabel}>Сума за документом в грн</div>
                            <InputBox
                                errors={errors}
                                name="docSumUAH"
                                placeholder="Сума за документом в грн"
                                type="text"
                                disabled={isReadonly}
                                options={{
                                    ...docSumUAHRest,
                                    ref: docSumUAHRef,
                                    inputMode: 'decimal',
                                    readOnly: isReadonly,
                                    disabled: isReadonly,
                                    onKeyDown: handleDecimalKeyDown,
                                    onChange: (e) => {
                                        const raw = e.target.value;
                                        // лишаємо цифри + одну кому/крапку
                                        let cleaned = raw.replace(/[^0-9.,]/g, '');
                                        // (опц.) якщо раптом користувач ввів кілька ком/крапок — можна залишити першу
                                        const parts = cleaned.split(/[.,]/);
                                        if (parts.length > 2) {
                                            cleaned = parts[0] + '.' + parts.slice(1).join('');
                                        }
                                        if (raw !== cleaned) {
                                            e.target.value = cleaned;
                                        }
                                        docSumUAHOnChange(e); // важливо: передаємо далі в RHF
                                    },
                                }}
                            />

                        </div>

                        <div className={styles.column}>
                            <div className={styles.fieldLabel}>
                                Хто приймав (автоматично хто заповнює форму)
                            </div>
                            <input
                                type="hidden"
                                {...register('acceptedBy', { valueAsNumber: true })}
                            />

                            <InputBox
                                errors={errors}
                                name="acceptedByDisplay"
                                placeholder="Хто приймав (автоматично хто заповнює форму)"
                                type="text"
                                disabled={true}
                                options={{
                                    value: acceptedByDisplayName || '',
                                    readOnly: true,
                                    disabled: true,
                                    tabIndex: -1,
                                }}
                            />

                            <div className={styles.fieldLabel}>Загальний кошторис</div>
                            <InputBox
                                errors={errors}
                                name="totalEstimate"
                                placeholder="Загальний кошторис"
                                type="text"
                                disabled={isReadonly}
                                options={{ ...register('totalEstimate'), readOnly: isReadonly }}
                            />


                            <div className={styles.fieldLabel}>Закупівельний курс долара, грн</div>

                            <InputBox
                                errors={errors}
                                name="exchangeRate"
                                placeholder={
                                    mode === 'edit' && !hasSavedExchangeRate
                                        ? 'Курс не було збережено при створенні'
                                        : 'Закупівельний курс долара, грн'
                                }
                                type="text"
                                disabled={true}
                                options={{
                                    ...exchangeRateRest,
                                    ref: exchangeRateRef,
                                    readOnly: true,
                                    tabIndex: -1,
                                    inputMode: 'decimal',
                                    onKeyDown: handleDecimalKeyDown,
                                    onChange: (e) => {
                                        const raw = e.target.value;
                                        const cleaned = raw.replace(/[^0-9.,]/g, '');
                                        if (raw !== cleaned) {
                                            e.target.value = cleaned;
                                        }
                                        exchangeRateOnChange(e);
                                    },
                                }}
                            />

                            <div className={styles.fieldLabel}>Коментар</div>
                            <textarea
                                className={`comment ${errors.comment ? styles.error : ''}`}
                                placeholder="Коментар"
                                {...register('comment')}
                                maxLength="200"
                                readOnly={isReadonly}
                                disabled={isReadonly}
                            />
                            {errors.comment && <p className={styles.errorText}>{errors.comment.message}</p>}
                        </div>
                    </div>
                </div>

                <div className={`${styles.titleBlock} ${styles.extraPadding}`}>
                    <h3>Детальна інформація</h3>
                </div>
                {!isReadonly && capacityValidationInfo?.hasErrors && (
                    <div className={styles.bannerError}>
                        <strong>Перевірте (чи за бажанням перерозподіліть) кількість у позиціях продукції, де в комірках на складі перевищено доступну місткість.</strong>
                        <div style={{ paddingBottom: '8px', whiteSpace: 'pre-line' }}>
                            {capacityValidationInfo.summaryText}
                        </div>
                    </div>
                )}
                <div className={styles.form}>
                    <h3>Перелік товарів</h3>
                    <h4>Детальна інформація по кожній позиції товарів які прийшли</h4>
                    <EditableProductTable ref={productRef} mode={mode} exchangeRate={watch('exchangeRate')} readOnly={isReadonly} onCapacityValidationChange={handleCapacityValidationChange} />
                </div>
            </form>
            {isConfirmPopupOpen && (
                <CentralPopup title="Підтвердження" onClose={closeConfirmPopup}>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            rowGap: "16px",
                            textAlign: "center",
                        }}
                    >
                        <h3
                            style={{
                                paddingBottom: 0,
                            }}
                        >
                            Ви дійсно бажаєте зберегти накладну?
                        </h3>

                        <button
                            type="button"
                            className="btnDark"
                            style={{
                                width: "200px",
                            }}
                            onClick={handleConfirmSave}
                        >
                            <span>Підтвердити</span>
                        </button>

                        <button
                            type="button"
                            className="btnLight"
                            style={{
                                width: "200px",
                            }}
                            onClick={closeConfirmPopup}
                        >
                            <span>Скасувати</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
            {isProductValidationPopupOpen && (
                <CentralPopup
                    title=""
                    onClose={closeProductValidationPopup}
                    infoPopup
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            rowGap: "16px",
                            justifyContent: "space-between",
                            height: "100%",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                rowGap: "8px",
                                textAlign: "left",
                            }}
                        >
                            <h3
                                style={{
                                    paddingBottom: 0,
                                    textAlign: "center",
                                }}
                            >
                                Заповніть обов'язкові поля <br/> в таблиці з товарами
                            </h3>
                            {productValidationInfo.map((item, index) => (
                                <p key={index} style={{ margin: 0 }}>
                                    * {item.prefix}{' '}
                                    {item.fields.map((field, fieldIndex) => (
                                        <React.Fragment key={field}>
                                            <strong>{field}</strong>
                                            {fieldIndex < item.fields.length - 1 ? ', ' : ''}
                                        </React.Fragment>
                                    ))}
                                </p>
                            ))}
                        </div>

                        <button
                            type="button"
                            className="btnDark"
                            style={{
                                width: "200px",
                                alignSelf: "center",
                            }}
                            onClick={closeProductValidationPopup}
                        >
                            <span>Ок</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
            {isCapacityValidationPopupOpen && (
                <CentralPopup
                    title=""
                    onClose={closeCapacityValidationPopup}
                    infoPopup
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            rowGap: "16px",
                            justifyContent: "space-between",
                            height: "100%",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                rowGap: "10px",
                                textAlign: "left",
                            }}
                        >
                            <h3
                                style={{
                                    paddingBottom: 0,
                                    textAlign: "center",
                                }}
                            >
                                Перевищено місткість комірок
                            </h3>

                            <p style={{ margin: 0 }}>
                                Накладну неможливо зберегти, поки кількість у проблемних комірках
                                перевищує доступний ліміт.
                            </p>

                            {capacityValidationInfo.violations.map((item, index) => {
                                const positionNumbers = item.rows.map(row => row.positionLabel).join(', ');
                                const hasSinglePosition = item.rows.length === 1;

                                return (
                                    <div
                                        key={`${item.cellId}-${index}`}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            rowGap: "4px",
                                            paddingTop: "8px",
                                            borderTop: index === 0 ? "none" : "1px solid #e5e7eb",
                                        }}
                                    >
                                        <p style={{ margin: 0 }}>
                                            <strong>✓ {item.cellLabel}</strong>
                                        </p>

                                        <p style={{ margin: 0 }}>
                                            Максимум для поточної форми:{' '}
                                            <strong>{formatCapacityNumber(item.capacityLimit)}</strong>
                                        </p>

                                        {mode === 'edit' && (
                                            <p style={{ margin: 0 }}>
                                                {hasSinglePosition ? (
                                                    <>
                                                        Ви можете вказати максимум <strong>{formatCapacityNumber(item.capacityLimit)}</strong> для позиції № <strong>{positionNumbers}</strong> або обирати інші комірки.
                                                    </>
                                                ) : (
                                                    <>
                                                        Ви можете перерозподіляти сумарну кількість в межах <strong>{formatCapacityNumber(item.capacityLimit)}</strong> між позиціями <strong>{positionNumbers}</strong> або обирати інші комірки.
                                                    </>
                                                )}
                                                {' '}
                                                (З урахуванням раніше збереженої в цій накладній кількості доступно:{' '}
                                                <strong>{formatCapacityNumber(item.remainingCapacity)}</strong>,
                                                {' '}раніше збережено в цій накладній:{' '}
                                                <strong>{formatCapacityNumber(item.originalQty)}</strong>.)
                                            </p>
                                        )}

                                        <p style={{ margin: 0 }}>
                                            Зараз у формі сумарно вказано:{' '}
                                            <strong>{formatCapacityNumber(item.totalQty)}</strong>
                                        </p>

                                        <p style={{ margin: 0 }}>
                                            Перевірте суму кількостей в позиціях №{' '}
                                            <strong>{positionNumbers}</strong>
                                        </p>
                                    </div>
                                );
                            })}

                            <p style={{ margin: 0 }}>
                                Зменште кількість товарів або оберіть інші комірки, щоб увійти в ліміт. Ви можете перерозподіляти кількість за бажанням.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="btnDark"
                            style={{
                                width: "200px",
                                alignSelf: "center",
                            }}
                            onClick={closeCapacityValidationPopup}
                        >
                            <span>Ок</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
            {isLoading && <Preloader />}
        </div>
    );
};

export default IncomingArrivalProduct;
