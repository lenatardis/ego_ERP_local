import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import styles from './FabricComposition.module.scss';
import SearchFilter from "../Common/SearchFilter/SearchFilter";
import Table from "../Common/Table/Table";
import Filter from "../Common/Filter/Filter";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import CustomSelect from "../Common/CustomSelect/CustomSelect";
import { useNavigate } from "react-router";
import { getAccessToken } from "../../api/authStorage.js";
import { fetchFilters, getFabrics, fetchFabricRolls } from "../../api/tablesApi.js";
import { Pagination, Slider } from '@mui/material';
import Preloader from "../Common/Preloader/Preloader";
import ImgPlaceholder from "../../assets/img/img_placeholder.jpeg";
import NewCustomSelect from "../Common/NewCustomSelect/NewCustomSelect.jsx";

import CentralPopup from "../Common/CentralPopup/CentralPopup.jsx";
import packageIcon from "../../assets/icons/package.png";
import { useAppDispatch, useAppSelector } from "../../hooks/redux.jsx";
import { getIsActivePopup } from "../../store/selectors";
import { setIsActivePopup } from "../../store/main-slice";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";

const normalizeFabricsToRows = (list = []) =>
    list.map(f => ({
        id: f.id,
        category: f?.type?.type ?? "",
        code: f?.name ?? "",
        photo: f?.images?.[0] ?? "",
        remaining: f?.opened_length_remainder ?? "",
        remainingMeters: f?.opened_length_remainder ?? "",
        remainingClosed: f?.new_fabricrolls_remainder ?? "",
        remainingClosedMeters: f?.new_length_remainder ?? ""
    }));

const FabricComposition = () => {
    const [isShowFilter, setIsShowFilter] = useState(false);
    const [totalPages, setTotalPages] = useState(0);
    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState({
        f1: '',
        f2: '',
        f3: '',
        f4: '',
        f5: '',
        f6: 'all'
    });

    const [filterParams, setFilterParams] = useState({
        page: 1,
        name: null,
        type_id: null,
        new_fabricroll_remainder_min: null,
        new_fabricroll_remainder_max: null,
        in_stock: null
    });

    const dispatch = useAppDispatch();
    const isActivePopup = useAppSelector(getIsActivePopup);

    const [selectedFabric, setSelectedFabric] = useState(null); // { id, category, code }
    const [rollsRows, setRollsRows] = useState([]);
    const [rollsTotalPages, setRollsTotalPages] = useState(1);
    const [rollsPage, setRollsPage] = useState(1);
    const [isRollsLoading, setIsRollsLoading] = useState(false);

    const ROLLS_PAGE_SIZE = 20;
    const rollsAbortRef = useRef(null);

    const openLocationPopup = useCallback((row) => {
        setSelectedFabric({ id: row.id, category: row.category, code: row.code, photo: row.photo });
        setRollsPage(1);
        dispatch(setIsActivePopup(true));
    }, [dispatch]);

    const closeLocationPopup = () => {
        setSelectedFabric(null);
        setRollsRows([]);
        setRollsTotalPages(1);
        setRollsPage(1);
    };

    const normalizeRollsToRows = (list = [], page = 1, pageSize = 20) =>
        list.map((r, idx) => ({
            num: (page - 1) * pageSize + idx + 1,
            warehouse: r?.cell?.rack?.warehouse?.name ?? "",
            rack: r?.cell?.rack?.name ?? "",
            cell: r?.cell?.id ?? "",
            remainder: r?.current_length ?? "",
        }));


    const MAX_CLOSED_ROLLS = 100;
    const [closedRollsRange, setClosedRollsRange] = useState([0, MAX_CLOSED_ROLLS]);

    const [filterOptions, setFilterOptions] = useState([]);

    const navigate = useNavigate();
    const abortRef = useRef(null); // для скасування попереднього запиту

    const onClose = () => setIsShowFilter(false);
    const onOpenFilter = () => setIsShowFilter(true);

    const onProductNavigate = () => navigate('/storage-product');
    const onNewProductNavigate = () => navigate('/newProduct');
    const onNewFabricNavigate = () => navigate('/newFabric');

    const columns = useMemo(() => ([
        {
            key: "location",
            title: "Розташування",
            width: "70px",
            render: (_, row) => (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        openLocationPopup(row);
                    }}
                    style={{
                        display: 'block', margin: '0 auto',
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                    }}
                    title="Розташування"
                    aria-label="Розташування"
                >
                    <img src={packageIcon} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                </button>
            ),
        },
        { key: "category", title: "Категорія" },
        { key: "code", title: "Код тканини", width: "60px" },
        {
            key: "photo",
            title: "Фото",
            width: "65px",
            render: (value) =>
                value
                    ? <img src={value} alt="Фото" style={{ display: 'block', margin: '0 auto', width: 65, height: 65, objectFit: "cover", borderRadius: 4 }} />
                    : <img src={ImgPlaceholder} alt="Фото" style={{ display: 'block', margin: '0 auto', width: 65, height: 65, objectFit: "cover", borderRadius: 4 }} />
        },
        { key: "remaining", title: "Залишок відкритих рулонів", width: "120px" },
        { key: "remainingMeters", title: "Залишок відкритих рулонів в метрах", width: "120px" },
        { key: "remainingClosed", title: "Залишок закритих рулонів", width: "110px" },
        { key: "remainingClosedMeters", title: "Залишок закритих рулонів в метрах", width: "110px" }
    ]), [openLocationPopup]);

    const rollsColumns = useMemo(() => ([
        { key: "num", title: "№", width: "50px" },
        { key: "warehouse", title: "Склад", width: "120px" },
        { key: "rack", title: "Стелаж", width: "120px" },
        { key: "cell", title: "Комірка", width: "90px" },
        { key: "remainder", title: "Залишок, м", width: "100px" },
    ]), []);

    const handleFilterChange = (key) => (event) => {
        const value = event.target.value;
        setFilters(prev => ({ ...prev, [key]: value }));

        if (key === 'f5') {
            const typeId = value === '' ? null : Number(value);

            onSendFilters({
                ...filterParams,
                type_id: typeId,
                new_fabricroll_remainder_min: filterParams.new_fabricroll_remainder_min,
                new_fabricroll_remainder_max: filterParams.new_fabricroll_remainder_max,
            });
        }

        if (key === 'f6') {
            let inStock = null;

            if (value === 'true') inStock = true;
            if (value === 'false') inStock = false;
            if (value === 'all') inStock = null;

            onSendFilters({
                ...filterParams,
                in_stock: inStock,
            });
        }
    };
    const categoryOptions = useMemo(() => [
        { name: 'Усі категорії', value: '' },
        ...filterOptions.map(o => ({ name: o.name, value: String(o.value) }))
    ], [filterOptions]);

    const stockOptions = useMemo(() => [
        { name: 'Є на складі', value: 'true' },
        { name: 'Немає на складі', value: 'false' },
        { name: 'Всі тканини', value: 'all' },
    ], []);

    useEffect(() => {
        const token = getAccessToken();
        setIsLoading(true);

        Promise.all([getFabrics(token, filterParams), fetchFilters(token)])
            .then(([fabricsResponse, filtersResponse]) => {
                if (fabricsResponse?.fabrics) {
                    setRows(normalizeFabricsToRows(fabricsResponse.fabrics));
                    setTotalPages(fabricsResponse?.total_pages);
                }
                if (Array.isArray(filtersResponse?.types)) {
                    setFilterOptions(filtersResponse.types.map(t => ({ name: t.type, value: t.id })));
                } else {
                    setFilterOptions([]);
                }
            })
            .catch(err => {
                console.error('Error loading data:', err);
                setRows([]);
            })
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isActivePopup || !selectedFabric?.id) return;

        const token = getAccessToken();

        // abort previous
        if (rollsAbortRef.current) rollsAbortRef.current.abort();
        rollsAbortRef.current = new AbortController();

        setIsRollsLoading(true);

        fetchFabricRolls(
            token,
            selectedFabric.id,
            { page: rollsPage, page_size: ROLLS_PAGE_SIZE },
            rollsAbortRef.current.signal
        )
            .then((res) => {
                const items = res?.["fabric-rolls"] || [];
                setRollsRows(normalizeRollsToRows(items, rollsPage, ROLLS_PAGE_SIZE));
                setRollsTotalPages(res?.total_pages || 1);
                console.log("[fabric-rolls response]", res); // можеш прибрати
            })
            .catch((err) => {
                if (err?.name !== "AbortError") console.error("fetchFabricRolls error:", err);
            })
            .finally(() => setIsRollsLoading(false));

        return () => {
            if (rollsAbortRef.current) rollsAbortRef.current.abort();
        };
    }, [isActivePopup, selectedFabric?.id, rollsPage]);

    const handleRollsPaginationChange = (_, value) => {
        if (rollsPage !== value) setRollsPage(value);
    };

    const fetchFabrics = (newFilterParams) => {
        setIsLoading(true);
        const accessToken = getAccessToken();

        // скасувати попередній запит
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        getFabrics(accessToken, newFilterParams, abortRef.current.signal)
            .then((response) => {
                if (response?.fabrics) {
                    setRows(normalizeFabricsToRows(response.fabrics));
                }
                setTotalPages(response?.total_pages);
            })
            .catch((err) => {
                if (err?.name !== 'AbortError') console.error('getFabrics error:', err);
            })
            .finally(() => setIsLoading(false));
    };

    const handlePaginationChange = (event, value) => {
        if (filterParams.page !== value) {
            const newFilterParams = { ...filterParams, page: value };
            setFilterParams(newFilterParams);
            window.scrollTo({ top: 0, behavior: 'auto' });
            fetchFabrics(newFilterParams);
        }
    };

    const onSendFilters = (newParams) => {
        const params = { ...newParams, page: 1 };
        setFilterParams(params);
        fetchFabrics(params);
    };

    const resetAllFilters = () => {
        setFilters({
            f1: '',
            f2: '',
            f3: '',
            f4: '',
            f5: '',
            f6: 'all'
        });

        setClosedRollsRange([0, MAX_CLOSED_ROLLS]);

        const next = {
            page: 1,
            name: null,
            type_id: null,
            new_fabricroll_remainder_min: null,
            new_fabricroll_remainder_max: null,
            in_stock: null
        };

        setFilterParams(next);
        fetchFabrics(next);
    };

    return (
        <div>
            <ArrBack/>
            <SearchFilter
                onOpenFilter={onOpenFilter}
                title={'Тканини'}
                isAdd
                composition
                onProductNavigate={onProductNavigate}
                onNewProductNavigate={onNewProductNavigate}
                onNewFabricNavigate={onNewFabricNavigate}
                /*    onNewFabricArrivalNavigate={onNewFabricArrivalNavigate}
                    onNewProductArrivalNavigate={onNewProductArrivalNavigate}*/
                searchValue={filterParams.name}
                setSearchValue={(value) => setFilterParams(prev => ({ ...prev, name: value }))}
                onSearch={() => onSendFilters(filterParams)}
            />

            <Table columns={columns} data={rows} subtitle={'Тканини'} equalColumns centered />

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
                <NewCustomSelect
                    label="Категорія"
                    value={filters.f5}
                    onChange={handleFilterChange('f5')}
                    options={categoryOptions}
                />
                <NewCustomSelect
                    label="Наявність"
                    value={filters.f6}
                    onChange={handleFilterChange('f6')}
                    options={stockOptions}
                />

                <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 12, color: '#ffffff' }}>Мінімальний і максимальний залишок закритих рулонів, шт</p>
                    </div>
                    <Slider
                        value={closedRollsRange}
                        onChange={(_, val) => setClosedRollsRange(val)}
                        onChangeCommitted={(_, val) => {
                            const [min, max] = val;
                            if (
                                min === (filterParams.new_fabricroll_remainder_min ?? 0) &&
                                max === (filterParams.new_fabricroll_remainder_max ?? MAX_CLOSED_ROLLS)
                            ) return;

                            onSendFilters({
                                ...filterParams,
                                new_fabricroll_remainder_min: min,
                                new_fabricroll_remainder_max: max,
                            });
                        }}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `${v} шт`}
                        min={0}
                        max={MAX_CLOSED_ROLLS}
                        marks={[
                            { value: 0, label: '0' },
                            { value: MAX_CLOSED_ROLLS, label: MAX_CLOSED_ROLLS }
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

            <PopupCloser isShow={isShowFilter} onClose={onClose} />

            {totalPages > 1 && (
                <Pagination
                    count={totalPages}
                    page={filterParams.page}
                    siblingCount={1}
                    boundaryCount={1}
                    hidePrevButton
                    hideNextButton
                    onChange={handlePaginationChange}
                />
            )}

            {isActivePopup && selectedFabric?.id != null && (
                <CentralPopup
                    title={"Розташування рулонів"}
                    onClose={closeLocationPopup}
                    bigPopup
                    verticalScroll
                >
                    <div className={styles.infoBlock}>
                        <div className={styles.imgBlock}>
                            <img
                                src={selectedFabric?.photo || ImgPlaceholder}
                                alt=""
                                className={styles.imgBlock__img}
                            />
                            <p className={styles.imgBlock__title}>
                                {selectedFabric?.category} {selectedFabric?.code}
                            </p>
                        </div>
                        {rollsRows.length === 0 && !isRollsLoading ? (
                            <p className={styles.infoText}>Немає рулонів</p>
                        ) : (
                            <>
                                <p className={styles.infoTitle}>Рулони:</p>

                                <Table
                                    columns={rollsColumns}
                                    data={rollsRows}
                                    equalColumns
                                    popupTable
                                    centered
                                />

                                {rollsTotalPages > 1 && (
                                    <div style={{ marginTop: 12 }}>
                                        <Pagination
                                            count={rollsTotalPages}
                                            page={rollsPage}
                                            siblingCount={1}
                                            boundaryCount={1}
                                            hidePrevButton
                                            hideNextButton
                                            onChange={handleRollsPaginationChange}
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {isRollsLoading && <Preloader />}
                    </div>

                </CentralPopup>
            )}
            {isLoading && <Preloader />}
        </div>
    );
};

export default FabricComposition;
