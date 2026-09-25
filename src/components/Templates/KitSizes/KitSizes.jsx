// KitSizes.jsx
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
import { Pagination } from "@mui/material";

import TabsLinks from "../TabLinks/TabLinks.jsx";

import {
    fetchKitSizes,
    createKitSize,
    editKitSize,
    deleteKitSize,
} from "../../../api/tablesApi.js";

import { getAccessToken } from "../../../api/authStorage.js";
import { useAppDispatch } from "../../../hooks/redux.jsx";
import { setIsActivePopup } from "../../../store/main-slice.js";

import { useStickyXScroll } from "../../../hooks/useStickyXScroll.jsx";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";
import OptionLimitLabel from "../../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../../Common/LimitedCell/LimitedCell.jsx";

const MAX_NAME_LENGTH = 100;
const MAX_SHORT_NAME_LENGTH = 10;

/* helpers */
const mapApiItemToRow = (item) => ({
    id: item?.id,
    name: item?.name ?? "",
    short_name: item?.short_name ?? "",
    deleted_at: item?.deleted_at ?? null,
    raw: item,
});

const KitSizes = () => {
    const dispatch = useAppDispatch();

    const scrollRef = useRef(null);

    // ghost scroll (як у NewPrices/ComponentTemplates)
    const { mainRef, StickyBar, recalcX } = useStickyXScroll({
        offsetBottom: 0,
        trackHeight: 16,
        zIndex: 60,
    });

    const [allRows, setAllRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const [isShowFilter, setIsShowFilter] = useState(false);
    const [searchValue, setSearchValue] = useState(null);

    // filters UI
    const [filters, setFilters] = useState({
    });

    // API params
    const [filterParams, setFilterParams] = useState({
        page: 1,
        is_deleted: "false",
        name: null,
        short_name: "",
    });

    const updateRows = (updater) => setAllRows((prev) => updater(prev));

    const resetXScrollToStart = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.scrollTo({ left: 0, behavior: "auto" });
        el.dispatchEvent(new Event("scroll"));

        requestAnimationFrame(() => {
            recalcX();
        });
    }, [recalcX]);

    const fetchData = useCallback(async (params) => {
        try {
            setIsLoading(true);
            const token = getAccessToken();

            const data = await fetchKitSizes(token, {
                page: params.page,
                page_size: 10,
                is_deleted: params.is_deleted === "" ? undefined : params.is_deleted,
                name: params.name || undefined,
                short_name: params.short_name || undefined,
            });

            const list = Array.isArray(data?.kit_sizes) ? data.kit_sizes : Array.isArray(data?.results) ? data.results : [];
            const mapped = list.map(mapApiItemToRow);

            setAllRows(mapped);
            setTotalPages(Number(data?.total_pages) || Number(data?.totalPages) || 0);
        } catch (e) {
            console.error("Failed to load kit sizes:", e);
            setAllRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(filterParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        const next = { page: 1, is_deleted: "false", name: null, short_name: "" };
        setFilters({});
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
            resetXScrollToStart();
            fetchData(next);
        }
    };

    const onCloseFilter = () => setIsShowFilter(false);

    // popups
    const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", short_name: "" });
    const [createErrors, setCreateErrors] = useState({});

    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editForm, setEditForm] = useState({ name: "", short_name: "" });
    const [editErrors, setEditErrors] = useState({});
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const clearCreateError = (key) => {
        setCreateErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const clearEditError = (key) => {
        setEditErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const openCreatePopup = () => {
        setCreateForm({ name: "", short_name: "" });
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeCreatePopup = () => {
        setIsCreatePopupOpen(false);
        setCreateErrors({});
        dispatch(setIsActivePopup(false));
    };

    const openEditPopup = (row) => {
        setEditingRowId(row?.id ?? null);
        setEditForm({
            name: row?.name ?? "",
            short_name: row?.short_name ?? "",
        });
        setEditErrors({});
        setIsEditPopupOpen(true);
        setIsCreatePopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeEditPopup = () => {
        setIsEditPopupOpen(false);
        setEditingRowId(null);
        setEditErrors({});
        dispatch(setIsActivePopup(false));
    };

    const validateForm = (form, mode) => {
        const errors = {};
        const nameTrimmed = String(form.name ?? "").trim();
        const shortTrimmed = String(form.short_name ?? "").trim();

        const nameKey = mode === "create" ? "createName" : "editName";
        const shortKey = mode === "create" ? "createShort" : "editShort";

        if (!nameTrimmed) errors[nameKey] = { message: "Вкажіть назву" };
        if (nameTrimmed.length > MAX_NAME_LENGTH) {
            errors[nameKey] = { message: "Назва має бути не більше 100 символів" };
        }

        if (!shortTrimmed) errors[shortKey] = { message: "Вкажіть коротку назву" };
        if (shortTrimmed.length > MAX_SHORT_NAME_LENGTH) {
            errors[shortKey] = { message: "Коротка назва має бути не більше 10 символів" };
        }

        return errors;
    };
    const handleCreateSave = async () => {
        const errors = validateForm(createForm, "create");
        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();
            const created = await createKitSize(token, {
                name: createForm.name.trim(),
                short_name: createForm.short_name.trim(),
            });

            const newRow = mapApiItemToRow(created);
            updateRows((prev) => [newRow, ...prev]);
            closeCreatePopup();
        } catch (e) {
            console.error("Failed to create kit size:", e);
            window.alert("Не вдалося створити. Спробуй ще раз.");
        }
    };

    const handleEditSave = async () => {
        if (!editingRowId) {
            closeEditPopup();
            return;
        }

        const errors = validateForm(editForm, "edit");
        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();
            const updated = await editKitSize(token, editingRowId, {
                name: editForm.name.trim(),
                short_name: editForm.short_name.trim(),
            });

            const updatedRow = mapApiItemToRow(updated);
            updateRows((prev) => prev.map((r) => (r.id === editingRowId ? { ...r, ...updatedRow } : r)));
            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit kit size:", e);
            window.alert("Не вдалося зберегти. Спробуй ще раз.");
        }
    };

    const openDeletePopup = (row) => {
        if (!row?.id) return;

        setDeleteTarget(row);
        setIsDeletePopupOpen(true);
        dispatch(setIsActivePopup(true));
    };

    const closeDeletePopup = () => {
        setIsDeletePopupOpen(false);
        setDeleteTarget(null);
        dispatch(setIsActivePopup(false));
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget?.id) return;

        try {
            setIsDeleting(true);

            const token = getAccessToken();
            await deleteKitSize(token, deleteTarget.id);

            updateRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            closeDeletePopup();
        } catch (e) {
            console.error("Failed to delete kit size:", e);
        } finally {
            setIsDeleting(false);
        }
    };

    // колонки: зроблено “без пустоти” — fr розтягує таблицю на всю ширину
    const columns = useMemo(
        () => [
            { key: "id", title: "ID", width: "90px" },
            { key: "name", title: "Назва", width: "1.7fr", render: (_, row) => <LimitedCell value={row.name} />, },
            { key: "short_name", title: "Коротка назва", width: "1fr", render: (_, row) => <LimitedCell value={row.short_name} />, },
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    // minWidth для sticky header/ghost scroll: fr не парсимо як px — беремо адекватний мінімум
    const minWidthPx = useMemo(() => {
        const getMin = (w) => {
            if (!w) return 160;
            const s = String(w).trim();
            const px = s.match(/^(\d+)\s*px$/i);
            if (px) return Number(px[1]);
            const mm = s.match(/minmax\(\s*(\d+)\s*px/i);
            if (mm) return Number(mm[1]);
            // fr / інші — мінімум, щоб не “зламати” sticky header
            return 260;
        };

        const sum = columns.reduce((acc, col) => acc + getMin(col.width), 0);
        return sum + 50;
    }, [columns]);

    useEffect(() => {
        recalcX();
    }, [minWidthPx, allRows.length, recalcX]);

    return (
        <div className={styles.wrapper}>
            <ArrBack />
            <SearchFilter
                title="Розміри комплектів"
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
                hideFilterButton
            />

            <TabsLinks />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати розмір</span>
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

            {/* scroll container (важливо: і scrollRef, і mainRef) */}
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

            <StickyBar />

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
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

            {/* CREATE */}
            {isCreatePopupOpen && (
                <CentralPopup title="Додавання розміру" onClose={closeCreatePopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={createErrors}
                            name="createName"
                            label={<OptionLimitLabel text="Назва" />}
                            placeholder="Назва"
                            options={{
                                value: createForm.name,
                                maxLength: MAX_NAME_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_NAME_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, name: value }));
                                    clearCreateError("createName");
                                },
                            }}
                        />

                        <InputBox
                            errors={createErrors}
                            name="createShort"
                            label={<OptionLimitLabel text="Коротка назва" maxLength={MAX_SHORT_NAME_LENGTH} />}
                            placeholder="Коротка назва"
                            options={{
                                value: createForm.short_name,
                                maxLength: MAX_SHORT_NAME_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_NAME_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, short_name: value }));
                                    clearCreateError("createShort");
                                },
                            }}
                        />
                        <button type="button" className="btnDark" onClick={handleCreateSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}

            {/* EDIT */}
            {isEditPopupOpen && (
                <CentralPopup title="Редагування розміру" onClose={closeEditPopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={editErrors}
                            name="editName"
                            label={<OptionLimitLabel text="Назва" />}
                            placeholder="Назва"
                            options={{
                                value: editForm.name,
                                maxLength: MAX_NAME_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_NAME_LENGTH);
                                    setEditForm((prev) => ({ ...prev, name: value }));
                                    clearEditError("editName");
                                },
                            }}
                        />

                        <InputBox
                            errors={editErrors}
                            name="editShort"
                            label={<OptionLimitLabel text="Коротка назва" maxLength={MAX_SHORT_NAME_LENGTH} />}
                            placeholder="Коротка назва"
                            options={{
                                value: editForm.short_name,
                                maxLength: MAX_SHORT_NAME_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_NAME_LENGTH);
                                    setEditForm((prev) => ({ ...prev, short_name: value }));
                                    clearEditError("editShort");
                                },
                            }}
                        />

                        <button type="button" className="btnDark" onClick={handleEditSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
            {isDeletePopupOpen && (
                <CentralPopup
                    title="Видалення розміру"
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
                            Ви дійсно бажаєте видалити розмір?
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

export default KitSizes;
