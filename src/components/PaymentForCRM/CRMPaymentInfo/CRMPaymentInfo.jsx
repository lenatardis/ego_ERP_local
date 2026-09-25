import React, { useEffect, useState } from "react";
import styles from "../../FabricComposition/components/IncomingArrival.module.scss";
import InputBox from "../../Common/InputBox/InputBox.jsx";
import Preloader from "../../Common/Preloader/Preloader.jsx";
import { useParams } from "react-router";
import { getAccessToken } from "../../../api/authStorage.js";
import { getSpecificCRMPayment } from "../../../api/tablesApi.js";
import LinkIcon from "../../../assets/icons/link.svg";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";

const TYPE_MAP = {
    ONLINE: "Онлайн",
    IBAN: "IBAN",
    TAX: "Накладений платіж",
};

const METHOD_MAP = {
    FULL: "Повна оплата",
    PREPAYMENT: "Передплата",
    POSTPAID: "Післяплата",
};

const STATUS_MAP = {
    PAY_WAIT: "Очікує оплати",
    PAID: "Оплачено",
    NOT_PAID: "Не оплачено",
    REFUND: "Повернення",
    IN_PROG: "В обробці",
    IN_PROC: "В обробці",
};

const APPROVED_MAP = {
    IN_PROC: "На розгляді",
    APPROVED: "Підтверджено",
    DECLINED: "Відхилено",
};

const PROVIDER_TYPE_MAP = {
    monobank: "Monobank",
};

const formatValue = (value) => {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "boolean") return value ? "Так" : "Ні";
    return String(value);
};

const formatDateTime = (value) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("uk-UA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

const formatMoney = (value) => {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    return Number.isNaN(num) ? String(value) : num.toLocaleString("uk-UA");
};

const getFileNameFromUrl = (url) => {
    if (!url) return "";
    try {
        const pathname = new URL(url).pathname;
        const parts = pathname.split("/").filter(Boolean);
        return decodeURIComponent(parts[parts.length - 1] || url);
    } catch {
        const parts = String(url).split("/").filter(Boolean);
        return decodeURIComponent(parts[parts.length - 1] || String(url));
    }
};

const getApprovalClassName = (status) => {
    switch (status) {
        case "APPROVED":
            return styles.paymentDetailPage__approvalApproved;
        case "DECLINED":
            return styles.paymentDetailPage__approvalDeclined;
        case "IN_PROC":
            return styles.paymentDetailPage__approvalInProc;
        default:
            return "";
    }
};

const CRMPaymentInfo = () => {
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
                const response = await getSpecificCRMPayment(token, id);

                if (!response?.id) {
                    setBannerMsg("Не вдалося завантажити інформацію про CRM платіж.");
                    setPayment(null);
                    return;
                }

                setPayment(response);
            } catch (error) {
                console.error("Failed to load CRM payment info:", error);
                setBannerMsg("Не вдалося завантажити інформацію про CRM платіж.");
                setPayment(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            loadData();
        }
    }, [id]);

    const hasReceiptLink = Boolean(payment?.receipt_id && payment?.receipt_url);
    const hasCustomerReceiptLink = !hasReceiptLink && Boolean(payment?.customer_receipt);

    return (
        <div className={`${styles.incomingFabric} ${styles.paymentDetailPage}`}>
            <ArrBack/>
            <div className={styles.titleBlock}>
                <h2>Перегляд CRM платежу</h2>
            </div>

            {bannerMsg && <div className={styles.bannerError}>{bannerMsg}</div>}

            <div className={`${styles.form} ${styles.upperForm}`}>
                <h3>Інформація про CRM платіж</h3>

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

                        <div className={styles.fieldLabel}>Поточний статус</div>
                        <InputBox
                            errors={{}}
                            name="status"
                            type="text"
                            disabled
                            options={{
                                value: STATUS_MAP[payment?.status] || formatValue(payment?.status),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Тип оплати</div>
                        <InputBox
                            errors={{}}
                            name="type"
                            type="text"
                            disabled
                            options={{
                                value: TYPE_MAP[payment?.type] || formatValue(payment?.type),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Метод оплати</div>
                        <InputBox
                            errors={{}}
                            name="method"
                            type="text"
                            disabled
                            options={{
                                value: METHOD_MAP[payment?.method] || formatValue(payment?.method),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Орієнтовна дата сплати</div>
                        <InputBox
                            errors={{}}
                            name="prepayment_datetime"
                            type="text"
                            disabled
                            options={{
                                value: formatDateTime(payment?.prepayment_datetime),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Фактична дата сплати</div>
                        <InputBox
                            errors={{}}
                            name="paid_datetime"
                            type="text"
                            disabled
                            options={{
                                value: formatDateTime(payment?.paid_datetime),
                                readOnly: true,
                                disabled: true,
                            }}
                        />
                    </div>

                    <div className={styles.column}>
                        <div className={styles.fieldLabel}>Сума</div>
                        <InputBox
                            errors={{}}
                            name="prepayment_amount"
                            type="text"
                            disabled
                            options={{
                                value: formatMoney(payment?.prepayment_amount),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>ID CRM замовлення</div>
                        <InputBox
                            errors={{}}
                            name="order"
                            type="text"
                            disabled
                            options={{
                                value: formatValue(payment?.order),
                                readOnly: true,
                                disabled: true,
                            }}
                        />

                        <div className={styles.fieldLabel}>Чек</div>
                        {hasReceiptLink ? (
                            <div className={`${styles.paymentDetailPage__linkBox} ${styles.paymentDetailPage__linkBoxMd}`}>
                                <a
                                    href={payment.receipt_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.paymentDetailPage__link}
                                >
                                    <img
                                        src={LinkIcon}
                                        alt="link"
                                        className={styles.paymentDetailPage__linkIcon}
                                    />
                                    {payment.receipt_id}
                                </a>
                            </div>
                        ) : hasCustomerReceiptLink ? (
                            <div className={styles.paymentDetailPage__linkBox}>
                                <a
                                    href={payment.customer_receipt}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.paymentDetailPage__link}
                                >
                                    <img
                                        src={LinkIcon}
                                        alt="link"
                                        className={styles.paymentDetailPage__linkIcon}
                                    />
                                    {getFileNameFromUrl(payment.customer_receipt)}
                                </a>
                            </div>
                        ) : (
                            <InputBox
                                errors={{}}
                                name="receipt_fallback"
                                type="text"
                                disabled
                                options={{
                                    value: "",
                                    readOnly: true,
                                    disabled: true,
                                }}
                            />
                        )}

                        <div className={styles.fieldLabel}>Підтвердження бухгалтером</div>
                        <div
                            className={`${styles.paymentDetailPage__linkBox} ${styles.paymentDetailPage__linkBoxMd} ${getApprovalClassName(payment?.customer_receipt_approved)}`}
                        >
                            {APPROVED_MAP[payment?.customer_receipt_approved] ||
                                formatValue(payment?.customer_receipt_approved)}
                        </div>

                        <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__sectionTitle}`}>
                            Онлайн платіж
                        </div>

                        <div className={styles.paymentDetailPage__providerBlock}>
                            <div className={styles.paymentDetailPage__providerGrid}>
                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Банк
                                    </div>
                                    <InputBox
                                        errors={{}}
                                        name="provider_payment_type"
                                        type="text"
                                        disabled
                                        options={{
                                            value:
                                                PROVIDER_TYPE_MAP[payment?.provider_payment?.type] ||
                                                formatValue(payment?.provider_payment?.type),
                                            readOnly: true,
                                            disabled: true,
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className={`${styles.fieldLabel} ${styles.paymentDetailPage__providerLabel}`}>
                                        Інвойс
                                    </div>
                                    {payment?.provider_payment?.order_id && payment?.provider_payment?.invoice_url ? (
                                        <div className={`${styles.paymentDetailPage__linkBox} ${styles.paymentDetailPage__linkBoxMd}`}>
                                            <a
                                                href={payment.provider_payment.invoice_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={styles.paymentDetailPage__link}
                                            >
                                                <img
                                                    src={LinkIcon}
                                                    alt="link"
                                                    className={styles.paymentDetailPage__linkIcon}
                                                />
                                                {payment.provider_payment.order_id}
                                            </a>
                                        </div>
                                    ) : (
                                        <InputBox
                                            errors={{}}
                                            name="provider_payment_order_id"
                                            type="text"
                                            disabled
                                            options={{
                                                value: formatValue(payment?.provider_payment?.order_id),
                                                readOnly: true,
                                                disabled: true,
                                            }}
                                        />
                                    )}
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

export default CRMPaymentInfo;