// KitOptions.jsx (KitOptionTemplates)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../../../Pricelist/Pricelist.module.scss";

import Table from "../../../Common/Table/Table.jsx";
import TableFixedHeader from "../../../Common/Table/TableFixedHeader.jsx";
import CentralPopup from "../../../Common/CentralPopup/CentralPopup.jsx";
import InputBox from "../../../Common/InputBox/InputBox.jsx";

import SearchFilter from "../../../Common/SearchFilter/SearchFilter";
import Filter from "../../../Common/Filter/Filter";
import PopupCloser from "../../../Common/PopupCloser/PopupCloser";
import CustomSelect from "../../../Common/CustomSelect/CustomSelect";

import Preloader from "../../../Common/Preloader/Preloader.jsx";
import { Pagination } from "@mui/material";

import CustomCheckbox from "../../../Common/CustomCheckbox/CustomCheckbox.jsx";
import OptionLimitLabel from "../../../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../../../Common/LimitedCell/LimitedCell.jsx";

import TabsLinks from "../../TabLinks/TabLinks.jsx";
import OptionsInnerTabs from "../../TabLinks/OptionInnerTabs.jsx";

import {
    fetchKitOptionTemplates,
    createKitOptionTemplate,
    editKitOptionTemplate,
    deleteKitOptionTemplate,
    fetchOptionParts,
} from "../../../../api/tablesApi.js";

import { getAccessToken } from "../../../../api/authStorage.js";
import { useAppDispatch } from "../../../../hooks/redux.jsx";
import { setIsActivePopup } from "../../../../store/main-slice.js";
import { useStickyXScroll } from "../../../../hooks/useStickyXScroll.jsx";
import ArrBack from "../../../Common/ArrBack/ArrBack.jsx";


/* helpers */
const mapApiTemplateToRow = (item) => {
    const partsArrRaw = Array.isArray(item?.part) ? item.part : [];
    const partsArr = partsArrRaw.filter((p) => !p?.deleted_at);

    const partsLabel =
        partsArr.length > 0
            ? partsArr.map((p) => p?.name).filter(Boolean).join(", ")
            : "-";

    return {
        id: item?.id,
        name: item?.name ?? "",
        description: item?.description ?? "",
        image: item?.image ?? "",
        partIds: partsArr.map((p) => p?.id).filter((x) => x != null),
        partsLabel,
        raw: item,
    };
};

const MAX_OPTION_TEXT_LENGTH = 100;

const KitOptionTemplates = () => {
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
    const [filters, setFilters] = useState({});

    const [filterParams, setFilterParams] = useState({
        page: 1,
        is_deleted: "false",
        name: null,
    });

    const updateRows = (updater) => setAllRows((prev) => updater(prev));

    // checkboxes: option parts (type='kit'), only active (is_deleted=false)
    const [optionParts, setOptionParts] = useState([]);
    const [isPartsLoading, setIsPartsLoading] = useState(false);

    const [partsPage, setPartsPage] = useState(1);
    const [partsTotalPages, setPartsTotalPages] = useState(1);
    const [partsNameById, setPartsNameById] = useState({});

    const partsScrollRef = useRef(null);
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchOptionPartsPage = useCallback(async (pageToLoad = 1) => {
        try {
            setIsPartsLoading(true);
            const token = getAccessToken();

            const data = await fetchOptionParts(token, {
                page: pageToLoad,
                type: "kit",            // <-- стрінга
                is_deleted: "false",     // <-- тільки активні
            });

            const list = Array.isArray(data?.option_parts) ? data.option_parts : [];
            const total = Number(data?.total_pages) || 1;

            setOptionParts(
                list.map((p) => ({
                    id: p.id,
                    name: p.name ?? "",
                    type: p.type ?? "kit",
                }))
            );

            setPartsTotalPages(total);

            setPartsNameById((prev) => {
                const next = { ...prev };
                for (const p of list) next[p.id] = p.name ?? "";
                return next;
            });
        } catch (e) {
            console.error("Failed to load option parts page:", e);
            setOptionParts([]);
            setPartsTotalPages(1);
        } finally {
            setIsPartsLoading(false);
        }
    }, []);

    const fetchData = async (params) => {
        try {
            setIsLoading(true);
            const token = getAccessToken();

            const data = await fetchKitOptionTemplates(token, {
                page: params.page,
                is_deleted: params.is_deleted === "" ? undefined : params.is_deleted,
                name: params.name || undefined,
            });

            const apiRows = (data?.kit_option_templates ?? data?.kitOptionTemplates ?? []).map(
                mapApiTemplateToRow
            );

            setAllRows(apiRows);
            setTotalPages(data?.total_pages ?? data?.totalPages ?? 0);
        } catch (e) {
            console.error("Failed to load kit option templates:", e);
            setAllRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData(filterParams);
        setPartsPage(1);
        fetchOptionPartsPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /*  useEffect(() => {
       const root = document.documentElement; // <html>
       root.classList.add("stableGutter");
       return () => {
           root.classList.remove("stableGutter");
       };
   }, []);*/

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
        description: "",
        partIds: [],
        imageFile: null,
        imagePreviewUrl: "",
    });
    const [createErrors, setCreateErrors] = useState({});

    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        description: "",
        partIds: [],
        imageFile: null,
        imagePreviewUrl: "",
        currentImageUrl: "",
    });
    const [editErrors, setEditErrors] = useState({});

    const revokeIfBlobUrl = (url) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
        }
    };

    const openCreatePopup = () => {
        revokeIfBlobUrl(createForm.imagePreviewUrl);

        setCreateForm({
            name: "",
            description: "",
            partIds: [],
            imageFile: null,
            imagePreviewUrl: "",
        });
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);

        setPartsPage(1);
        fetchOptionPartsPage(1);

        dispatch(setIsActivePopup(true));
    };

    const closeCreatePopup = () => {
        revokeIfBlobUrl(createForm.imagePreviewUrl);

        setIsCreatePopupOpen(false);
        setCreateForm({
            name: "",
            description: "",
            partIds: [],
            imageFile: null,
            imagePreviewUrl: "",
        });
        setCreateErrors({});

        setPartsPage(1);
        setOptionParts([]);
        setPartsNameById({});
        setPartsTotalPages(1);

        dispatch(setIsActivePopup(false));
    };

    const openEditPopup = (row) => {
        setEditingRowId(row.id);

        const raw = row?.raw ?? {};
        const partsArrRaw = Array.isArray(raw?.part) ? raw.part : [];
        const partsArr = partsArrRaw.filter((p) => !p?.deleted_at);
        const currentImageUrl = raw?.image ?? row?.image ?? "";

        setPartsNameById((prev) => {
            const next = { ...prev };
            for (const p of partsArr) {
                if (p?.id != null) next[p.id] = p.name ?? "";
            }
            return next;
        });

        revokeIfBlobUrl(editForm.imagePreviewUrl);

        setEditForm({
            name: row.name || "",
            description: row.description || "",
            partIds: partsArr.map((p) => p?.id).filter((x) => x != null),
            imageFile: null,
            imagePreviewUrl: "",
            currentImageUrl: currentImageUrl || "",
        });

        setEditErrors({});
        setIsEditPopupOpen(true);
        setIsCreatePopupOpen(false);

        setPartsPage(1);
        fetchOptionPartsPage(1);

        dispatch(setIsActivePopup(true));
    };

    const closeEditPopup = () => {
        revokeIfBlobUrl(editForm.imagePreviewUrl);

        setIsEditPopupOpen(false);
        setEditingRowId(null);
        setEditForm({
            name: "",
            description: "",
            partIds: [],
            imageFile: null,
            imagePreviewUrl: "",
            currentImageUrl: "",
        });
        setEditErrors({});

        setPartsPage(1);
        setOptionParts([]);
        setPartsTotalPages(1);
        setPartsNameById({});

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

    const clearEditError = (key) => {
        setEditErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const toggleCreatePart = (partId, checked) => {
        if (checked) {
            const found = optionParts.find((p) => p.id === partId);
            if (found?.name) setPartsNameById((prev) => ({ ...prev, [partId]: found.name }));
        }

        setCreateForm((prev) => {
            const set = new Set(prev.partIds);
            if (checked) set.add(partId);
            else set.delete(partId);
            return { ...prev, partIds: Array.from(set) };
        });
    };

    const toggleEditPart = (partId, checked) => {
        if (checked) {
            const found = optionParts.find((p) => p.id === partId);
            if (found?.name) setPartsNameById((prev) => ({ ...prev, [partId]: found.name }));
        }

        setEditForm((prev) => {
            const set = new Set(prev.partIds);
            if (checked) set.add(partId);
            else set.delete(partId);
            return { ...prev, partIds: Array.from(set) };
        });
    };

    const onCreateImageChange = (file) => {
        revokeIfBlobUrl(createForm.imagePreviewUrl);
        if (!(file instanceof File)) {
            setCreateForm((prev) => ({ ...prev, imageFile: null, imagePreviewUrl: "" }));
            return;
        }
        const blobUrl = URL.createObjectURL(file);
        setCreateForm((prev) => ({ ...prev, imageFile: file, imagePreviewUrl: blobUrl }));
    };

    const onEditImageChange = (file) => {
        revokeIfBlobUrl(editForm.imagePreviewUrl);
        if (!(file instanceof File)) {
            setEditForm((prev) => ({ ...prev, imageFile: null, imagePreviewUrl: "" }));
            return;
        }
        const blobUrl = URL.createObjectURL(file);
        setEditForm((prev) => ({ ...prev, imageFile: file, imagePreviewUrl: blobUrl }));
    };

    const handleCreateSave = async () => {
        const errors = {};
        const nameTrimmed = createForm.name.trim();

        if (!nameTrimmed) errors.createName = { message: "Вкажіть назву" };

        if (nameTrimmed.length > MAX_OPTION_TEXT_LENGTH) {
            errors.createName = { message: "Назва має бути не більше 100 символів" };
        }

        if ((createForm.description ?? "").length > MAX_OPTION_TEXT_LENGTH) {
            errors.createDescription = { message: "Опис має бути не більше 100 символів" };
        }

        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const payload = {
                name: nameTrimmed,
                description: createForm.description ?? "",
                partIds: (createForm.partIds ?? []).map((id) => Number(id)),
                imageFile: createForm.imageFile,
            };

            const created = await createKitOptionTemplate(token, payload);
            const newRow = mapApiTemplateToRow(created);

            updateRows((prev) => [newRow, ...prev]);
            closeCreatePopup();
        } catch (e) {
            console.error("Failed to create kit option template:", e);
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

        if ((editForm.description ?? "").length > MAX_OPTION_TEXT_LENGTH) {
            errors.editDescription = { message: "Опис має бути не більше 100 символів" };
        }

        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const payload = {
                name: nameTrimmed,
                description: editForm.description ?? "",
                partIds: (editForm.partIds ?? []).map((id) => Number(id)),
                imageFile: editForm.imageFile,
            };

            const updated = await editKitOptionTemplate(token, editingRowId, payload);
            const updatedRow = mapApiTemplateToRow(updated);

            updateRows((prev) =>
                prev.map((r) => (r.id === editingRowId ? { ...r, ...updatedRow } : r))
            );
            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit kit option template:", e);
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
            await deleteKitOptionTemplate(token, deleteTarget.id);

            updateRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            closeDeletePopup();
        } catch (e) {
            console.error("Failed to delete kit option template:", e);
        } finally {
            setIsDeleting(false);
        }
    };

    const renderSelectedParts = (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) return null;
        if (partsTotalPages <= 1) return null;

        const names = ids.map((id) => partsNameById[id] || `#${id}`).join(", ");
        return (
            <p style={{ margin: "5px 0 5px", fontStyle: "italic" }}>
                * Вже обрано: {names}
            </p>
        );
    };

    const columns = useMemo(
        () => [
            { key: "id", title: "ID", width: "60px" },
            {
                key: "image",
                title: "Фото",
                width: "80px",
                render: (_, row) =>
                    row.image ? (
                        <img
                            src={row.image}
                            alt={row.name || "photo"}
                            style={{
                                width: 46,
                                height: 46,
                                objectFit: "cover",
                                borderRadius: 8,
                                display: "block",
                                margin: "0 auto",
                            }}
                        />
                    ) : null,
            },
            { key: "name", title: "Назва", render: (_, row) => <LimitedCell value={row.name} /> },
            {
                key: "description",
                title: "Опис",
                render: (_, row) => <LimitedCell value={row.description} lineClamp={4} />,
            },
            {
                key: "partsLabel",
                title: "Частини",
                render: (_, row) => <LimitedCell value={row.partsLabel} lineClamp={8} />,
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
        [allRows, partsNameById]
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

    const handlePartsPageChange = async (event, value) => {
        if (partsPage === value) return;
        setPartsPage(value);
        await fetchOptionPartsPage(value);
        requestAnimationFrame(() => {
            if (partsScrollRef.current) {
                partsScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
            }
        });
    };

    return (
        <div className={styles.wrapper}>
            <ArrBack />
            <SearchFilter
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
                title="Опції комплектів"
                hideFilterButton
            />

            <TabsLinks />
            <OptionsInnerTabs />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати опцію комплектів</span>
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
                <CentralPopup title="Додавання опції комплектів" onClose={closeCreatePopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={createErrors}
                            name="createName"
                            label={<OptionLimitLabel text="Назва" />}
                            placeholder="Назва опції"
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

                        <div className={styles.textareaBox}>
                            <label className={styles.textareaLabel} htmlFor="createDescription">
                                <OptionLimitLabel text="Опис" />
                            </label>
                            <textarea
                                id="createDescription"
                                className={`${styles.textarea} ${createErrors.createDescription ? styles.textareaError : ""
                                    }`}
                                placeholder="Опис опції"
                                value={createForm.description}
                                onChange={(e) => {
                                    const value = e.target.value.slice(0, MAX_OPTION_TEXT_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, description: value }));
                                    clearCreateError("createDescription");
                                }}
                                maxLength={MAX_OPTION_TEXT_LENGTH}
                            />
                            {createErrors.createDescription && (
                                <div className={styles.errorText}>{createErrors.createDescription.message}</div>
                            )}
                        </div>

                        {/* PHOTO */}
                        <div>
                            <p style={{ margin: "0 0 8px 0" }}>Фото (опційно):</p>

                            {createForm.imagePreviewUrl &&
                                <img
                                    src={createForm.imagePreviewUrl}
                                    alt="preview"
                                    style={{
                                        width: 120,
                                        height: 120,
                                        objectFit: "cover",
                                        borderRadius: 10,
                                        display: "block",
                                        marginBottom: 8,
                                    }}
                                />}

                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => onCreateImageChange(e.target.files?.[0])}
                            />
                        </div>

                        {/* PARTS */}
                        <div>
                            <p style={{ margin: "0 0 8px 0" }}>Оберіть частини опції:</p>

                            {isPartsLoading && <div className={styles.helperText}>Завантаження частин…</div>}

                            {!isPartsLoading && optionParts.length === 0 && (
                                <div className={styles.helperText}>Немає доступних частин</div>
                            )}

                            {renderSelectedParts(createForm.partIds)}

                            <div ref={partsScrollRef} style={{
                                height: 160, overflow: "auto", border: "1px solid #ddd", borderRadius: 6, padding: 8,
                            }}
                            >
                                {optionParts.map((p) => (
                                    <div key={p.id} style={{ marginBottom: 10 }}>
                                        <CustomCheckbox
                                            name={p.name}
                                            value={p.id}
                                            isChecked={createForm.partIds.includes(p.id)}
                                            isLoading={isPartsLoading}
                                            onChange={(checked) => toggleCreatePart(p.id, checked)}
                                            label
                                            darkText
                                        />
                                    </div>
                                ))}

                                {isPartsLoading && (
                                    <div style={{ padding: 8, fontSize: 12, color: "#666" }}>
                                        Завантаження частин…
                                    </div>
                                )}

                                {!isPartsLoading && optionParts.length === 0 && (
                                    <div style={{ padding: 8, fontSize: 12, color: "#666" }}>
                                        Немає доступних частин
                                    </div>
                                )}
                            </div>

                            {partsTotalPages > 1 && (
                                <div style={{ marginTop: 10 }}>
                                    <Pagination
                                        count={partsTotalPages}
                                        page={partsPage}
                                        siblingCount={1}
                                        boundaryCount={1}
                                        hidePrevButton
                                        hideNextButton
                                        onChange={handlePartsPageChange}
                                    />
                                </div>
                            )}

                        </div>

                        <button type="button" className="btnDark" onClick={handleCreateSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}

            {/* EDIT */}
            {isEditPopupOpen && (
                <CentralPopup title="Редагування опції комплектів" onClose={closeEditPopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={editErrors}
                            name="editName"
                            label={<OptionLimitLabel text="Назва" />}
                            placeholder="Назва опції"
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

                        <div className={styles.textareaBox}>
                            <label className={styles.textareaLabel} htmlFor="editDescription">
                                <OptionLimitLabel text="Опис" />
                            </label>
                            <textarea
                                id="editDescription"
                                className={`${styles.textarea} ${editErrors.editDescription ? styles.textareaError : ""
                                    }`}
                                placeholder="Опис опції"
                                value={editForm.description}
                                onChange={(e) => {
                                    const value = e.target.value.slice(0, MAX_OPTION_TEXT_LENGTH);
                                    setEditForm((prev) => ({ ...prev, description: value }));
                                    clearEditError("editDescription");
                                }}
                                maxLength={MAX_OPTION_TEXT_LENGTH}
                            />
                            {editErrors.editDescription && (
                                <div className={styles.errorText}>{editErrors.editDescription.message}</div>
                            )}
                        </div>

                        {/* PHOTO */}
                        <div>
                            <p style={{ margin: "0 0 8px 0" }}>Фото:</p>

                            {editForm.imagePreviewUrl ? (
                                <img
                                    src={editForm.imagePreviewUrl}
                                    alt="preview"
                                    style={{
                                        width: 120,
                                        height: 120,
                                        objectFit: "cover",
                                        borderRadius: 10,
                                        display: "block",
                                        marginBottom: 8,
                                    }}
                                />
                            ) : editForm.currentImageUrl ? (
                                <img
                                    src={editForm.currentImageUrl}
                                    alt="current"
                                    style={{
                                        width: 120,
                                        height: 120,
                                        objectFit: "cover",
                                        borderRadius: 10,
                                        display: "block",
                                        marginBottom: 8,
                                    }}
                                />
                            ) : (
                                <div className={styles.helperText} style={{ marginBottom: 8 }}>
                                    Фото немає
                                </div>
                            )}

                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => onEditImageChange(e.target.files?.[0])}
                            />

                            {editForm.imagePreviewUrl && (
                                <button
                                    type="button"
                                    className="btnDark"
                                    style={{ marginTop: 8 }}
                                    onClick={() => onEditImageChange(null)}
                                >
                                    <span>Скинути новий файл</span>
                                </button>
                            )}
                        </div>

                        {/* PARTS */}
                        <div>
                            <p style={{ margin: "0 0 8px 0" }}>Оберіть частини опції:</p>

                            {isPartsLoading && <div className={styles.helperText}>Завантаження частин…</div>}

                            {!isPartsLoading && optionParts.length === 0 && (
                                <div className={styles.helperText}>Немає доступних частин</div>
                            )}

                            {renderSelectedParts(editForm.partIds)}

                            <div ref={partsScrollRef}
                                style={{
                                    height: 160,
                                    overflow: "auto",
                                    border: "1px solid #ddd",
                                    borderRadius: 6,
                                    padding: 8,
                                }}>
                                {optionParts.map((p) => (
                                    <div key={p.id} style={{ marginBottom: 10 }}>
                                        <CustomCheckbox
                                            name={p.name}
                                            value={p.id}
                                            isChecked={editForm.partIds.includes(p.id)}
                                            isLoading={isPartsLoading}
                                            onChange={(checked) => toggleEditPart(p.id, checked)}
                                            label
                                            darkText
                                        />
                                    </div>
                                ))}

                                {isPartsLoading && (
                                    <div style={{ padding: 8, fontSize: 12, color: "#666" }}>
                                        Завантаження частин…
                                    </div>
                                )}

                                {!isPartsLoading && optionParts.length === 0 && (
                                    <div style={{ padding: 8, fontSize: 12, color: "#666" }}>
                                        Немає доступних частин
                                    </div>
                                )}
                            </div>

                            {partsTotalPages > 1 && (
                                <div style={{ marginTop: 10 }}>
                                    <Pagination
                                        count={partsTotalPages}
                                        page={partsPage}
                                        siblingCount={1}
                                        boundaryCount={1}
                                        hidePrevButton
                                        hideNextButton
                                        onChange={handlePartsPageChange}
                                    />
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
                    title="Видалення опції комплектів"
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
                            Ви дійсно бажаєте видалити опцію комплектів?
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

export default KitOptionTemplates;
