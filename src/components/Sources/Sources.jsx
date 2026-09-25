import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import styles from "../Pricelist/Pricelist.module.scss";

import Table from "../Common/Table/Table.jsx";
import TableFixedHeader from "../Common/Table/TableFixedHeader.jsx";
import CentralPopup from "../Common/CentralPopup/CentralPopup.jsx";
import InputBox from "../Common/InputBox/InputBox.jsx";

import SearchFilter from "../Common/SearchFilter/SearchFilter";
import Filter from "../Common/Filter/Filter";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import CustomSelect from "../Common/CustomSelect/CustomSelect";

import { useStickyXScroll } from "../../hooks/useStickyXScroll.jsx";

import Preloader from "../Common/Preloader/Preloader.jsx";
import { Pagination } from "@mui/material";

import {
    fetchSources,
    createSource,
    editSource,
    deleteSource,
    fetchPricelists,
} from "../../api/tablesApi.js";
import { getAccessToken } from "../../api/authStorage.js";

import { useAppDispatch } from "../../hooks/redux.jsx";
import { setIsActivePopup } from "../../store/main-slice.js";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";
import OptionLimitLabel from "../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../Common/LimitedCell/LimitedCell.jsx";

/*helpers*/

const mapApiSourceToRow = (item) => {
    const pricesList = item.prices_list || null;
    const activePricesList = pricesList?.deleted_at == null ? pricesList : null;

    return {
        id: item.id,
        name: item.name ?? "",
        pricesListId: activePricesList?.id ?? null,
        pricesListTitle: activePricesList?.title ?? activePricesList?.name ?? "",
        raw: item,
    };
};

const MAX_SOURCE_NAME_LENGTH = 50;

const Sources = () => {
    const dispatch = useAppDispatch();
    const scrollRef = useRef(null);

    // ghost scroll (як у ComponentTemplates / Pricelist)
    const { mainRef, StickyBar, recalcX } = useStickyXScroll({
        offsetBottom: 0,
        trackHeight: 16,
        zIndex: 60,
    });

    /*  useEffect(() => {
          const root = document.documentElement; // <html>
          root.classList.add("stableGutter");
          return () => {
              root.classList.remove("stableGutter");
          };
      }, []);*/

    const resetXScrollToStart = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.scrollTo({ left: 0, behavior: "auto" });
        el.dispatchEvent(new Event("scroll"));

        requestAnimationFrame(() => {
            recalcX();
        });
    }, [recalcX]);

    const [allRows, setAllRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const [isShowFilter, setIsShowFilter] = useState(false);
    const [searchValue, setSearchValue] = useState(null);
    const [filterParams, setFilterParams] = useState({
        page: 1,
        is_deleted: "",
        name: null,
    });

    const [pricelistOptions, setPricelistOptions] = useState([]);
    const [isPricelistsLoading, setIsPricelistsLoading] = useState(false);
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [deletingRowId, setDeletingRowId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteWarningText, setDeleteWarningText] = useState("");

    const loadAllPricelists = async () => {
        try {
            setIsPricelistsLoading(true);
            const token = getAccessToken();

            let currentPage = 1;
            let pagesTotal = 1;
            const acc = [];

            while (currentPage <= pagesTotal) {
                // тягнемо всі сторінки
                const data = await fetchPricelists(token, { page: currentPage });
                const lists = data?.prices_lists ?? data?.pricesLists ?? [];
                pagesTotal = data?.total_pages ?? data?.totalPages ?? 1;

                acc.push(
                    ...lists.map((pl) => ({
                        value: pl.id,
                        name: pl.title ?? pl.name ?? "",
                    }))
                );

                currentPage += 1;
            }

            setPricelistOptions(acc);
        } catch (e) {
            console.error("Failed to load pricelists for select:", e);
            setPricelistOptions([]);
        } finally {
            setIsPricelistsLoading(false);
        }
    };

    const fetchData = async (params) => {
        try {
            setIsLoading(true);
            const token = getAccessToken();

            const data = await fetchSources(token, {
                page: params.page,
                is_deleted: params.is_deleted === "" ? undefined : params.is_deleted,
                name: params.name || undefined,
            });

            const apiRows = (data?.sources ?? []).map(mapApiSourceToRow);
            setAllRows(apiRows);
            setTotalPages(data?.total_pages ?? 0);
        } catch (e) {
            console.error("Failed to load sources:", e);
            setAllRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData(filterParams);
        loadAllPricelists();
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
        onSendFilters({ ...filterParams, name: searchValue?.trim() || null });
    };


    const resetAllFilters = () => {
        const next = { page: 1, is_deleted: "", name: null };
        setFilterParams(next);
        setSearchValue(null);
        setPage(1);
        fetchData(next);
    };


    const handlePaginationChange = (event, value) => {
        if (page !== value) {
            setPage(value);
            const next = { ...filterParams, page: value };
            setFilterParams(next);
            window.scrollTo({ top: 0, behavior: "auto" });
            fetchData(next);
        }
    };

    const onCloseFilter = () => setIsShowFilter(false);

    const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        pricesListId: "",
    });
    const [createErrors, setCreateErrors] = useState({});

    const openCreatePopup = () => {
        setCreateForm({ name: "", pricesListId: "" });
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeCreatePopup = () => {
        setIsCreatePopupOpen(false);
        setCreateForm({ name: "", pricesListId: "" });
        setCreateErrors({});
        dispatch(setIsActivePopup(false));
    };

    const clearCreateError = (key) => {
        setCreateErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const resolvePricesListObject = (pricesListValue) => {
        if (!pricesListValue) return null;

        if (typeof pricesListValue === "object") return pricesListValue;

        const opt = pricelistOptions.find(
            (o) => String(o.value) === String(pricesListValue)
        );

        return opt
            ? { id: pricesListValue, title: opt.name }
            : { id: pricesListValue, title: "" };
    };

    const handleCreateSave = async () => {
        const errors = {};
        const nameTrimmed = createForm.name.trim();
        const plId = createForm.pricesListId;

        if (!nameTrimmed) errors.createName = { message: "Вкажіть назву джерела" };

        if (nameTrimmed.length > MAX_SOURCE_NAME_LENGTH) {
            errors.createName = { message: "Назва має бути не більше 50 символів" };
        }

        if (!plId) errors.createPricesList = { message: "Оберіть прайслист" };
        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();
            const payload = {
                name: nameTrimmed,
                prices_list: plId,
            };

            const created = await createSource(token, payload);

            const normalizedCreated = created
                ? {
                    ...created,
                    prices_list: resolvePricesListObject(
                        created.prices_list ?? created.pricesList ?? plId
                    ),
                }
                : {
                    id: Date.now(),
                    name: nameTrimmed,
                    prices_list: resolvePricesListObject(plId),
                };

            const newRow = mapApiSourceToRow(normalizedCreated);

            updateRows((prev) => [newRow, ...prev]);
            closeCreatePopup();
        } catch (e) {
            console.error("Failed to create source:", e);
        }
    };

    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        pricesListId: "",
    });
    const [editErrors, setEditErrors] = useState({});

    const openEditPopup = (row) => {
        setEditingRowId(row.id);
        setEditForm({
            name: row.name || "",
            pricesListId: row.pricesListId ?? "",
        });
        setEditErrors({});
        setIsEditPopupOpen(true);
        setIsCreatePopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeEditPopup = () => {
        setIsEditPopupOpen(false);
        setEditingRowId(null);
        setEditForm({ name: "", pricesListId: "" });
        setEditErrors({});
        dispatch(setIsActivePopup(false));
    };

    const clearEditError = (key) => {
        setEditErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleEditSave = async () => {
        if (!editingRowId) {
            closeEditPopup();
            return;
        }

        const errors = {};
        const nameTrimmed = editForm.name.trim();
        const plId = editForm.pricesListId;

        if (!nameTrimmed) errors.editName = { message: "Вкажіть назву джерела" };

        if (nameTrimmed.length > MAX_SOURCE_NAME_LENGTH) {
            errors.editName = { message: "Назва має бути не більше 50 символів" };
        }

        if (!plId) errors.editPricesList = { message: "Оберіть прайслист" };
        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();
            const payload = {
                name: nameTrimmed,
                prices_list: plId,
            };

            const updated = await editSource(token, editingRowId, payload);
            const updatedRow = mapApiSourceToRow(updated);

            updateRows((prev) =>
                prev.map((r) => (r.id === editingRowId ? { ...r, ...updatedRow } : r))
            );

            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit source:", e);
        }
    };

    const formatDeleteWarningText = (text) => {
        if (!text) return "";

        return String(text)
            .replace(/\\n/g, "\n")
            .trim();
    };

    const openDeletePopup = (row) => {
        if (!row?.id) return;

        setDeletingRowId(row.id);
        setDeleteWarningText("");
        setIsDeletePopupOpen(true);
        dispatch(setIsActivePopup(true));
    };

    const closeDeletePopup = () => {
        setIsDeletePopupOpen(false);
        setDeletingRowId(null);
        setDeleteWarningText("");
        dispatch(setIsActivePopup(false));
    };

    const handleConfirmDelete = async () => {
        if (!deletingRowId) return;

        try {
            setIsDeleting(true);
            const token = getAccessToken();

            await deleteSource(token, deletingRowId, {
                ignoreWarning: Boolean(deleteWarningText),
            });

            updateRows((prev) => prev.filter((r) => r.id !== deletingRowId));
            setIsDeletePopupOpen(false);
            setDeletingRowId(null);
            setDeleteWarningText("");
            dispatch(setIsActivePopup(false));
        } catch (e) {
            if (
                e?.status === 400 &&
                e?.data?.error &&
                String(e.data.error).includes("Ви дійсно хочете")
            ) {
                setDeleteWarningText(formatDeleteWarningText(e.data.error));
                return;
            }

            console.error("Failed to delete source:", e);
        } finally {
            setIsDeleting(false);
        }
    };

    const columns = useMemo(
        () => [
            { key: "id", title: "ID", width: "60px" },
            {
                key: "name",
                title: "Назва",
                render: (_, row) => <LimitedCell value={row.name} />,
            },
            {
                key: "pricesListTitle",
                title: "Прайслист",
                render: (_, row) => <LimitedCell value={row.pricesListTitle || "—"} />,
            },
            {
                key: "actions",
                title: "",
                width: "160px",
                render: (_, row) => (
                    <div className={styles.actionsCell}>
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
                ),
            },
        ],
        [rows]
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
                title="Джерела"
                hideFilterButton
            />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати джерело</span>
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
                <CentralPopup title="Додавання джерела" onClose={closeCreatePopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={createErrors}
                            name="createName"
                            label={<OptionLimitLabel text="Назва" maxLength={MAX_SOURCE_NAME_LENGTH} />}
                            placeholder="Назва джерела"
                            options={{
                                value: createForm.name,
                                maxLength: MAX_SOURCE_NAME_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SOURCE_NAME_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, name: value }));
                                    clearCreateError("createName");
                                },
                            }}
                        />

                        <div>
                            <CustomSelect
                                label="Прайслист"
                                value={createForm.pricesListId}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setCreateForm((prev) => ({ ...prev, pricesListId: value }));
                                    clearCreateError("createPricesList");
                                }}
                                options={pricelistOptions}
                            />
                            {createErrors.createPricesList && (
                                <div className={styles.errorText}>
                                    {createErrors.createPricesList.message}
                                </div>
                            )}
                            {isPricelistsLoading && (
                                <div className={styles.helperText}>Завантаження прайслистів…</div>
                            )}
                        </div>

                        <button type="button" className="btnDark" onClick={handleCreateSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}

            {isEditPopupOpen && (
                <CentralPopup title="Редагування джерела" onClose={closeEditPopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={editErrors}
                            name="editName"
                            label={<OptionLimitLabel text="Назва" maxLength={MAX_SOURCE_NAME_LENGTH} />}
                            placeholder="Назва джерела"
                            options={{
                                value: editForm.name,
                                maxLength: MAX_SOURCE_NAME_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SOURCE_NAME_LENGTH);
                                    setEditForm((prev) => ({ ...prev, name: value }));
                                    clearEditError("editName");
                                },
                            }}
                        />
                        <div>
                            <CustomSelect
                                label="Прайслист"
                                value={editForm.pricesListId}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setEditForm((prev) => ({ ...prev, pricesListId: value }));
                                    clearEditError("editPricesList");
                                }}
                                options={pricelistOptions}
                            />
                            {editErrors.editPricesList && (
                                <div className={styles.errorText}>
                                    {editErrors.editPricesList.message}
                                </div>
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
                    title={deleteWarningText ? "Джерело використовується" : "Видалення джерела"}
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
                        <h3
                            style={{
                                paddingBottom: 0,
                                whiteSpace: "pre-line",
                                lineHeight: "1.4",
                            }}
                        >
                            {deleteWarningText || "Ви дійсно бажаєте видалити джерело?"}
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

export default Sources;
