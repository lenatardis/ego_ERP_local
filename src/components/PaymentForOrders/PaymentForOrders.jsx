import React, { useEffect, useState, useCallback, useRef } from "react";
import styles from "./PaymentForOrders.module.scss";
import pricelistStyles from "../Pricelist/Pricelist.module.scss";
import { useStickyXScroll } from "../../hooks/useStickyXScroll.jsx";
import { useNavigate } from "react-router";

import SearchFilter from "../Common/SearchFilter/SearchFilter";
import Filter from "../Common/Filter/Filter";
import CustomSelect from "../Common/CustomSelect/CustomSelect";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import CentralPopup from "../Common/CentralPopup/CentralPopup";
import ExpandableTable from "../Common/ExpandableTable/ExpandableTable";
import ExpandedBox from "../Common/ExpandableTable/ExpandedBox";
import Preloader from "../Common/Preloader/Preloader.jsx";
import { Pagination } from "@mui/material";

import { useAppDispatch } from "../../hooks/redux";
import { setIsActivePopup } from "../../store/main-slice";
import { getAccessToken } from "../../api/authStorage.js";
import {
    getPrivatAccounts,
    fetchBillCoincidance,
    linkPrivatPaymentToBill,
    fetchAccounts as fetchAccountOptions
} from "../../api/tablesApi.js";
import InputBox from "../Common/InputBox/InputBox.jsx";
import CustomCheckbox from "../Common/CustomCheckbox/CustomCheckbox.jsx";
import InfoIcon from "../../assets/icons/info.svg";
import Tooltip from '@mui/material/Tooltip';
import NewCustomSelect from "../Common/NewCustomSelect/NewCustomSelect.jsx";
import LinkRenderer from "../Common/LinkRenderer/LinkRenderer";
import ExpandableTableFixedHeader from "../Common/ExpandableTable/ExpandableTableFixedHeader.jsx";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";

//utils

const MONEY_TYPE_MAP = {
    NON_CASH: "Безготівка",
    CASH: "Готівка",
};
const BILL_TYPE_MAP = {
    ONLINE: "Онлай",
    IBAN: "P/P (IBAN)",
    TAX: "Накладений платіж",
};
const BILL_METHOD_MAP = {
    FULL: "Повна оплата",
    PREPAYMENT: "Передплата",
    POSTPAID: "Післяплата",
};
const BILL_STATUS_MAP = {
    PAYMENT_WAIT: "Очікує оплати",
    PAY_WAIT: "Очікує оплати",
    PAID: "Оплачено",
    NOT_PAID: "Не оплачено",
    REFUND: "Повернуто",
};

const tMoneyType = (v) => (v ? MONEY_TYPE_MAP[v] ?? v : "");
const tBillType = (v) => (v ? BILL_TYPE_MAP[v] ?? v : "");
const tBillMethod = (v) => (v ? BILL_METHOD_MAP[v] ?? v : "");
const tBillStatus = (v) => (v ? BILL_STATUS_MAP[v] ?? v : "");

const formatMoney = (n) => (n ?? n === 0 ? `${Number(n).toLocaleString("uk-UA")} грн` : "");
const formatPercent0 = (n) => (n || n === 0 ? `${Number(n).toFixed(0)}%` : "—");

const uniqueBy = (arr, keyFn) => {
    const seen = new Set();
    return arr.filter((item) => {
        const k = keyFn(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
};

const isoToDDMMYYYY = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
};

const formatSignificance = (n) => typeof n === "number" ? `${(n * 100).toFixed(0)}%` : "—";


// dedupe results and payment_bills
const sanitizeCoincidence = (raw) => {
    const results = Array.isArray(raw?.results) ? raw.results : [];

    const uniqResults = uniqueBy(results, (r) =>
        r?.order_id != null ? `order:${r.order_id}` : JSON.stringify(r)
    ).map((r) => {
        const bills = Array.isArray(r.payment_bills) ? r.payment_bills : [];

        const uniqBills = uniqueBy(bills, (b) => {
            if (b?.id != null) return `id:${b.id}`;
            const amt = b?.prepayment_amount ?? b?.amount ?? "";
            return `sig:${b?.type}|${b?.method}|${b?.status}|${amt}|${b?.receipt_url ?? ""}`;
        });

        return { ...r, payment_bills: uniqBills };
    });

    return {
        ...raw,
        results: uniqResults,
        count: uniqResults.length,
    };
};

//columns
const columns = [
    {
        key: "datetime",
        title: "Дата",
        render: (val) => {
            if (!val) return "";

            const s = String(val).trim();
            const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(.*)$/);
            if (m) {
                const [, dd, mm, yyyy, rest] = m;
                return <span>{dd}.{mm}.{yyyy}{rest}</span>;
            }
            return s;
        }
    },
    { key: "id", title: <>ID<br />платежу</> },
    {
        key: "order_url",
        title: "Рахунок",
        render: (val) => <LinkRenderer value={val} copy />,
    },
    { key: "account", title: "Отримувач" },
    {
        key: "amount",
        title: "Сума",
        render: (val) => ((val ?? "") !== "" ? Number(val).toLocaleString("uk-UA") : ""),
    },
    { key: "currency", title: "Валюта" },
    { key: "manager", title: "Менеджер" },
    { key: "counterparty", title: "Контрагент" },
    { key: "assignment", title: "Призначення" },
    {
        key: "money_type",
        title: "Тип",
        render: (val) => tMoneyType(val),
    },
    {
        key: "receipt_url",
        title: "Чек",
        render: (val) => <LinkRenderer value={val} />,
    },
    {
        key: "comment",
        title: "Коментар",
        cellClassName: styles.commentCell,
    }
];

const ITEMS_PER_PAGE = 25;


const PaymentForOrders = () => {
    const dispatch = useAppDispatch();
    const scrollRef = useRef(null);

    const { mainRef, StickyBar, recalcX } = useStickyXScroll({
        offsetBottom: 0,
        trackHeight: 16,
        zIndex: 60,
    });

    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // pagination + filters
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [filterParams, setFilterParams] = useState({
        page: 1,
        account: "",
        amount: "",
        counterparty: "",
        assignment: "",
        operation_type: "",
        money_type: "",
        is_linked: "",
        datetime_range: "",
        search: null,
    });

    const [showSidePopup, setShowSidePopup] = useState(false);
    const [isShowFilter, setIsShowFilter] = useState(false);

    const [isLinkPopup, setIsLinkPopup] = useState(false);
    const [selectedPaymentRow, setSelectedPaymentRow] = useState(null);

    const [tabLoading, setTabLoading] = useState(false);
    const [tabError, setTabError] = useState(null);
    const [tabData, setTabData] = useState({
        results: [],
        similarity_ranges: null,
        count: 0,
        significance_coefficients: null
    });
    const [activeTab, setActiveTab] = useState(0);
    const [linkingBillId, setLinkingBillId] = useState(null);

    const gridTemplate = {
        gridTemplateColumns:
            "95px 65px 65px minmax(100px,1fr) minmax(65px,1fr) 60px minmax(130px,1fr) minmax(130px,1fr) minmax(170px,1fr) 65px 65px minmax(220px,1fr)",
    };

    const minWidthPx =
        95 +
        65 +
        65 +
        100 +
        65 +
        60 +
        130 +
        130 +
        170 +
        65 +
        65 +
        220 + 32;
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const onOpenFilter = () => setIsShowFilter(true);
    const onClose = () => setIsShowFilter(false);

    const closeSidePopup = () => {
        setShowSidePopup(false);
        dispatch(setIsActivePopup(false));
    };

    const onRemove = (id) => {
        setShowSidePopup(true);
        console.log("remove id:", id);
    };

    const openLinkPopup = (row) => {
        setSelectedPaymentRow(row);
        setIsLinkPopup(true);
        dispatch(setIsActivePopup(true));
    };
    const closeLinkPopup = () => {
        setIsLinkPopup(false);
        setSelectedPaymentRow(null);
        setTabData({ results: [], similarity_ranges: null, count: 0, significance_coefficients: null });
        setActiveTab(0);
        setTabError(null);
        setTabLoading(false);
        dispatch(setIsActivePopup(false));
    };

    const navigate = useNavigate();

    const fetchAccounts = useCallback(async (params) => {
        try {
            setIsLoading(true);
            const token = getAccessToken();
            const resp = await getPrivatAccounts(token, params);

            const list = Array.isArray(resp?.results) ? resp.results : [];
            const count = Number(resp?.count) || 0;
            const total = Math.ceil(count / ITEMS_PER_PAGE);

            setRows(list);
            setTotalPages(total);
            setPage(params?.page || 1);
        } catch (e) {
            console.error("Error loading privat accounts:", e);
            setRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts(filterParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        recalcX();
    }, [rows.length, recalcX]);

    useEffect(() => {
        recalcX();
    }, [recalcX, minWidthPx]);

    const onSendFilters = (nextParams) => {
        const next = { ...nextParams, page: 1 };
        setFilterParams(next);
        setPage(1);
        fetchAccounts(next);
    };

    const handlePaginationChange = (event, value) => {
        if (page === value) return;
        const next = { ...filterParams, page: value };
        setFilterParams(next);
        setPage(value);
        window.scrollTo({ top: 0, behavior: "auto" });
        fetchAccounts(next);
    };

    const openPrivatPaymentInfo = (row) => {
        if (!row?.id) return;
        navigate(`/privatPaymentInfo/${row.id}`);
    };

    useEffect(() => {
        const fetchTabs = async () => {
            if (!isLinkPopup || !selectedPaymentRow?.id) return;
            try {
                setTabLoading(true);
                setTabError(null);
                setActiveTab(0);

                const token = getAccessToken();
                const raw = await fetchBillCoincidance(token, selectedPaymentRow.id);
                const cleaned = sanitizeCoincidence(raw);

                setTabData({
                    results: cleaned.results,
                    similarity_ranges: cleaned?.similarity_ranges ?? null,
                    count: Number(cleaned?.count) || 0,
                    significance_coefficients: cleaned?.significance_coefficients ?? null
                });
            } catch (e) {
                console.error("Error fetching bill coincidence:", e);
                setTabError("Вибачте, не вдалося завантажити можливі співпадіння.");
                setTabData({ results: [], similarity_ranges: null, count: 0, significance_coefficients: null });
            } finally {
                setTabLoading(false);
            }
        };
        fetchTabs();
    }, [isLinkPopup, selectedPaymentRow?.id]);

    const linkToBill = async (billId) => {
        try {
            if (!selectedPaymentRow?.id) {
                console.error("Немає вибраного платежу для прив’язки");
                return;
            }
            if (!Number.isInteger(billId)) {
                console.error("Некоректний bill id:", billId);
                return;
            }

            setLinkingBillId(billId);
            const token = getAccessToken();
            const res = await linkPrivatPaymentToBill(token, selectedPaymentRow.id, billId);
            setRows((prev) =>
                prev.map((r) => (r.id === selectedPaymentRow.id ? { ...r, is_linked: true } : r))
            );
            if (res?.order_url) {
                setRows((prev) =>
                    prev.map((r) =>
                        r.id === selectedPaymentRow.id ? { ...r, order_url: res.order_url, is_linked: true, customer_url: res?.customer_url } : r
                    )
                );
            } else {
                await fetchAccounts(filterParams);
            }
            closeLinkPopup();
        } catch (e) {
            console.error("Помилка прив’язки платежу:", e);
        } finally {
            setLinkingBillId(null);
        }
    };

    const applyIsLinked = (val /* true | false | '' */) => {
        const next = { ...filterParams, is_linked: val, page: 1 };
        setFilterParams(next);
        setPage(1);
        fetchAccounts(next);
    };

    const [accountOptions, setAccountOptions] = useState([{ name: 'Усі рахунки', value: '' }]);

    useEffect(() => {
        const loadAccountOptions = async () => {
            try {
                const token = getAccessToken();
                const resp = await fetchAccountOptions(token);
                const list = Array.isArray(resp?.results) ? resp.results : (Array.isArray(resp) ? resp : []);
                const opts = [{ name: 'Усі рахунки', value: '' }].concat(
                    list.map(item => ({
                        value: String(item.id),
                        name: item.account ?? '',
                    }))
                );
                setAccountOptions(opts);
            } catch (e) {
                console.error('Error fetching accounts options:', e);
                setAccountOptions([{ name: 'Усі рахунки', value: '' }]);
            }
        };
        loadAccountOptions();
    }, []);

    const updateDateRange = (fromISO, toISO) => {
        const range =
            fromISO && toISO ? `${isoToDDMMYYYY(fromISO)}-${isoToDDMMYYYY(toISO)}` : '';

        const next = { ...filterParams, datetime_range: range, page: 1 };
        setFilterParams(next);
        fetchAccounts(next);
    };

    const resetAllFilters = useCallback(() => {
        setDateFrom('');
        setDateTo('');

        const defaults = {
            page: 1,
            account: '',
            amount: '',
            counterparty: '',
            assignment: '',
            operation_type: '',
            money_type: '',
            is_linked: '',
            datetime_range: '',
            search: null,
        };

        setFilterParams(defaults);
        setPage(1);
        fetchAccounts(defaults);
    }, [fetchAccounts]);

    return (
        <div className={styles.payments}>
            <ArrBack/>
            <SearchFilter
                onOpenFilter={onOpenFilter}
                title={"Оплата замовлень"}
                searchValue={filterParams.search}
                setSearchValue={(value) =>
                    setFilterParams((prev) => ({ ...prev, search: value }))
                }
                onSearch={() => onSendFilters(filterParams)}
            />

            <ExpandableTableFixedHeader
                columns={columns}
                centered
                scrollContainerRef={scrollRef}
                minWidth={minWidthPx}
                stickyTop={0}
                stickyZIndex={8}
                gridTemplate={gridTemplate}
            />

            <div
                style={{ overflowX: "auto", paddingBottom: 8 }}
                ref={(el) => {
                    if (typeof mainRef === "function") {
                        mainRef(el);
                    } else if (mainRef && "current" in mainRef) {
                        mainRef.current = el;
                    }
                    scrollRef.current = el;
                }}
                className={pricelistStyles.xScrollHide}
            >
                <div style={{ minWidth: `${minWidthPx}px` }}>
                    <ExpandableTable
                        columns={columns}
                        data={rows}
                        gridTemplate={gridTemplate}
                        hideHeader
                        tableWithStickyHeader
                        centered
                        expandedRowRender={(row) => (
                            <ExpandedBox
                                row={row}
                                onRemove={onRemove}
                                onManualLink={openLinkPopup}
                                onView={openPrivatPaymentInfo}
                            />
                        )}
                    />
                </div>
            </div>

            <StickyBar />

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
                <InputBox
                    label="Призначення"
                    name="assignment"
                    placeholder="Введіть призначення"
                    errors={{}}
                    options={{
                        value: filterParams.assignment,
                        onChange: (e) => {
                            const value = e.target.value;
                            const next = { ...filterParams, assignment: value };
                            onSendFilters(next);
                        },
                    }} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <CustomCheckbox
                        name="Лише прив'язані"
                        value="true"
                        isChecked={filterParams.is_linked === true}
                        isLoading={isLoading}
                        onChange={(checked) => applyIsLinked(checked ? true : '')}
                        label
                    />
                    <CustomCheckbox
                        name="Лише не прив'язані"
                        value="false"
                        isChecked={filterParams.is_linked === false}
                        isLoading={isLoading}
                        onChange={(checked) => applyIsLinked(checked ? false : '')}
                        label
                    />
                </div>
                <InputBox
                    name="counterparty"
                    label="Контрагент"
                    errors={{}}
                    placeholder="Введіть назву контрагента"
                    options={{
                        value: filterParams.counterparty || '',
                        onChange: (e) => {
                            const value = e.target.value;
                            const next = { ...filterParams, counterparty: value, page: 1 };
                            setFilterParams(next);
                            fetchAccounts(next);
                        },
                    }}
                />
                <InputBox
                    name="amount"
                    label="Сума"
                    errors={{}}
                    type="text"
                    placeholder="Сума"
                    options={{
                        value: filterParams.amount ?? '',
                        onChange: (e) => {
                            const raw = e.target.value;
                            const next = { ...filterParams, amount: raw, page: 1 };
                            setFilterParams(next);

                            const cleaned = raw.replace(/\s/g, '').replace(',', '.');

                            const isValid = cleaned === '' || /^-?\d+(\.\d+)?$/.test(cleaned);

                            if (isValid) {
                                fetchAccounts({ ...next, amount: cleaned });
                            }
                        },
                    }}
                />
                <CustomSelect
                    label="Тип грошей"
                    value={filterParams.money_type ?? ''}
                    onChange={(e) => {
                        const val = e.target.value; // 'NON_CASH' | 'CASH' | ''
                        const next = { ...filterParams, money_type: val, page: 1 };
                        setFilterParams(next);
                        fetchAccounts(next);
                    }}
                    options={Object.entries(MONEY_TYPE_MAP).map(([value, name]) => ({ value, name }))}
                />
                <NewCustomSelect
                    label="Рахунок"
                    value={filterParams.account ?? ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        const next = { ...filterParams, account: val, page: 1 };
                        setFilterParams(next);
                        fetchAccounts(next);
                    }}
                    options={accountOptions}
                />
                <InputBox
                    name="date_from"
                    label="Дата від"
                    errors={{}}
                    type="date"
                    placeholder=""
                    options={{
                        value: dateFrom,
                        onChange: (e) => {
                            const v = e.target.value;   // YYYY-MM-DD
                            setDateFrom(v);
                            updateDateRange(v, dateTo);
                        },
                    }}
                />

                <InputBox
                    name="date_to"
                    label="Дата до"
                    errors={{}}
                    type="date"
                    placeholder=""
                    options={{
                        value: dateTo,
                        onChange: (e) => {
                            const v = e.target.value;   // YYYY-MM-DD
                            setDateTo(v);
                            updateDateRange(dateFrom, v);
                        },
                    }}
                />

            </Filter>
            <PopupCloser isShow={isShowFilter} onClose={onClose} />


            {totalPages > 1 && (
                <Pagination
                    count={totalPages}
                    page={page}
                    siblingCount={1}
                    boundaryCount={1}
                    hidePrevButton
                    hideNextButton
                    onChange={handlePaginationChange}
                />
            )}


            {showSidePopup && (
                <CentralPopup title={"Видалення замовлення"} onClose={closeSidePopup}>
                    <div><span>delete</span></div>
                </CentralPopup>
            )}

            {isLinkPopup && (
                <CentralPopup title={"Прив’язка платежу"} onClose={closeLinkPopup} bigPopup>
                    {tabLoading && <Preloader />}

                    {!tabLoading && tabError && <div style={{ color: "#F17C7C" }}>{tabError}</div>}

                    {!tabLoading && !tabError && tabData.results.length === 0 && (
                        <div>Немає можливих співпадінь рахунків</div>
                    )}

                    {!tabLoading && !tabError && tabData.results.length > 0 && (
                        <div className={styles.payPopupGrid}>

                            <div className={styles.payPopupGrid__leftColumn}>
                                <div className={styles.paymentTab__wrap}>
                                    {tabData.results.map((item, idx) => (
                                        <div
                                            key={item.order_id ?? idx}
                                            className={`${styles.paymentTab__item} ${idx === activeTab ? `${styles.active}` : ""}`}
                                            onClick={() => setActiveTab(idx)}
                                            role="button"
                                        >
                                            <div className={styles.paymentTab__title}>
                                                <h4>Замовлення №{item.order_id}</h4>
                                            </div>
                                            {item.customer && (<div className={styles.paymentTab__info}>
                                                <p className={styles.paymentTab__price}>{item.customer}</p>
                                            </div>)}
                                            <div className={styles.paymentTab__info}>
                                                <p>Оплачені: {item.paid_count}</p>
                                            </div>
                                            <div className={styles.paymentTab__info}>
                                                <p>Неоплачені: {item.unpaid_count}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.payPopupGrid__rightColumn}>
                                <div className={styles.paymentTabContent}>
                                    {(tabData.results[activeTab]?.payment_bills ?? []).map((bill, idx) => {
                                        const amount = bill.prepayment_amount ?? bill.amount ?? null;
                                        const typeLine = [tBillType(bill.type), tBillMethod(bill.method), tBillStatus(bill.status)]
                                            .filter(Boolean)
                                            .join(", ");
                                        const receipt = bill.receipt_url && String(bill.receipt_url).trim();

                                        const billKey = `${bill.id ?? "x"}|${bill.type}|${bill.method}|${bill.status}|${amount ?? ""
                                            }|${receipt ?? ""}|${idx}`;

                                        return (
                                            <div key={billKey} className={styles.paymentAccount__item}>
                                                <div>
                                                    <h5>Рахунок №{bill.id}</h5>
                                                    <p className={styles.paymentAccount__price}>{formatMoney(amount)}</p>
                                                    <p className={styles.paymentAccount__date}>{typeLine || "—"} {bill.prepayment_datetime || "—"}</p>
                                                    <div>
                                                        <p className={styles.paymentAccount__date}>
                                                            <span>Співпадіння: {formatPercent0(bill.similarity)}</span>
                                                            <Tooltip
                                                                arrow
                                                                placement="top"
                                                                followCursor
                                                                title={
                                                                    tabData?.significance_coefficients ? (
                                                                        <div style={{ display: 'grid', gap: 4 }}>
                                                                            <div>
                                                                                <strong>{formatSignificance(tabData.significance_coefficients.name_significance)}</strong>
                                                                                {" "}— значущість ПІБ контрагента
                                                                            </div>
                                                                            <div>
                                                                                <strong>{formatSignificance(tabData.significance_coefficients.date_significance)}</strong>
                                                                                {" "}— значущість дати транзакції
                                                                            </div>
                                                                            <div>
                                                                                <strong>{formatSignificance(tabData.significance_coefficients.amount_significance)}</strong>
                                                                                {" "}— значущість суми
                                                                            </div>
                                                                        </div>
                                                                    ) : "Дані про значущість недоступні"
                                                                }
                                                            >
                                                                <img src={InfoIcon} className={styles.infoIcon}
                                                                    alt="Інфо" />
                                                            </Tooltip>
                                                        </p>
                                                        <p className={styles.clarification}>*Співпадіння визначається за
                                                            діапазоном дати
                                                            транзакції {tabData.similarity_ranges?.transaction_date_range} год
                                                            та діапазоном
                                                            суми {tabData.similarity_ranges?.amount_range}</p>
                                                    </div>
                                                </div>
                                                <div className={styles.btnRow}>
                                                    {receipt ? (
                                                        <a
                                                            className={`btnDark ${styles.smallBtn}`}
                                                            href={receipt}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <span>Чек</span>
                                                        </a>
                                                    ) : (
                                                        <button
                                                            className={`btnDark ${styles.smallBtn}`}
                                                            disabled
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <span>Чек</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        className={"btnDark"}
                                                        disabled={linkingBillId === bill.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            linkToBill(bill.id);
                                                        }}
                                                    >
                                                        <span>Підв'язати</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </CentralPopup>
            )}

            {isLoading && <Preloader />}
        </div>
    );
};

export default PaymentForOrders;
