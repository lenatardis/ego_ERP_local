import React, { useMemo, useState, useRef, useEffect } from "react";
import styles from "./Pricelist.module.scss";

import Table from "../Common/Table/Table.jsx";
import TableFixedHeader from "../Common/Table/TableFixedHeader.jsx";
import CentralPopup from "../Common/CentralPopup/CentralPopup.jsx";
import InputBox from "../Common/InputBox/InputBox.jsx";

import SearchFilter from "../Common/SearchFilter/SearchFilter";
import Filter from "../Common/Filter/Filter";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import CustomSelect from "../Common/CustomSelect/CustomSelect";
import CustomCheckbox from "../Common/CustomCheckbox/CustomCheckbox.jsx";
import { useStickyXScroll } from "../../hooks/useStickyXScroll.jsx";

import Preloader from "../Common/Preloader/Preloader.jsx";
import { Pagination } from "@mui/material";

import {
    fetchPricelists,
    createPricelist,
    editPricelist,
    deletePricelist
} from "../../api/tablesApi.js";
import { getAccessToken } from "../../api/authStorage.js";

import { useAppDispatch } from "../../hooks/redux.jsx";
import { setIsActivePopup } from "../../store/main-slice.js";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";
import OptionLimitLabel from "../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../Common/LimitedCell/LimitedCell.jsx";

// ===== helpers =====

const mapApiPricelistToRow = (item) => {
    const priceCount = item.price_count || {};

    const statusRaw = item.status ?? "";
    const statusUa =
        statusRaw === "ACTIVE"
            ? "Активний"
            : statusRaw === "DEPRECATED"
                ? "Неактивний"
                : statusRaw;

    return {
        id: item.id,
        name: item.title ?? "",
        description: item.description ?? "",
        isDefault: item.is_default ? "Так" : "Ні",
        isDefaultRaw: !!item.is_default,
        status: statusUa,
        statusRaw,
        price_count: priceCount,
        sources: item.sources ?? [],
        selectedSourceId: item.sources?.[0]?.id ?? null,
    };
};

const PRICE_COUNT_LABELS = {
    warehouse_item_type: "Товар",
    kit_template: "Комплект",
    kit_option_template: "Опція комплекту",
    kit_component_template: "Компонент",
    component_option_template: "Опція компоненту",
};

const MAX_PRICELIST_NAME_LENGTH = 50;
const MAX_PRICELIST_DESCRIPTION_LENGTH = 100;


const Pricelist = () => {
    const dispatch = useAppDispatch();
    const scrollRef = useRef(null);

    // ghost scroll
    const { mainRef, StickyBar, recalcX } = useStickyXScroll({
        offsetBottom: 0,
        trackHeight: 16,
        zIndex: 60,
    });

    // сирі дані однієї сторінки з беку
    const [allRows, setAllRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // пагінація
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    // пошук + фільтри
    const [isShowFilter, setIsShowFilter] = useState(false);
    const [searchValue, setSearchValue] = useState(null);
    const [filters, setFilters] = useState({
        status: "",
    });
    const [filterParams, setFilterParams] = useState({
        page: 1,
        title: null,
        status: "",
    });

    const [priceCountExpanded, setPriceCountExpanded] = useState({});
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [deletingRow, setDeletingRow] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // статуси як у бекенду (ACTIVE/DEPRECATED)
    const statusOptions = [
        { name: "Усі статуси", value: "" },
        { name: "Активні", value: "ACTIVE" },
        { name: "Неактивні", value: "DEPRECATED" },
    ];

    const fetchData = async (params) => {
        try {
            setIsLoading(true);
            const token = getAccessToken();
            const data = await fetchPricelists(token, {
                page: params.page,
                status: params.status || undefined,
                title: params.title || undefined, // бековий пошук по назві
                // is_default/page_size — додаси якщо треба
            });

            const apiRows = (data?.prices_lists ?? []).map(mapApiPricelistToRow);

            setAllRows(apiRows);
            setTotalPages(data?.total_pages ?? 0);
        } catch (e) {
            console.error("Failed to load pricelists:", e);
            setAllRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    };

    /* useEffect(() => {
         const root = document.documentElement;
         root.classList.add("stableGutter");
         return () => {
             root.classList.remove("stableGutter");
         };
     }, []);*/

    useEffect(() => {
        fetchData(filterParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const rows = allRows;


    const updateRows = (updater) => {
        setAllRows((prev) => updater(prev));
    };

    const onSendFilters = (newParams) => {
        const next = { ...newParams, page: 1 };
        setFilterParams(next);
        setPage(1);
        fetchData(next);
    };

    const handleSearch = () => {
        onSendFilters({ ...filterParams, title: searchValue?.trim() || null });
    };

    const handleStatusChange = (event) => {
        const value = event.target.value;
        setFilters({ status: value });
        onSendFilters({ ...filterParams, status: value });
    };

    const resetAllFilters = () => {
        const next = { page: 1, title: "", status: "" };
        setFilters({ status: "" });
        setFilterParams(next);
        setSearchValue(null);
        setPage(1);
        setPriceCountExpanded({});
        fetchData(next);
    };

    const handlePaginationChange = (event, value) => {
        if (page !== value) {
            setPage(value);
            const next = { ...filterParams, page: value };
            setFilterParams(next);
            setPriceCountExpanded({});
            window.scrollTo({ top: 0, behavior: "auto" });
            fetchData(next);
        }
    };

    const onCloseFilter = () => setIsShowFilter(false);

    // ===== POPUP: edit pricelist =====
    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        description: "",
        isDefault: false,
    });
    const [editErrors, setEditErrors] = useState({});

    const editingRow = useMemo(
        () => rows.find((r) => r.id === editingRowId) || null,
        [rows, editingRowId]
    );

    const clearEditError = (key) => {
        setEditErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const openEditPopup = (row) => {
        setEditingRowId(row.id);
        setEditForm({
            name: row.name || "",
            description: row.description || "",
            isDefault: row.isDefaultRaw ?? false,
        });
        setEditErrors({});
        setIsEditPopupOpen(true);
        setIsCreatePopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeEditPopup = () => {
        setIsEditPopupOpen(false);
        setEditingRowId(null);
        setEditForm({ name: "", description: "", isDefault: false });
        setEditErrors({});
        dispatch(setIsActivePopup(false));
    };

    const isMultipleDefaultPricelistError = (err) => {
        const data = err?.data;
        const msgs = data?.is_default;

        if (!msgs) return false;

        const arr = Array.isArray(msgs) ? msgs : [msgs];
        return arr.some((m) =>
            String(m).toLowerCase().includes("multiple default priceslist")
        );
    };

    const handleEditSave = async () => {
        if (!editingRowId) {
            closeEditPopup();
            return;
        }

        const errors = {};
        const nameTrimmed = editForm.name.trim();
        const descTrimmed = editForm.description.trim();

        if (!nameTrimmed) {
            errors.pricelistName = { message: "Вкажіть назву прайслиста" };
        }

        if (nameTrimmed.length > MAX_PRICELIST_NAME_LENGTH) {
            errors.pricelistName = { message: "Назва має бути не більше 50 символів" };
        }

        if (!descTrimmed) {
            errors.pricelistDescription = { message: "Вкажіть опис прайслиста" };
        }

        if (descTrimmed.length > MAX_PRICELIST_DESCRIPTION_LENGTH) {
            errors.pricelistDescription = { message: "Опис має бути не більше 100 символів" };
        }

        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const payload = {
                title: nameTrimmed,
                description: descTrimmed,
                is_default: !!editForm.isDefault,
                status: editingRow?.statusRaw ?? "ACTIVE",
            };

            const updated = await editPricelist(token, editingRowId, payload);

            const updatedRow = mapApiPricelistToRow(updated);

            updateRows((prev) =>
                prev.map((r) => (r.id === editingRowId ? { ...r, ...updatedRow } : r))
            );

            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit pricelist:", e);

            if (isMultipleDefaultPricelistError(e)) {
                window.alert(
                    "Не може бути кілька прайслистів за замовчуванням.\n" +
                    "Щоб зробити цей прайслист основним, спочатку зніміть прапорець «За замовчуванням» " +
                    "у поточного основного прайслиста, а потім повторіть збереження."
                );
                return;
            }

            window.alert("Не вдалося зберегти прайслист. Спробуй ще раз.");
        }

    };

    const handleToggleStatus = async (row) => {
        if (!row?.id) return;

        const nextStatus = row.statusRaw === "DEPRECATED" ? "ACTIVE" : "DEPRECATED";

        try {
            const token = getAccessToken();

            const payload = {
                title: (row.name || "").trim(),
                description: (row.description || "").trim(),
                is_default: row.isDefaultRaw ?? false,
                status: nextStatus,
            };

            const updated = await editPricelist(token, row.id, payload);
            const updatedRow = mapApiPricelistToRow(updated);

            updateRows((prev) =>
                prev.map((r) => (r.id === row.id ? { ...r, ...updatedRow } : r))
            );
        } catch (e) {
            console.error("Failed to change pricelist status:", e);
        }
    };


    const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        description: "",
        isDefault: false,
    });
    const [createErrors, setCreateErrors] = useState({});

    const clearCreateError = (key) => {
        setCreateErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleDeletePricelist = async () => {
        if (!deletingRow?.id) {
            closeDeletePopup();
            return;
        }

        try {
            setIsDeleting(true);
            const token = getAccessToken();

            await deletePricelist(token, deletingRow.id);

            const isLastRowOnPage = rows.length === 1;
            const nextPage = isLastRowOnPage && page > 1 ? page - 1 : page;
            const nextParams = { ...filterParams, page: nextPage };

            setPage(nextPage);
            setFilterParams(nextParams);
            setPriceCountExpanded({});

            await fetchData(nextParams);

            closeDeletePopup();
        } catch (e) {
            console.error("Failed to delete pricelist:", e);
            window.alert("Не вдалося видалити прайслист. Спробуй ще раз.");
        } finally {
            setIsDeleting(false);
        }
    };

    const openCreatePopup = () => {
        setCreateForm({ name: "", description: "", isDefault: false });
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeCreatePopup = () => {
        setIsCreatePopupOpen(false);
        setCreateForm({ name: "", description: "", isDefault: false });
        setCreateErrors({});
        dispatch(setIsActivePopup(false));
    };

    const openDeletePopup = (row) => {
        setDeletingRow(row);
        setIsDeletePopupOpen(true);
        setIsEditPopupOpen(false);
        setIsCreatePopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeDeletePopup = () => {
        setIsDeletePopupOpen(false);
        setDeletingRow(null);
        dispatch(setIsActivePopup(false));
    };

    const handleCreateSave = async () => {
        const errors = {};
        const nameTrimmed = createForm.name.trim();
        const descTrimmed = createForm.description.trim();

        if (!nameTrimmed) {
            errors.createName = { message: "Вкажіть назву прайслиста" };
        }

        if (nameTrimmed.length > MAX_PRICELIST_NAME_LENGTH) {
            errors.createName = { message: "Назва має бути не більше 50 символів" };
        }

        if (!descTrimmed) {
            errors.createDescription = { message: "Вкажіть опис прайслиста" };
        }

        if (descTrimmed.length > MAX_PRICELIST_DESCRIPTION_LENGTH) {
            errors.createDescription = { message: "Опис має бути не більше 100 символів" };
        }
        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();
            const payload = {
                title: nameTrimmed,
                description: descTrimmed,
                is_default: createForm.isDefault,
                status: "ACTIVE",
            };

            const created = await createPricelist(token, payload);

            const fallback = {
                id: Date.now(),
                title: nameTrimmed,
                description: descTrimmed,
                is_default: createForm.isDefault,
                status: "ACTIVE",
                price_count: {
                    warehouse_item_type: 0,
                    kit_component_template: 0,
                    kit_template: 0,
                    component_option_template: 0,
                    kit_option_template: 0,
                },
                sources: [],
            };

            const newRow = mapApiPricelistToRow(created || fallback);
            updateRows((prev) => [...prev, newRow]);

            closeCreatePopup();
        } catch (e) {
            console.error("Failed to create pricelist:", e);

            if (isMultipleDefaultPricelistError(e)) {
                window.alert(
                    "Не може бути кілька прайслистів за замовчуванням.\n" +
                    "Щоб зробити цей прайслист основним, спочатку зніміть прапорець «За замовчуванням» " +
                    "у поточного основного прайслиста, а потім повторіть збереження."
                );
                return;
            }

            window.alert("Не вдалося зберегти прайслист. Спробуй ще раз.");
        }

    };

    // ===== columns =====
    const columns = useMemo(
        () => [
            { key: "id", title: "ID", width: "60px" },
            { key: "name", title: "Назва прайслиста", render: (_, row) => <LimitedCell value={row.name} />, },
            { key: "description", title: "Опис", render: (_, row) => <LimitedCell value={row.description} lineClamp={8} />, },
            {
                key: "price_count",
                title: "К-ть цін",
                width: "140px",
                render: (_, row) => {
                    const isExpanded = !!priceCountExpanded[row.id];
                    const counts = row.price_count || {};

                    const items = Object.entries(PRICE_COUNT_LABELS).map(
                        ([key, label]) => ({
                            label,
                            value: counts[key] ?? 0,
                        })
                    );

                    return (
                        <div className={styles.priceCountCell}>
                            <button
                                type="button"
                                className="btnDark"
                                onClick={() =>
                                    setPriceCountExpanded((prev) => ({
                                        ...prev,
                                        [row.id]: !prev[row.id],
                                    }))
                                }
                            >
                                <span>{isExpanded ? "Сховати" : "Показати"}</span>
                            </button>

                            {isExpanded && (
                                <div className={styles.priceCountList}>
                                    {items.map((item, idx) => (
                                        <div
                                            key={`${row.id}-pc-${idx}`}
                                            className={styles.priceCountRow}
                                        >
                                            {item.label}: {item.value}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                },
            },

            { key: "isDefault", title: "За замовчуванням" },
            { key: "status", title: "Статус" },
            {
                key: "sources",
                title: "Джерела",
                render: (_, row) => {
                    const sources = (row.sources || [])
                        .map((s) => s.name)
                        .filter(Boolean);

                    if (!sources.length) {
                        return <LimitedCell value="Немає" lineClamp={1} />;
                    }

                    return (
                        <div className={styles.sourcesCell}>
                            {sources.map((name, idx) => (
                                <LimitedCell
                                    key={`${row.id}-src-${idx}`}
                                    value={name}
                                    lineClamp={1}
                                />
                            ))}
                        </div>
                    );
                },
            },
            {
                key: "actions",
                title: "",
                width: "140px",
                render: (_, row) => {
                    const isDeprecated = row.statusRaw === "DEPRECATED";

                    return (
                        <div className={styles.actionsCell}>
                            <button
                                type="button"
                                className="btnDark"
                                onClick={() => handleToggleStatus(row)}
                            >
                                <span>{isDeprecated ? "Активувати" : "Деактивувати"}</span>
                            </button>
                            <button
                                type="button"
                                className="btnDark"
                                onClick={() => openEditPopup(row)}
                            >
                                <span>Редагувати</span>
                            </button>
                            <button
                                type="button"
                                className="btnDark"
                                onClick={() => openDeletePopup(row)}
                            >
                                <span>Видалити</span>
                            </button>
                        </div>
                    );
                },
            }
        ],
        [rows, priceCountExpanded]
    );

    const minWidthPx = useMemo(() => {
        return columns.reduce((acc, col) => {
            const w = col.width ? parseInt(col.width, 10) || 160 : 160;
            return acc + w;
        }, 0);
    }, [columns]);

    useEffect(() => {
        recalcX();
    }, [minWidthPx, rows.length, recalcX]);


    return (
        <div className={styles.wrapper}>
            <ArrBack />
            <SearchFilter
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
                title="Прайслісти"
            />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати прайслист</span>
                </button>
            </div>

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
                style={{ overflowX: "auto", paddingBottom: 8 }}
                ref={(el) => {
                    if (typeof mainRef === "function") {
                        mainRef(el);
                    } else if (mainRef && "current" in mainRef) {
                        mainRef.current = el;
                    }
                    scrollRef.current = el;
                }}
                className={styles.xScrollHide}
            >
                <div style={{ minWidth: `${minWidthPx}px` }}>
                    <Table columns={columns} data={rows} centered hideHeader />
                </div>
            </div>

            {/* ghost scroll bar */}
            <StickyBar />


            {/* фільтри */}
            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
                <CustomSelect
                    label="Статус"
                    value={filters.status}
                    onChange={handleStatusChange}
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

            {isLoading && <Preloader />}

            {isEditPopupOpen && (
                <CentralPopup title="Редагування прайслиста" onClose={closeEditPopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={editErrors}
                            name="pricelistName"
                            label={<OptionLimitLabel text="Назва" maxLength={MAX_PRICELIST_NAME_LENGTH} />}
                            placeholder="Назва прайслиста"
                            options={{
                                value: editForm.name,
                                maxLength: MAX_PRICELIST_NAME_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_PRICELIST_NAME_LENGTH);
                                    setEditForm((prev) => ({ ...prev, name: value }));
                                    clearEditError("pricelistName");
                                },
                            }}
                        />

                        <div className={styles.textareaBox}>
                            <label className={styles.textareaLabel} htmlFor="pricelistDescription">
                                <OptionLimitLabel text="Опис" maxLength={MAX_PRICELIST_DESCRIPTION_LENGTH} />
                            </label>
                            <textarea
                                id="pricelistDescription"
                                className={`${styles.textarea} ${editErrors.pricelistDescription ? styles.textareaError : ""
                                    }`}
                                placeholder="Опис прайслиста"
                                value={editForm.description}
                                onChange={(e) => {
                                    const value = e.target.value.slice(0, MAX_PRICELIST_DESCRIPTION_LENGTH);
                                    setEditForm((prev) => ({ ...prev, description: value }));
                                    clearEditError("pricelistDescription");
                                }}
                                maxLength={MAX_PRICELIST_DESCRIPTION_LENGTH}
                            />
                            {editErrors.pricelistDescription && (
                                <div className={styles.errorText}>
                                    {editErrors.pricelistDescription.message}
                                </div>
                            )}
                        </div>

                        <div>
                            <CustomCheckbox
                                name="За замовчуванням"
                                value="is_default"
                                isChecked={editForm.isDefault}
                                isLoading={false}
                                onChange={(checked) => {
                                    setEditForm((prev) => ({ ...prev, isDefault: checked }));
                                }}
                            />
                        </div>

                        <button type="button" className="btnDark" onClick={handleEditSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}

            {isCreatePopupOpen && (
                <CentralPopup title="Додавання прайслиста" onClose={closeCreatePopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={createErrors}
                            name="createName"
                            label={<OptionLimitLabel text="Назва" maxLength={MAX_PRICELIST_NAME_LENGTH} />}
                            placeholder="Назва прайслиста"
                            options={{
                                value: createForm.name,
                                maxLength: MAX_PRICELIST_NAME_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_PRICELIST_NAME_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, name: value }));
                                    clearCreateError("createName");
                                },
                            }}
                        />

                        <div className={styles.textareaBox}>
                            <label className={styles.textareaLabel} htmlFor="createDescription">
                                <OptionLimitLabel text="Опис" maxLength={MAX_PRICELIST_DESCRIPTION_LENGTH} />
                            </label>
                            <textarea
                                id="createDescription"
                                className={`${styles.textarea} ${createErrors.createDescription ? styles.textareaError : ""
                                    }`}
                                placeholder="Опис прайслиста"
                                value={createForm.description}
                                onChange={(e) => {
                                    const value = e.target.value.slice(0, MAX_PRICELIST_DESCRIPTION_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, description: value }));
                                    clearCreateError("createDescription");
                                }}
                                maxLength={MAX_PRICELIST_DESCRIPTION_LENGTH}
                            />
                            {createErrors.createDescription && (
                                <div className={styles.errorText}>
                                    {createErrors.createDescription.message}
                                </div>
                            )}
                        </div>

                        <div>
                            <CustomCheckbox
                                name="За замовчуванням"
                                value="is_default"
                                isChecked={createForm.isDefault}
                                isLoading={false}
                                onChange={(checked) => {
                                    setCreateForm((prev) => ({ ...prev, isDefault: checked }));
                                }}
                            />
                        </div>

                        <button type="button" className="btnDark" onClick={handleCreateSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
            {isDeletePopupOpen && (
                <CentralPopup
                    title={"Видалення прайслиста"}
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
                            Ви дійсно бажаєте видалити прайслист?
                        </h3>

                        <button
                            type="button"
                            className="btnDark"
                            style={{ width: "200px" }}
                            onClick={handleDeletePricelist}
                            disabled={isDeleting}
                        >
                            <span>{isDeleting ? "Видалення..." : "Видалити"}</span>
                        </button>

                        <button
                            type="button"
                            className="btnLight"
                            style={{ width: "200px" }}
                            onClick={closeDeletePopup}
                            disabled={isDeleting}
                        >
                            <span>Скасувати</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
        </div>
    );
};

export default Pricelist;
