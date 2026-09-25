// CreateCustomOptions.jsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import styles from "../Pricelist/Pricelist.module.scss";

import Table from "../Common/Table/Table.jsx";
import TableFixedHeader from "../Common/Table/TableFixedHeader.jsx";
import CentralPopup from "../Common/CentralPopup/CentralPopup.jsx";
import InputBox from "../Common/InputBox/InputBox.jsx";

import SearchFilter from "../Common/SearchFilter/SearchFilter";
import Filter from "../Common/Filter/Filter";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import CustomSelect from "../Common/CustomSelect/CustomSelect";

import Preloader from "../Common/Preloader/Preloader.jsx";
import { Pagination } from "@mui/material";

import CustomCheckbox from "../Common/CustomCheckbox/CustomCheckbox.jsx"; // ← перевір шлях

import {
    fetchComponentOptionTemplates,
    fetchComponentTypes,
    fetchOptionParts,
    createComponentOptionTemplate,
    editComponentOptionTemplate,
    deleteComponentOptionTemplate,
} from "../../api/tablesApi.js";
import { getAccessToken } from "../../api/authStorage.js";

import { useAppDispatch } from "../../hooks/redux.jsx";
import { setIsActivePopup } from "../../store/main-slice.js";
import CustomLoadSelect from "../Common/CustomLoadSelect/CustomLoadSelect.jsx";

/* helpers */
const mapApiTemplateToRow = (item) => {
    const typeObj = item?.type ?? null;
    const partsArr = Array.isArray(item?.part) ? item.part : [];

    const partsLabel =
        partsArr.length > 0
            ? partsArr.map((p) => p?.name).filter(Boolean).join(", ")
            : "-";

    return {
        id: item?.id,
        name: item?.name ?? "",
        description: item?.description ?? "",
        typeId: typeObj?.id ?? null,
        typeName: typeObj?.name ?? "-",
        partIds: partsArr.map((p) => p?.id).filter((x) => x != null),
        partsLabel,
        raw: item,
    };
};

const CreateCustomOptions = () => {
    const dispatch = useAppDispatch();
    const scrollRef = useRef(null);

    const [allRows, setAllRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const [isShowFilter, setIsShowFilter] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [filters, setFilters] = useState({ is_deleted: "false", type_id: "" });

    const [filterParams, setFilterParams] = useState({
        page: 1,
        is_deleted: "false",
        name: "",
        type_id: "",
    });


    const isDeletedOptions = [
        { name: "Всі", value: "" },
        { name: "Активні", value: "false" },
        { name: "Видалені", value: "true" },
    ];


    // checkboxes: option parts (type='component')
    const [optionParts, setOptionParts] = useState([]);
    const [isPartsLoading, setIsPartsLoading] = useState(false);

    const [partsPage, setPartsPage] = useState(1);
    const [partsTotalPages, setPartsTotalPages] = useState(1);
    const [partsNameById, setPartsNameById] = useState({});

    const updateRows = (updater) => setAllRows((prev) => updater(prev));

    const fetchTypePage = useCallback(async ({ page, page_size }) => {
        const token = getAccessToken();
        const data = await fetchComponentTypes(token, { page, page_size });

        const list = Array.isArray(data?.component_types) ? data.component_types : [];
        const totalPages = Number(data?.total_pages) || 1;

        return {
            options: list.map((t) => ({ value: t.id, name: t.name ?? "" })),
            totalPages,
        };
    }, []);

    const fetchOptionPartsPage = useCallback(async (pageToLoad = 1) => {
        try {
            setIsPartsLoading(true);
            const token = getAccessToken();

            const data = await fetchOptionParts(token, {
                page: pageToLoad,
                type: "component",
                // page_size: 1, // якщо хочеш тестувати з фронта. Якщо ти вже “забила” в api — лишай без цього.
            });

            const list = Array.isArray(data?.option_parts) ? data.option_parts : [];
            const total = Number(data?.total_pages) || 1;

            setOptionParts(
                list.map((p) => ({
                    id: p.id,
                    name: p.name ?? "",
                    type: p.type ?? "component",
                }))
            );

            setPartsTotalPages(total);

            // оновлюємо кеш імен
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

            const data = await fetchComponentOptionTemplates(token, {
                page: params.page,
                is_deleted: params.is_deleted === "" ? undefined : params.is_deleted,
                name: params.name || undefined,
                type_id: params.type_id || undefined,
            });

            const apiRows = (data?.component_option_templates ?? data?.componentOptionTemplates ?? []).map(
                mapApiTemplateToRow
            );

            setAllRows(apiRows);
            setTotalPages(data?.total_pages ?? data?.totalPages ?? 0);
        } catch (e) {
            console.error("Failed to load component option templates:", e);
            setAllRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData(filterParams);
      /*  loadAllComponentTypes();*/
        setPartsPage(1);
        fetchOptionPartsPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSendFilters = (newParams) => {
        const next = { ...newParams, page: 1 };
        setFilterParams(next);
        setPage(1);
        fetchData(next);
    };

    const handleSearch = () => {
        onSendFilters({ ...filterParams, name: searchValue.trim() });
    };

    const handleIsDeletedChange = (event) => {
        const value = event.target.value;
        setFilters((prev) => ({ ...prev, is_deleted: value }));
        onSendFilters({ ...filterParams, is_deleted: value });
    };


    const handleTypeChange = (event) => {
        const value = event.target.value;
        setFilters((prev) => ({ ...prev, type_id: value }));
        onSendFilters({ ...filterParams, type_id: value });
    };

    const handlePartsPageChange = (event, value) => {
        if (partsPage === value) return;
        setPartsPage(value);
        fetchOptionPartsPage(value);
    };

    const resetAllFilters = () => {
        const next = { page: 1, is_deleted: "false", name: "", type_id: "" };
        setFilters({ is_deleted: "false", type_id: "" });
        setFilterParams(next);
        setSearchValue("");
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
        typeId: "",
        partIds: [],
    });
    const [createErrors, setCreateErrors] = useState({});
    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);

    const openCreatePopup = () => {
        setCreateForm({ name: "", description: "", typeId: "", partIds: [] });
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);
        setPartsPage(1);
        fetchOptionPartsPage(1);
        dispatch(setIsActivePopup(true));
    };

    const closeCreatePopup = () => {
        setIsCreatePopupOpen(false);
        setCreateForm({ name: "", description: "", typeId: "", partIds: [] });
        setCreateErrors({});
        setPartsPage(1);
        setOptionParts([]);
        setPartsNameById({});
        setPartsTotalPages(1);
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

    const toggleCreatePart = (partId, checked) => {
        // підхоплюємо name з поточної сторінки
        if (checked) {
            const found = optionParts.find((p) => p.id === partId);
            if (found?.name) {
                setPartsNameById((prev) => ({ ...prev, [partId]: found.name }));
            }
        }

        setCreateForm((prev) => {
            const set = new Set(prev.partIds);
            if (checked) set.add(partId);
            else set.delete(partId);
            return { ...prev, partIds: Array.from(set) };
        });
    };


    const handleCreateSave = async () => {
        const errors = {};
        const nameTrimmed = createForm.name.trim();
        const typeId = createForm.typeId;

        if (!nameTrimmed) errors.createName = { message: "Вкажіть назву" };
        if (!typeId) errors.createType = { message: "Оберіть тип" };

        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const payload = {
                name: nameTrimmed,
                description: createForm.description ?? "",
                type: Number(typeId),
                part: (createForm.partIds ?? []).map((id) => Number(id)),
            };

            const created = await createComponentOptionTemplate(token, payload);
            const newRow = mapApiTemplateToRow(created);

            updateRows((prev) => [newRow, ...prev]);
            closeCreatePopup();
        } catch (e) {
            console.error("Failed to create component option template:", e);
        }
    };


    const [editingRowId, setEditingRowId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        description: "",
        typeId: "",
        partIds: [],
    });
    const [editErrors, setEditErrors] = useState({});

    const openEditPopup = (row) => {
        setEditingRowId(row.id);

        const raw = row?.raw ?? {};
        const typeObj = raw?.type ?? null;
        const partsArr = Array.isArray(raw?.part) ? raw.part : [];

        // 1) назви для вже вибраних частин — беремо з raw.part (бо вони точно є)
        setPartsNameById((prev) => {
            const next = { ...prev };
            for (const p of partsArr) {
                if (p?.id != null) next[p.id] = p.name ?? "";
            }
            return next;
        });


        setEditForm({
            name: row.name || "",
            description: row.description || "",
            typeId: typeObj?.id ?? row.typeId ?? "",
            partIds: partsArr.map((p) => p?.id).filter((x) => x != null),
        });

        setEditErrors({});
        setIsEditPopupOpen(true);
        setIsCreatePopupOpen(false);
        setPartsPage(1);
        fetchOptionPartsPage(1);
        dispatch(setIsActivePopup(true));
    };

    const closeEditPopup = () => {
        setIsEditPopupOpen(false);
        setEditingRowId(null);
        setEditForm({ name: "", description: "", typeId: "", partIds: [] });
        setEditErrors({});
        setPartsPage(1);
        setOptionParts([]);
        setPartsTotalPages(1);
        setPartsNameById({});
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

    const toggleEditPart = (partId, checked) => {
        if (checked) {
            const found = optionParts.find((p) => p.id === partId);
            if (found?.name) {
                setPartsNameById((prev) => ({ ...prev, [partId]: found.name }));
            }
        }

        setEditForm((prev) => {
            const set = new Set(prev.partIds);
            if (checked) set.add(partId);
            else set.delete(partId);
            return { ...prev, partIds: Array.from(set) };
        });
    };


    const handleEditSave = async () => {
        if (!editingRowId) {
            closeEditPopup();
            return;
        }

        const errors = {};
        const nameTrimmed = editForm.name.trim();
        const typeId = editForm.typeId;

        if (!nameTrimmed) errors.editName = { message: "Вкажіть назву" };
        if (!typeId) errors.editType = { message: "Оберіть тип" };

        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const payload = {
                name: nameTrimmed,
                description: editForm.description ?? "",
                type: Number(typeId),
                part: (editForm.partIds ?? []).map((id) => Number(id)),
            };

            const updated = await editComponentOptionTemplate(token, editingRowId, payload);
            const updatedRow = mapApiTemplateToRow(updated);

            updateRows((prev) => prev.map((r) => (r.id === editingRowId ? { ...r, ...updatedRow } : r)));
            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit component option template:", e);
        }
    };

    const handleDelete = async (row) => {
        if (!row?.id) return;

        const ok = window.confirm("Ви дійсно бажаєте видалити опцію компонентів?");
        if (!ok) return;

        try {
            const token = getAccessToken();
            await deleteComponentOptionTemplate(token, row.id);

            updateRows((prev) => prev.filter((r) => r.id !== row.id));
        } catch (e) {
            console.error("Failed to delete component option template:", e);
            window.alert("Не вдалося видалити. Спробуй ще раз.");
        }
    };

    const renderSelectedParts = (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) return null;
        if (partsTotalPages <= 1) return null; // як ти просила: тільки якщо сторінок > 1

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
            { key: "name", title: "Назва" },
            {
                key: "description",
                title: "Опис",
                render: (_, row) => (row.description?.trim() ? row.description : "-"),
            },
            {
                key: "typeName",
                title: "Тип",
                render: (_, row) => row.typeName || "-",
            },
            {
                key: "partsLabel",
                title: "Частини",
                render: (_, row) => row.partsLabel || "-",
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
                        <button type="button" className="btnDark" onClick={() => handleDelete(row)}>
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

    return (
        <div className={styles.wrapper}>
            <SearchFilter
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
                title="Опції компонентів"
            />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати опцію компонентів</span>
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

            <div style={{ overflowX: "auto", paddingBottom: 8 }} ref={scrollRef}>
                <div style={{ minWidth: `${minWidthPx}px` }}>
                    <Table columns={columns} data={allRows} centered hideHeader />
                </div>
            </div>

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
                <CustomSelect
                    label="Статус"
                    value={filters.is_deleted}
                    onChange={handleIsDeletedChange}
                    options={isDeletedOptions}
                />
                <CustomLoadSelect
                    label="Тип"
                    value={filters.type_id}
                    onChange={handleTypeChange}
                    fetchPage={fetchTypePage}
                    prependOptions={[{ name: "Всі", value: "" }]} // якщо треба "Всі"
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

            {/* CREATE */}
            {isCreatePopupOpen && (
                <CentralPopup title="Додавання опції компонентів" onClose={closeCreatePopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={createErrors}
                            name="createName"
                            label="Назва"
                            placeholder="Назва опції"
                            options={{
                                value: createForm.name,
                                onChange: (e) => {
                                    const value = e.target.value;
                                    setCreateForm((prev) => ({ ...prev, name: value }));
                                    clearCreateError("createName");
                                },
                            }}
                        />

                        <div className={styles.textareaBox}>
                            <label className={styles.textareaLabel} htmlFor="createDescription">
                                Опис
                            </label>
                            <textarea
                                id="createDescription"
                                className={`${styles.textarea} ${
                                    createErrors.createDescription ? styles.textareaError : ""
                                }`}
                                placeholder="Опис опції"
                                value={createForm.description}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setCreateForm((prev) => ({ ...prev, description: value }));
                                    clearCreateError("createDescription");
                                }}
                            />
                            {createErrors.createDescription && (
                                <div className={styles.errorText}>{createErrors.createDescription.message}</div>
                            )}
                        </div>

                        <div>
                            <CustomLoadSelect
                                label="Тип"
                                value={createForm.typeId}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setCreateForm((prev) => ({ ...prev, typeId: value }));
                                    clearCreateError("createType");
                                }}
                                fetchPage={fetchTypePage}
                            />

                            {createErrors.createType && (
                                <div className={styles.errorText}>{createErrors.createType.message}</div>
                            )}
                        </div>

                        <div>
                            <p style={{ margin: "0 0 8px 0" }}>Оберіть частини опції:</p>

                            {isPartsLoading && <div className={styles.helperText}>Завантаження частин…</div>}

                            {!isPartsLoading && optionParts.length === 0 && (
                                <div className={styles.helperText}>Немає доступних частин</div>
                            )}

                            {renderSelectedParts(createForm.partIds)}

                            <div style={{ display: "flex", flexDirection: "column", rowGap: 10 }}>
                                {optionParts.map((p) => (
                                    <CustomCheckbox
                                        key={p.id}
                                        name={p.name}
                                        value={p.id}
                                        isChecked={createForm.partIds.includes(p.id)}
                                        isLoading={isPartsLoading}
                                        onChange={(checked) => toggleCreatePart(p.id, checked)}
                                        label
                                        darkText
                                    />
                                ))}
                            </div>
                            {partsTotalPages > 1 && (
                                <Pagination
                                    count={partsTotalPages}
                                    page={partsPage}
                                    siblingCount={1}
                                    boundaryCount={1}
                                    hidePrevButton
                                    hideNextButton
                                    onChange={handlePartsPageChange}
                                />
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
                <CentralPopup title="Редагування опції компонентів" onClose={closeEditPopup}>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
                        <InputBox
                            errors={editErrors}
                            name="editName"
                            label="Назва"
                            placeholder="Назва опції"
                            options={{
                                value: editForm.name,
                                onChange: (e) => {
                                    const value = e.target.value;
                                    setEditForm((prev) => ({ ...prev, name: value }));
                                    clearEditError("editName");
                                },
                            }}
                        />

                        <div className={styles.textareaBox}>
                            <label className={styles.textareaLabel} htmlFor="editDescription">
                                Опис
                            </label>
                            <textarea
                                id="editDescription"
                                className={`${styles.textarea} ${
                                    editErrors.editDescription ? styles.textareaError : ""
                                }`}
                                placeholder="Опис опції"
                                value={editForm.description}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setEditForm((prev) => ({ ...prev, description: value }));
                                    clearEditError("editDescription");
                                }}
                            />
                            {editErrors.editDescription && (
                                <div className={styles.errorText}>{editErrors.editDescription.message}</div>
                            )}
                        </div>

                        <div>
                            <CustomLoadSelect
                                label="Тип"
                                value={editForm.typeId}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setEditForm((prev) => ({ ...prev, typeId: value }));
                                    clearEditError("editType");
                                }}
                                fetchPage={fetchTypePage}
                            />

                            {editErrors.editType && (
                                <div className={styles.errorText}>{editErrors.editType.message}</div>
                            )}
                        </div>

                        <div>
                            <p style={{ margin: "0 0 8px 0" }}>Оберіть частини опції:</p>

                            {isPartsLoading && <div className={styles.helperText}>Завантаження частин…</div>}

                            {!isPartsLoading && optionParts.length === 0 && (
                                <div className={styles.helperText}>Немає доступних частин</div>
                            )}

                            {renderSelectedParts(editForm.partIds)}

                            <div style={{ display: "flex", flexDirection: "column", rowGap: 10 }}>
                                {optionParts.map((p) => (
                                    <CustomCheckbox
                                        key={p.id}
                                        name={p.name}
                                        value={p.id}
                                        isChecked={editForm.partIds.includes(p.id)}
                                        isLoading={isPartsLoading}
                                        onChange={(checked) => toggleEditPart(p.id, checked)}
                                        label
                                        darkText
                                    />
                                ))}
                            </div>
                            {partsTotalPages > 1 && (
                                <Pagination
                                    count={partsTotalPages}
                                    page={partsPage}
                                    siblingCount={1}
                                    boundaryCount={1}
                                    hidePrevButton
                                    hideNextButton
                                    onChange={handlePartsPageChange}
                                />
                            )}
                        </div>

                        <button type="button" className="btnDark" onClick={handleEditSave}>
                            <span>Зберегти</span>
                        </button>
                    </div>
                </CentralPopup>
            )}
        </div>
    );
};

export default CreateCustomOptions;
