import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./VendorDebtList.module.scss";
import pricelistStyles from "../../Pricelist/Pricelist.module.scss";

import SearchFilter from "../../Common/SearchFilter/SearchFilter.jsx";
import Filter from "../../Common/Filter/Filter.jsx";
import PopupCloser from "../../Common/PopupCloser/PopupCloser.jsx";
import Table from "../../Common/Table/Table.jsx";
import TableFixedHeader from "../../Common/Table/TableFixedHeader.jsx";
import Preloader from "../../Common/Preloader/Preloader.jsx";
import { Pagination, Slider } from "@mui/material";

import { getAccessToken } from "../../../api/authStorage.js";
import { fetchVendors } from "../../../api/tablesApi.js";
import { useStickyXScroll } from "../../../hooks/useStickyXScroll.jsx";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";

const ITEMS_PER_PAGE = 25;
const MAX_AMOUNT = 1000000;

const formatMoney = (value) => {
    if (value === undefined || value === null || value === "") return "—";

    const num = Number(value);
    if (Number.isNaN(num)) return value;

    return num.toLocaleString("uk-UA");
};

const mapVendorToRow = (vendor) => ({
    id: vendor?.id ?? "",
    full_name: vendor?.full_name ?? "—",
    debt_uah: vendor?.dept?.uah ?? "",
    debt_usd: vendor?.dept?.usd ?? "",
    dept_paid_off: Boolean(vendor?.dept?.dept_paid_off),
});

const VendorDebtList = () => {
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

    const [uahDeptRange, setUahDeptRange] = useState([0, MAX_AMOUNT]);
    const [usdDeptRange, setUsdDeptRange] = useState([0, MAX_AMOUNT]);

    const [filterParams, setFilterParams] = useState({
        page: 1,
        page_size: ITEMS_PER_PAGE,
        search: null,
        uah_dept_min: null,
        uah_dept_max: null,
        usd_dept_min: null,
        usd_dept_max: null,
    });

    const onOpenFilter = () => setIsShowFilter(true);
    const onCloseFilter = () => setIsShowFilter(false);

    const loadVendors = useCallback(async (params) => {
        try {
            setIsLoading(true);

            const token = getAccessToken();
            const response = await fetchVendors(token, params);

            const vendorsList = Array.isArray(response?.vendors) ? response.vendors : [];
            const total = Number(response?.total_pages) || 0;
            const current = Number(response?.current_page) || 1;

            setRows(vendorsList.map(mapVendorToRow));
            setTotalPages(total);
            setPage(current);
        } catch (error) {
            console.error("Error loading vendors:", error);
            setRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadVendors(filterParams);
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
        loadVendors(next);
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
        loadVendors(next);
    };

    const resetAllFilters = useCallback(() => {
        const defaults = {
            page: 1,
            page_size: ITEMS_PER_PAGE,
            search: null,
            uah_dept_min: null,
            uah_dept_max: null,
            usd_dept_min: null,
            usd_dept_max: null,
        };

        setUahDeptRange([0, MAX_AMOUNT]);
        setUsdDeptRange([0, MAX_AMOUNT]);
        setFilterParams(defaults);
        setPage(1);
        loadVendors(defaults);
    }, [loadVendors]);

    const columns = useMemo(() => [
        {
            key: "full_name",
            title: "ПІБ постачальника",
            width: "1.6fr",
            render: (val) => val || "—",
        },
        {
            key: "debt_uah",
            title: "Борг, грн",
            width: "1fr",
            render: (val) => formatMoney(val),
        },
        {
            key: "debt_usd",
            title: "Борг, $",
            width: "1fr",
            render: (val) => formatMoney(val),
        },
        {
            key: "dept_paid_off",
            title: "",
            width: "0.9fr",
            render: (val) => (
                <span
                    style={{
                        color: val ? "#1f9d55" : "#d93025",
                        fontWeight: 600,
                    }}
                >
                    {val ? "Без боргу" : "Борг"}
                </span>
            ),
        },
    ], []);

    const minWidthPx =
        220 + // ПІБ постачальника
        160 + // Борг, грн
        140 + // Борг, $
        120;  // Статус

    const scrollWrapStyle = { overflowX: "auto", paddingBottom: 8 };
    const innerStyle = { minWidth: `${minWidthPx}px` };

    useEffect(() => {
        recalcX();
    }, [rows.length, recalcX]);

    useEffect(() => {
        recalcX();
    }, [minWidthPx, recalcX]);

    useEffect(() => {
        setUahDeptRange([
            filterParams.uah_dept_min ?? 0,
            filterParams.uah_dept_max ?? MAX_AMOUNT,
        ]);
    }, [filterParams.uah_dept_min, filterParams.uah_dept_max]);

    useEffect(() => {
        setUsdDeptRange([
            filterParams.usd_dept_min ?? 0,
            filterParams.usd_dept_max ?? MAX_AMOUNT,
        ]);
    }, [filterParams.usd_dept_min, filterParams.usd_dept_max]);

    return (
        <div className={styles.vendorDebts}>
            <ArrBack/>
            <SearchFilter
                onOpenFilter={onOpenFilter}
                title={"Баланс розрахунків з постачальниками"}
                searchValue={filterParams.search}
                setSearchValue={(value) =>
                    setFilterParams((prev) => ({ ...prev, search: value }))
                }
                onSearch={() => onSendFilters(filterParams)}
                vendor
                onVendorBalanceNavigate={() => {}}
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
                <div>
                    <div style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 12, color: "#ffffff", marginBottom: 10 }}>
                            Мінімальний і максимальний борг, грн
                        </p>
                    </div>

                    <Slider
                        value={uahDeptRange}
                        onChange={(_, val) => setUahDeptRange(val)}
                        onChangeCommitted={(_, val) => {
                            const [min, max] = val;

                            if (
                                min === (filterParams.uah_dept_min ?? 0) &&
                                max === (filterParams.uah_dept_max ?? MAX_AMOUNT)
                            ) {
                                return;
                            }

                            onSendFilters({
                                ...filterParams,
                                uah_dept_min: min,
                                uah_dept_max: max,
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
                            Мінімальний і максимальний борг, $
                        </p>
                    </div>

                    <Slider
                        value={usdDeptRange}
                        onChange={(_, val) => setUsdDeptRange(val)}
                        onChangeCommitted={(_, val) => {
                            const [min, max] = val;

                            if (
                                min === (filterParams.usd_dept_min ?? 0) &&
                                max === (filterParams.usd_dept_max ?? MAX_AMOUNT)
                            ) {
                                return;
                            }

                            onSendFilters({
                                ...filterParams,
                                usd_dept_min: min,
                                usd_dept_max: max,
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

            {isLoading && <Preloader />}
        </div>
    );
};

export default VendorDebtList;