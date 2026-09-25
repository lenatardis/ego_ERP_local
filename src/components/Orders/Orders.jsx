import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./Orders.module.scss";

import SearchFilter from "../Common/SearchFilter/SearchFilter";
import ProtectedImage from "../Common/ProtectedImage/ProtectedImage";

import { fetchOrders } from "../../api/ordersApi";
import { useAppSelector } from "../../hooks/redux";
import { getProfile } from "../../store/selectors";

import {
    MAIN_TABS,
    ORDER_TYPE_TABS,
    getStoredAccessToken,
    getUserIdFromToken,
    normalizeOrdersResponse,
    mapOrderToRow,
    getDefaultAvailableStatus,
    getColumnTitles,
} from "./Orders.helpers";
import ArrBack from "../Common/ArrBack/ArrBack";

const Orders = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { groups } = useAppSelector(getProfile);

    const [activeTab, setActiveTab] = useState(
        location.state?.activeTab === "my" ? "my" : "all"
    );
    const [activeOrderType, setActiveOrderType] = useState("kit");
    const [searchValue, setSearchValue] = useState(null);
    const [filterParams, setFilterParams] = useState({
        search: null,
    });

    const [ordersResponse, setOrdersResponse] = useState({
        results: [],
        count: 0,
        next: null,
        previous: null,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errorText, setErrorText] = useState("");
    const [selectedBarcode, setSelectedBarcode] = useState("");

    const token = getStoredAccessToken();
    const currentUserId = useMemo(() => getUserIdFromToken(token), [token]);

    const isCutter = Array.isArray(groups) && groups.includes("Закрійник");
    const isSewer =
        Array.isArray(groups) &&
        (groups.includes("Швачка") || groups.includes("Швея"));
    const isPacker = Array.isArray(groups) && groups.includes("Пакувальник");

    const isArchiveTab =
        activeTab === "shipment_ready" || activeTab === "delivered";

    const showOrderTypeTabs = isPacker || isArchiveTab;
    const effectiveOrderType = showOrderTypeTabs ? activeOrderType : "kit";

    useEffect(() => {
        if (!showOrderTypeTabs && activeOrderType !== "kit") {
            setActiveOrderType("kit");
        }
    }, [showOrderTypeTabs, activeOrderType]);

    const defaultAvailableStatus = useMemo(
        () => getDefaultAvailableStatus({ isCutter, isSewer, isPacker }),
        [isCutter, isSewer, isPacker]
    );

    const myActiveStatus = useMemo(() => {
        if (isCutter) return "ON_CUT";
        if (isSewer) return "ON_SEWING";
        if (isPacker) return "ON_PACKAGING";
        return "";
    }, [isCutter, isSewer, isPacker]);

    const { thirdColumnTitle, fourthColumnTitle } = useMemo(
        () =>
            getColumnTitles({
                activeTab,
                activeOrderType: effectiveOrderType,
            }),
        [activeTab, effectiveOrderType]
    );

    const showBarcodeColumn = activeTab === "all";
    const isMyWarehouseTable =
        activeTab === "my" && effectiveOrderType === "warehouse_item";

    const tableGridClass = showBarcodeColumn
        ? styles.withBarcode
        : isMyWarehouseTable
            ? styles.myWarehouseTable
            : styles.withoutBarcode;

    const handleSearch = () => {
        setFilterParams((prev) => ({
            ...prev,
            search: searchValue?.trim() || null,
        }));
    };

    useEffect(() => {
        const loadOrders = async () => {
            if (!token) {
                setErrorText("Не знайдено access token.");
                setOrdersResponse({
                    results: [],
                    count: 0,
                    next: null,
                    previous: null,
                });
                return;
            }

            if (activeTab === "my" && !currentUserId) {
                setErrorText("Не вдалося визначити ID поточного користувача.");
                setOrdersResponse({
                    results: [],
                    count: 0,
                    next: null,
                    previous: null,
                });
                return;
            }

            try {
                setIsLoading(true);
                setErrorText("");

                const roleFilters =
                    activeTab === "all"
                        ? {
                            for_cutter: isCutter || undefined,
                            for_sewer: isSewer || undefined,
                            for_packer:
                                isPacker && effectiveOrderType === "kit"
                                    ? true
                                    : undefined,
                        }
                        : {};
                const typeFilters = {
                    only_kit:
                        effectiveOrderType === "kit" ? true : undefined,
                    only_warehouse_item:
                        effectiveOrderType === "warehouse_item"
                            ? true
                            : undefined,
                };

                const archiveStatus =
                    activeTab === "shipment_ready"
                        ? "SHIPMENT_READY"
                        : activeTab === "delivered"
                            ? "DELIVERED"
                            : "";

                const resolvedStatus =
                    activeTab === "all"
                        ? defaultAvailableStatus || undefined
                        : isArchiveTab
                            ? archiveStatus
                            : myActiveStatus || undefined;

                const response = await fetchOrders(token, {
                    page: 1,
                    page_size: 100,
                    search: filterParams.search,
                    status: resolvedStatus,
                    user: activeTab === "my" ? currentUserId : undefined,
                    ...roleFilters,
                    ...typeFilters,
                });

                setOrdersResponse(normalizeOrdersResponse(response));
            } catch (error) {
                console.error("Orders load error:", error);
                setErrorText("Не вдалося завантажити замовлення.");
                setOrdersResponse({
                    results: [],
                    count: 0,
                    next: null,
                    previous: null,
                });
            } finally {
                setIsLoading(false);
            }
        };

        loadOrders();
    }, [
        token,
        currentUserId,
        activeTab,
        isArchiveTab,
        filterParams.search,
        activeOrderType,
        effectiveOrderType,
        defaultAvailableStatus,
        myActiveStatus,
        isCutter,
        isSewer,
        isPacker,
    ]);

    const rows = useMemo(() => {
        const mappedRows = ordersResponse.results.map(mapOrderToRow);

        const typedRows = mappedRows.filter((row) =>
            effectiveOrderType === "kit"
                ? row.type === "kit"
                : row.type === "warehouse_item"
        );

        return typedRows;
    }, [ordersResponse.results, effectiveOrderType]);

    const canOpenOrder = (row) => {
        if (activeTab === "my") {
            return true;
        }

        if (isCutter) {
            return row.cutter === currentUserId;
        }

        if (isSewer) {
            return row.sewer === currentUserId;
        }

        if (isPacker) {
            return row.packer === currentUserId;
        }

        return false;
    };

    const handleOpenOrder = (row) => {
        if (!canOpenOrder(row)) {
            return;
        }

        navigate("/order", {
            state: {
                orderId: row.id,
                order: row.raw,
            },
        });
    };

    const handleOpenBarcode = (event, barcodeUrl) => {
        event.stopPropagation();
        if (!barcodeUrl) return;
        setSelectedBarcode(barcodeUrl);
    };

    const handleCloseBarcode = () => {
        setSelectedBarcode("");
    };

    return (
        <div className={styles.orders}>
            <ArrBack />
            <SearchFilter
                title="Замовлення"
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
                hideFilterButton
            />

            <div className={styles.tabsWrap}>
                <div className={styles.switcher}>
                    {MAIN_TABS.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            className={`${styles.switchButton} ${activeTab === tab.value
                                ? styles.switchButtonActive
                                : ""
                                }`}
                            onClick={() => setActiveTab(tab.value)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {showOrderTypeTabs && (
                <div className={styles.innerTabsWrap}>
                    <div className={styles.innerSwitcher}>
                        {ORDER_TYPE_TABS.map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                className={`${styles.innerSwitchButton} ${activeOrderType === tab.value
                                    ? styles.innerSwitchButtonActive
                                    : ""
                                    }`}
                                onClick={() => setActiveOrderType(tab.value)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.tableWrap}>
                <div className={`${styles.headerRow} ${tableGridClass}`}>
                    {isMyWarehouseTable ? (
                        <>
                            <div>Дата отримання</div>
                            <div>Фото</div>
                            <div>Назва</div>
                            <div>Категорія</div>
                            <div>Колір</div>
                            <div>Розмір</div>
                            <div>Коментар</div>
                        </>
                    ) : (
                        <>
                            <div>Дата отримання</div>
                            <div>Фото</div>
                            <div>{thirdColumnTitle}</div>
                            <div>{fourthColumnTitle}</div>
                            <div>Опції</div>
                            {showBarcodeColumn && <div>Barcode</div>}
                            <div>Коментар</div>
                        </>
                    )}
                </div>

                {isLoading ? (
                    <div className={styles.stateBlock}>Завантаження...</div>
                ) : errorText ? (
                    <div className={styles.stateBlock}>{errorText}</div>
                ) : rows.length === 0 ? (
                    <div className={styles.stateBlock}>Немає замовлень</div>
                ) : (
                    <div className={styles.rows}>
                        {rows.map((row) => {
                            const disabled = !canOpenOrder(row);
                            const isWarehouseTab =
                                effectiveOrderType === "warehouse_item";

                            if (isMyWarehouseTable) {
                                return (
                                    <button
                                        key={row.id}
                                        type="button"
                                        className={`${styles.rowCard} ${tableGridClass}`}
                                        onClick={() => handleOpenOrder(row)}
                                        title={
                                            disabled
                                                ? "Можна відкривати лише свої замовлення"
                                                : ""
                                        }
                                    >
                                        <div className={styles.cell}>
                                            {row.receivedDate}
                                        </div>

                                        <div className={styles.cell}>
                                            <ProtectedImage
                                                src={row.imageUrl}
                                                alt="Замовлення"
                                                token={token}
                                                className={styles.photo}
                                                fallbackClassName={
                                                    styles.photoPlaceholder
                                                }
                                            />
                                        </div>

                                        <div className={styles.cell}>
                                            {row.nameValue || "—"}
                                        </div>

                                        <div className={styles.cell}>
                                            {row.categoryValue || "—"}
                                        </div>

                                        <div className={styles.cell}>
                                            {row.colorValue || "—"}
                                        </div>

                                        <div className={styles.cell}>
                                            {row.setSize || "—"}
                                        </div>

                                        <div className={styles.cell}>
                                            <div className={styles.comment}>
                                                {row.directCommentValue}
                                            </div>
                                        </div>
                                    </button>
                                );
                            }

                            const thirdColumnValue = isWarehouseTab
                                ? row.nameValue
                                : activeTab === "my"
                                    ? row.nameValue
                                    : row.setSize;

                            const fourthColumnValue = isWarehouseTab
                                ? row.setSize
                                : row.completionValue;

                            const optionsValue = isWarehouseTab
                                ? "—"
                                : row.optionsValue || "—";

                            return (
                                <button
                                    key={row.id}
                                    type="button"
                                    className={`${styles.rowCard} ${tableGridClass}`}
                                    onClick={() => handleOpenOrder(row)}
                                    title={
                                        disabled
                                            ? "Можна відкривати лише свої замовлення"
                                            : ""
                                    }
                                >
                                    <div className={styles.cell}>
                                        {row.receivedDate}
                                    </div>

                                    <div className={styles.cell}>
                                        <ProtectedImage
                                            src={row.imageUrl}
                                            alt="Замовлення"
                                            token={token}
                                            className={styles.photo}
                                            fallbackClassName={
                                                styles.photoPlaceholder
                                            }
                                        />
                                    </div>

                                    <div className={styles.cell}>
                                        {thirdColumnValue || "—"}
                                    </div>

                                    <div className={styles.cell}>
                                        {fourthColumnValue || "—"}
                                    </div>

                                    <div className={styles.cell}>
                                        {optionsValue}
                                    </div>

                                    {showBarcodeColumn && (
                                        <div className={styles.cell}>
                                            {row.barcode ? (
                                                <div
                                                    className={
                                                        styles.barcodePreview
                                                    }
                                                    onClick={(event) =>
                                                        handleOpenBarcode(
                                                            event,
                                                            row.barcode
                                                        )
                                                    }
                                                    role="button"
                                                    tabIndex={0}
                                                >
                                                    <img
                                                        src={row.barcode}
                                                        alt="Barcode"
                                                        className={
                                                            styles.barcodeImage
                                                        }
                                                    />
                                                </div>
                                            ) : (
                                                "—"
                                            )}
                                        </div>
                                    )}

                                    <div className={styles.cell}>
                                        <div className={styles.comment}>
                                            {row.comment}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedBarcode && (
                <div className={styles.barcodeModal} onClick={handleCloseBarcode}>
                    <div
                        className={styles.barcodeModalContent}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <img
                            src={selectedBarcode}
                            alt="Barcode original"
                            className={styles.barcodeModalImage}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Orders;