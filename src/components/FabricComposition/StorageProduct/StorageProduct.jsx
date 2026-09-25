import React, { useEffect, useState, useMemo, useCallback } from "react";
import styles from "./StorageProduct.module.scss";
import SearchFilter from "../../Common/SearchFilter/SearchFilter";
import Filter from "../../Common/Filter/Filter";
import PopupCloser from "../../Common/PopupCloser/PopupCloser";
import { useNavigate } from "react-router";
import ColorRow from "./ColorRow/ColorRow.jsx";
import Table from "../../Common/Table/Table.jsx";
import { getAccessToken } from "../../../api/authStorage.js";
import { fetchFinishedProducts, fetchProductProperties } from "../../../api/tablesApi.js";
import ImgPlaceholder from "../../../assets/img/img_placeholder.jpeg";
import Preloader from "../../Common/Preloader/Preloader.jsx";
import { Pagination } from "@mui/material";
import NewCustomSelect from "../../Common/NewCustomSelect/NewCustomSelect.jsx";
import CentralPopup from "../../Common/CentralPopup/CentralPopup.jsx";
import packageIcon from "../../../assets/icons/package.png";
import { useAppDispatch, useAppSelector } from "../../../hooks/redux.jsx";
import { getIsActivePopup } from "../../../store/selectors";
import { setIsActivePopup } from "../../../store/main-slice";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";

/* helpers */
const toSizeLabel = (s) => (s ? `${s.width}x${s.length}` : "");
const colorToArray = (name) => (name ? [{ title: name }] : []);
const sizeToArray = (s) => {
    const label = toSizeLabel(s);
    return label ? [{ title: label }] : [];
};
const toSizeName = (s) => `${s.width}x${s.length}`;
const toOptions = (arr = [], mapName = (x) => x.name) =>
    arr.map((x) => ({ value: x.id, name: mapName(x) }));

// тепер нам потрібна тільки сумарна кількість
const computeAggregates = (types = []) => {
    let totalQty = 0;

    for (const t of types) {
        if (typeof t?.quantity === "number" && !Number.isNaN(t.quantity)) {
            totalQty += t.quantity;
        }
    }

    return { totalQty };
};

const normalizeLocationsFromTypes = (types = []) => {
    const rows = [];

    types.forEach((type) => {
        const units = Array.isArray(type?.units) ? type.units : [];
        const sizeLabel = type?.size ? `${type.size.width}x${type.size.length}` : "";
        const colorLabel = type?.color?.name ?? "";

        units.forEach((unit) => {
            rows.push({
                num: rows.length + 1,
                warehouse: unit?.cell?.rack?.warehouse?.name ?? "Немає",
                rack: unit?.cell?.rack?.name ?? "Немає",
                cell: unit?.cell?.number ?? unit?.cell?.id ?? "Немає",
                remainder: unit?.current_quantity ?? 0,
                color: colorLabel,
                size: sizeLabel,
            });
        });
    });

    return rows;
};

const StorageProduct = () => {
    const [isShowFilter, setIsShowFilter] = useState(false);
    const [rows, setRows] = useState([]);

    const [isLoading, setIsLoading] = useState(false);

    const [loadingProps, setLoadingProps] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const [categoryOptions, setCategoryOptions] = useState([
        { name: "Усі категорії", value: "" },
    ]);
    const [colorOptions, setColorOptions] = useState([
        { name: "Усі кольори", value: "" },
    ]);
    const [sizeOptions, setSizeOptions] = useState([
        { name: "Усі розміри", value: "" },
    ]);

    const [filters, setFilters] = useState({
        category: "",
        prices__color: "",
        prices__size: "",
        stock: "all",
    });

    const [filterParams, setFilterParams] = useState({
        page: 1,
        name: null,
        category: "",
        prices__color: "",
        prices__size: "",
        in_stock: null,
    });

    const stockOptions = useMemo(() => [
        { name: "Є на складі", value: "true" },
        { name: "Немає на складі", value: "false" },
        { name: "Вся продукція", value: "all" },
    ], []);

    const [expandedIds, setExpandedIds] = useState(() => new Set());

    const dispatch = useAppDispatch();
    const isActivePopup = useAppSelector(getIsActivePopup);

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [locationRows, setLocationRows] = useState([]);

    const navigate = useNavigate();

    const onClose = () => setIsShowFilter(false);
    const onOpenFilter = () => setIsShowFilter(true);
    const onFabricNavigate = () => navigate("/storage");

    const onNewProductArrivalNavigate = () => navigate("/incomingArrivalProduct");
    const onNewFabricArrivalNavigate = () => navigate("/incomingArrivalFabric");

    const onNewProductNavigate = () => navigate("/newProduct");
    const onNewFabricNavigate = () => navigate("/newFabric");

    const openLocationPopup = useCallback((row) => {
        const popupRows = Array.isArray(row?.__locationRows) ? row.__locationRows : [];

        setSelectedProduct({
            id: row?.__tplId ?? row?.id ?? null,
            category: row?.category ?? "",
            name: row?.name ?? "",
            photo: row?.photo ?? "",
        });
        setLocationRows(popupRows);
        dispatch(setIsActivePopup(true));
    }, [dispatch]);

    const closeLocationPopup = useCallback(() => {
        setSelectedProduct(null);
        setLocationRows([]);
        dispatch(setIsActivePopup(false));
    }, [dispatch]);

    // МАПІНГ ПІД НОВИЙ БЕКЕНД (types)
    const mapTemplatesToRowsWithSubrows = useCallback((templates = []) => {
        return templates.map((t) => {
            const types = Array.isArray(t.types) ? t.types : [];
            const hasMultiple = types.length > 1;
            const hasAny = types.length > 0;

            const tplId = t.id;
            const locationRows = normalizeLocationsFromTypes(types);

            const onToggleExpand = () => {
                setExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(tplId)) next.delete(tplId);
                    else next.add(tplId);
                    return next;
                });
            };

            if (hasMultiple) {
                const agg = computeAggregates(types);

                const subrows = types.map((type) => ({
                    __isSubrow: true,
                    __tplId: tplId,
                    category: "",
                    name: "",
                    photo: "",
                    quantity: type?.quantity ?? "",
                    colors: colorToArray(type?.color?.name ?? ""),
                    sizes: sizeToArray(type?.size ?? null),
                    __locationRows: locationRows,
                }));

                return {
                    __isAggregate: true,
                    __hasSubrows: true,
                    __tplId: tplId,
                    _onToggleExpand: onToggleExpand,
                    __subrows: subrows,
                    __variantsCount: types.length,
                    __locationRows: locationRows,

                    category: t?.category?.name ?? "",
                    name: t?.name ?? "",
                    photo: t?.images?.[0] ?? "",
                    quantity: agg.totalQty,
                };
            }

            const first = hasAny ? types[0] : null;

            return {
                __isAggregate: false,
                __hasSubrows: false,
                __tplId: tplId,
                _onToggleExpand: null,
                __subrows: [],
                __variantsCount: hasAny ? 1 : 0,
                __locationRows: locationRows,

                category: t?.category?.name ?? "",
                name: t?.name ?? "",
                photo: t?.images?.[0] ?? "",
                quantity: first?.quantity != null ? first.quantity : "",
                colors: colorToArray(first?.color?.name ?? ""),
                sizes: sizeToArray(first?.size ?? null),
            };
        });
    }, []);

    useEffect(() => {
        (async () => {
            try {
                setLoadingProps(true);
                const token = getAccessToken();
                const props = await fetchProductProperties(token);
                setCategoryOptions([
                    { name: "Усі категорії", value: "" },
                    ...toOptions(props?.categories || []),
                ]);
                setColorOptions([
                    { name: "Усі кольори", value: "" },
                    ...toOptions(props?.colors || []),
                ]);
                setSizeOptions([
                    { name: "Усі розміри", value: "" },
                    ...toOptions(props?.sizes || [], toSizeName),
                ]);
            } catch (e) {
                console.error("product properties fetch failed", e);
                setCategoryOptions([{ name: "Усі категорії", value: "" }]);
                setColorOptions([{ name: "Усі кольори", value: "" }]);
                setSizeOptions([{ name: "Усі розміри", value: "" }]);
            } finally {
                setLoadingProps(false);
            }
        })();
    }, []);

    const fetchData = useCallback(
        async (params) => {
            try {
                setLoadingData(true);
                const token = getAccessToken();
                const resp = await fetchFinishedProducts(token, params);
                const list = Array.isArray(resp?.warehouse_item_templates)
                    ? resp.warehouse_item_templates
                    : [];
                const mapped = mapTemplatesToRowsWithSubrows(list);
                setRows(mapped);
                setTotalPages(resp?.total_pages ?? 0);
                setExpandedIds(new Set());
            } catch (e) {
                console.error("Error loading finished products:", e);
                setRows([]);
                setTotalPages(0);
            } finally {
                setLoadingData(false);
            }
        },
        [mapTemplatesToRowsWithSubrows]
    );

    useEffect(() => {
        setIsLoading(loadingProps || loadingData);
    }, [loadingProps, loadingData]);

    useEffect(() => {
        fetchData(filterParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFilterChange = useCallback(
        (key) => (event) => {
            const value = event.target.value;
            setFilters((prev) => ({ ...prev, [key]: value }));

            let next;

            if (key === "stock") {
                let inStock = null;

                if (value === "true") inStock = true;
                if (value === "false") inStock = false;
                if (value === "all") inStock = null;

                next = {
                    ...filterParams,
                    page: 1,
                    in_stock: inStock,
                };
            } else {
                next = {
                    ...filterParams,
                    page: 1,
                    [key]: value === "" ? "" : Number(value),
                };
            }

            setFilterParams(next);
            setPage(1);
            fetchData(next);
        },
        [filterParams, fetchData]
    );

    const onSendFilters = useCallback(
        (nextParams) => {
            const next = { ...nextParams, page: 1 };
            setFilterParams(next);
            setPage(1);
            fetchData(next);
        },
        [fetchData]
    );

    const handlePaginationChange = useCallback(
        (event, value) => {
            if (page !== value) {
                setPage(value);
                const next = { ...filterParams, page: value };
                setFilterParams(next);
                window.scrollTo({ top: 0, behavior: "auto" });
                fetchData(next);
            }
        },
        [page, filterParams, fetchData]
    );

    const resetAllFilters = useCallback(() => {
        setFilters({
            category: "",
            prices__color: "",
            prices__size: "",
            stock: "all",
        });

        const next = {
            page: 1,
            name: null,
            category: "",
            prices__color: "",
            prices__size: "",
            in_stock: null,
        };

        setFilterParams(next);
        setPage(1);
        fetchData(next);
    }, [fetchData]);

    const columns = useMemo(
        () => [
            {
                key: "location",
                title: "Розташування",
                width: "70px",
                render: (_, row) => {
                    if (row?.__isSubrow) {
                        return <div style={{ width: 22, height: 22, margin: "0 auto" }} />;
                    }

                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                openLocationPopup(row);
                            }}
                            style={{
                                display: "block",
                                margin: "0 auto",
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                            }}
                            title="Розташування"
                            aria-label="Розташування"
                        >
                            <img
                                src={packageIcon}
                                alt=""
                                style={{ width: 22, height: 22, objectFit: "contain" }}
                            />
                        </button>
                    );
                },
            },
            { key: "category", title: "Категорія" },
            { key: "name", title: "Назва", width: "60px" },

            {
                key: "photo",
                title: "Фото",
                width: "65px",
                render: (_, row) => {
                    if (row?.__isSubrow) {
                        return <div style={{ width: 65, height: 65 }} />;
                    }

                    const src = row?.photo;
                    return src ? (
                        <img
                            src={src}
                            alt="Фото"
                            style={{ width: 65, height: 65, objectFit: "cover", borderRadius: 4 }}
                        />
                    ) : (
                        <img
                            src={ImgPlaceholder}
                            alt="Фото"
                            style={{ width: 65, height: 65, objectFit: "cover", borderRadius: 4 }}
                        />
                    );
                },
            },

            {
                key: "quantity",
                title: "Кількість",
                width: "120px",
                render: (value, row) => {
                    const isAgg = !!row?.__isAggregate;
                    const hasSub = !!row?.__hasSubrows;
                    const showToggle = hasSub;
                    const isExpanded = expandedIds.has(row.__tplId);

                    const showQuantity = !showToggle;

                    return (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                alignItems: "center",
                            }}
                        >
                            {showQuantity && (
                                <div>{isAgg ? row.quantity ?? 0 : value ?? ""}</div>
                            )}

                            {showToggle && (
                                <button
                                    className={`btnDark ${styles.var}`}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation?.();
                                        row._onToggleExpand?.(row, e);
                                    }}
                                >
                                    <span>
                                        {isExpanded ? "Сховати варіанти" : "Показати варіанти"}
                                    </span>
                                </button>
                            )}
                        </div>
                    );
                },
            },
            {
                key: "colors",
                title: "Колір",
                width: "120px",
                render: (_, row) => {
                    if (row?.__isAggregate) {
                        return <div></div>;
                    }
                    return <ColorRow colors={row.colors} />;
                },
            },

            {
                key: "sizes",
                title: "Розмір",
                width: "120px",
                render: (_, row) => {
                    if (row?.__isAggregate) {
                        return <div></div>;
                    }

                    const arr = Array.isArray(row.sizes) ? row.sizes : [];
                    const label = arr
                        .map((s) => s?.title)
                        .filter(Boolean)
                        .join(", ");

                    return <div>{label}</div>;
                },
            }

        ],
        [expandedIds, openLocationPopup]
    );

    const locationColumns = useMemo(
        () => [
            { key: "num", title: "№", width: "50px" },
            { key: "warehouse", title: "Склад", width: "140px" },
            { key: "rack", title: "Стелаж", width: "120px" },
            { key: "cell", title: "Комірка", width: "100px" },
            { key: "remainder", title: "Залишок", width: "100px" },
            { key: "color", title: "Колір", width: "120px" },
            { key: "size", title: "Розмір", width: "120px" },
        ],
        []
    );

    return (
        <div>
            <ArrBack/>
            <SearchFilter
                onOpenFilter={onOpenFilter}
                title={"Готова продукція"}
                isAdd
                onAdd={null}
                composition
                onFabricNavigate={onFabricNavigate}
                searchValue={filterParams.name}
                setSearchValue={(value) =>
                    setFilterParams((prev) => ({ ...prev, name: value }))
                }
                onSearch={() => onSendFilters(filterParams)}
                onNewFabricNavigate={onNewFabricNavigate}
                onNewProductNavigate={onNewProductNavigate}
            /*  onNewFabricArrivalNavigate={onNewFabricArrivalNavigate}
              onNewProductArrivalNavigate={onNewProductArrivalNavigate}*/
            />

            <Table
                columns={columns}
                data={rows}
                subrows={(row) =>
                    expandedIds.has(row.__tplId) ? row.__subrows || [] : []
                }
                subtitle={"Готова продукція"}
                equalColumns
                centered
            />

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
                <NewCustomSelect
                    label="Категорія"
                    value={filters.category}
                    onChange={handleFilterChange("category")}
                    options={categoryOptions}
                />
                <NewCustomSelect
                    label="Колір"
                    value={filters.prices__color}
                    onChange={handleFilterChange("prices__color")}
                    options={colorOptions}
                />
                <NewCustomSelect
                    label="Розмір"
                    value={filters.prices__size}
                    onChange={handleFilterChange("prices__size")}
                    options={sizeOptions}
                />
                <NewCustomSelect
                    label="Наявність"
                    value={filters.stock}
                    onChange={handleFilterChange("stock")}
                    options={stockOptions}
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

            {isActivePopup && selectedProduct?.id != null && (
                <CentralPopup
                    title={"Розташування готової продукції"}
                    onClose={closeLocationPopup}
                    bigPopup
                    verticalScroll
                >
                    <div className={styles.infoBlock}>
                        <div className={styles.imgBlock}>
                            <img
                                src={selectedProduct?.photo || ImgPlaceholder}
                                alt=""
                                className={styles.imgBlock__img}
                            />
                            <p className={styles.imgBlock__title}>
                                {selectedProduct?.category} {selectedProduct?.name}
                            </p>
                        </div>

                        {locationRows.length === 0 ? (
                            <p className={styles.infoText}>Немає розташування</p>
                        ) : (
                            <>
                                <p className={styles.infoTitle}>Готова продукція:</p>

                                <Table
                                    columns={locationColumns}
                                    data={locationRows}
                                    equalColumns
                                    popupTable
                                    centered
                                />
                            </>
                        )}
                    </div>
                </CentralPopup>
            )}

            {isLoading && <Preloader />}
        </div>
    );
};

export default StorageProduct;