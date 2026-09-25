import React, { useEffect, useMemo, useState } from "react";
import styles from "../../FabricComposition/components/IncomingArrival.module.scss";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import InputBox from "../../Common/InputBox/InputBox.jsx";
import NewCustomSelect from "../../Common/NewCustomSelect/NewCustomSelect.jsx";
import Preloader from "../../Common/Preloader/Preloader.jsx";
import CurrencyRateInfo from "../../Common/CurrencyRateInfo/CurrencyRateInfo.jsx";
import { getAccessToken } from "../../../api/authStorage.js";
import {
  fetchVendors,
  fetchAllArrivals,
  createVendorPayment,
  editVendorPayment,
  getSpecificVendorPayment,
  fetchCurrentCashRate
} from "../../../api/tablesApi.js";
import { useNavigate, useParams } from "react-router";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";

const paymentSourceOptions = [
  { value: "BANK", name: "Банк" },
  { value: "CASH", name: "Готівка" },
  { value: "OTHER", name: "Інше" },
];

const paymentStatusOptions = [
  { value: "UNPAID", name: "Не оплачено" },
  { value: "PAID", name: "Оплачено" },
  { value: "WAIT_FOR_PAY", name: "Очікує оплати" },
];

const parseDecimal = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  const raw = String(value ?? "")
    .trim()
    .replace(",", ".")
    .replace(/\s+/g, "");

  if (!raw) return NaN;

  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
};

const toMoneyString = (value) => {
  const n = parseDecimal(value);
  if (!Number.isFinite(n)) return "";
  return String(Number(n.toFixed(2)));
};

const formatArrivalOption = (arrival) => {
  if (!arrival) return "";

  const idPart = arrival.id != null ? `Надходження ${arrival.id}` : "Надходження";
  const datePart = arrival.arrival_date ? ` від ${arrival.arrival_date}` : "";

  return `${idPart}${datePart}`;
};

const fromBackendDate = (value) => {
  if (!value) return "";

  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split(".");
    return `${y}-${m}-${d}`;
  }

  return "";
};

const getValidationSchema = (mode) =>
  Yup.object({
    paymentSource: Yup.string()
      .nullable()
      .required("Оберіть джерело платежу"),
    operationDate: Yup.string()
      .nullable()
      .required("Оберіть дату операції"),
    payerAccount: Yup.string().nullable(),
    receiverAccount: Yup.string().nullable(),
    payerName: Yup.string().nullable(),
    vendor:
      mode === "create"
        ? Yup.number()
          .transform((v) => (isNaN(v) ? undefined : v))
          .integer()
          .positive("Оберіть постачальника")
          .required("Оберіть постачальника")
        : Yup.mixed().nullable(),
    documentFile: Yup.mixed().nullable(),
    arrival:
      mode === "create"
        ? Yup.number()
          .transform((v) => (isNaN(v) ? undefined : v))
          .integer()
          .positive("Оберіть надходження")
          .required("Оберіть надходження")
        : Yup.mixed().nullable(),
    uahAmount: Yup.string()
      .nullable()
      .required("Введіть суму в грн"),
    usdAmount: Yup.string()
      .nullable()
      .required("Введіть суму в $"),
    dollarRate: Yup.mixed().test(
      "valid-rate",
      "Курс має бути > 0",
      (value) => {
        if (value === undefined || value === null || String(value).trim() === "") {
          return true;
        }
        const n = parseDecimal(value);
        return Number.isFinite(n) && n > 0;
      }
    ),
    comment: Yup.string().nullable().max(500, "До 500 символів"),
  });

const NewVendorPayment = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const isReadMode = window.location.pathname.endsWith("/read");
  const mode = isReadMode ? "read" : id ? "edit" : "create";
  const isReadonly = mode === "read";

  const [vendors, setVendors] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bannerMsg, setBannerMsg] = useState(null);
  const [existingDocument, setExistingDocument] = useState("");
  const [currentUsdRate, setCurrentUsdRate] = useState(null);
  const [currentUsdSaleRate, setCurrentUsdSaleRate] = useState(null);

  const schema = useMemo(() => getValidationSchema(mode), [mode]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      paymentSource: "",
      operationDate: "",
      payerAccount: "",
      receiverAccount: "",
      payerName: "",
      vendor: "",
      status: "",
      documentFile: null,
      arrival: "",
      uahAmount: "",
      usdAmount: "",
      dollarRate: "",
      comment: "",
    },
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const loadCurrentRate = async () => {
      try {
        const resp = await fetchCurrentCashRate(token);
        const usd = resp?.exchange_rate;

        const buyNum = parseDecimal(usd?.buy);
        const saleNum = parseDecimal(usd?.sale);

        if (Number.isFinite(buyNum) && buyNum > 0) {
          setCurrentUsdRate(buyNum);

          if (mode === "create") {
            setValue("dollarRate", String(buyNum), { shouldDirty: false });
          }
        } else {
          setCurrentUsdRate(null);
        }

        if (Number.isFinite(saleNum) && saleNum > 0) {
          setCurrentUsdSaleRate(saleNum);
        } else {
          setCurrentUsdSaleRate(null);
        }
      } catch (error) {
        console.error("Failed to fetch current USD rate:", error);
        setCurrentUsdRate(null);
        setCurrentUsdSaleRate(null);
      }
    };

    loadCurrentRate();
  }, [mode, setValue]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        const [vendorsResponse, arrivalsResponse, paymentResponse] = await Promise.all([
          fetchVendors(token),
          fetchAllArrivals(token, { page: 1 }),
          id ? getSpecificVendorPayment(token, id) : Promise.resolve(null),
        ]);

        setVendors(Array.isArray(vendorsResponse?.vendors) ? vendorsResponse.vendors : []);
        setArrivals(
          Array.isArray(arrivalsResponse?.fabric_arrivals)
            ? arrivalsResponse.fabric_arrivals
            : []
        );

        if (paymentResponse) {
          setExistingDocument(paymentResponse?.document ?? "");

          reset({
            paymentSource: paymentResponse?.source ?? "",
            operationDate: fromBackendDate(paymentResponse?.operation_date),
            payerAccount: paymentResponse?.payer_account ?? "",
            receiverAccount: paymentResponse?.recipient_account ?? "",
            payerName: paymentResponse?.payer ?? "",
            vendor: paymentResponse?.vendor?.id ?? paymentResponse?.vendor ?? "",
            status: paymentResponse?.status ?? "",
            documentFile: null,
            arrival:
              paymentResponse?.fabric_arrival?.id ??
              paymentResponse?.fabric_arrival ??
              "",
            uahAmount:
              paymentResponse?.uah_amount != null ? String(paymentResponse.uah_amount) : "",
            usdAmount:
              paymentResponse?.usd_amount != null ? String(paymentResponse.usd_amount) : "",
            dollarRate:
              paymentResponse?.exchange_rate != null
                ? String(paymentResponse.exchange_rate)
                : "",
            comment: paymentResponse?.comment ?? "",
          });
        }
      } catch (error) {
        console.error("Failed to load vendor payment form data:", error);
        setBannerMsg("Не вдалося завантажити дані платежу.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id, reset]);

  const vendorOptions = useMemo(
    () =>
      vendors.map((vendor) => ({
        value: vendor.id,
        name: vendor.full_name,
      })),
    [vendors]
  );

  const arrivalOptions = useMemo(
    () =>
      arrivals.map((arrival) => ({
        value: arrival.id,
        name: formatArrivalOption(arrival) || `Надходження ${arrival.id}`,
      })),
    [arrivals]
  );

  const watchedDate = watch("operationDate");

  const {
    ref: uahAmountRef,
    onChange: uahAmountOnChange,
    ...uahAmountRest
  } = register("uahAmount");

  const {
    ref: usdAmountRef,
    onChange: usdAmountOnChange,
    ...usdAmountRest
  } = register("usdAmount");

  const {
    ref: dollarRateRef,
    onChange: dollarRateOnChange,
    ...dollarRateRest
  } = register("dollarRate");

  const handleDecimalKeyDown = (e) => {
    const allowedControlKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "Enter",
    ];

    if (allowedControlKeys.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (e.key >= "0" && e.key <= "9") return;
    if (e.key === "." || e.key === ",") return;

    e.preventDefault();
  };

  const stopEnterSubmit = (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  };

  const buildPayload = (formData) => {
    const payload = {
      source: formData.paymentSource || "",
      operation_date: formData.operationDate || "",
      payer_account: formData.payerAccount?.trim() || "",
      recipient_account: formData.receiverAccount?.trim() || "",
      payer: formData.payerName?.trim() || "",
      vendor: formData.vendor ? Number(formData.vendor) : "",
      status: formData.status || "",
      document: formData.documentFile || null,
      fabric_arrival: formData.arrival ? Number(formData.arrival) : "",
      uah_amount: formData.uahAmount?.trim() || "",
      usd_amount: formData.usdAmount?.trim() || "",
      exchange_rate:
        formData.dollarRate !== undefined &&
          formData.dollarRate !== null &&
          String(formData.dollarRate).trim() !== ""
          ? parseDecimal(formData.dollarRate)
          : "",
      comment: formData.comment?.trim() || "",
    };

    return payload;
  };

  const onSave = async (formData) => {
    try {
      setBannerMsg(null);
      setIsLoading(true);

      const token = getAccessToken();
      const payload = buildPayload(formData);

      const response = id
        ? await editVendorPayment(token, id, payload)
        : await createVendorPayment(token, payload);

      if (!response?.id) {
        setBannerMsg("Неочікувана відповідь від сервера.");
        return;
      }

      navigate("/payment-for-vendors");
    } catch (error) {
      console.error("Failed to save vendor payment:", error);
      setBannerMsg("Не вдалося зберегти платіж постачальнику.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.incomingFabric}>
      <ArrBack/>
      <div className={styles.titleBlock}>
        <h2>
          {mode === "read"
            ? "Перегляд платежу постачальнику"
            : mode === "edit"
              ? "Редагування платежу постачальнику"
              : "Надходження-витрати (рахунки)"}
        </h2>

        {!isReadonly && (
          <div className={styles.form__action}>
            <button className={"btnDark"} type="submit" form="new-vendor-payment-form">
              <span>Зберегти</span>
            </button>
          </div>
        )}
      </div>

      {bannerMsg && <div className={styles.bannerError}>{bannerMsg}</div>}

      <form
        id="new-vendor-payment-form"
        onSubmit={isReadonly ? (e) => e.preventDefault() : handleSubmit(onSave)}
        autoComplete="off"
        onKeyDownCapture={stopEnterSubmit}
      >
        <div className={`${styles.form} ${styles.upperForm}`}>
          <h3>Ручне внесення взаєморозрахунку з постачальником:</h3>

          <div className={styles.titleWrap}>
            <h4>Загальна інформація про надходження</h4>
            <CurrencyRateInfo
              buyRate={currentUsdRate}
              saleRate={currentUsdSaleRate}
            />
          </div>

          <div className={styles.form__content}>
            <div className={`${styles.column} ${styles.select}`}>
              <div className={styles.fieldLabel}>Джерело платежу</div>
              <Controller
                name="paymentSource"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <NewCustomSelect
                      label="Джерело платежу"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      options={paymentSourceOptions}
                      className={fieldState.error ? styles.error : ""}
                      error={!!fieldState.error}
                      greyPlaceholder
                      disabled={isReadonly}
                    />
                    {fieldState.error && (
                      <p className={styles.errorText}>{fieldState.error.message}</p>
                    )}
                  </>
                )}
              />

              <div className={styles.fieldLabel}>Дата операції</div>
              <div className={styles.dateWrapper}>
                <input
                  id="operationDate"
                  type="date"
                  className={`${styles.dateField} ${watchedDate ? styles.filled : ""
                    } ${errors.operationDate ? styles.error : ""}`}
                  {...register("operationDate")}
                  disabled={isReadonly}
                />
                <span className={styles.datePlaceholder}>Дата операції</span>
              </div>
              {errors.operationDate && (
                <p className={styles.errorText}>{errors.operationDate.message}</p>
              )}

              <div className={styles.fieldLabel}>З якої каси / Рахунок IBAN платника</div>
              <InputBox
                errors={errors}
                name="payerAccount"
                placeholder="З якої каси / Рахунок IBAN платника"
                type="text"
                disabled={isReadonly}
                options={{ ...register("payerAccount"), readOnly: isReadonly, disabled: isReadonly }}
              />

              <div className={styles.fieldLabel}>Рахунок отримувача</div>
              <InputBox
                errors={errors}
                name="receiverAccount"
                placeholder="Рахунок отримувача"
                type="text"
                disabled={isReadonly}
                options={{ ...register("receiverAccount"), readOnly: isReadonly, disabled: isReadonly }}
              />

              <div className={styles.fieldLabel}>Хто платив</div>
              <InputBox
                errors={errors}
                name="payerName"
                placeholder="Хто платив"
                type="text"
                disabled={isReadonly}
                options={{ ...register("payerName"), readOnly: isReadonly, disabled: isReadonly }}
              />

              <div className={styles.fieldLabel}>Постачальник</div>
              <Controller
                name="vendor"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <NewCustomSelect
                      label="Постачальник"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      options={vendorOptions}
                      className={fieldState.error ? styles.error : ""}
                      error={!!fieldState.error}
                      greyPlaceholder
                      disabled={isReadonly}
                    />
                    {fieldState.error && (
                      <p className={styles.errorText}>{fieldState.error.message}</p>
                    )}
                  </>
                )}
              />
              {mode !== "create" && (
                <>
                  <div className={styles.fieldLabel}>Статус</div>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field, fieldState }) => (
                      <>
                        <NewCustomSelect
                          label="Статус"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          options={paymentStatusOptions}
                          className={fieldState.error ? styles.error : ""}
                          error={!!fieldState.error}
                          greyPlaceholder
                          disabled={isReadonly}
                        />
                        {fieldState.error && (
                          <p className={styles.errorText}>{fieldState.error.message}</p>
                        )}
                      </>
                    )}
                  />
                </>
              )}
            </div>

            <div className={styles.column}>
              <div className={styles.fieldLabel}>Накладна / документ</div>

              {existingDocument && (
                <div style={{ marginBottom: "8px", fontSize: "12px" }}>
                  <div style={{ marginBottom: "4px", color: "#6B6780" }}>
                    Збережений файл:
                  </div>
                  <a href={existingDocument} target="_blank" rel="noopener noreferrer">
                    Відкрити збережений файл
                  </a>
                </div>
              )}

              {!isReadonly && (
                <div style={{ marginTop: existingDocument ? "10px" : 0 }}>
                  <div style={{ marginBottom: "4px", fontSize: "12px", color: "#6B6780" }}>
                    {existingDocument ? "Обрати новий файл:" : "Обрати файл:"}
                  </div>

                  <input
                    id="documentFile"
                    type="file"
                    onChange={(e) => {
                      setValue("documentFile", e.target.files?.[0] || null, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                  />
                </div>
              )}

              {isReadonly && !existingDocument && (
                <InputBox
                  errors={{}}
                  name="documentFileReadonly"
                  placeholder="Накладна / документ"
                  type="text"
                  disabled
                  options={{
                    value: "Документ відсутній",
                    readOnly: true,
                    disabled: true,
                  }}
                />
              )}

              {errors.documentFile && (
                <p className={styles.errorText}>{errors.documentFile.message}</p>
              )}

              <div className={styles.fieldLabel}>Надходження</div>
              <Controller
                name="arrival"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <NewCustomSelect
                      label="Надходження"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      options={arrivalOptions}
                      className={fieldState.error ? styles.error : ""}
                      error={!!fieldState.error}
                      greyPlaceholder
                      disabled={isReadonly}
                    />
                    {fieldState.error && (
                      <p className={styles.errorText}>{fieldState.error.message}</p>
                    )}
                  </>
                )}
              />

             <div className={styles.fieldLabel}>Сума, $</div>
              <InputBox
                errors={errors}
                name="usdAmount"
                placeholder="Сума, $"
                type="text"
                disabled={isReadonly}
                options={{
                  ...usdAmountRest,
                  ref: usdAmountRef,
                  inputMode: "decimal",
                  onKeyDown: handleDecimalKeyDown,
                  readOnly: isReadonly,
                  disabled: isReadonly,
                  onChange: (e) => {
                    const raw = e.target.value;
                    let cleaned = raw.replace(/[^0-9.,]/g, "");
                    const parts = cleaned.split(/[.,]/);

                    if (parts.length > 2) {
                      cleaned = parts[0] + "." + parts.slice(1).join("");
                    }

                    if (raw !== cleaned) {
                      e.target.value = cleaned;
                    }

                    usdAmountOnChange(e);

                    if (isReadonly) return;

                    const usdValue = parseDecimal(cleaned);
                    const rateValue = parseDecimal(watch("dollarRate"));

                    if (cleaned.trim() === "") {
                      setValue("uahAmount", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      return;
                    }

                    if (Number.isFinite(usdValue) && Number.isFinite(rateValue) && rateValue > 0) {
                      setValue("uahAmount", toMoneyString(usdValue * rateValue), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  },
                }}
              />

              <div className={styles.fieldLabel}>Сума, грн</div>
              <InputBox
                errors={errors}
                name="uahAmount"
                placeholder="Сума, грн"
                type="text"
                disabled={isReadonly}
                options={{
                  ...uahAmountRest,
                  ref: uahAmountRef,
                  inputMode: "decimal",
                  onKeyDown: handleDecimalKeyDown,
                  readOnly: isReadonly,
                  disabled: isReadonly,
                  onChange: (e) => {
                    const raw = e.target.value;
                    let cleaned = raw.replace(/[^0-9.,]/g, "");
                    const parts = cleaned.split(/[.,]/);

                    if (parts.length > 2) {
                      cleaned = parts[0] + "." + parts.slice(1).join("");
                    }

                    if (raw !== cleaned) {
                      e.target.value = cleaned;
                    }

                    uahAmountOnChange(e);
                  },
                }}
              />


              <div className={styles.fieldLabel}>Курс до долара</div>
              <InputBox
                errors={errors}
                name="dollarRate"
                placeholder="Курс до долара"
                type="text"
                disabled={isReadonly}
                options={{
                  ...dollarRateRest,
                  ref: dollarRateRef,
                  inputMode: "decimal",
                  onKeyDown: handleDecimalKeyDown,
                  readOnly: isReadonly,
                  disabled: isReadonly,
                  onChange: (e) => {
                    const raw = e.target.value;
                    let cleaned = raw.replace(/[^0-9.,]/g, "");
                    const parts = cleaned.split(/[.,]/);

                    if (parts.length > 2) {
                      cleaned = parts[0] + "." + parts.slice(1).join("");
                    }

                    if (raw !== cleaned) {
                      e.target.value = cleaned;
                    }

                    dollarRateOnChange(e);

                    if (isReadonly) return;

                    const rateValue = parseDecimal(cleaned);
                    const usdValue = parseDecimal(watch("usdAmount"));

                    if (Number.isFinite(rateValue) && rateValue > 0 && Number.isFinite(usdValue)) {
                      setValue("uahAmount", toMoneyString(usdValue * rateValue), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }
                }}
              />

              <div className={styles.fieldLabel}>Коментар</div>
              <textarea
                className={`comment ${errors.comment ? styles.error : ""}`}
                placeholder="Коментар"
                {...register("comment")}
                maxLength="500"
                readOnly={isReadonly}
                disabled={isReadonly}
              />
              {errors.comment && (
                <p className={styles.errorText}>{errors.comment.message}</p>
              )}
            </div>
          </div>
        </div>
      </form>

      {isLoading && <Preloader />}
    </div>
  );
};

export default NewVendorPayment;