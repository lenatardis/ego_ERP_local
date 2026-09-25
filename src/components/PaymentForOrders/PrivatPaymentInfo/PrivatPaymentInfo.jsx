import React, { useEffect, useState } from "react";
import styles from "../../FabricComposition/components/IncomingArrival.module.scss";
import InputBox from "../../Common/InputBox/InputBox.jsx";
import Preloader from "../../Common/Preloader/Preloader.jsx";
import { useParams } from "react-router";
import { getAccessToken } from "../../../api/authStorage.js";
import { getPrivatAccountById } from "../../../api/tablesApi.js";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";

const OPERATION_MAP = {
    EXPENDITURE: "Витрата",
    TRANSFER: "Переказ",
    INCOME: "Надходження",
};

const MONEY_TYPE_MAP = {
    NON_CASH: "Безготівковий",
    CASH: "Готівковий",
};

const CURRENCY_MAP = {
    UAH: "Гривня",
    USD: "Долар США",
    EUR: "Євро",
};

const PAYMENT_BILL_TYPE_MAP = {
    ONLINE: "Онлайн",
    IBAN: "IBAN",
    TAX: "Накладений платіж",
};

const PAYMENT_BILL_METHOD_MAP = {
    FULL: "Повна оплата",
    PREPAYMENT: "Передплата",
    POSTPAID: "Післяплата",
};

const PAYMENT_BILL_STATUS_MAP = {
    PAY_WAIT: "Очікує оплати",
    PAID: "Оплачено",
    NOT_PAID: "Не оплачено",
    REFUND: "Повернення",
    IN_PROG: "В обробці",
    IN_PROC: "В обробці",
};

const formatValue = (value) => {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "boolean") return value ? "Так" : "Ні";
    return String(value);
};

const formatBoolean = (value) => {
    if (value === true) return "Так";
    if (value === false) return "Ні";
    return "";
};

const formatMoney = (value) => {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    return Number.isNaN(num) ? String(value) : num.toLocaleString("uk-UA");
};

const formatDateTime = (value) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    const pad = (num) => String(num).padStart(2, "0");

    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

const PrivatPaymentInfo = () => {
    const { id } = useParams();
    const [isLoading, setIsLoading] = useState(false);
    const [bannerMsg, setBannerMsg] = useState(null);
    const [payment, setPayment] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                setBannerMsg(null);

                const token = getAccessToken();
                const response = await getPrivatAccountById(token, id);

                if (!response?.id) {
                    setBannerMsg("Не вдалося завантажити інформацію про платіж.");
                    setPayment(null);
                    return;
                }

                setPayment(response);
            } catch (error) {
                console.error("Failed to load privat payment info:", error);
                setBannerMsg("Не вдалося завантажити інформацію про платіж.");
                setPayment(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            loadData();
        }
    }, [id]);

    return (
        <div className={`${styles.incomingFabric} ${styles.paymentDetailPage}`}>
            <ArrBack/>
            <div className={styles.titleBlock}>
                <h2>Перегляд платежу</h2>
            </div>

            {bannerMsg && <div className={styles.bannerError}>{bannerMsg}</div>}

            <div className={`${styles.form} ${styles.upperForm}`}>
                <h3>Інформація про платіж</h3>

                <div className={styles.form__content}>
                    <div className={styles.column}>
                        <div className={styles.fieldLabel}>ID</div>
                        <InputBox
                            errors={{}}
                            name="id"
                            type="text"
                            disabled
                            options={{
                                value: formatValue(payment?.id),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Тип операції</div>
                        <InputBox
                            errors={{}}
                            name="operation"
                            type="text"
                            disabled
                            options={{
                                value: OPERATION_MAP[payment?.operation] || formatValue(payment?.operation),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Метод операції</div>
                        <InputBox
                            errors={{}}
                            name="money_type"
                            type="text"
                            disabled
                            options={{
                                value: MONEY_TYPE_MAP[payment?.money_type] || formatValue(payment?.money_type),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>ID транзакції</div>
                        <InputBox
                            errors={{}}
                            name="transaction_id"
                            type="text"
                            disabled
                            options={{
                                value: formatValue(payment?.transaction_id),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>ID квитанції</div>
                        <InputBox
                            errors={{}}
                            name="num_doc"
                            type="text"
                            disabled
                            options={{
                                value: formatValue(payment?.num_doc),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Ref</div>
                        <InputBox
                            errors={{}}
                            name="payment_id"
                            type="text"
                            disabled
                            options={{
                                value: formatValue(payment?.payment_id),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Сума</div>
                        <InputBox
                            errors={{}}
                            name="amount"
                            type="text"
                            disabled
                            options={{
                                value: formatMoney(payment?.amount),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Валюта</div>
                        <InputBox
                            errors={{}}
                            name="currency"
                            type="text"
                            disabled
                            options={{
                                value: CURRENCY_MAP[payment?.currency] || formatValue(payment?.currency),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Курс</div>
                        <InputBox
                            errors={{}}
                            name="course"
                            type="text"
                            disabled
                            options={{
                                value: formatValue(payment?.course),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Дата оплати</div>
                        <InputBox
                            errors={{}}
                            name="datetime"
                            type="text"
                            disabled
                            options={{
                                value: formatDateTime(payment?.datetime),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__sectionTitle}`}>
                            Отримувач
                        </div>

                        <div className={styles.paymentDetailPage__providerBlock}>
                            <div className={styles.paymentDetailPage__providerGrid}>
                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        IBAN
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="account_iban"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.account?.iban),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        ПІБ
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="account_full_name"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.account?.full_name),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__sectionTitle}`}>
                            Відправник
                        </div>

                        <div className={styles.paymentDetailPage__providerBlock}>
                            <div className={styles.paymentDetailPage__providerGrid}>
                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Контрагент
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="counterparty"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.counterparty),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Код ЄДРПОУ
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="counterparty_crf"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.counterparty_crf),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Код банку (МФО)
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="counterparty_mfo"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.counterparty_mfo),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        IBAN
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="counterparty_iban"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.counterparty_iban),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Банк
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="counterparty_mfo_name"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.counterparty_mfo_name),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Розташування
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="counterparty_mfo_city"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.counterparty_mfo_city),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.column}>
                        <div className={styles.fieldLabel}>Призначення платежу</div>
                        <textarea
                            className="comment"
                            value={formatValue(payment?.assignment)}
                            readOnly
                            disabled
                        />

                        <div className={styles.fieldLabel}>Коментар до транзакції</div>
                        <textarea
                            className="comment"
                            value={formatValue(payment?.comment)}
                            readOnly
                            disabled
                        />

                        <div className={styles.fieldLabel}>Платіж повернуто</div>
                        <InputBox
                            errors={{}}
                            name="is_refunded"
                            type="text"
                            disabled
                            options={{
                                value: formatBoolean(payment?.is_refunded),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__sectionTitle}`}>
                            CRM рахунок
                        </div>

                        <div className={styles.paymentDetailPage__providerBlock}>
                            <div className={styles.paymentDetailPage__providerGrid}>
                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        ID
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_id"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.payment_bill?.id),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Тип оплати
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_type"
                                        type="text"
                                        disabled
                                        options={{
                                            value:
                                                PAYMENT_BILL_TYPE_MAP[payment?.payment_bill?.type] ||
                                                formatValue(payment?.payment_bill?.type),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Метод оплати
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_method"
                                        type="text"
                                        disabled
                                        options={{
                                            value:
                                                PAYMENT_BILL_METHOD_MAP[payment?.payment_bill?.method] ||
                                                formatValue(payment?.payment_bill?.method),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Статус
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_status"
                                        type="text"
                                        disabled
                                        options={{
                                            value:
                                                PAYMENT_BILL_STATUS_MAP[payment?.payment_bill?.status] ||
                                                formatValue(payment?.payment_bill?.status),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Орієнтовна дата сплати
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_prepayment_datetime"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatDateTime(payment?.payment_bill?.prepayment_datetime),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Фактична дата сплати
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_paid_datetime"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatDateTime(payment?.payment_bill?.paid_datetime),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Сума
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_prepayment_amount"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatMoney(payment?.payment_bill?.prepayment_amount),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        ID платежу
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_payment_id"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.payment_bill?.payment_id),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        ID замовлення
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="payment_bill_order_id"
                                        type="text"
                                        disabled
                                        options={{
                                            value: formatValue(payment?.payment_bill?.order_id),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading && <Preloader />}
        </div>
    );
};

export default PrivatPaymentInfo;