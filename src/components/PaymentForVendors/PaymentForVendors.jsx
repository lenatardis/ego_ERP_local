import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./PaymentForVendors.module.scss";
import pricelistStyles from "../Pricelist/Pricelist.module.scss";

import SearchFilter from "../Common/SearchFilter/SearchFilter";
import Filter from "../Common/Filter/Filter";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import Table from "../Common/Table/Table";
import TableFixedHeader from "../Common/Table/TableFixedHeader.jsx";
import InputBox from "../Common/InputBox/InputBox.jsx";
import NewCustomSelect from "../Common/NewCustomSelect/NewCustomSelect.jsx";
import CentralPopup from "../Common/CentralPopup/CentralPopup";
import Preloader from "../Common/Preloader/Preloader.jsx";
import { Pagination, Slider } from "@mui/material";

import { getAccessToken } from "../../api/authStorage.js";
import { getVendorPayments, deleteVendorPayment } from "../../api/tablesApi.js";
import { useNavigate } from "react-router";
import { useStickyXScroll } from "../../hooks/useStickyXScroll.jsx";

import DocumentIcon from "../../assets/icons/document.svg";
import EditIcon from "../../assets/icons/editIcon.svg";
import BinIcon from "../../assets/icons/bin.svg";
import LinkRenderer from "../Common/LinkRenderer/LinkRenderer";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";

const ITEMS_PER_PAGE = 25;

const SOURCE_MAP = {
    BANK: "Банк",
    CASH: "Готівка",
    OTHER: "Інше",
};

const STATUS_MAP = {
    UNPAID: "Не оплачено",
    PAID: "Оплачено",
    WAIT_FOR_PAY: "Очікує оплати",
};

const sourceOptions = [
    { value: "", name: "Усі" },
    { value: "BANK", name: "Банк" },
    { value: "CASH", name: "Готівка" },
    { value: "OTHER", name: "Інше" },
];

const statusOptions = [
    { value: "", name: "Усі" },
    { value: "UNPAID", name: "Не оплачено" },
    { value: "PAID", name: "Оплачено" },
    { value: "WAIT_FOR_PAY", name: "Очікує оплати" },
];

const MAX_AMOUNT = 1000000;

const formatMoney = (value) => {
    if (value === undefined || value === null || value === "") return "";
    const num = Number(value);
    return Number.isNaN(num) ? value : num.toLocaleString("uk-UA");
};

const formatDate = (value) => {
    if (!value) return "";

    const s = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split("-");
        return `${d}.${m}.${y}`;
    }

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
        return s;
    }

    return s;
};

const getVendorName = (vendor) => {
    if (!vendor) return "";
    if (typeof vendor === "string") return vendor;
    return vendor.full_name || vendor.name || "";
};

const getFabricArrivalDisplay = (fabricArrival) => {
    if (!fabricArrival) return "";
    if (typeof fabricArrival === "string" || typeof fabricArrival === "number") {
        return String(fabricArrival);
    }

    const parts = [];

    if (fabricArrival.id != null) {
        parts.push(`ID ${fabricArrival.id}`);
    }

    if (fabricArrival.arrival_date) {
        parts.push(fabricArrival.arrival_date);
    }

    return parts.join(", ");
};

const mapBackendItemToRow = (item) => ({
    id: item?.id ?? "",
    source: item?.source ?? "",
    operation_date: item?.operation_date ?? "",
    payer_account: item?.payer_account ?? "",
    recipient_account: item?.recipient_account ?? "",
    payer: item?.payer ?? "",
    vendor: getVendorName(item?.vendor),
    exchange_rate: item?.exchange_rate ?? "",
    fabric_arrival: getFabricArrivalDisplay(item?.fabric_arrival),
    status: item?.status ?? "",
    document_num: item?.fabric_arrival?.document_num ?? "",
    document: item?.document ?? "",
    uah_amount: item?.uah_amount ?? "",
    usd_amount: item?.usd_amount ?? "",
    comment: item?.comment ?? "",
});

const StatusBadge = ({ value }) => {
    if (!value) return null;

    const cls =
        value === "PAID"
            ? styles.approved
            : value === "UNPAID"
                ? styles.declined
                : value === "WAIT_FOR_PAY"
                    ? styles.inProc
                    : "";

    return (
        <span className={cls}>
            {STATUS_MAP[value] || value}
        </span>
    );
};

const ActionButtons = ({ row, onView, onEdit, onDelete }) => {
    const btnStyle = {
        width: "20px",
        height: "20px",
        minWidth: "20px",
        border: "none",
        background: "#D9D1E0",
        borderRadius: "4px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
    };

    const wrapStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        columnGap: "5px",
    };

    const iconStyle = {
        display: "block",
        width: "16px",
        height: "16px",
    };

    return (
        <div style={wrapStyle}>
            <button
                type="button"
                style={btnStyle}
                title="Переглянути"
                onClick={() => onView(row)}
            >
                <img src={DocumentIcon} alt="Переглянути" style={iconStyle} />
            </button>

            <button
                type="button"
                style={btnStyle}
                title="Редагувати"
                onClick={() => onEdit(row)}
            >
                <img src={EditIcon} alt="Редагувати" style={iconStyle} />
            </button>

            {row?.status !== "PAID" && (
                <button
                    type="button"
                    style={btnStyle}
                    title="Видалити"
                    onClick={() => onDelete(row)}
                >
                    <img src={BinIcon} alt="Видалити" style={iconStyle} />
                </button>
            )}
        </div>
    );
};

const PaymentForVendors = () => {
    const navigate = useNavigate();
    const scrollRef = useRef(null);

    const { mainRef, StickyBar, recalcX } = useStickyXScroll({
        offsetBottom: 0,
        trackHeight: 16,
        zIndex: 60,
    });

    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isShowFilter, setIsShowFilter] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    const [uahAmountRange, setUahAmountRange] = useState([0, MAX_AMOUNT]);
    const [usdAmountRange, setUsdAmountRange] = useState([0, MAX_AMOUNT]);

    const [filterParams, setFilterParams] = useState({
        page: 1,
        page_size: ITEMS_PER_PAGE,
        search: null,
        source: "",
        operation_date: "",
        vendor: "",
        uah_amount_min: null,
        uah_amount_max: null,
        usd_amount_min: null,
        usd_amount_max: null,
        exchange_rate: "",
        document_num: "",
        payer_account: "",
        recipient_account: "",
        payer: "",
        fabric_arrival: "",
        status: "",
    });


    const onOpenFilter = () => setIsShowFilter(true);
    const onCloseFilter = () => setIsShowFilter(false);

    const onNewVendorPaymentNavigate = () => navigate("/new-vendor-payment");

    const fetchVendorPaymentsList = useCallback(async (params) => {
        try {
            setIsLoading(true);

            const token = getAccessToken();
            const response = await getVendorPayments(token, params);

            const list = Array.isArray(response?.vendor_payments)
                ? response.vendor_payments
                : [];
            const total = Number(response?.total_pages) || 0;
            const current = Number(response?.current_page) || 1;

            setRows(list.map(mapBackendItemToRow));
            setTotalPages(total);
            setPage(current);
        } catch (error) {
            console.error("Error loading vendor payments:", error);
            setRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVendorPaymentsList(filterParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isShowFilter) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [isShowFilter]);

    const onSendFilters = (nextParams) => {
        const next = {
            ...nextParams,
            page: 1,
            page_size: ITEMS_PER_PAGE,
        };

        setFilterParams(next);
        setPage(1);
        fetchVendorPaymentsList(next);
    };

    const handlePaginationChange = (event, value) => {
        if (page === value) return;

        const next = {
            ...filterParams,
            page: value,
            page_size: ITEMS_PER_PAGE,
        };

        setFilterParams(next);
        setPage(value);
        window.scrollTo({ top: 0, behavior: "auto" });
        fetchVendorPaymentsList(next);
    };

    const resetAllFilters = useCallback(() => {
        const defaults = {
            page: 1,
            page_size: ITEMS_PER_PAGE,
            search: null,
            source: "",
            operation_date: "",
            vendor: "",
            uah_amount_min: null,
            uah_amount_max: null,
            usd_amount_min: null,
            usd_amount_max: null,
            exchange_rate: "",
            document_num: "",
            payer_account: "",
            recipient_account: "",
            payer: "",
            fabric_arrival: "",
            status: "",
        };

        setUahAmountRange([0, MAX_AMOUNT]);
        setUsdAmountRange([0, MAX_AMOUNT]);
        setFilterParams(defaults);
        setPage(1);
        fetchVendorPaymentsList(defaults);
    }, [fetchVendorPaymentsList]);

    const onView = (row) => {
        if (!row?.id) return;
        navigate(`/new-vendor-payment/${row.id}/read`);
    };

    const onEdit = (row) => {
        if (!row?.id) return;
        navigate(`/new-vendor-payment/${row.id}`);
    };

    const onDelete = (row) => {
        setSelectedRow(row);
        setShowDeletePopup(true);
    };

    const closeDeletePopup = () => {
        setSelectedRow(null);
        setShowDeletePopup(false);
    };

    const handleConfirmDelete = async () => {
        if (!selectedRow?.id) {
            closeDeletePopup();
            return;
        }

        try {
            setIsLoading(true);
            const token = getAccessToken();
            await deleteVendorPayment(token, selectedRow.id);
            closeDeletePopup();
            await fetchVendorPaymentsList(filterParams);
        } catch (error) {
            console.error("Error deleting vendor payment:", error);
            closeDeletePopup();
        } finally {
            setIsLoading(false);
        }
    };

    const columns = useMemo(() => [
        {
            key: "source",
            title: "Джерело",
            width: "0.8fr",
            render: (val) => SOURCE_MAP[val] || val || "",
        },
        {
            key: "operation_date",
            title: "Дата",
            width: "0.9fr",
            render: (val) => formatDate(val),
        },
        {
            key: "payer_account",
            title: (
                <>
                    З якої каси /
                    <br />
                    Рахунок IBAN
                    <br />
                    платника
                </>
            ),
            width: "1.2fr",
            render: (val) => val ? <LinkRenderer value={val} copy /> : null,
        },
        {
            key: "recipient_account",
            title: (
                <>
                    Рахунок
                    <br />
                    отримувача
                </>
            ),
            width: "1fr",
            render: (val) => val ? <LinkRenderer value={val} copy /> : null,
        },
        {
            key: "payer",
            title: "Хто платив",
            width: "0.9fr",
            render: (val) => val || "",
        },
        {
            key: "vendor",
            title: "Постачальник",
            width: "1fr",
            render: (val) => val || "",
        },
        {
            key: "document",
            title: (
                <>
                    Накладна /
                    <br />
                    документ
                </>
            ),
            width: "0.95fr",
            render: (val, row) => {
                if (val) return <LinkRenderer value={val} />;
                return row?.document_num || "";
            },
        },
        {
            key: "uah_amount",
            title: (
                <>
                    Сума,
                    <br />
                    грн
                </>
            ),
            width: "0.8fr",
            render: (val) => formatMoney(val),
        },
        {
            key: "usd_amount",
            title: (
                <>
                    Сума,
                    <br />
                    $
                </>
            ),
            width: "0.7fr",
            render: (val) => formatMoney(val),
        },
        {
            key: "exchange_rate",
            title: (
                <>
                    Курс до
                    <br />
                    долара
                </>
            ),
            width: "0.75fr",
            render: (val) => val || "",
        },
        {
            key: "comment",
            title: "Коментар",
            width: "2fr",
            render: (val) => val || "",
        },
        {
            key: "status",
            title: "Статус",
            width: "0.9fr",
            render: (val) => <StatusBadge value={val} />,
        },
        {
            key: "actions",
            title: "Дії",
            width: "0.9fr",
            render: (val, row) => (
                <ActionButtons
                    row={row}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ),
        },
    ], []);

    // minWidth по тому ж принципу, що в NewPrices:
    // окрема явна формула в px, незалежна від col.width
    const minWidthPx =
        70 +  // Джерело  
        70 +  // Дата     
        30 + // З якої каси / Рахунок IBAN платника   
        30 + // Рахунок отримувача   
        105 + // Хто платив
        145 + // Постачальник
        30 + // Накладна / документ
        95 +  // Сума, грн
        85 +  // Сума, $
        50 +  // Курс до долара
        200 + // Коментар
        80 + // Статус
        200;   // Дії

    const scrollWrapStyle = { overflowX: "auto", paddingBottom: 8 };
    const innerStyle = { minWidth: `${minWidthPx}px` };

    useEffect(() => {
        recalcX();
    }, [rows.length, recalcX]);

    useEffect(() => {
        recalcX();
    }, [minWidthPx, recalcX]);

    useEffect(() => {
        setUahAmountRange([
            filterParams.uah_amount_min ?? 0,
            filterParams.uah_amount_max ?? MAX_AMOUNT,
        ]);
    }, [filterParams.uah_amount_min, filterParams.uah_amount_max]);

    useEffect(() => {
        setUsdAmountRange([
            filterParams.usd_amount_min ?? 0,
            filterParams.usd_amount_max ?? MAX_AMOUNT,
        ]);
    }, [filterParams.usd_amount_min, filterParams.usd_amount_max]);

    return (
        <div className={styles.payments}>
            <ArrBack/>
            <SearchFilter
                onOpenFilter={onOpenFilter}
                title={"Взаєморозрахунок з постачальниками"}
                searchValue={filterParams.search}
                setSearchValue={(value) =>
                    setFilterParams((prev) => ({ ...prev, search: value }))
                }
                onSearch={() => onSendFilters(filterParams)}
                vendor
                onNewVendorPaymentNavigate={onNewVendorPaymentNavigate}
                onVendorBalanceNavigate={() => navigate('/vendorList')}
            />

            <TableFixedHeader
                columns={columns}
                subtitle={null}
                equalColumns={false}
                centered
                scrollContainerRef={scrollRef}
                minWidth={minWidthPx}
                stickyTop={0}
                stickyZIndex={8}
            />

            <div
                style={scrollWrapStyle}
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
                <div style={innerStyle}>
                    <Table
                        columns={columns}
                        data={rows}
                        centered
                        zeroPdTable
                        hideHeader
                    />
                </div>
            </div>

            <StickyBar />

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
                <NewCustomSelect
                    label="Джерело"
                    value={filterParams.source}
                    onChange={(e) => {
                        const next = { ...filterParams, source: e.target.value };
                        onSendFilters(next);
                    }}
                    options={sourceOptions}
                />

                <InputBox
                    label="Дата"
                    name="operation_date"
                    type="date"
                    errors={{}}
                    options={{
                        value: filterParams.operation_date,
                        onChange: (e) => {
                            const next = { ...filterParams, operation_date: e.target.value };
                            onSendFilters(next);
                        },
                    }}
                />

                <InputBox
                    label="Постачальник"
                    name="vendor"
                    placeholder="Введіть постачальника"
                    errors={{}}
                    options={{
                        value: filterParams.vendor,
                        onChange: (e) => {
                            const next = { ...filterParams, vendor: e.target.value };
                            onSendFilters(next);
                        },
                    }}
                />

                <div>
                    <div style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 12, color: "#ffffff", marginBottom: 10 }}>
                            Мінімальна і максимальна сума, грн
                        </p>
                    </div>

                    <Slider
                        value={uahAmountRange}
                        onChange={(_, val) => setUahAmountRange(val)}
                        onChangeCommitted={(_, val) => {
                            const [min, max] = val;

                            if (
                                min === (filterParams.uah_amount_min ?? 0) &&
                                max === (filterParams.uah_amount_max ?? MAX_AMOUNT)
                            ) {
                                return;
                            }

                            onSendFilters({
                                ...filterParams,
                                uah_amount_min: min,
                                uah_amount_max: max,
                            });
                        }}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `${v}`}
                        min={0}
                        max={MAX_AMOUNT}
                        marks={[
                            { value: 0, label: "0" },
                            { value: MAX_AMOUNT, label: String(MAX_AMOUNT) },
                        ]}
                        sx={{
                            marginBottom: 0,

                            "& .MuiSlider-markLabel": {
                                fontSize: 12,
                                whiteSpace: "nowrap",
                            },

                            "& .MuiSlider-markLabel[data-index='0']": {
                                left: "0 !important",
                                transform: "translateX(0) !important",
                            },

                            "& .MuiSlider-markLabel[data-index='1']": {
                                left: "100% !important",
                                transform: "translateX(-100%) !important",
                            },

                            "& .MuiSlider-thumb[data-index='0']": {
                                transform: "translateY(-50%) !important",
                            },

                            "& .MuiSlider-thumb[data-index='1']": {
                                transform: "translate(-110%, -50%) !important",
                            },

                            "& .MuiSlider-valueLabel": {
                                transform: "translateY(-100%) scale(0)",
                            },

                            "& .MuiSlider-valueLabel.MuiSlider-valueLabelOpen": {
                                transform: "translateY(-100%) scale(1)",
                            },

                            "& .MuiSlider-thumb[data-index='0'] .MuiSlider-valueLabel": {
                                left: 0,
                                transform: "translateY(-100%) scale(0)",
                            },

                            "& .MuiSlider-thumb[data-index='0'] .MuiSlider-valueLabel.MuiSlider-valueLabelOpen": {
                                transform: "translateY(-100%) scale(1)",
                            },

                            "& .MuiSlider-thumb[data-index='1'] .MuiSlider-valueLabel": {
                                left: "auto !important",
                                right: 0,
                                transform: "translate(-8px, -100%) scale(0)",
                            },

                            "& .MuiSlider-thumb[data-index='1'] .MuiSlider-valueLabel.MuiSlider-valueLabelOpen": {
                                transform: "translate(-8px, -100%) scale(1)",
                            },

                            "& .MuiSlider-thumb::before": {
                                boxShadow: "none !important",
                            },

                            "& .MuiSlider-thumb:hover, & .MuiSlider-thumb.Mui-focusVisible, & .MuiSlider-thumb.Mui-active": {
                                boxShadow: "none !important",
                            },
                        }}
                    />
                </div>

                <div>
                    <div style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 12, color: "#ffffff", marginBottom: 10 }}>
                            Мінімальна і максимальна сума, $
                        </p>
                    </div>

                    <Slider
                        value={usdAmountRange}
                        onChange={(_, val) => setUsdAmountRange(val)}
                        onChangeCommitted={(_, val) => {
                            const [min, max] = val;

                            if (
                                min === (filterParams.usd_amount_min ?? 0) &&
                                max === (filterParams.usd_amount_max ?? MAX_AMOUNT)
                            ) {
                                return;
                            }

                            onSendFilters({
                                ...filterParams,
                                usd_amount_min: min,
                                usd_amount_max: max,
                            });
                        }}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `${v}`}
                        min={0}
                        max={MAX_AMOUNT}
                        marks={[
                            { value: 0, label: "0" },
                            { value: MAX_AMOUNT, label: String(MAX_AMOUNT) },
                        ]}
                        sx={{
                            marginBottom: 0,

                            "& .MuiSlider-markLabel": {
                                fontSize: 12,
                                whiteSpace: "nowrap",
                            },

                            "& .MuiSlider-markLabel[data-index='0']": {
                                left: "0 !important",
                                transform: "translateX(0) !important",
                            },

                            "& .MuiSlider-markLabel[data-index='1']": {
                                left: "100% !important",
                                transform: "translateX(-100%) !important",
                            },

                            "& .MuiSlider-thumb[data-index='0']": {
                                transform: "translateY(-50%) !important",
                            },

                            "& .MuiSlider-thumb[data-index='1']": {
                                transform: "translate(-110%, -50%) !important",
                            },

                            "& .MuiSlider-valueLabel": {
                                transform: "translateY(-100%) scale(0)",
                            },

                            "& .MuiSlider-valueLabel.MuiSlider-valueLabelOpen": {
                                transform: "translateY(-100%) scale(1)",
                            },

                            "& .MuiSlider-thumb[data-index='0'] .MuiSlider-valueLabel": {
                                left: 0,
                                transform: "translateY(-100%) scale(0)",
                            },

                            "& .MuiSlider-thumb[data-index='0'] .MuiSlider-valueLabel.MuiSlider-valueLabelOpen": {
                                transform: "translateY(-100%) scale(1)",
                            },

                            "& .MuiSlider-thumb[data-index='1'] .MuiSlider-valueLabel": {
                                left: "auto !important",
                                right: 0,
                                transform: "translate(-8px, -100%) scale(0)",
                            },

                            "& .MuiSlider-thumb[data-index='1'] .MuiSlider-valueLabel.MuiSlider-valueLabelOpen": {
                                transform: "translate(-8px, -100%) scale(1)",
                            },

                            "& .MuiSlider-thumb::before": {
                                boxShadow: "none !important",
                            },

                            "& .MuiSlider-thumb:hover, & .MuiSlider-thumb.Mui-focusVisible, & .MuiSlider-thumb.Mui-active": {
                                boxShadow: "none !important",
                            },
                        }}
                    />
                </div>

                <InputBox
                    label="Курс до долара"
                    name="exchange_rate"
                    placeholder="Введіть курс"
                    errors={{}}
                    options={{
                        value: filterParams.exchange_rate,
                        onChange: (e) => {
                            const next = { ...filterParams, exchange_rate: e.target.value };
                            onSendFilters(next);
                        },
                    }}
                />

                <InputBox
                    label="Накладна / Документ"
                    name="document_num"
                    placeholder="Введіть номер документа"
                    errors={{}}
                    options={{
                        value: filterParams.document_num,
                        onChange: (e) => {
                            const next = { ...filterParams, document_num: e.target.value };
                            onSendFilters(next);
                        },
                    }}
                />

                <InputBox
                    label="З якої каси / Рахунок IBAN платника"
                    name="payer_account"
                    placeholder="Введіть рахунок платника"
                    errors={{}}
                    options={{
                        value: filterParams.payer_account,
                        onChange: (e) => {
                            const next = { ...filterParams, payer_account: e.target.value };
                            onSendFilters(next);
                        },
                    }}
                />

                <InputBox
                    label="Рахунок отримувача"
                    name="recipient_account"
                    placeholder="Введіть рахунок отримувача"
                    errors={{}}
                    options={{
                        value: filterParams.recipient_account,
                        onChange: (e) => {
                            const next = {
                                ...filterParams,
                                recipient_account: e.target.value,
                            };
                            onSendFilters(next);
                        },
                    }}
                />

                <InputBox
                    label="Хто платив"
                    name="payer"
                    placeholder="Введіть ПІБ / назву"
                    errors={{}}
                    options={{
                        value: filterParams.payer,
                        onChange: (e) => {
                            const next = { ...filterParams, payer: e.target.value };
                            onSendFilters(next);
                        },
                    }}
                />

                <InputBox
                    label="Надходження тканини"
                    name="fabric_arrival"
                    placeholder="Введіть ID або дату"
                    errors={{}}
                    options={{
                        value: filterParams.fabric_arrival,
                        onChange: (e) => {
                            const next = { ...filterParams, fabric_arrival: e.target.value };
                            onSendFilters(next);
                        },
                    }}
                />

                <NewCustomSelect
                    label="Статус"
                    value={filterParams.status}
                    onChange={(e) => {
                        const next = { ...filterParams, status: e.target.value };
                        onSendFilters(next);
                    }}
                    options={statusOptions}
                />
            </Filter>

            <PopupCloser isShow={isShowFilter} onClose={onCloseFilter} />

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

            {showDeletePopup && (
                <CentralPopup
                    title={"Видалення платежу постачальнику"}
                    onClose={closeDeletePopup}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            rowGap: "16px",
                            textAlign: "center",
                        }}
                    >
                        <h3 style={{ paddingBottom: 0 }}>
                            Ви дійсно бажаєте видалити платіж?
                        </h3>

                        <button
                            type="button"
                            className="btnDark"
                            style={{ width: "200px" }}
                            onClick={handleConfirmDelete}
                        >
                            <span>Видалити</span>
                        </button>

                        <button
                            type="button"
                            className="btnLight"
                            style={{ width: "200px" }}
                            onClick={closeDeletePopup}
                        >
                            <span>Скасувати</span>
                        </button>
                    </div>
                </CentralPopup>
            )}

            {isLoading && <Preloader />}
        </div>
    );
};

export default PaymentForVendors;