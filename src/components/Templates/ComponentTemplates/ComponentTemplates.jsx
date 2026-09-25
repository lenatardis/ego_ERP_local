// ComponentTemplates.jsx
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
    fetchComponentTemplates,
    createComponentTemplate,
    editComponentTemplate,
    deleteComponentTemplate,
    fetchComponentTypes,
    fetchProductTypesCRM,
} from "../../../api/tablesApi.js";

import { getAccessToken } from "../../../api/authStorage.js";
import { useAppDispatch } from "../../../hooks/redux.jsx";
import { setIsActivePopup } from "../../../store/main-slice.js";

import { useStickyXScroll } from "../../../hooks/useStickyXScroll.jsx";
import { useObjectUrl } from "../../../hooks/useObjectUrl";

import CustomLoadSelect from "../../Common/CustomLoadSelect/CustomLoadSelect.jsx";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";
import OptionLimitLabel from "../../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../../Common/LimitedCell/LimitedCell.jsx";



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
                margin: "0 auto",
            }}
        />
    );
};

const mapApiTemplateToRow = (item) => ({
    id: item?.id,
    name: item?.name ?? "",
    short_name: item?.short_name ?? "",
    size: item?.size ?? "",
    fabric_a_count: item?.fabric_a_count,
    fabric_b_count: item?.fabric_b_count,
    image: item?.image ?? "",
    type: item?.type ?? null, // очікуємо {id, name}
    fabric_type: item?.fabric_type ?? null, // очікуємо {id, type}
    deleted_at: item?.deleted_at ?? null,
    raw: item,
});

const toDisplayNum = (v) => {
    if (v === 0) return "0";
    if (v == null || v === "") return "-";
    return String(v);
};

const MAX_NAME_LENGTH = 100;
const MAX_SHORT_FIELD_LENGTH = 10;

const ComponentTemplates = () => {
    const dispatch = useAppDispatch();

    const scrollRef = useRef(null);

    // ghost scroll (як у NewPrices)
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
        type_id: "",
        fabric_type_id: "",
    });

    // API params (не ламаємо те, що працювало)
    const [filterParams, setFilterParams] = useState({
        page: 1,
        is_deleted: "false",
        name: null,
        type_id: "",
        fabric_type_id: "",
    });


    // select options
    const [typeOptions, setTypeOptions] = useState([
        { name: "Тип (завантаження...)", value: "" },
    ]);
    const [fabricTypeOptions, setFabricTypeOptions] = useState([
        { name: "Тип тканини (завантаження...)", value: "" },
    ]);

    const resetXScrollToStart = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.scrollTo({ left: 0, behavior: "auto" });

        el.dispatchEvent(new Event("scroll"));

        requestAnimationFrame(() => {
            recalcX();
        });
    }, [recalcX]);


    const updateRows = (updater) => setAllRows((prev) => updater(prev));

    const loadSelectOptions = useCallback(async () => {
        try {
            const token = getAccessToken();

            // 1) component types (calculator)
            const ct = await fetchComponentTypes(token, {
                page: 1,
                page_size: 1000,
                is_deleted: "false",
                name: "",
            });

            const ctList = Array.isArray(ct?.component_types) ? ct.component_types : [];
            const ctOptions = [
                { name: "Тип", value: "" },
                ...ctList.map((x) => ({ name: x?.name ?? `ID ${x?.id}`, value: x?.id })),
            ];
            setTypeOptions(ctOptions);

            // 2) fabric types (CRM)
            const ft = await fetchProductTypesCRM(token);
            const ftList = Array.isArray(ft) ? ft : [];
            const ftOptions = [
                { name: "Тип тканини", value: "" },
                ...ftList
                    .filter((x) => x?.is_available !== false)
                    .map((x) => ({ name: x?.type ?? `ID ${x?.id}`, value: x?.id })),
            ];
            setFabricTypeOptions(ftOptions);
        } catch (e) {
            console.error("Failed to load select options:", e);
            setTypeOptions([{ name: "Тип", value: "" }]);
            setFabricTypeOptions([{ name: "Тип тканини", value: "" }]);
        }
    }, []);

    const fetchComponentTypesPageForSelect = useCallback(
        async ({ page, page_size }) => {
            const token = getAccessToken();

            const ct = await fetchComponentTypes(token, {
                page,
                page_size,
                is_deleted: "false",
                name: "",
            });

            const list = Array.isArray(ct?.component_types) ? ct.component_types : [];
            const totalPages = Number(ct?.total_pages ?? ct?.totalPages ?? 1) || 1;

            return {
                options: list.map((x) => ({
                    value: String(x?.id ?? ""),
                    name: x?.name ?? (x?.id != null ? `ID ${x.id}` : "—"),
                })),
                totalPages,
            };
        },
        []
    );

    const fetchFabricTypesPageForSelect = useCallback(
        async ({ page, page_size }) => {
            const token = getAccessToken();

            // У тебе fetchProductTypesCRM без пагінації — тому повертаємо все як 1 сторінку
            const ft = await fetchProductTypesCRM(token);
            const listRaw = Array.isArray(ft) ? ft : [];

            const list = listRaw
                .filter((x) => x?.is_available !== false)
                .map((x) => ({
                    value: String(x?.id ?? ""),
                    name: x?.type ?? (x?.id != null ? `ID ${x.id}` : "—"),
                }));

            return {
                options: list,
                totalPages: 1,
            };
        },
        []
    );

    const fetchData = useCallback(async (params) => {
        try {
            setIsLoading(true);
            const token = getAccessToken();

            const data = await fetchComponentTemplates(token, {
                page: params.page,
                page_size: 10,
                is_deleted: params.is_deleted === "" ? undefined : params.is_deleted,
                name: params.name || undefined,

                type_id: params.type_id || undefined,
                fabric_type_id: params.fabric_type_id || undefined,
            });


            const list = Array.isArray(data?.component_templates) ? data.component_templates : [];
            const mapped = list.map(mapApiTemplateToRow);
            setAllRows(mapped);
            setTotalPages(Number(data?.total_pages) || 0);
        } catch (e) {
            console.error("Failed to load component templates:", e);
            setAllRows([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSelectOptions();
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


    const handleTypeFilterChange = (event) => {
        const value = event.target.value;
        setFilters((prev) => ({ ...prev, type_id: value }));
        onSendFilters({ ...filterParams, type_id: value });
    };

    const handleFabricTypeFilterChange = (event) => {
        const value = event.target.value;
        setFilters((prev) => ({ ...prev, fabric_type_id: value }));
        onSendFilters({ ...filterParams, fabric_type_id: value });
    };

    const resetAllFilters = () => {
        const next = { page: 1, is_deleted: "false", name: null, type_id: "", fabric_type_id: "" };
        setFilters({ type_id: "", fabric_type_id: "" });
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
    const [createForm, setCreateForm] = useState({
        name: "",
        short_name: "",
        size: "",
        fabric_a_count: "",
        fabric_b_count: "",
        type: "",
        fabric_type: "",
        imageFile: null,
    });
    const [createErrors, setCreateErrors] = useState({});

    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        short_name: "",
        size: "",
        fabric_a_count: "",
        fabric_b_count: "",
        type: "",
        fabric_type: "",
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
        setCreateForm({
            name: "",
            short_name: "",
            size: "",
            fabric_a_count: "",
            fabric_b_count: "",
            type: "",
            fabric_type: "",
            imageFile: null,
        });
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
        setEditingRowId(row.id);
        setEditForm({
            name: row?.name ?? "",
            short_name: row?.short_name ?? "",
            size: row?.size ?? "",
            fabric_a_count: row?.fabric_a_count ?? "",
            fabric_b_count: row?.fabric_b_count ?? "",
            type: row?.type?.id ?? "",
            fabric_type: row?.fabric_type?.id ?? "",
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
        setEditErrors({});
        dispatch(setIsActivePopup(false));
    };

    const validateForm = (form, mode) => {
        const errors = {};
        const nameTrimmed = String(form.name ?? "").trim();
        const shortTrimmed = String(form.short_name ?? "").trim();
        const sizeTrimmed = String(form.size ?? "").trim();
        const fabricACount = String(form.fabric_a_count ?? "").trim();
        const fabricBCount = String(form.fabric_b_count ?? "").trim();

        const nameKey = mode === "create" ? "createName" : "editName";
        const shortKey = mode === "create" ? "createShort" : "editShort";
        const sizeKey = mode === "create" ? "createSize" : "editSize";
        const aKey = mode === "create" ? "createA" : "editA";
        const bKey = mode === "create" ? "createB" : "editB";

        if (!nameTrimmed) errors[nameKey] = { message: "Вкажіть назву" };
        if (nameTrimmed.length > MAX_NAME_LENGTH) {
            errors[nameKey] = { message: "Назва має бути не більше 100 символів" };
        }

        if (!shortTrimmed) errors[shortKey] = { message: "Вкажіть коротку назву" };
        if (shortTrimmed.length > MAX_SHORT_FIELD_LENGTH) {
            errors[shortKey] = { message: "Коротка назва має бути не більше 10 символів" };
        }

        if (sizeTrimmed.length > MAX_SHORT_FIELD_LENGTH) {
            errors[sizeKey] = { message: "Розмір має бути не більше 10 символів" };
        }

        if (fabricACount.length > MAX_SHORT_FIELD_LENGTH) {
            errors[aKey] = { message: "A має бути не більше 10 символів" };
        }

        if (fabricBCount.length > MAX_SHORT_FIELD_LENGTH) {
            errors[bKey] = { message: "B має бути не більше 10 символів" };
        }

        if (!form.type) errors[mode === "create" ? "createType" : "editType"] = { message: "Оберіть тип" };
        if (!form.fabric_type) errors[mode === "create" ? "createFabricType" : "editFabricType"] = { message: "Оберіть тип тканини" };

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

            const created = await createComponentTemplate(token, {
                name: createForm.name.trim(),
                short_name: createForm.short_name.trim(),
                size: String(createForm.size ?? "").trim(),
                fabric_a_count: createForm.fabric_a_count,
                fabric_b_count: createForm.fabric_b_count,
                type: Number(createForm.type),
                fabric_type: Number(createForm.fabric_type),
                image: createForm.imageFile,
            });

            const newRow = mapApiTemplateToRow(created);
            updateRows((prev) => [newRow, ...prev]);
            closeCreatePopup();
        } catch (e) {
            console.error("Failed to create component template:", e);
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

            const updated = await editComponentTemplate(token, editingRowId, {
                name: editForm.name.trim(),
                short_name: editForm.short_name.trim(),
                size: String(editForm.size ?? "").trim(),
                fabric_a_count: editForm.fabric_a_count,
                fabric_b_count: editForm.fabric_b_count,
                type: Number(editForm.type),
                fabric_type: Number(editForm.fabric_type),
                image: editForm.imageFile,
            });

            const updatedRow = mapApiTemplateToRow(updated);
            updateRows((prev) => prev.map((r) => (r.id === editingRowId ? { ...r, ...updatedRow } : r)));
            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit component template:", e);
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
            await deleteComponentTemplate(token, deleteTarget.id);

            updateRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            closeDeletePopup();
        } catch (e) {
            console.error("Failed to delete component template:", e);
        } finally {
            setIsDeleting(false);
        }
    };
    const columns = useMemo(
        () => [
            { key: "id", title: "ID", width: "56px" },
            {
                key: "name",
                title: "Назва",
                width: "210px",
                render: (_, row) => <LimitedCell value={row.name} />,
            },
            {
                key: "short_name",
                title: "Коротка назва",
                width: "130px",
                render: (_, row) => <LimitedCell value={row.short_name} />,
            },
            {
                key: "size",
                title: "Розмір",
                width: "110px",
                render: (_, row) => <LimitedCell value={row.size} />,
            },
            {
                key: "type",
                title: "Тип",
                width: "170px",
                render: (_, row) => (row?.type?.name ? row.type.name : "-"),
            },
            {
                key: "fabric_type",
                title: "Тип тканини",
                width: "170px",
                render: (_, row) => (row?.fabric_type?.type ? row.fabric_type.type : "-"),
            },
            {
                key: "fabric_a_count",
                title: "A",
                width: "60px",
                render: (_, row) => <LimitedCell value={toDisplayNum(row.fabric_a_count)} />,
            },
            {
                key: "fabric_b_count",
                title: "B",
                width: "60px",
                render: (_, row) => <LimitedCell value={toDisplayNum(row.fabric_b_count)} />,
            },
            {
                key: "image",
                title: "Фото",
                width: "110px",
                render: (_, row) => renderPhotoCell(row.image),
            },
            {
                key: "actions",
                title: "",
                width: "130px",
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

    const minWidthPx = useMemo(() => {
        const sum = columns.reduce((acc, col) => {
            const w = col.width ? parseInt(col.width, 10) || 160 : 160;
            return acc + w;
        }, 0);

        return sum + 50;
    }, [columns]);


    // recalc ghost-scroll when width/rows change
    useEffect(() => {
        recalcX();
    }, [minWidthPx, allRows.length, recalcX]);

    return (
        <div className={styles.wrapper}>
            <ArrBack />
            <SearchFilter
                title="Шаблони компонентів"
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
            />

            <TabsLinks />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати компонент</span>
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

            {/* scroll container (важливо: і scrollRef, і mainRef — як у NewPrices) */}
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
                    value={filters.type_id}
                    onChange={handleTypeFilterChange}
                    options={typeOptions}
                />

                <CustomSelect
                    label="Тип тканини"
                    value={filters.fabric_type_id}
                    onChange={handleFabricTypeFilterChange}
                    options={fabricTypeOptions}
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
                <CentralPopup title="Додавання компонента" onClose={closeCreatePopup} verticalScroll>
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
                            label={<OptionLimitLabel text="Коротка назва" maxLength={MAX_SHORT_FIELD_LENGTH} />}
                            placeholder="Коротка назва"
                            options={{
                                value: createForm.short_name,
                                maxLength: MAX_SHORT_FIELD_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_FIELD_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, short_name: value }));
                                    clearCreateError("createShort");
                                },
                            }}
                        />

                        <InputBox
                            errors={createErrors}
                            name="createSize"
                            label={<OptionLimitLabel text="Розмір" maxLength={MAX_SHORT_FIELD_LENGTH} />}
                            placeholder="Розмір"
                            options={{
                                value: createForm.size,
                                maxLength: MAX_SHORT_FIELD_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_FIELD_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, size: value }));
                                    clearCreateError("createSize");
                                },
                            }}
                        />

                        <InputBox
                            errors={createErrors}
                            name="createA"
                            label={<OptionLimitLabel text="Додаткова витрата тканини A" maxLength={MAX_SHORT_FIELD_LENGTH} />}
                            placeholder="A"
                            options={{
                                value: createForm.fabric_a_count,
                                maxLength: MAX_SHORT_FIELD_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_FIELD_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, fabric_a_count: value }));
                                    clearCreateError("createA");
                                },
                            }}
                        />

                        <InputBox
                            errors={createErrors}
                            name="createB"
                            label={<OptionLimitLabel text="Додаткова витрата тканини B" maxLength={MAX_SHORT_FIELD_LENGTH} />}
                            placeholder="B"
                            options={{
                                value: createForm.fabric_b_count,
                                maxLength: MAX_SHORT_FIELD_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_FIELD_LENGTH);
                                    setCreateForm((prev) => ({ ...prev, fabric_b_count: value }));
                                    clearCreateError("createB");
                                },
                            }}
                        />

                        <div>
                            <CustomLoadSelect
                                label="Тип"
                                value={createForm.type}
                                onChange={(e) => {
                                    setCreateForm((prev) => ({ ...prev, type: e.target.value }));
                                    clearCreateError("createType");
                                }}
                                fetchPage={fetchComponentTypesPageForSelect}
                                pageSize={25}
                                menuMaxHeight={340}
                                prependOptions={[{ name: "Тип", value: "" }]}
                                prefetchMinItems={30}
                            />

                            {createErrors.createType && (
                                <div className={styles.errorText}>{createErrors.createType.message}</div>
                            )}
                        </div>

                        <div>
                            <CustomLoadSelect
                                label="Тип тканини"
                                value={createForm.fabric_type}
                                onChange={(e) => {
                                    setCreateForm((prev) => ({ ...prev, fabric_type: e.target.value }));
                                    clearCreateError("createFabricType");
                                }}
                                fetchPage={fetchFabricTypesPageForSelect}
                                pageSize={50}
                                menuMaxHeight={340}
                                prependOptions={[{ name: "Тип тканини", value: "" }]}
                                prefetchMinItems={30}
                            />

                            {createErrors.createFabricType && (
                                <div className={styles.errorText}>{createErrors.createFabricType.message}</div>
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
                <CentralPopup title="Редагування компонента" onClose={closeEditPopup} verticalScroll>
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
                            label={<OptionLimitLabel text="Коротка назва" maxLength={MAX_SHORT_FIELD_LENGTH} />}
                            placeholder="Коротка назва"
                            options={{
                                value: editForm.short_name,
                                maxLength: MAX_SHORT_FIELD_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_FIELD_LENGTH);
                                    setEditForm((prev) => ({ ...prev, short_name: value }));
                                    clearEditError("editShort");
                                },
                            }}
                        />

                        <InputBox
                            errors={editErrors}
                            name="editSize"
                            label={<OptionLimitLabel text="Розмір" maxLength={MAX_SHORT_FIELD_LENGTH} />}
                            placeholder="Розмір"
                            options={{
                                value: editForm.size,
                                maxLength: MAX_SHORT_FIELD_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_FIELD_LENGTH);
                                    setEditForm((prev) => ({ ...prev, size: value }));
                                    clearEditError("editSize");
                                },
                            }}
                        />

                        <InputBox
                            errors={editErrors}
                            name="editA"
                            label={<OptionLimitLabel text="Додаткова витрата тканини A" maxLength={MAX_SHORT_FIELD_LENGTH} />}
                            placeholder="A"
                            options={{
                                value: editForm.fabric_a_count,
                                maxLength: MAX_SHORT_FIELD_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_FIELD_LENGTH);
                                    setEditForm((prev) => ({ ...prev, fabric_a_count: value }));
                                    clearEditError("editA");
                                },
                            }}
                        />

                        <InputBox
                            errors={editErrors}
                            name="editB"
                            label={<OptionLimitLabel text="Додаткова витрата тканини B" maxLength={MAX_SHORT_FIELD_LENGTH} />}
                            placeholder="B"
                            options={{
                                value: editForm.fabric_b_count,
                                maxLength: MAX_SHORT_FIELD_LENGTH,
                                onChange: (e) => {
                                    const value = e.target.value.slice(0, MAX_SHORT_FIELD_LENGTH);
                                    setEditForm((prev) => ({ ...prev, fabric_b_count: value }));
                                    clearEditError("editB");
                                },
                            }}
                        />

                        <div>
                            <CustomLoadSelect
                                label="Тип"
                                value={editForm.type}
                                onChange={(e) => {
                                    setEditForm((prev) => ({ ...prev, type: e.target.value }));
                                    clearEditError("editType");
                                }}
                                fetchPage={fetchComponentTypesPageForSelect}
                                pageSize={25}
                                menuMaxHeight={340}
                                prependOptions={[{ name: "Тип", value: "" }]}
                                prefetchMinItems={30}
                            />

                            {editErrors.editType && (
                                <div className={styles.errorText}>{editErrors.editType.message}</div>
                            )}
                        </div>

                        <div>
                            <CustomLoadSelect
                                label="Тип тканини"
                                value={editForm.fabric_type}
                                onChange={(e) => {
                                    setEditForm((prev) => ({ ...prev, fabric_type: e.target.value }));
                                    clearEditError("editFabricType");
                                }}
                                fetchPage={fetchFabricTypesPageForSelect}
                                pageSize={50}
                                menuMaxHeight={340}
                                prependOptions={[{ name: "Тип тканини", value: "" }]}
                                prefetchMinItems={30}
                            />

                            {editErrors.editFabricType && (
                                <div className={styles.errorText}>{editErrors.editFabricType.message}</div>
                            )}
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
                    title="Видалення компонента"
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
                            Ви дійсно бажаєте видалити компонент?
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

export default ComponentTemplates;
