// ComponentTypes.jsx
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
    fetchComponentTypes,
    createComponentType,
    editComponentType,
    deleteComponentType,
} from "../../../api/tablesApi.js";
import { getAccessToken } from "../../../api/authStorage.js";

import { useAppDispatch } from "../../../hooks/redux.jsx";
import { setIsActivePopup } from "../../../store/main-slice.js";
import { useObjectUrl } from "../../../hooks/useObjectUrl";

import { useStickyXScroll } from "../../../hooks/useStickyXScroll.jsx";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";
import OptionLimitLabel from "../../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../../Common/LimitedCell/LimitedCell.jsx";

/* helpers */
const mapApiTypeToRow = (item) => ({
    id: item?.id,
    name: item?.name ?? "",
    mono_fabric_type: item?.mono_fabric_type ?? "",
    image: item?.image ?? "",
    deleted_at: item?.deleted_at ?? null,
    raw: item,
});

const monoTypeOptions = [
    { name: "A", value: "A" },
    { name: "B", value: "B" },
    { name: "AB", value: "AB" },
];

const renderPhotoCell = (src) => {
    const url = (src ?? "").trim();
    if (!url) return null;

    return (
        <img
            src={url}
            alt=""
            style={{
                width: 42,
                height: 42,
                objectFit: "cover",
                borderRadius: 6,
                display: "block",
                margin: "0 auto"
            }}
        />
    );
};

const MAX_OPTION_TEXT_LENGTH = 100;

const ComponentTypes = () => {
    const dispatch = useAppDispatch();
    const scrollRef = useRef(null);

    // ghost scroll (як у Pricelist / ComponentTemplates)
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

    // UI filters (тільки статус)
    const [filters, setFilters] = useState({});

    // API params
    const [filterParams, setFilterParams] = useState({
        page: 1,
        is_deleted: "false",
        name: null,
    });

    const updateRows = (updater) => setAllRows((prev) => updater(prev));

    const fetchData = useCallback(async (params) => {
        try {
            setIsLoading(true);
            const token = getAccessToken();

            const data = await fetchComponentTypes(token, {
                page: params.page,
                page_size: 10,
                is_deleted: params.is_deleted === "" ? undefined : params.is_deleted, // default "false"
                name: params.name || undefined,
            });

            const list = Array.isArray(data?.component_types) ? data.component_types : [];
            setAllRows(list.map(mapApiTypeToRow));
            setTotalPages(Number(data?.total_pages) || 0);
        } catch (e) {
            console.error("Failed to load component types:", e);
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
        const next = { page: 1, is_deleted: "false", name: null };
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
            fetchData(next);
        }
    };

    const onCloseFilter = () => setIsShowFilter(false);

    // popups
    const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        mono_fabric_type: "A",
        imageFile: null,
    });
    const [createErrors, setCreateErrors] = useState({});

    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        mono_fabric_type: "A",
        imageFile: null,
        imageUrl: "",
    });
    const [editErrors, setEditErrors] = useState({});
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const createPreviewUrl = useObjectUrl(createForm.imageFile);
    const editPreviewUrl = useObjectUrl(editForm.imageFile);

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
        setCreateForm({ name: "", mono_fabric_type: "A", imageFile: null });
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeCreatePopup = () => {
        setIsCreatePopupOpen(false);
        setCreateForm({ name: "", mono_fabric_type: "A", imageFile: null });
        setCreateErrors({});
        dispatch(setIsActivePopup(false));
    };

    const openEditPopup = (row) => {
        setEditingRowId(row.id);
        setEditForm({
            name: row?.name ?? "",
            mono_fabric_type: row?.mono_fabric_type || "A",
            imageFile: null,
            imageUrl: row?.image ?? "",
        });
        setEditErrors({});
        setIsEditPopupOpen(true);
        setIsCreatePopupOpen(false);
        dispatch(setIsActivePopup(true));
    };

    const closeEditPopup = () => {
        setIsEditPopupOpen(false);
        setEditingRowId(null);
        setEditForm({ name: "", mono_fabric_type: "A", imageFile: null, imageUrl: "" });
        setEditErrors({});
        dispatch(setIsActivePopup(false));
    };

    const buildFormData = ({ name, mono_fabric_type, imageFile }) => {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("mono_fabric_type", mono_fabric_type);
        if (imageFile) fd.append("image", imageFile);
        return fd;
    };

    const handleCreateSave = async () => {
        const errors = {};
        const nameTrimmed = createForm.name.trim();

        if (!nameTrimmed) errors.createName = { message: "Вкажіть назву" };
        if (nameTrimmed.length > MAX_OPTION_TEXT_LENGTH) {
            errors.createName = { message: "Назва має бути не більше 100 символів" };
        }
        if (!createForm.mono_fabric_type) errors.createMono = { message: "Оберіть монотканинний тип" };

        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const fd = buildFormData({
                name: nameTrimmed,
                mono_fabric_type: createForm.mono_fabric_type,
                imageFile: createForm.imageFile,
            });

            const created = await createComponentType(token, fd);
            const newRow = mapApiTypeToRow(created);

            updateRows((prev) => [newRow, ...prev]);
            closeCreatePopup();
        } catch (e) {
            console.error("Failed to create component type:", e);
        }
    };

    const handleEditSave = async () => {
        if (!editingRowId) {
            closeEditPopup();
            return;
        }

        const errors = {};
        const nameTrimmed = editForm.name.trim();

        if (!nameTrimmed) errors.editName = { message: "Вкажіть назву" };
        if (nameTrimmed.length > MAX_OPTION_TEXT_LENGTH) {
            errors.editName = { message: "Назва має бути не більше 100 символів" };
        }
        if (!editForm.mono_fabric_type) errors.editMono = { message: "Оберіть монотканинний тип" };

        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const fd = buildFormData({
                name: nameTrimmed,
                mono_fabric_type: editForm.mono_fabric_type,
                imageFile: editForm.imageFile,
            });

            const updated = await editComponentType(token, editingRowId, fd);
            const updatedRow = mapApiTypeToRow(updated);

            updateRows((prev) => prev.map((r) => (r.id === editingRowId ? { ...r, ...updatedRow } : r)));
            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit component type:", e);
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
            await deleteComponentType(token, deleteTarget.id);

            updateRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            closeDeletePopup();
        } catch (e) {
            console.error("Failed to delete component type:", e);
        } finally {
            setIsDeleting(false);
        }
    };

    const columns = useMemo(
        () => [
            { key: "id", title: "ID", width: "60px" },
            { key: "name", title: "Назва", render: (_, row) => <LimitedCell value={row.name} />, },
            {
                key: "image",
                title: "Фото",
                width: "90px",
                render: (_, row) => renderPhotoCell(row.image),
            },
            {
                key: "mono_fabric_type",
                title: "Монотканинний тип",
                width: "190px",
                render: (_, row) => (row.mono_fabric_type?.trim() ? row.mono_fabric_type : "-"),
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allRows]
    );

    const minWidthPx = useMemo(() => {
        return columns.reduce((acc, col) => {
            const w = col.width ? parseInt(col.width, 10) || 160 : 160;
            return acc + w;
        }, 0);
    }, [columns]);

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

    /*  useEffect(() => {
        const root = document.documentElement; // <html>
        root.classList.add("stableGutter");
        return () => {
            root.classList.remove("stableGutter");
        };
    }, []);*/

    return (
        <div className={styles.wrapper}>
            <ArrBack />
            <SearchFilter
                title="Типи компонентів"
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
                hideFilterButton
            />

            <TabsLinks />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати тип компонентів</span>
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
                <CentralPopup title="Додавання типу компонентів" onClose={closeCreatePopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={createErrors}
                            name="createName"
                            label={<OptionLimitLabel text="Назва" />}
                            placeholder="Назва типу"
                            options={{
                                value: createForm.name,
                                maxLength: MAX_OPTION_TEXT_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_OPTION_TEXT_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, name: value }));
                                    clearCreateError("createName");
                                },
                            }}
                        />

                        <div>
                            <CustomSelect
                                label="Монотканинний тип"
                                value={createForm.mono_fabric_type}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setCreateForm((prev) => ({ ...prev, mono_fabric_type: value }));
                                    clearCreateError("createMono");
                                }}
                                options={monoTypeOptions}
                            />
                            {createErrors.createMono && (
                                <div className={styles.errorText}>{createErrors.createMono.message}</div>
                            )}
                        </div>

                        <div>
                            <label className={styles.textareaLabel} style={{ display: "block", marginBottom: 6 }}>
                                Фото
                            </label>

                            {createPreviewUrl ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <img
                                        src={createPreviewUrl}
                                        alt=""
                                        style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8 }}
                                    />
                                    <span style={{ fontStyle: "italic" }}>Обране фото</span>
                                </div>
                            ) : null}

                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    setCreateForm((prev) => ({ ...prev, imageFile: file }));
                                }}
                            />
                        </div>


                        <button type="button" className="btnDark" onClick={handleCreateSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}

            {/* EDIT */}
            {isEditPopupOpen && (
                <CentralPopup title="Редагування типу компонентів" onClose={closeEditPopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={editErrors}
                            name="editName"
                            label={<OptionLimitLabel text="Назва" />}
                            placeholder="Назва типу"
                            options={{
                                value: editForm.name,
                                maxLength: MAX_OPTION_TEXT_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_OPTION_TEXT_LENGTH);
                                    setEditForm((prev) => ({ ...prev, name: value }));
                                    clearEditError("editName");
                                },
                            }}
                        />

                        <div>
                            <CustomSelect
                                label="Монотканинний тип"
                                value={editForm.mono_fabric_type}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setEditForm((prev) => ({ ...prev, mono_fabric_type: value }));
                                    clearEditError("editMono");
                                }}
                                options={monoTypeOptions}
                            />
                            {editErrors.editMono && <div className={styles.errorText}>{editErrors.editMono.message}</div>}
                        </div>

                        <div>
                            <label className={styles.textareaLabel} style={{ display: "block", marginBottom: 6 }}>
                                Фото
                            </label>

                            {editPreviewUrl ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <img
                                        src={editPreviewUrl}
                                        alt=""
                                        style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8 }}
                                    />
                                    <span style={{ fontStyle: "italic" }}>Обране фото (ще не збережено)</span>
                                </div>
                            ) : editForm.imageUrl?.trim() ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <img
                                        src={editForm.imageUrl}
                                        alt=""
                                        style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8 }}
                                    />
                                    <span style={{ fontStyle: "italic" }}>Поточне фото</span>
                                </div>
                            ) : null}

                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    setEditForm((prev) => ({ ...prev, imageFile: file }));
                                }}
                            />
                        </div>

                        <button type="button" className="btnDark" onClick={handleEditSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
            {isDeletePopupOpen && (
                <CentralPopup
                    title="Видалення типу компонентів"
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
                            Ви дійсно бажаєте видалити тип компонентів?
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

export default ComponentTypes;
