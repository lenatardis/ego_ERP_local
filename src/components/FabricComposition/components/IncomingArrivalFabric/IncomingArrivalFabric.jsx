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
import EditableFabricTable from ".././EditableFabricTable/EditableFabricTable.jsx";
import { createFabricArrival, fetchVendors, fetchSpecificArrival, editSpecificArrival, fetchCurrentCashRate } from '../../../../api/tablesApi.js';
import { NO_CHANGES_MESSAGE, isSameArrivalPayload, arrivalPayloadFromFabricResponse } from '../arrivalUnchanged.js';
import { getUserById } from "../../../../api/authApi.js";
import { getAccessToken, getUserId } from "../../../../api/authStorage.js";
import { useSelector } from "react-redux";
import { getProfile } from "../../../../store/selectors.js";
import { useNavigate, useParams } from "react-router";
import NewCustomSelect from "../../../Common/NewCustomSelect/NewCustomSelect.jsx";
import CurrencyRateInfo from "../../../Common/CurrencyRateInfo/CurrencyRateInfo.jsx";
import ArrBack from "../../../Common/ArrBack/ArrBack.jsx";
import { t } from '../../../../i18n';

// універсальний парсер "1,56" / "1.56" / "1 234,56" → число
const parseDecimal = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : NaN;
    }
    const raw = String(value ?? '')
        .trim()
        .replace(',', '.')    // кома → крапка
        .replace(/\s+/g, ''); // прибираємо пробіли

    if (!raw) return NaN;

    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
};

/* Yup scheme for upper form */
const headerSchema = Yup.object({
    date: Yup.string().required(t('Оберіть дату')),
    providerOption: Yup.number()
        .transform(v => (isNaN(v) ? undefined : v))
        .integer().positive(t('Оберіть постачальника'))
        .required(t('Оберіть постачальника')),
    docNumber: Yup.string().trim().min(1, t('Вкажіть номер документа')),
    docSumUAH: Yup.number()
        .transform((value, originalValue) => {
            const n = parseDecimal(originalValue);
            return Number.isNaN(n) ? undefined : n;
        })
        .moreThan(0, t('Сума в грн має бути > 0'))
        .required(t('Вкажіть суму в грн')),
    docSumUSD: Yup.number()
        .transform((value, originalValue) => {
            const n = parseDecimal(originalValue);
            return Number.isNaN(n) ? undefined : n;
        })
        .moreThan(0, t('Сума в $ має бути > 0'))
        .required(t('Вкажіть суму в $')),
    acceptedBy: Yup.number()
        .transform(v => (isNaN(v) ? undefined : v))
        .integer().positive(t('Немає ідентифікатора користувача'))
        .required(t('Немає ідентифікатора користувача')),
    exchangeRate: Yup.number()
        .transform((value, originalValue) => {
            const n = parseDecimal(originalValue);
            return Number.isNaN(n) ? undefined : n;
        })
        .moreThan(0, t('Курс має бути > 0'))
        .required(t('Вкажіть закупівельний курс долара')),

    totalEstimate: Yup.string().max(100, t('До 100 символів')).nullable(),
    comment: Yup.string().max(200, t('До 200 символів')).nullable(),
});

const IncomingArrivalFabric = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [vendorOptions, setVendorOptions] = useState([]);
    const [bannerMsg, setBannerMsg] = useState(null);
    // the arrival as loaded in edit mode, in payload shape: saving it unchanged is refused
    const savedPayloadRef = useRef(null);
    const [currentUsdRate, setCurrentUsdRate] = useState(null);
    const [currentUsdSaleRate, setCurrentUsdSaleRate] = useState(null);
    const [hasSavedExchangeRate, setHasSavedExchangeRate] = useState(true);
    const FAIL_BANNER = t('Переконайтесь, будь ласка, що ви заповнили всі необхідні дані');

    const { id } = useParams();
    const isReadMode = window.location.pathname.endsWith('/read');
    const mode = isReadMode ? 'read' : id ? 'edit' : 'create';
    const isReadonly = mode === 'read';
    const [isFabricValidationPopupOpen, setIsFabricValidationPopupOpen] = useState(false);
    const [fabricValidationInfo, setFabricValidationInfo] = useState([]);
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
        clearErrors,
        setValue,
        control,
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

    const fabricRef = useRef(null);
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

                    // тільки при створенні – ставимо цей курс у поле exchangeRate
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

    const toNum = (v) => {
        const n = parseDecimal(v);
        return Number.isFinite(n) ? n : 0;
    };

    const calcTotals = (rows = []) =>
        rows.reduce(
            (acc, row) => {
                const rowUAH = toNum(row.sumUAH);
                const rowUSD = toNum(row.sumUSD);

                if (rowUAH > 0) acc.uah += rowUAH;
                if (rowUSD > 0) acc.usd += rowUSD;

                return acc;
            },
            { uah: 0, usd: 0 }
        );

    const fmt2 = (n) => toNum(n).toFixed(2);

    const onCheckSum = () => {
        const fRows = fabricRef.current?.getRows?.() || [];
        const { uah: tableUAH, usd: tableUSD } = calcTotals(fRows);

        const docUAH = toNum(watch('docSumUAH'));
        const docUSD = toNum(watch('docSumUSD'));
        const uahOk = near(docUAH, tableUAH);
        const usdOk = near(docUSD, tableUSD);

        clearErrors(['docSumUAH', 'docSumUSD']);

        if (!uahOk) {
            setError('docSumUAH', {
                type: 'manual',
                message: t('Не збігається з рядками ({{tableUAH}})', {tableUAH: fmt2(tableUAH)}),
            });
        }

        if (!usdOk) {
            setError('docSumUSD', {
                type: 'manual',
                message: t('Не збігається з рядками ({{tableUSD}})', {tableUSD: fmt2(tableUSD)}),
            });
        }

        if (uahOk && usdOk) {
            setBannerMsg(t('Суми співпадають ✓  (грн: {{tableUAH}}, $: {{tableUSD}})', {tableUAH: fmt2(tableUAH), tableUSD: fmt2(tableUSD)}));
        } else {
            const parts = [];
            if (!usdOk) parts.push(t('✓ $: загальна форма внесення надходження {{docUSD}} ≠ по рядках детальної форми {{tableUSD}}', {docUSD: fmt2(docUSD), tableUSD: fmt2(tableUSD)}));
            if (!uahOk) parts.push(t('✓ грн: загальна форма внесення надходження {{docUAH}} ≠ по рядках детальної форми {{tableUAH}}', {docUAH: fmt2(docUAH), tableUAH: fmt2(tableUAH)}));
            setBannerMsg(t('Невідповідність сум!\n{{n}}', {n: parts.join('\n')}));
        }
    };

    const onInvalid = () => {
        const f = fabricRef.current?.validateAndBuildPayload?.();
        const fEmpty = !f || (f.payload?.length ?? 0) === 0;
        const capacityInfo = f?.capacityValidationInfo;

        if (fEmpty) {
            setBannerMsg(t('Додайте хоча б один рядок у таблиці тканин'));

            if (capacityInfo?.hasErrors) {
                setPendingCapacityPopupInfo(capacityInfo);
            }

            if (f?.fabricValidationInfo?.length) {
                openFabricValidationPopup(f.fabricValidationInfo);
            } else if (capacityInfo?.hasErrors) {
                openCapacityValidationPopup(capacityInfo);
            }

            return;
        }

        setBannerMsg(FAIL_BANNER);

        if (capacityInfo?.hasErrors) {
            setPendingCapacityPopupInfo(capacityInfo);
        }

        if (f?.fabricValidationInfo?.length) {
            openFabricValidationPopup(f.fabricValidationInfo);
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

        // службові клавіші
        if (allowedControlKeys.includes(e.key)) return;

        // шорткати: Ctrl/Command + A/C/V/X/Z/Y
        if (e.ctrlKey || e.metaKey) return;

        // цифри
        if (e.key >= '0' && e.key <= '9') return;

        // крапка або кома
        if (e.key === '.' || e.key === ',') return;

        // все інше – блокуємо
        e.preventDefault();
    };

    // Submit
    const onSave = (formData) => {

        const fabrics = fabricRef.current?.validateAndBuildPayload?.() || { isValid: false, payload: [] };

        const hasF = (fabrics.payload?.length ?? 0) > 0;

        if (!hasF) {
            const capacityInfo = fabrics.capacityValidationInfo;

            setBannerMsg(t('Додайте хоча б один рядок у таблиці тканин'));

            if (capacityInfo?.hasErrors) {
                setPendingCapacityPopupInfo(capacityInfo);
            }

            if (fabrics.fabricValidationInfo?.length) {
                openFabricValidationPopup(fabrics.fabricValidationInfo);
            } else if (capacityInfo?.hasErrors) {
                openCapacityValidationPopup(capacityInfo);
            }

            return;
        }

        if (hasF && !fabrics.isValid) {
            const capacityInfo = fabrics.capacityValidationInfo;

            if (capacityInfo?.hasErrors) {
                setBannerMsg(t('Перевірте кількість у тканинах, де в комірці на складі перевищено доступну місткість{{violations}}', {violations: getCapacityMaxText(capacityInfo.violations)}));
                setPendingCapacityPopupInfo(capacityInfo);
            } else {
                setBannerMsg(FAIL_BANNER);
            }

            if (fabrics.fabricValidationInfo?.length) {
                openFabricValidationPopup(fabrics.fabricValidationInfo);
            } else if (capacityInfo?.hasErrors) {
                openCapacityValidationPopup(capacityInfo);
            }

            return;
        }

        const fRows = fabricRef.current?.getRows?.() || [];
        const { uah: tableUAH, usd: tableUSD } = calcTotals(fRows);

        const docSumUAHNum = toNum(formData.docSumUAH);
        const docSumUSDNum = toNum(formData.docSumUSD);

        let sumsOk = true;
        if (!near(docSumUAHNum, tableUAH)) {
            setError('docSumUAH', { type: 'manual', message: t('Не збігається з рядками ({{tableUAH}})', {tableUAH: fmt2(tableUAH)}) });
            sumsOk = false;
        }
        if (!near(docSumUSDNum, tableUSD)) {
            setError('docSumUSD', { type: 'manual', message: t('Не збігається з рядками ({{tableUSD}})', {tableUSD: fmt2(tableUSD)}) });
            sumsOk = false;
        }
        if (!sumsOk) {
            setBannerMsg(t('Невідповідність сум'));
            return;
        }

        const payload = {
            vendor: Number(formData.providerOption),
            receiver: Number(formData.acceptedBy),
            fabric_rolls: fabrics.payload,
            arrival_date: toBackendDate(formData.date),
            document_num: (formData.docNumber || '').trim(),
            uah_amount: docSumUAHNum,
            usd_amount: docSumUSDNum,
            exchange_rate: toNum(formData.exchangeRate),
            total_estimate: (formData.totalEstimate || '').trim() || null,
            comment: (formData.comment || '').trim() || null,
        };

        if (mode === 'edit' && isSameArrivalPayload(payload, savedPayloadRef.current)) {
            setBannerMsg(NO_CHANGES_MESSAGE);
            return;
        }
        // all checks passed: the banner of an earlier failed attempt (or "no changes") no longer applies
        setBannerMsg(null);

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
                ;

                const exRateNum = parseDecimal(resp.exchange_rate);

                if (Number.isFinite(exRateNum) && exRateNum > 0) {
                    setHasSavedExchangeRate(true);
                    setValue('exchangeRate', exRateNum, { shouldDirty: false });
                } else {
                    setHasSavedExchangeRate(false);
                    setValue('exchangeRate', '', { shouldDirty: false });
                }


                // fabric table
                fabricRef.current?.loadFromEdit?.(resp.fabric_rolls || []);
                savedPayloadRef.current = arrivalPayloadFromFabricResponse(
                    resp, (d) => toBackendDate(fromBackendDate(d)));
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

    const openFabricValidationPopup = (messages = []) => {
        if (!messages.length) return;

        setFabricValidationInfo(messages);
        setIsFabricValidationPopupOpen(true);
        dispatch(setIsActivePopup(true));
    };

    const closeFabricValidationPopup = () => {
        setIsFabricValidationPopupOpen(false);
        setFabricValidationInfo([]);
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

    // " (максимум N)" для однієї комірки, або максимум по кожній комірці, якщо їх кілька
    const getCapacityMaxText = (violations = []) => {
        if (!violations.length) return '';
        if (violations.length === 1) return ` ${t('(максимум {{capacityLimit}})', {capacityLimit: formatCapacityNumber(violations[0].capacityLimit)})}`;
        return ` (${t('максимум:')} ${violations
            .map(item => `${item.cellLabel} – ${formatCapacityNumber(item.capacityLimit)}`)
            .join('; ')})`;
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

            if (!resp || (resp.id == null && !Array.isArray(resp.fabric_rolls))) {
                setBannerMsg(t('Неочікувана відповідь від сервера.'));
                return;
            }

            if (mode === 'edit' || mode === 'create') {
                navigate('/arrivalList');
            }
        } catch (e) {
            console.log(e);
            // причина відмови від бекенду (400): { поле: [повідомлення] }
            const reasons = Object.values(e?.data || {}).flat().filter(m => typeof m === 'string');
            setBannerMsg(
                reasons.length
                    ? t('Вибачте, здається, щось пішло не так. Накладну не збережено:\n{{n}}', {n: reasons.join('\n')})
                    : t('Вибачте, здається, щось пішло не так.') +
                    t(' Повторіть, будь ласка, спробу пізніше.')
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
                        ? t('Перегляд надходження тканини')
                        : id
                            ? t('Редагування надходження тканини')
                            : t('Внесення надходження тканини')}
                </h2>
                {!isReadonly && (
                    <div className={styles.form__action}>
                        <button className={'btnLight'} type="button" onClick={onCheckSum}>
                            <span>{t('Перевірка суми')}</span>
                        </button>
                        <button className={'btnDark'} type="submit" form="incoming-fabric-form">
                            <span>{t('Зберегти')}</span>
                        </button>
                    </div>
                )}
            </div>

            {bannerMsg && (
                // "Перевірка суми" success gets the positive (green) banner style (IncomingArrival.module.scss)
                <div className={`${styles.bannerError} ${bannerMsg.startsWith(t('Суми співпадають')) ? styles.bannerOk : ''}`}>{bannerMsg}</div>
            )}

            <form
                id="incoming-fabric-form"
                onSubmit={isReadonly ? (e) => e.preventDefault() : handleSubmit(onSave, onInvalid)}
                autoComplete="off"
                onKeyDownCapture={stopEnterSubmit}
            >
                <div className={`${styles.form} ${styles.upperForm}`}>
                    <h3>{t('Форма внесення надходження на склад:')}</h3>
                    <div className={styles.titleWrap}>
                        <h4>{t('Загальна інформація про надходження')}</h4>
                        <CurrencyRateInfo
                            buyRate={currentUsdRate}
                            saleRate={currentUsdSaleRate}
                        />
                    </div>
                    <div className={styles.form__content}>
                        <div className={`${styles.column} ${styles.select}`}>
                            <div className={styles.fieldLabel}>{t('Дата надходження')}</div>
                            <div className={styles.dateWrapper}>
                                <input
                                    id="date"
                                    type="date"
                                    className={`${styles.dateField} ${watch('date') ? styles.filled : ''} ${errors.date ? styles.error : ''}`}
                                    {...register('date')}
                                    disabled={isReadonly}
                                />
                                <span className={styles.datePlaceholder}>{t('Дата надходження')}</span>
                            </div>
                            {errors.date && <p className={styles.errorText}>{errors.date.message}</p>}

                            <div className={styles.fieldLabel}>{t('Постачальник')}</div>
                            <Controller
                                name="providerOption"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <>
                                        <NewCustomSelect
                                            label={t('Постачальник')}
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

                            <div className={styles.fieldLabel}>{t('Номер документа')}</div>
                            <InputBox
                                errors={errors}
                                name="docNumber"
                                placeholder={t('Номер документа')}
                                type="text"
                                disabled={isReadonly}
                                options={{ ...register('docNumber'), readOnly: isReadonly}}
                            />

                            <div className={styles.fieldLabel}>{t('Сума за документом в доларах')}</div>
                            <InputBox
                                errors={errors}
                                name="docSumUSD"
                                placeholder={t('Сума за документом в доларах')}
                                type="text"
                                disabled={isReadonly}
                                options={{
                                    ...docSumUSDRest,
                                    ref: docSumUSDRef,
                                    inputMode: 'decimal',
                                    onKeyDown: handleDecimalKeyDown,
                                    readOnly: isReadonly,
                                    disabled: isReadonly,
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
                             <div className={styles.fieldLabel}>{t('Сума за документом в грн')}</div>
                            <InputBox
                                errors={errors}
                                name="docSumUAH"
                                placeholder={t('Сума за документом в грн')}
                                type="text"
                                disabled={isReadonly}
                                options={{
                                    ...docSumUAHRest,
                                    ref: docSumUAHRef,
                                    inputMode: 'decimal',
                                    onKeyDown: handleDecimalKeyDown,
                                    readOnly: isReadonly,
                                    disabled: isReadonly,
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
                                        docSumUAHOnChange(e);
                                    },
                                }}
                            />
                        </div>

                        <div className={styles.column}>
                            <div className={styles.fieldLabel}>
                                {t('Хто приймав (автоматично хто заповнює форму)')}
                            </div>
                            {/* технічне поле для id, як і раніше, йде в форму / на бек */}
                            <input
                                type="hidden"
                                {...register('acceptedBy', { valueAsNumber: true })}
                            />

                            <InputBox
                                errors={errors}
                                name="acceptedByDisplay"
                                placeholder={t('Хто приймав (автоматично хто заповнює форму)')}
                                type="text"
                                disabled={true}
                                options={{
                                    value: acceptedByDisplayName || '',
                                    readOnly: true,
                                    disabled: true,
                                    tabIndex: -1,
                                }}
                            />

                            <div className={styles.fieldLabel}>{t('Загальний кошторис')}</div>
                            <InputBox
                                errors={errors}
                                name="totalEstimate"
                                placeholder={t('Загальний кошторис')}
                                type="text"
                                options={{ ...register('totalEstimate'), readOnly: isReadonly }}
                                disabled={isReadonly}
                            />

                            <div className={styles.fieldLabel}>{t('Закупівельний курс $, грн')}</div>
                            <InputBox
                                errors={errors}
                                name="exchangeRate"
                                placeholder={
                                    mode === 'edit' && !hasSavedExchangeRate
                                        ? t('Курс не було збережено при створенні')
                                        : t('Закупівельний курс долара, грн')
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

                            <div className={styles.fieldLabel}>{t('Коментар')}</div>
                            <textarea
                                className={`comment ${errors.comment ? styles.error : ''}`}
                                placeholder={t('Коментар')}
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
                    <h3>{t('Детальна інформація')}</h3>
                </div>
                {!isReadonly && capacityValidationInfo?.hasErrors && (
                    <div className={styles.bannerError}>
                        <strong>{t('Перевірте (чи за бажанням перерозподіліть) кількість у рядках, де в комірках на складі перевищено доступну місткість')}{getCapacityMaxText(capacityValidationInfo.violations)}.</strong>
                        <div style={{ paddingBottom: '8px', whiteSpace: 'pre-line' }}>
                            {capacityValidationInfo.summaryText}
                        </div>
                    </div>
                )}
                <div className={styles.form} id="fabric-table">
                    <h3>{t('Перелік тканин:')}</h3>
                    <h4>{t('Детальна інформація по кожній позиції тканини які прийшли')}</h4>
                    <EditableFabricTable ref={fabricRef} mode={mode} exchangeRate={watch('exchangeRate')} readOnly={isReadonly} onCapacityValidationChange={handleCapacityValidationChange} />
                </div>
            </form>
            {isConfirmPopupOpen && (
                <CentralPopup title={t('Підтвердження')} onClose={closeConfirmPopup}>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            rowGap: "16px",
                            textAlign: "center",
                        }}
                    >
                        <h3 style={{
                            paddingBottom: 0,
                        }}>{t('Ви дійсно бажаєте зберегти накладну?')}</h3>

                        <button type="button" className="btnDark" style={{
                            width: "200px",
                        }} onClick={handleConfirmSave}>
                            <span>{t('Підтвердити')}</span>
                        </button>

                        <button type="button" className="btnLight" style={{
                            width: "200px",
                        }} onClick={closeConfirmPopup}>
                            <span>{t('Скасувати')}</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
            {isFabricValidationPopupOpen && (
                <CentralPopup
                    title=""
                    onClose={closeFabricValidationPopup}
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
                                {t('Заповніть обов\'язкові поля')} <br /> {t('в таблиці з тканинами')}
                            </h3>

                            {fabricValidationInfo.map((item, index) => (
                                <p key={index} style={{ margin: 0 }}>
                                    * {item.prefix}{' '}
                                    {item.fields.map((field, fieldIndex) => (
                                        <React.Fragment key={`${field}-${fieldIndex}`}>
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
                            onClick={closeFabricValidationPopup}
                        >
                            <span>{t('Ок')}</span>
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
                                {t('Перевищено місткість комірок')}
                            </h3>

                            <p style={{ margin: 0 }}>
                                {t('Накладну неможливо зберегти, поки кількість у проблемних комірках')}
                                {t('перевищує доступний ліміт.')}
                            </p>

                            {capacityValidationInfo.violations.map((item, index) => (
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
                                        {t('Максимум для поточної форми:')}{' '}
                                        <strong>{formatCapacityNumber(item.capacityLimit)}</strong>
                                    </p>

                                    {mode === 'edit' && (
                                        <p style={{ margin: 0 }}>
                                            {t('Ви можете перерозподіляти сумарну кількість в межах')} <strong>{formatCapacityNumber(item.capacityLimit)}</strong> {t('між рядками')}  <strong>{item.rows.map(row => row.rowNumber).join(', ')}</strong> {t('або обирати інші комірки.')}
                                            {t('(З урахуванням раніше збереженої в цій накладній кількості доступно:')}{' '}
                                            <strong>{formatCapacityNumber(item.remainingCapacity)}</strong>,
                                            {' '}{t('раніше збережено в цій накладній:')}{' '}
                                            <strong>{formatCapacityNumber(item.originalQty)}</strong>.)
                                        </p>
                                    )}

                                    <p style={{ margin: 0 }}>
                                        {t('Зараз у формі в різних рядках сумарно вказано:')}{' '}
                                        <strong>{formatCapacityNumber(item.totalQty)}</strong>
                                    </p>


                                    <p style={{ margin: 0 }}>
                                        {t('Перевірте суму кількостей в рядках №')} {' '}
                                        <strong>{item.rows.map(row => row.rowNumber).join(', ')}</strong>
                                    </p>
                                </div>
                            ))}

                            <p style={{ margin: 0 }}>
                                {t('Зменште кількість рулонів або оберіть інші комірки, щоб увійти в ліміт. Також ви можете перерозподіляти кількість між рядками.')}
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
                <span>{t('Ок')}</span>
            </button>
        </div>
    </CentralPopup>
)}
            {isLoading && <Preloader />}
        </div>
    );
};

export default IncomingArrivalFabric;
