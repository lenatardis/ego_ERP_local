// OptionParts.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../../Pricelist/Pricelist.module.scss";

import Table from "../../Common/Table/Table.jsx";
import TableFixedHeader from "../../Common/Table/TableFixedHeader.jsx";
import CentralPopup from "../../Common/CentralPopup/CentralPopup.jsx";
import InputBox from "../../Common/InputBox/InputBox.jsx";

import SearchFilter from "../../Common/SearchFilter/SearchFilter";
import Filter from "../../Common/Filter/Filter";
import PopupCloser from "../../Common/PopupCloser/PopupCloser";
import CustomSelect from "../../Common/CustomSelect/CustomSelect";

import Preloader from "../../Common/Preloader/Preloader.jsx";
import { Pagination} from "@mui/material";
import OptionLimitLabel from "../../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../../Common/LimitedCell/LimitedCell.jsx";
import TabsLinks from "../TabLinks/TabLinks.jsx";

import {
    fetchOptionParts,
    createOptionPart,
    editOptionPart,
    deleteOptionPart,
} from "../../../api/tablesApi.js";
import { getAccessToken } from "../../../api/authStorage.js";

import { useAppDispatch } from "../../../hooks/redux.jsx";
import { setIsActivePopup } from "../../../store/main-slice.js";

import { useStickyXScroll } from "../../../hooks/useStickyXScroll.jsx";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";

/* helpers */
const typeLabel = (t) => {
    if (t === "component") return "Компонент";
    if (t === "kit") return "Комплект";
    return "—";
};

const OPTION_PART_NAME_MAX_LENGTH = 100;


const mapApiOptionPartToRow = (item) => ({
    id: item?.id,
    name: item?.name ?? "",
    type: item?.type ?? "",
    raw: item,
});

const uniqBy = (arr, keyFn) => {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
        const k = keyFn(x);
        if (k == null) continue;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(x);
    }
    return out;
};

const normalizeTotalPages = (data) =>
    data?.total_pages ?? data?.totalPages ?? data?.totalPagesCount ?? data?.pages ?? 0;

const normalizeItems = (data) => data?.option_parts ?? data?.optionParts ?? data?.results ?? [];

const OptionParts = () => {
    const dispatch = useAppDispatch();
    const scrollRef = useRef(null);

    const { mainRef, StickyBar, recalcX } = useStickyXScroll({
        offsetBottom: 0,
        trackHeight: 16,
        zIndex: 60,
    });

    const [allRows, setAllRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // UI pagination for merged list (kit+component)
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // search + filters
    const [isShowFilter, setIsShowFilter] = useState(false);
    const [searchValue, setSearchValue] = useState(null);

    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [deletingRow, setDeletingRow] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // дефолт: Активні
    const [filters, setFilters] = useState({
        type: "", // "", "component", "kit"
    });

    const [filterParams, setFilterParams] = useState({
        page: 1,
        is_deleted: "false",
        name: null,
        type: "",
    });

    const typeOptions = [
        { name: "Усі типи", value: "" },
        { name: "Компонент", value: "component" },
        { name: "Комплект", value: "kit" },
    ];

    const formTypeOptions = useMemo(
        () => [
            { name: "Оберіть тип", value: "" },
            { name: "Компонент", value: "component" },
            { name: "Комплект", value: "kit" },
        ],
        []
    );

  /*  useEffect(() => {
        const root = document.documentElement; // <html>
        root.classList.add("stableGutter");
        return () => {
            root.classList.remove("stableGutter");
        };
    }, []);*/


    const fetchData = useCallback(async (params) => {
        try {
            setIsLoading(true);

            const token = getAccessToken();

            const common = {
                page: params.page,
                name: params.name || undefined,
                is_deleted: params.is_deleted === "" ? undefined : params.is_deleted, // у нас "" не використовується, але лишаємо на майбутнє
            };

            // один тип
            if (params.type) {
                const data = await fetchOptionParts(token, { ...common, type: params.type });
                const list = normalizeItems(data);
                setAllRows(list.map(mapApiOptionPartToRow));
                setTotalPages(Math.max(1, normalizeTotalPages(data) || 1));
                return;
            }

            // два типи
            const [dataComponent, dataKit] = await Promise.all([
                fetchOptionParts(token, { ...common, type: "component" }),
                fetchOptionParts(token, { ...common, type: "kit" }),
            ]);

            const listComponent = normalizeItems(dataComponent).map(mapApiOptionPartToRow);
            const listKit = normalizeItems(dataKit).map(mapApiOptionPartToRow);

            const merged = uniqBy([...listComponent, ...listKit], (x) => `${x.type}-${x.id}`);
            setAllRows(merged);

            const tpC = normalizeTotalPages(dataComponent) || 1;
            const tpK = normalizeTotalPages(dataKit) || 1;
            setTotalPages(Math.max(1, Math.max(tpC, tpK)));
        } catch (e) {
            console.error("Failed to load option parts:", e);
            setAllRows([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(filterParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateRows = useCallback((updater) => setAllRows((prev) => updater(prev)), []);

    const onSendFilters = useCallback(
        (newParams) => {
            const next = { ...newParams, page: 1 };
            setFilterParams(next);
            setPage(1);
            fetchData(next);
        },
        [fetchData]
    );

    const handleSearch = useCallback(() => {
        onSendFilters({ ...filterParams, name: searchValue?.trim() || null });
    }, [filterParams, searchValue, onSendFilters]);


    const handleTypeChange = useCallback(
        (event) => {
            const value = event.target.value; // "" | "component" | "kit"
            setFilters((prev) => ({ ...prev, type: value }));
            onSendFilters({ ...filterParams, type: value });
        },
        [filterParams, onSendFilters]
    );

    const resetAllFilters = useCallback(() => {
        const next = { page: 1, is_deleted: "false", name: null, type: "" };
        setFilters({ type: "" });
        setFilterParams(next);
        setSearchValue("");
        setPage(1);
        fetchData(next);
    }, [fetchData]);

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

    const onCloseFilter = useCallback(() => setIsShowFilter(false), []);

    /* create popup */
    const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", type: "" });
    const [createErrors, setCreateErrors] = useState({});

    const openCreatePopup = useCallback(() => {
        setCreateForm({ name: "", type: "" });
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);
        dispatch(setIsActivePopup(true));
    }, [dispatch]);

    const closeCreatePopup = useCallback(() => {
        setIsCreatePopupOpen(false);
        setCreateForm({ name: "", type: "" });
        setCreateErrors({});
        dispatch(setIsActivePopup(false));
    }, [dispatch]);

    const clearCreateError = useCallback((key) => {
        setCreateErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const handleCreateSave = useCallback(async () => {
        const errors = {};
        const nameTrimmed = createForm.name.trim();
        const typeValue = createForm.type;

        if (!nameTrimmed) errors.createName = { message: "Вкажіть назву" };
        if (nameTrimmed.length > OPTION_PART_NAME_MAX_LENGTH) {
            errors.createName = { message: "Назва має бути не більше 100 символів" };
}
        if (!typeValue) errors.createType = { message: "Оберіть тип" };

        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();
            const payload = { name: nameTrimmed, type: typeValue };

            const created = await createOptionPart(token, payload);
            const newRow = mapApiOptionPartToRow(created);

            updateRows((prev) => [newRow, ...prev]);
            closeCreatePopup();

            // щоб синхронізувати пагінацію/мердж у режимі type=""
            fetchData(filterParams);
        } catch (e) {
            console.error("Failed to create option part:", e);
            window.alert("Не вдалося створити частину опції. Спробуй ще раз.");
        }
    }, [createForm, updateRows, closeCreatePopup, fetchData, filterParams]);

    /* edit popup */
    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);

    // ВАЖЛИВО: id може повторюватись між типами → зберігаємо ще originalType
    const [editingRowId, setEditingRowId] = useState(null);
    const [editingRowOriginalType, setEditingRowOriginalType] = useState("");

    const [editForm, setEditForm] = useState({ name: "", type: "" });
    const [editErrors, setEditErrors] = useState({});

    const openEditPopup = useCallback(
        (row) => {
            setEditingRowId(row.id);
            setEditingRowOriginalType(row.type || row?.raw?.type || "");
            setEditForm({ name: row.name || "", type: row.type || "" });
            setEditErrors({});
            setIsEditPopupOpen(true);
            setIsCreatePopupOpen(false);
            dispatch(setIsActivePopup(true));
        },
        [dispatch]
    );

    const closeEditPopup = useCallback(() => {
        setIsEditPopupOpen(false);
        setEditingRowId(null);
        setEditingRowOriginalType("");
        setEditForm({ name: "", type: "" });
        setEditErrors({});
        dispatch(setIsActivePopup(false));
    }, [dispatch]);

    const clearEditError = useCallback((key) => {
        setEditErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const handleEditSave = useCallback(async () => {
        if (!editingRowId) {
            closeEditPopup();
            return;
        }

        const errors = {};
        const nameTrimmed = editForm.name.trim();
        const nextType = editForm.type;

        if (!nameTrimmed) errors.editName = { message: "Вкажіть назву" };
        if (nameTrimmed.length > OPTION_PART_NAME_MAX_LENGTH) {
            errors.editName = { message: "Назва має бути не більше 100 символів" };
        }
        if (!nextType) errors.editType = { message: "Оберіть тип" };

        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        const prevType = editingRowOriginalType;

        try {
            const token = getAccessToken();

            // 1) якщо тип НЕ змінювався → звичайний PATCH
            if (prevType === nextType) {
                const payload = { name: nameTrimmed, type: nextType };
                const updated = await editOptionPart(token, editingRowId, payload);
                const updatedRow = mapApiOptionPartToRow(updated);

                updateRows((prev) =>
                    prev.map((r) =>
                        r.id === editingRowId && r.type === prevType ? { ...r, ...updatedRow } : r
                    )
                );

                closeEditPopup();
                return;
            }

            // 2) якщо тип ЗМІНИВСЯ:
            //    - НЕ робимо PATCH, бо може утворитись дубль (id+type)
            //    - робимо DELETE старого (id+prevType)
            //    - робимо CREATE нового з тим самим id, але іншим type
            //
            //    УВАГА: якщо на бекові вже існує запис з (id + nextType),
            //    create може впасти (або навпаки створити дубль, якщо бек дозволяє).
            //    Я НЕ видаляю “чужий” запис автоматично, щоб не втратити дані.

            await deleteOptionPart(token, editingRowId, prevType);

            const created = await createOptionPart(token, {
                id: editingRowId, // якщо бек дозволяє фіксувати id
                name: nameTrimmed,
                type: nextType,
            });

            const createdRow = mapApiOptionPartToRow(created);

            updateRows((prev) => {
                // прибираємо старий (id+prevType)
                const withoutOld = prev.filter((r) => !(r.id === editingRowId && r.type === prevType));

                // страховка: якщо в локальному списку вже є (id+nextType), не додаємо дубль
                const existsTarget = withoutOld.some(
                    (r) => r.id === editingRowId && r.type === nextType
                );

                if (existsTarget) return withoutOld;

                return [createdRow, ...withoutOld];
            });

            closeEditPopup();

            // синхронізуємо з беком (особливо важливо при type="" і мерджі двох запитів)
            fetchData(filterParams);
        } catch (e) {
            console.error("Failed to save option part:", e);
            window.alert("Не вдалося зберегти зміни. Спробуй ще раз.");

            // якщо delete пройшов, а create впав — краще оновити список, щоб не було “половинчастого” стану
            fetchData(filterParams);
        }
    }, [
        editingRowId,
        editingRowOriginalType,
        editForm,
        closeEditPopup,
        updateRows,
        fetchData,
        filterParams,
    ]);

    const openDeletePopup = useCallback(
        (row) => {
            if (!row?.id) return;

            const rowType = row?.type || row?.raw?.type;
            if (!rowType) return;

            setDeletingRow({ id: row.id, type: rowType });
            setIsDeletePopupOpen(true);
            dispatch(setIsActivePopup(true));
        },
        [dispatch]
    );

    const closeDeletePopup = useCallback(() => {
        setIsDeletePopupOpen(false);
        setDeletingRow(null);
        dispatch(setIsActivePopup(false));
    }, [dispatch]);

    const handleConfirmDelete = useCallback(async () => {
        if (!deletingRow?.id || !deletingRow?.type) return;

        try {
            setIsDeleting(true);

            const token = getAccessToken();
            const deleted = await deleteOptionPart(token, deletingRow.id, deletingRow.type);

            if (deleted) {
                updateRows((prev) =>
                    prev.filter((r) => !(r.id === deletingRow.id && r.type === deletingRow.type))
                );
                closeDeletePopup();
                return;
            }

            console.error("Failed to delete option part: empty delete response");
        } catch (e) {
            console.error("Failed to delete option part:", e);
        } finally {
            setIsDeleting(false);
        }
    }, [deletingRow, updateRows, closeDeletePopup]);

    const columns = useMemo(
        () => [
            { key: "id", title: "ID", width: "60px" },
            { key: "name", title: "Назва", render: (_, row) => <LimitedCell value={row.name} /> },
            {
                key: "type",
                title: "Тип",
                width: "180px",
                render: (_, row) => typeLabel(row.type),
            },
            {
                key: "actions",
                title: "",
                width: "160px",
                render: (_, row) => (
                    <div className={styles.actionsCell}>
                        <button type="button" className="btnDark" onClick={() => openEditPopup(row)}>
                            <span>Редагувати</span>
                        </button>
                        <button type="button" className="btnDark" onClick={() => openDeletePopup(row)}>
                            <span>Видалити</span>
                        </button>
                    </div>
                ),
            },
        ],
        [openEditPopup, openDeletePopup]
    );

    const minWidthPx = useMemo(
        () =>
            columns.reduce((acc, col) => {
                const w = col.width ? parseInt(col.width, 10) || 160 : 160;
                return acc + w;
            }, 0),
        [columns]
    );

    const resetXScrollToStart = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.scrollTo({ left: 0, behavior: "auto" });
        el.dispatchEvent(new Event("scroll"));

        requestAnimationFrame(() => {
            recalcX();
        });
    }, [recalcX]);

    useEffect(() => {
        recalcX();
    }, [minWidthPx, allRows.length, recalcX]);


    return (
        <div className={styles.wrapper}>
            <ArrBack/>
            <SearchFilter
                title="Частини опцій"
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
            />

            <TabsLinks />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати частину опції</span>
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
                    <Table columns={columns} data={allRows} centered hideHeader />
                </div>
            </div>

            {/* ghost scroll bar */}
            <StickyBar />

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
                <CustomSelect
                    label="Тип"
                    value={filters.type}
                    onChange={handleTypeChange}
                    options={typeOptions}
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

            {isCreatePopupOpen && (
                <CentralPopup title="Додавання частини опції" onClose={closeCreatePopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={createErrors}
                            name="createName"
                            label={<OptionLimitLabel text="Назва" />}
                            placeholder="Назва"
                            options={{
                                value: createForm.name,
                                maxLength: OPTION_PART_NAME_MAX_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, OPTION_PART_NAME_MAX_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, name: value }));
                                    clearCreateError("createName");
                                },
                            }}
                        />

                        <div>
                            <CustomSelect
                                label="Тип"
                                value={createForm.type}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setCreateForm((prev) => ({ ...prev, type: value }));
                                    clearCreateError("createType");
                                }}
                                options={formTypeOptions}
                            />
                            {createErrors.createType && (
                                <div className={styles.errorText}>{createErrors.createType.message}</div>
                            )}
                        </div>

                        <button type="button" className="btnDark" onClick={handleCreateSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}

            {isEditPopupOpen && (
                <CentralPopup title="Редагування частини опції" onClose={closeEditPopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={editErrors}
                            name="editName"
                            label={<OptionLimitLabel text="Назва" />}
                            placeholder="Назва"
                            options={{
                                value: editForm.name,
                                maxLength: OPTION_PART_NAME_MAX_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, OPTION_PART_NAME_MAX_LENGTH);
                                    setEditForm((prev) => ({ ...prev, name: value }));
                                    clearEditError("editName");
                                },
                            }}
                        />

                        <div>
                            <CustomSelect
                                label="Тип"
                                value={editForm.type}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setEditForm((prev) => ({ ...prev, type: value }));
                                    clearEditError("editType");
                                }}
                                options={formTypeOptions}
                            />
                            {editErrors.editType && (
                                <div className={styles.errorText}>{editErrors.editType.message}</div>
                            )}
                        </div>

                        <button type="button" className="btnDark" onClick={handleEditSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
            {isDeletePopupOpen && (
                <CentralPopup
                    title={"Видалення частини опції"}
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
                            Ви дійсно бажаєте видалити частину опції?
                        </h3>

                        <button
                            type="button"
                            className="btnDark"
                            style={{ width: "200px" }}
                            onClick={handleConfirmDelete}
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

export default OptionParts;
