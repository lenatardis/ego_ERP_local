// CreateCustomOptions.jsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
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
import {Pagination} from "@mui/material";

import CustomCheckbox from "../../../Common/CustomCheckbox/CustomCheckbox.jsx";
import OptionLimitLabel from "../../../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../../../Common/LimitedCell/LimitedCell.jsx";

import {
    fetchComponentOptionTemplates,
    fetchComponentTypes,
    fetchOptionParts,
    createComponentOptionTemplate,
    editComponentOptionTemplate,
    deleteComponentOptionTemplate,
} from "../../../../api/tablesApi.js";
import {getAccessToken} from "../../../../api/authStorage.js";

import {useAppDispatch} from "../../../../hooks/redux.jsx";
import {setIsActivePopup} from "../../../../store/main-slice.js";
import CustomLoadSelect from "../../../Common/CustomLoadSelect/CustomLoadSelect.jsx";
import TabsLinks from "../../TabLinks/TabLinks.jsx";
import OptionsInnerTabs from "../../TabLinks/OptionInnerTabs.jsx";
import {useStickyXScroll} from "../../../../hooks/useStickyXScroll.jsx";
import ArrBack from "../../../Common/ArrBack/ArrBack.jsx";


/* helpers */
const mapApiTemplateToRow = (item) => {
    const typeObj = item?.type ?? null;
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
        typeId: typeObj?.id ?? null,
        typeName: typeObj?.name ?? "-",
        partIds: partsArr.map((p) => p?.id).filter((x) => x != null),
        partsLabel,
        raw: item,
    };
};

const toIdsString = (arr) =>
    Array.isArray(arr) && arr.length ? arr.map((x) => Number(x)).filter(Number.isFinite).join(",") : undefined;

const MAX_OPTION_TEXT_LENGTH = 100;


const ComponentOptions = () => {
    const dispatch = useAppDispatch();
    const scrollRef = useRef(null);

    // ghost scroll (як у Pricelist / ComponentTemplates)
    const {mainRef, StickyBar, recalcX} = useStickyXScroll({
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
    const [filters, setFilters] = useState({
        type_ids: [],
        part_ids: [],
    });

    const [filterParams, setFilterParams] = useState({
        page: 1,
        is_deleted: "false",
        name: null,
        type_ids: [],
        part_ids: [],
    });

    // checkboxes: option parts (type='component')
    const [optionParts, setOptionParts] = useState([]);
    const [isPartsLoading, setIsPartsLoading] = useState(false);

    const [partsPage, setPartsPage] = useState(1);
    const [partsTotalPages, setPartsTotalPages] = useState(1);
    const [partsNameById, setPartsNameById] = useState({});
    const partsScrollRef = useRef(null);
    // FILTER: types чекбокси
    const [filterTypes, setFilterTypes] = useState([]);
    const [isFilterTypesLoading, setIsFilterTypesLoading] = useState(false);
    const [filterTypesPage, setFilterTypesPage] = useState(1);
    const [filterTypesTotalPages, setFilterTypesTotalPages] = useState(1);
    const filterTypesScrollRef = useRef(null);

// FILTER: parts чекбокси
    const [filterParts, setFilterParts] = useState([]);
    const [isFilterPartsLoading, setIsFilterPartsLoading] = useState(false);
    const [filterPartsPage, setFilterPartsPage] = useState(1);
    const [filterPartsTotalPages, setFilterPartsTotalPages] = useState(1);
    const filterPartsScrollRef = useRef(null);
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);


    const updateRows = (updater) => setAllRows((prev) => updater(prev));

    const fetchTypePage = useCallback(async ({page, page_size}) => {
        const token = getAccessToken();
        const data = await fetchComponentTypes(token, {
            page,
            page_size,
            is_deleted: "false"
        });

        const list = Array.isArray(data?.component_types) ? data.component_types : [];
        const totalPages = Number(data?.total_pages) || 1;

        return {
            options: list.map((t) => ({value: t.id, name: t.name ?? ""})),
            totalPages,
        };
    }, []);

    const fetchFilterTypesPage = useCallback(async (pageToLoad = 1) => {
        try {
            setIsFilterTypesLoading(true);
            const token = getAccessToken();

            const data = await fetchComponentTypes(token, {
                page: pageToLoad,
                page_size: 20,
                is_deleted: "false",
            });

            const list = Array.isArray(data?.component_types) ? data.component_types : [];
            const total = Number(data?.total_pages) || 1;

            setFilterTypes(list.map((t) => ({id: t.id, name: t.name ?? ""})));
            setFilterTypesTotalPages(total);
        } catch (e) {
            console.error("Failed to load filter types:", e);
            setFilterTypes([]);
            setFilterTypesTotalPages(1);
        } finally {
            setIsFilterTypesLoading(false);
        }
    }, []);

    const fetchFilterPartsPage = useCallback(async (pageToLoad = 1) => {
        try {
            setIsFilterPartsLoading(true);
            const token = getAccessToken();

            const data = await fetchOptionParts(token, {
                page: pageToLoad,
                page_size: 20,
                type: "component",
                is_deleted: "false",
            });

            const list = Array.isArray(data?.option_parts) ? data.option_parts : [];
            const total = Number(data?.total_pages) || 1;

            setFilterParts(list.map((p) => ({id: p.id, name: p.name ?? ""})));
            setFilterPartsTotalPages(total);
        } catch (e) {
            console.error("Failed to load filter parts:", e);
            setFilterParts([]);
            setFilterPartsTotalPages(1);
        } finally {
            setIsFilterPartsLoading(false);
        }
    }, []);


    const fetchOptionPartsPage = useCallback(async (pageToLoad = 1) => {
        try {
            setIsPartsLoading(true);
            const token = getAccessToken();

            const data = await fetchOptionParts(token, {
                page: pageToLoad,
                type: "component",
                is_deleted: "false"
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
                const next = {...prev};
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
                type_ids: toIdsString(params.type_ids),
                part_ids: toIdsString(params.part_ids),
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

        // popup parts
        setPartsPage(1);
        fetchOptionPartsPage(1);

        // NEW: filter чекбокси
        setFilterTypesPage(1);
        fetchFilterTypesPage(1);

        setFilterPartsPage(1);
        fetchFilterPartsPage(1);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyFilters = (patch) => {
        const next = {...filterParams, ...patch, page: 1};
        setFilterParams(next);
        setPage(1);
        fetchData(next);
    };

    const toggleFilterTypeId = (id, checked) => {
        setFilters((prev) => {
            const set = new Set(prev.type_ids);
            if (checked) set.add(id);
            else set.delete(id);
            const nextIds = Array.from(set);
            applyFilters({type_ids: nextIds});
            return {...prev, type_ids: nextIds};
        });
    };

    const toggleFilterPartId = (id, checked) => {
        setFilters((prev) => {
            const set = new Set(prev.part_ids);
            if (checked) set.add(id);
            else set.delete(id);
            const nextIds = Array.from(set);
            applyFilters({part_ids: nextIds});
            return {...prev, part_ids: nextIds};
        });
    };

    const handleFilterTypesPageChange = async (event, value) => {
        if (filterTypesPage === value) return;
        setFilterTypesPage(value);
        await fetchFilterTypesPage(value);

        requestAnimationFrame(() => {
            filterTypesScrollRef.current?.scrollTo({top: 0, behavior: "auto"});
        });
    };

    const handleFilterPartsPageChange = async (event, value) => {
        if (filterPartsPage === value) return;
        setFilterPartsPage(value);
        await fetchFilterPartsPage(value);

        requestAnimationFrame(() => {
            filterPartsScrollRef.current?.scrollTo({top: 0, behavior: "auto"});
        });
    };

    const onSendFilters = (newParams) => {
        const next = {...newParams, page: 1};
        setFilterParams(next);
        setPage(1);
        fetchData(next);
    };

    const handleSearch = () => {
        onSendFilters({ ...filterParams, name: searchValue?.trim() || null });
    };

    const handlePartsPageChange = async (event, value) => {
        if (partsPage === value) return;

        setPartsPage(value);
        await fetchOptionPartsPage(value);

        // скидаємо скрол всередині блоку, як у KitTemplates
        requestAnimationFrame(() => {
            if (partsScrollRef.current) {
                partsScrollRef.current.scrollTo({top: 0, behavior: "auto"});
            }
        });
    };


    const resetAllFilters = () => {
        const next = {page: 1, is_deleted: "false", name: null, type_ids: [], part_ids: []};
        setFilters({type_ids: [], part_ids: []});
        setFilterParams(next);
        setSearchValue(null);
        setPage(1);
        fetchData(next);

        // опційно: повернути фільтр-списки на 1 сторінку
        setFilterTypesPage(1);
        fetchFilterTypesPage(1);
        setFilterPartsPage(1);
        fetchFilterPartsPage(1);
    };

    const handlePaginationChange = (event, value) => {
        if (page !== value) {
            setPage(value);
            const next = {...filterParams, page: value};
            setFilterParams(next);
            window.scrollTo({top: 0, behavior: "auto"});
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
        setCreateForm({name: "", description: "", typeId: "", partIds: []});
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);
        setPartsPage(1);
        fetchOptionPartsPage(1);
        dispatch(setIsActivePopup(true));
    };

    const closeCreatePopup = () => {
        setIsCreatePopupOpen(false);
        setCreateForm({name: "", description: "", typeId: "", partIds: []});
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
            const next = {...prev};
            delete next[key];
            return next;
        });
    };

    const toggleCreatePart = (partId, checked) => {
        // підхоплюємо name з поточної сторінки
        if (checked) {
            const found = optionParts.find((p) => p.id === partId);
            if (found?.name) {
                setPartsNameById((prev) => ({...prev, [partId]: found.name}));
            }
        }

        setCreateForm((prev) => {
            const set = new Set(prev.partIds);
            if (checked) set.add(partId);
            else set.delete(partId);
            return {...prev, partIds: Array.from(set)};
        });
    };


    const handleCreateSave = async () => {
        const errors = {};
        const nameTrimmed = createForm.name.trim();
        const typeId = createForm.typeId;

        if (!nameTrimmed) errors.createName = {message: "Вкажіть назву"};
        if (nameTrimmed.length > MAX_OPTION_TEXT_LENGTH) {
            errors.createName = { message: "Назва має бути не більше 100 символів" };
        }

        if ((createForm.description ?? "").length > MAX_OPTION_TEXT_LENGTH) {
            errors.createDescription = { message: "Опис має бути не більше 100 символів" };
        }
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
        const partsArrRaw = Array.isArray(raw?.part) ? raw.part : [];
        const partsArr = partsArrRaw.filter((p) => !p?.deleted_at);

        // 1) назви для вже вибраних частин — беремо з raw.part (бо вони точно є)
        setPartsNameById((prev) => {
            const next = {...prev};
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
        setEditForm({name: "", description: "", typeId: "", partIds: []});
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
            const next = {...prev};
            delete next[key];
            return next;
        });
    };

    const toggleEditPart = (partId, checked) => {
        if (checked) {
            const found = optionParts.find((p) => p.id === partId);
            if (found?.name) {
                setPartsNameById((prev) => ({...prev, [partId]: found.name}));
            }
        }

        setEditForm((prev) => {
            const set = new Set(prev.partIds);
            if (checked) set.add(partId);
            else set.delete(partId);
            return {...prev, partIds: Array.from(set)};
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
        if (nameTrimmed.length > MAX_OPTION_TEXT_LENGTH) {
            errors.editName = { message: "Назва має бути не більше 100 символів" };
        }

        if ((editForm.description ?? "").length > MAX_OPTION_TEXT_LENGTH) {
            errors.editDescription = { message: "Опис має бути не більше 100 символів" };
        }
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

            updateRows((prev) => prev.map((r) => (r.id === editingRowId ? {...r, ...updatedRow} : r)));
            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit component option template:", e);
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
            await deleteComponentOptionTemplate(token, deleteTarget.id);

            updateRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            closeDeletePopup();
        } catch (e) {
            console.error("Failed to delete component option template:", e);
        } finally {
            setIsDeleting(false);
        }
    };

    const renderSelectedParts = (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) return null;
        if (partsTotalPages <= 1) return null; // як ти просила: тільки якщо сторінок > 1

        const names = ids.map((id) => partsNameById[id] || `#${id}`).join(", ");

        return (
            <p style={{margin: "5px 0 5px", fontStyle: "italic"}}>
                * Вже обрано: {names}
            </p>
        );
    };


    const columns = useMemo(
        () => [
            {key: "id", title: "ID", width: "60px"},
            {key: "name", title: "Назва",  render: (_, row) => <LimitedCell value={row.name} />},
            {
                key: "description",
                title: "Опис",
               render: (_, row) => <LimitedCell value={row.description} lineClamp={4} />,
            },
            {
                key: "typeName",
                title: "Тип",
                render: (_, row) => row.typeName || "-",
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
        [allRows]
    );

    const minWidthPx = useMemo(() => {
        return columns.reduce((acc, col) => {
            const w = col.width ? parseInt(col.width, 10) || 160 : 160;
            return acc + w;
        }, 0);
    }, [columns]);

    const renderLimitedCell = (value, fallback = "-") => {
        const text = value?.trim() ? value : fallback;

        return (
            <span
                title={text}
                style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    lineHeight: "1.35",
                }}
            >
                {text}
            </span>
        );
    };

    const resetXScrollToStart = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.scrollTo({left: 0, behavior: "auto"});
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
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
                title="Опції компонентів"
            />

            <TabsLinks/>

            <OptionsInnerTabs/>

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

            <div
                style={{overflowX: "auto", paddingBottom: 8}}
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
                <div style={{minWidth: `${minWidthPx}px`}}>
                    <Table columns={columns} data={allRows} centered hideHeader/>
                </div>
            </div>

            {/* ghost scroll bar */}
            <StickyBar/>

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>

                {/* TYPES чекбокси */}
                <div style={{marginTop: 12}}>
                    <p style={{margin: "0 0 8px 0"}}>Типи:</p>

                    {isFilterTypesLoading && <div className={styles.helperText}>Завантаження…</div>}
                    {!isFilterTypesLoading && filterTypes.length === 0 && (
                        <div className={styles.helperText}>Немає типів</div>
                    )}

                    <div
                        ref={filterTypesScrollRef}
                        className={styles.filterBlock}
                    >
                        {filterTypes.map((t) => (
                            <div key={t.id} style={{marginBottom: 10}}>
                                <CustomCheckbox
                                    name={t.name}
                                    value={t.id}
                                    isChecked={filters.type_ids.includes(t.id)}
                                    isLoading={isFilterTypesLoading}
                                    onChange={(checked) => toggleFilterTypeId(t.id, checked)}
                                    label
                                    darkText
                                />
                            </div>
                        ))}
                    </div>

                    {filterTypesTotalPages > 1 && (
                        <div style={{marginTop: 10}}>
                            <Pagination
                                count={filterTypesTotalPages}
                                page={filterTypesPage}
                                siblingCount={1}
                                boundaryCount={1}
                                hidePrevButton
                                hideNextButton
                                onChange={handleFilterTypesPageChange}
                            />
                        </div>
                    )}
                </div>

                {/* PARTS чекбокси */}
                <div style={{marginTop: 16}}>
                    <p style={{margin: "0 0 8px 0"}}>Частини:</p>

                    {isFilterPartsLoading && <div className={styles.helperText}>Завантаження…</div>}
                    {!isFilterPartsLoading && filterParts.length === 0 && (
                        <div className={styles.helperText}>Немає частин</div>
                    )}

                    <div
                        ref={filterPartsScrollRef}
                        className={styles.filterBlock}
                    >
                        {filterParts.map((p) => (
                            <div key={p.id} style={{marginBottom: 10}}>
                                <CustomCheckbox
                                    name={p.name}
                                    value={p.id}
                                    isChecked={filters.part_ids.includes(p.id)}
                                    isLoading={isFilterPartsLoading}
                                    onChange={(checked) => toggleFilterPartId(p.id, checked)}
                                    label
                                    darkText
                                />
                            </div>
                        ))}
                    </div>

                    {filterPartsTotalPages > 1 && (
                        <div style={{marginTop: 10}}>
                            <Pagination
                                count={filterPartsTotalPages}
                                page={filterPartsPage}
                                siblingCount={1}
                                boundaryCount={1}
                                hidePrevButton
                                hideNextButton
                                onChange={handleFilterPartsPageChange}
                            />
                        </div>
                    )}
                </div>
            </Filter>

            <PopupCloser isShow={isShowFilter} onClose={onCloseFilter}/>

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

            {isLoading && <Preloader/>}

            {/* CREATE */}
            {isCreatePopupOpen && (
                <CentralPopup title="Додавання опції компонентів" onClose={closeCreatePopup}>
                    <div style={{display: "flex", flexDirection: "column", rowGap: "16px"}}>
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
                                maxLength={MAX_OPTION_TEXT_LENGTH}
                                onChange={(e) => {
                                    const value = e.target.value.slice(0, MAX_OPTION_TEXT_LENGTH);
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
                                    setCreateForm((prev) => ({...prev, typeId: value}));
                                    clearCreateError("createType");
                                }}
                                fetchPage={fetchTypePage}
                            />

                            {createErrors.createType && (
                                <div className={styles.errorText}>{createErrors.createType.message}</div>
                            )}
                        </div>

                        <div>
                            <p style={{margin: "0 0 8px 0"}}>Оберіть частини опції:</p>

                            {isPartsLoading && <div className={styles.helperText}>Завантаження частин…</div>}

                            {!isPartsLoading && optionParts.length === 0 && (
                                <div className={styles.helperText}>Немає доступних частин</div>
                            )}

                            {renderSelectedParts(createForm.partIds)}

                            {/* СКРОЛ-БЛОК ДЛЯ optionParts */}
                            <div
                                ref={partsScrollRef}
                                style={{
                                    height: 160,
                                    overflow: "auto",
                                    border: "1px solid #ddd",
                                    borderRadius: 6,
                                    padding: 8,
                                }}
                            >
                                {optionParts.map((p) => (
                                    <div key={p.id} style={{marginBottom: 10}}>
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
                                    <div style={{padding: 8, fontSize: 12, color: "#666"}}>
                                        Завантаження частин…
                                    </div>
                                )}

                                {!isPartsLoading && optionParts.length === 0 && (
                                    <div style={{padding: 8, fontSize: 12, color: "#666"}}>
                                        Немає доступних частин
                                    </div>
                                )}
                            </div>

                            {/* ПАГІНАЦІЯ ПІД СКРОЛ-БЛОКОМ */}
                            {partsTotalPages > 1 && (
                                <div style={{marginTop: 10}}>
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
                <CentralPopup title="Редагування опції компонентів" onClose={closeEditPopup}>
                    <div style={{display: "flex", flexDirection: "column", rowGap: "16px"}}>
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
                                maxLength={MAX_OPTION_TEXT_LENGTH}
                                onChange={(e) => {
                                    const value = e.target.value.slice(0, MAX_OPTION_TEXT_LENGTH);
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
                                    setEditForm((prev) => ({...prev, typeId: value}));
                                    clearEditError("editType");
                                }}
                                fetchPage={fetchTypePage}
                            />

                            {editErrors.editType && (
                                <div className={styles.errorText}>{editErrors.editType.message}</div>
                            )}
                        </div>

                        <div>
                            <p style={{margin: "0 0 8px 0"}}>Оберіть частини опції:</p>

                            {isPartsLoading && <div className={styles.helperText}>Завантаження частин…</div>}

                            {!isPartsLoading && optionParts.length === 0 && (
                                <div className={styles.helperText}>Немає доступних частин</div>
                            )}

                            {renderSelectedParts(editForm.partIds)}

                            <div
                                ref={partsScrollRef}
                                style={{
                                    height: 160,
                                    overflow: "auto",
                                    border: "1px solid #ddd",
                                    borderRadius: 6,
                                    padding: 8,
                                }}
                            >
                                {optionParts.map((p) => (
                                    <div key={p.id} style={{marginBottom: 10}}>
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
                                    <div style={{padding: 8, fontSize: 12, color: "#666"}}>
                                        Завантаження частин…
                                    </div>
                                )}

                                {!isPartsLoading && optionParts.length === 0 && (
                                    <div style={{padding: 8, fontSize: 12, color: "#666"}}>
                                        Немає доступних частин
                                    </div>
                                )}
                            </div>

                            {partsTotalPages > 1 && (
                                <div style={{marginTop: 10}}>
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
                    title={"Видалення опції компонентів"}
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
                            Ви дійсно бажаєте видалити опцію компонентів?
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

export default ComponentOptions;
