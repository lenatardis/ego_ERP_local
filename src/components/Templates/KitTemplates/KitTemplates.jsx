// KitTemplates.jsx
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
import CustomCheckbox from "../../Common/CustomCheckbox/CustomCheckbox.jsx";

import Preloader from "../../Common/Preloader/Preloader.jsx";
import { Pagination } from "@mui/material";

import TabsLinks from "../TabLinks/TabLinks.jsx";

import { useObjectUrl } from "../../../hooks/useObjectUrl";

import {
    fetchKitTemplates,
    createKitTemplate,
    editKitTemplate,
    deleteKitTemplate,
    fetchKitSizes,
    fetchComponentTemplates,
    fetchProductTypesCRM,
} from "../../../api/tablesApi.js";

import { getAccessToken } from "../../../api/authStorage.js";
import { useAppDispatch } from "../../../hooks/redux.jsx";
import { setIsActivePopup } from "../../../store/main-slice.js";

import { useStickyXScroll } from "../../../hooks/useStickyXScroll.jsx";
import CustomLoadSelect from "../../Common/CustomLoadSelect/CustomLoadSelect.jsx";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";
import OptionLimitLabel from "../../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../../Common/LimitedCell/LimitedCell.jsx";

/* helpers */

const normalizeTotalPages = (data) =>
    Number(data?.total_pages ?? data?.totalPages ?? data?.pages ?? 0) || 0;

const normalizeKitTemplates = (data) =>
    data?.kit_templates ?? data?.kitTemplates ?? data?.results ?? [];

const renderPhotoCell = (src) => {
    const url = (src ?? "").toString().trim();
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

const mapApiItemToRow = (item, kitSizeMap, fabricTypeMap) => {
    const templateId = item?.template?.id ?? item?.template ?? null;
    const templateName = item?.template?.name ?? kitSizeMap.get(String(templateId)) ?? (templateId != null ? `#${templateId}` : "—");

    const fabricTypeId = item?.fabric_type?.id ?? item?.fabric_type ?? null;
    const fabricTypeName = item?.fabric_type?.name ?? item?.fabric_type?.type ?? fabricTypeMap.get(String(fabricTypeId)) ?? (fabricTypeId != null ? `#${fabricTypeId}` : "—");

    // component_size приходить як string/array/anything — покажемо кількість
    let compIds = [];
    if (Array.isArray(item?.component_size)) compIds = item.component_size;
    else if (typeof item?.component_size === "string") {
        try {
            compIds = JSON.parse(item.component_size) || [];
        } catch {
            compIds = [];
        }
    }

    return {
        id: item?.id,
        name: item?.name ?? "",
        short_name: item?.short_name ?? "",
        additional_fabric_consumption_price: item?.additional_fabric_consumption_price ?? "",
        template_name: templateName,
        fabric_type_name: fabricTypeName,
        components_count: Array.isArray(compIds) ? compIds.length : 0,
        image: item?.image ?? null,
        deleted_at: item?.deleted_at ?? null,
        raw: item,
    };
};

// витягнути мінімальну ширину з width (px/minmax/fr)
const getMinWidthFromCol = (w, fallbackPx = 220) => {
    if (!w) return fallbackPx;
    const s = String(w).trim();

    const px = s.match(/^(\d+)\s*px$/i);
    if (px) return Number(px[1]);

    const mm = s.match(/minmax\(\s*(\d+)\s*px/i);
    if (mm) return Number(mm[1]);

    // fr / інші
    return 260;
};

const MAX_NAME_LENGTH = 100;
const MAX_SHORT_NAME_LENGTH = 10;
const MAX_ADDITIONAL_FABRIC_LENGTH = 10;

const KitTemplates = () => {
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

    const updateRows = useCallback((updater) => setAllRows((prev) => updater(prev)), []);

    const resetXScrollToStart = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.scrollTo({ left: 0, behavior: "auto" });
        el.dispatchEvent(new Event("scroll"));

        requestAnimationFrame(() => {
            recalcX();
        });
    }, [recalcX]);

    // maps for rendering names in table
    const [kitSizeMap, setKitSizeMap] = useState(() => new Map());
    const [fabricTypeMap, setFabricTypeMap] = useState(() => new Map());

    const loadKitSizesMap = useCallback(async () => {
        try {
            const token = getAccessToken();
            // kit sizes зазвичай мало — тягнемо 1 сторінку з великим page_size
            const data = await fetchKitSizes(token, { page: 1, page_size: 200, is_deleted: "false" });
            const list = data?.kit_sizes ?? data?.results ?? [];
            const m = new Map();
            list.forEach((x) => {
                const id = x?.id;
                if (id != null) m.set(String(id), x?.name ?? `#${id}`);
            });
            setKitSizeMap(m);
        } catch (e) {
            console.error("Failed to load kit sizes map:", e);
            setKitSizeMap(new Map());
        }
    }, []);

    const loadFabricTypesMap = useCallback(async () => {
        try {
            const token = getAccessToken();
            const list = await fetchProductTypesCRM(token);
            const arr = Array.isArray(list) ? list : (list?.results ?? []);
            const m = new Map();
            arr.forEach((x) => {
                const id = x?.id;
                const name = x?.name ?? x?.title ?? x?.type ?? x?.label;
                if (id != null) m.set(String(id), name ?? `#${id}`);
            });
            setFabricTypeMap(m);
        } catch (e) {
            console.error("Failed to load fabric types map:", e);
            setFabricTypeMap(new Map());
        }
    }, []);

    const fetchData = useCallback(
        async (params) => {
            try {
                setIsLoading(true);
                const token = getAccessToken();

                const data = await fetchKitTemplates(token, {
                    page: params.page,
                    page_size: 10,
                    is_deleted: params.is_deleted === "" ? undefined : params.is_deleted,
                    name: params.name || undefined,
                    short_name: params.short_name || undefined,
                });

                const list = normalizeKitTemplates(data);
                const mapped = list.map((x) => mapApiItemToRow(x, kitSizeMap, fabricTypeMap));

                setAllRows(mapped);
                setTotalPages(normalizeTotalPages(data));
            } catch (e) {
                console.error("Failed to load kit templates:", e);
                setAllRows([]);
                setTotalPages(0);
            } finally {
                setIsLoading(false);
            }
        },
        [kitSizeMap, fabricTypeMap]
    );

    useEffect(() => {
        loadKitSizesMap();
        loadFabricTypesMap();
    }, [loadKitSizesMap, loadFabricTypesMap]);

    useEffect(() => {
        fetchData(filterParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kitSizeMap.size, fabricTypeMap.size]); // щоб перерендерило назви після підвантаження мап

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
    }, [onSendFilters, filterParams, searchValue]);


    const resetAllFilters = useCallback(() => {
        const next = { page: 1, is_deleted: "false", name: null, short_name: "" };
        setFilters({});
        setFilterParams(next);
        setSearchValue(null);
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
                resetXScrollToStart();
                fetchData(next);
            }
        },
        [page, filterParams, fetchData, resetXScrollToStart]
    );

    const onCloseFilter = useCallback(() => setIsShowFilter(false), []);

    // -------------------
    // POPUPS: create/edit
    // -------------------
    const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        short_name: "",
        additional_fabric_consumption_price: "",
        component_size: [],
        template: "",
        fabric_type: "",
        image: null,
    });
    const [createErrors, setCreateErrors] = useState({});

    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const createPreviewUrl = useObjectUrl(createForm.image);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        short_name: "",
        additional_fabric_consumption_price: "",
        component_size: [],
        template: "",
        fabric_type: "",
        image: null, // новий файл, якщо вибереш
    });
    const editPreviewUrl = useObjectUrl(editForm.image);
    const [editErrors, setEditErrors] = useState({});
    const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const clearErr = useCallback((setErrFn, key) => {
        setErrFn((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    // draft для інпутів кількості (щоб можна було стирати і вводити нормально)
    const [qtyDraftCreate, setQtyDraftCreate] = useState({}); // { [id]: "2" | "" }
    const [qtyDraftEdit, setQtyDraftEdit] = useState({});

    // тільки цифри або пусто
    const toDigitsOrEmpty = (v) => String(v ?? "").replace(/[^\d]/g, "");

    // прибрати драфт для конкретного id (щоб UI знову показував дефолт з форми)
    const clearQtyDraftKey = (setDraft, id) => {
        const key = String(id);
        setDraft((prev) => {
            if (!prev || !(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const applyQtyDraftsToForm = (form, draft) => {
        const base = Array.isArray(form.component_size) ? form.component_size.map((x) => Number(x)) : [];
        const d = draft || {};

        let nextArr = base;

        for (const [idStr, raw] of Object.entries(d)) {
            const id = Number(idStr);
            if (!Number.isFinite(id)) continue;

            const qty = raw === "" ? 0 : clampInt(raw, 0, 999);

            nextArr = nextArr.filter((x) => Number(x) !== id);
            if (qty > 0) nextArr = nextArr.concat(Array(qty).fill(id));
        }

        return { ...form, component_size: nextArr };
    };


    const openCreatePopup = useCallback(() => {
        setCreateForm({
            name: "",
            short_name: "",
            additional_fabric_consumption_price: "",
            component_size: [],
            template: "",
            fabric_type: "",
            image: null,
        });
        setCreateErrors({});
        setIsCreatePopupOpen(true);
        setIsEditPopupOpen(false);
        setQtyDraftCreate({});
        dispatch(setIsActivePopup(true));
    }, [dispatch]);

    const closeCreatePopup = useCallback(() => {
        setIsCreatePopupOpen(false);
        setCreateErrors({});
        dispatch(setIsActivePopup(false));
    }, [dispatch]);

    const openEditPopup = useCallback(
        (row) => {
            const raw = row?.raw ?? {};
            const templateId = raw?.template?.id ?? raw?.template ?? "";
            const fabricTypeId = raw?.fabric_type?.id ?? raw?.fabric_type ?? "";

            let compIds = [];
            if (Array.isArray(raw?.component_size)) compIds = raw.component_size;
            else if (typeof raw?.component_size === "string") {
                try {
                    compIds = JSON.parse(raw.component_size) || [];
                } catch {
                    compIds = [];
                }
            }

            setEditingRowId(row?.id ?? null);
            setEditForm({
                name: raw?.name ?? row?.name ?? "",
                short_name: raw?.short_name ?? row?.short_name ?? "",
                additional_fabric_consumption_price: raw?.additional_fabric_consumption_price ?? row?.additional_fabric_consumption_price ?? "",
                component_size: Array.isArray(compIds) ? compIds.map((x) => Number(x)) : [],
                template: templateId ? String(templateId) : "",
                fabric_type: fabricTypeId ? String(fabricTypeId) : "",
                image: null,
                imageUrl: (raw?.image ?? row?.image ?? "") || ""
            });

            setEditErrors({});
            setIsEditPopupOpen(true);
            setQtyDraftEdit({});
            setIsCreatePopupOpen(false);
            dispatch(setIsActivePopup(true));
        },
        [dispatch]
    );

    const closeEditPopup = useCallback(() => {
        setIsEditPopupOpen(false);
        setEditingRowId(null);
        setEditErrors({});
        dispatch(setIsActivePopup(false));
    }, [dispatch]);

    const validateForm = useCallback((form, mode) => {
        const errors = {};
        const nameTrimmed = String(form.name ?? "").trim();
        const shortTrimmed = String(form.short_name ?? "").trim();
        const additionalFabricTrimmed = String(form.additional_fabric_consumption_price ?? "").trim();

        const pref = mode === "create" ? "create" : "edit";

        if (!nameTrimmed) errors[`${pref}Name`] = { message: "Вкажіть назву" };
        if (nameTrimmed.length > MAX_NAME_LENGTH) {
            errors[`${pref}Name`] = { message: "Назва має бути не більше 100 символів" };
        }

        if (!shortTrimmed) errors[`${pref}Short`] = { message: "Вкажіть коротку назву" };
        if (shortTrimmed.length > MAX_SHORT_NAME_LENGTH) {
            errors[`${pref}Short`] = { message: "Коротка назва має бути не більше 10 символів" };
        }

        if (additionalFabricTrimmed.length > MAX_ADDITIONAL_FABRIC_LENGTH) {
            errors[`${pref}AddPrice`] = { message: "Додаткова витрата має бути не більше 10 символів" };
        }

        if (!String(form.template ?? "").trim()) {
            errors[`${pref}Template`] = { message: "Оберіть розмір комплекту" };
        }

        if (!String(form.fabric_type ?? "").trim()) {
            errors[`${pref}FabricType`] = { message: "Оберіть тип тканини" };
        }

        return errors;
    }, []);

    const handleCreateSave = useCallback(async () => {
        const formToSave = applyQtyDraftsToForm(createForm, qtyDraftCreate);

        const errors = validateForm(formToSave, "create");
        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const created = await createKitTemplate(token, {
                name: formToSave.name.trim(),
                short_name: formToSave.short_name.trim(),
                additional_fabric_consumption_price: formToSave.additional_fabric_consumption_price,
                component_size: formToSave.component_size,
                template: formToSave.template ? Number(formToSave.template) : null,
                fabric_type: formToSave.fabric_type ? Number(formToSave.fabric_type) : null,
                image: formToSave.image,
            });

            const newRow = mapApiItemToRow(created, kitSizeMap, fabricTypeMap);
            updateRows((prev) => [newRow, ...prev]);
            closeCreatePopup();
        } catch (e) {
            console.error("Failed to create kit template:", e);
            window.alert("Не вдалося створити. Спробуй ще раз.");
        }
    }, [createForm, qtyDraftCreate, validateForm, kitSizeMap, fabricTypeMap, updateRows, closeCreatePopup]);

    const handleEditSave = useCallback(async () => {
        if (!editingRowId) {
            closeEditPopup();
            return;
        }

        const formToSave = applyQtyDraftsToForm(editForm, qtyDraftEdit);

        const errors = validateForm(formToSave, "edit");
        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        try {
            const token = getAccessToken();

            const updated = await editKitTemplate(token, editingRowId, {
                name: formToSave.name.trim(),
                short_name: formToSave.short_name.trim(),
                additional_fabric_consumption_price: formToSave.additional_fabric_consumption_price,
                component_size: formToSave.component_size,
                template: formToSave.template ? Number(formToSave.template) : null,
                fabric_type: formToSave.fabric_type ? Number(formToSave.fabric_type) : null,
                image: formToSave.image,
            });

            const updatedRow = mapApiItemToRow(updated, kitSizeMap, fabricTypeMap);
            updateRows((prev) => prev.map((r) => (r.id === editingRowId ? { ...r, ...updatedRow } : r)));
            closeEditPopup();
        } catch (e) {
            console.error("Failed to edit kit template:", e);
            window.alert("Не вдалося зберегти. Спробуй ще раз.");
        }
    }, [editingRowId, editForm, qtyDraftEdit, validateForm, kitSizeMap, fabricTypeMap, updateRows, closeEditPopup]);

    const openDeletePopup = useCallback((row) => {
        if (!row?.id) return;

        setDeleteTarget(row);
        setIsDeletePopupOpen(true);
        dispatch(setIsActivePopup(true));
    }, [dispatch]);

    const closeDeletePopup = useCallback(() => {
        setIsDeletePopupOpen(false);
        setDeleteTarget(null);
        dispatch(setIsActivePopup(false));
    }, [dispatch]);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteTarget?.id) return;

        try {
            setIsDeleting(true);

            const token = getAccessToken();
            await deleteKitTemplate(token, deleteTarget.id);

            updateRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            closeDeletePopup();
        } catch (e) {
            console.error("Failed to delete kit template:", e);
        } finally {
            setIsDeleting(false);
        }
    }, [deleteTarget, updateRows, closeDeletePopup]);
    // -------------------
    // Component templates чекбокси в попапі (пагінація)
    // -------------------
    const [ctLoading, setCtLoading] = useState(false);
    const [ctPage, setCtPage] = useState(1);
    const [ctTotalPages, setCtTotalPages] = useState(1);
    const [ctItems, setCtItems] = useState([]);
    const [ctCacheById, setCtCacheById] = useState(() => new Map()); // щоб показувати “Вибрано …” по назвах

    const loadComponentTemplatesPage = useCallback(async (nextPage) => {
        try {
            setCtLoading(true);
            const token = getAccessToken();

            const data = await fetchComponentTemplates(token, {
                page: nextPage,
                page_size: 10,
                is_deleted: "false",
            });

            const list = data?.component_templates ?? data?.results ?? [];
            const tp = Number(data?.total_pages ?? data?.totalPages ?? 1) || 1;

            setCtItems(list);
            setCtTotalPages(tp);
            setCtPage(nextPage);

            setCtCacheById((prev) => {
                const m = new Map(prev);
                list.forEach((x) => {
                    const id = x?.id;
                    const name = x?.name ?? (id != null ? `#${id}` : "");
                    if (id != null) m.set(String(id), name);
                });
                return m;
            });
        } catch (e) {
            console.error("Failed to load component templates:", e);
            setCtItems([]);
            setCtTotalPages(1);
            setCtPage(1);
        } finally {
            setCtLoading(false);
        }
    }, []);

    // прогріти ctCacheById першими N сторінками (окрім already loaded 1-ї),
    // НЕ чіпаючи ctItems/ctPage — лише кеш назв
    const warmCtCacheFirstPages = useCallback(async (pagesToWarm = 3, pageSize = 10) => {
        try {
            const token = getAccessToken();

            // припустимо, що 1-шу сторінку ми вже вантажимо через loadComponentTemplatesPage(1)
            const startPage = 2;
            const endPage = Math.max(startPage, pagesToWarm);

            for (let p = startPage; p <= endPage; p++) {
                const data = await fetchComponentTemplates(token, {
                    page: p,
                    page_size: pageSize,
                    is_deleted: "false",
                });

                const list = data?.component_templates ?? data?.results ?? [];

                // важливо: оновлюємо тільки кеш
                setCtCacheById((prev) => {
                    const m = new Map(prev);
                    list.forEach((x) => {
                        const id = x?.id;
                        const name = x?.name ?? (id != null ? `#${id}` : "");
                        if (id != null && !m.has(String(id))) {
                            m.set(String(id), name);
                        }
                    });
                    return m;
                });

                // опційно: якщо сторінки закінчилися — зупиняємось
                const total = Number(data?.total_pages ?? data?.totalPages ?? 1) || 1;
                if (p >= total) break;
            }
        } catch (e) {
            console.error("warmCtCacheFirstPages failed:", e);
        }
    }, []);


    useEffect(() => {
        if (isCreatePopupOpen || isEditPopupOpen) {
            loadComponentTemplatesPage(1).then(() => {
                // прогріваємо ще 2 сторінки додатково (разом буде 3)
                warmCtCacheFirstPages(3, 10);
            });
        }
    }, [isCreatePopupOpen, isEditPopupOpen, loadComponentTemplatesPage, warmCtCacheFirstPages]);


    const clampInt = (v, min = 0, max = 999) => {
        const n = Number.parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
        if (!Number.isFinite(n)) return min;
        return Math.min(max, Math.max(min, n));
    };

    const getQtyFromIds = (ids, id) => {
        const arr = Array.isArray(ids) ? ids : [];
        const target = Number(id);
        let c = 0;
        for (const x of arr) if (Number(x) === target) c++;
        return c;
    };

    const summarizeSelected = (ids, ctCacheById, maxItems = 6) => {
        const arr = Array.isArray(ids) ? ids : [];

        const counts = new Map();
        for (const x of arr) {
            const key = String(Number(x));
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        const entries = Array.from(counts.entries()); // [ [idStr, qty], ... ]

        const shown = entries.slice(0, maxItems).map(([idStr, qty]) => {
            const name = ctCacheById.get(idStr) || `#${idStr}`;
            return qty > 1 ? `${name} ×${qty}` : name;
        });

        return {
            totalQty: arr.length,          // штук (з дублями)
            uniqueCount: entries.length,   // позицій (унікальних id)
            shown,
            hasMore: entries.length > maxItems,
        };
    };


    // set quantity: прибираємо всі входження id і додаємо рівно qty разів
    const setQtyInForm = (setForm, id, qty) => {
        const target = Number(id);
        const q = clampInt(qty, 0, 999);

        setForm((prev) => {
            const prevArr = Array.isArray(prev.component_size)
                ? prev.component_size.map((x) => Number(x))
                : [];

            const without = prevArr.filter((x) => Number(x) !== target);
            const withAdded = q > 0 ? without.concat(Array(q).fill(target)) : without;

            return { ...prev, component_size: withAdded };
        });
    };

    // -------------------
    // columns + minWidth
    // -------------------
    const columns = useMemo(
        () => [
            { key: "id", title: "ID", width: "60px" },
            { key: "name", title: "Назва", width: "minmax(200px, 1fr)", render: (_, row) => <LimitedCell value={row.name} /> },
            { key: "short_name", title: "Коротка назва", width: "minmax(160px, 1fr)", render: (_, row) => <LimitedCell value={row.short_name} /> },
            {
                key: "image",
                title: "Фото",
                width: "110px",
                render: (_, row) => renderPhotoCell(row?.image),
            },
            {
                key: "additional_fabric_consumption_price",
                title: "Дод. витрата",
                width: "140px",
                render: (_, row) => <LimitedCell value={row.additional_fabric_consumption_price} />,
            },
            {
                key: "template_name",
                title: "Розмір",
                width: "160px",
                render: (_, row) => <LimitedCell value={row.template_name} />,
            },
            { key: "fabric_type_name", title: "Тип тканини", width: "160px" },
            { key: "components_count", title: "Компоненти", width: "80px" },
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
        [openEditPopup, openDeletePopup]
    );

    const minWidthPx = useMemo(() => {
        const sum = columns.reduce((acc, col) => acc + getMinWidthFromCol(col.width, 220), 0);
        return sum + 50;
    }, [columns]);

    useEffect(() => {
        recalcX();
    }, [minWidthPx, allRows.length, recalcX]);

    // -------------------
    // Select loaders
    // -------------------
    const fabricTypeOptions = useMemo(() => {
        const opts = [{ name: "Оберіть тип тканини", value: "" }];
        for (const [id, name] of fabricTypeMap.entries()) {
            opts.push({ name: String(name), value: String(id) });
        }
        return opts;
    }, [fabricTypeMap]);


    const fetchKitSizesPageForSelect = useCallback(async ({ page, page_size }) => {
        const token = getAccessToken();
        const data = await fetchKitSizes(token, { page, page_size, is_deleted: "false" });

        const list = data?.kit_sizes ?? data?.results ?? [];
        const totalPages = Number(data?.total_pages ?? data?.totalPages ?? 1) || 1;

        return {
            options: list.map((x) => ({ value: String(x.id), name: x.name })),
            totalPages,
        };
    }, []);

    const fetchFabricTypesPageForSelect = useCallback(async ({ page, page_size }) => {
        const token = getAccessToken();

        const ft = await fetchProductTypesCRM(token);
        const listRaw = Array.isArray(ft) ? ft : (ft?.results ?? []);

        const list = listRaw
            .filter((x) => x?.is_available !== false)
            .map((x) => ({
                value: String(x?.id ?? ""),
                name: String(x?.name ?? x?.title ?? x?.type ?? x?.label ?? (x?.id != null ? `#${x.id}` : "—")),
            }))
            .filter((x) => x.value);

        return {
            options: list,
            totalPages: 1,
        };
    }, []);

    return (
        <div className={styles.wrapper}>
            <ArrBack />
            <SearchFilter
                title="Комплекти"
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                onSearch={handleSearch}
                hideFilterButton
            />

            <TabsLinks />

            <div className={styles.topActions}>
                <button type="button" className="btnDark" onClick={openCreatePopup}>
                    <span>Додати комплект</span>
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
                <CentralPopup title="Додавання комплекту" onClose={closeCreatePopup} verticalScroll>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: 16 }}>
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
                                    clearErr(setCreateErrors, "createName");
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
                                    clearErr(setCreateErrors, "createShort");
                                },
                            }}
                        />

                        <InputBox
                            errors={createErrors}
                            name="createAddPrice"
                            label={<OptionLimitLabel text="Додаткова ціна витрати тканини" maxLength={MAX_ADDITIONAL_FABRIC_LENGTH} />}
                            placeholder="0"
                            type="number"
                            options={{
                                value: createForm.additional_fabric_consumption_price,
                                maxLength: MAX_ADDITIONAL_FABRIC_LENGTH,
                                onChange: (e) => {
                                    const value = String(e.target.value ?? "").slice(0, MAX_ADDITIONAL_FABRIC_LENGTH);
                                    setCreateForm((prev) => ({
                                        ...prev,
                                        additional_fabric_consumption_price: value,
                                    }));
                                    clearErr(setCreateErrors, "createAddPrice");
                                },
                            }}
                        />

                        <div>
                            <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
                                Розмір комплекту
                            </div>

                            <CustomLoadSelect
                                label="Оберіть розмір"
                                value={createForm.template}
                                onChange={(e) => {
                                    setCreateForm((prev) => ({ ...prev, template: e.target.value }));
                                    clearErr(setCreateErrors, "createTemplate");
                                }}
                                fetchPage={fetchKitSizesPageForSelect}
                                pageSize={25}
                                menuMaxHeight={340}
                                prefetchMinItems={30}
                                prependOptions={[{ name: "Оберіть розмір", value: "" }]}
                            />

                            {createErrors.createTemplate && (
                                <div className={styles.errorText}>{createErrors.createTemplate.message}</div>
                            )}
                        </div>

                        <div>
                            <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
                                Тип тканини
                            </div>

                            <CustomLoadSelect
                                label="Тип тканини"
                                value={createForm.fabric_type}
                                onChange={(e) => {
                                    setCreateForm((prev) => ({ ...prev, fabric_type: e.target.value }));
                                    clearErr(setCreateErrors, "createFabricType");
                                }}
                                fetchPage={fetchFabricTypesPageForSelect}
                                pageSize={50}
                                menuMaxHeight={340}
                                prefetchMinItems={30}
                                prependOptions={[{ name: "Тип тканини", value: "" }]}
                            />


                            {createErrors.createFabricType && (
                                <div className={styles.errorText}>{createErrors.createFabricType.message}</div>
                            )}
                        </div>

                        {/* component_size */}
                        <div>
                            <div style={{ marginBottom: 6, fontSize: 12, color: "#666" }}>
                                Компоненти
                            </div>

                            {(() => {
                                const s = summarizeSelected(createForm.component_size, ctCacheById, 6);

                                return (
                                    <div style={{ fontStyle: "italic", fontSize: 12, marginBottom: 8, color: "#666" }}>
                                        Вибрано: {s.totalQty} шт.
                                        {s.uniqueCount > 0 ? ` — ${s.shown.join(", ")}${s.hasMore ? "…" : ""}` : ""}
                                    </div>
                                );
                            })()}


                            <div style={{
                                height: 120,
                                overflow: "auto",
                                border: "1px solid #ddd",
                                borderRadius: 6,
                                padding: 8
                            }}>
                                {ctItems.map((ct) => {
                                    const id = ct?.id;
                                    if (id == null) return null;

                                    const label = ct?.name ?? `#${id}`;

                                    const qty = getQtyFromIds(createForm.component_size, id);
                                    const checked = qty > 0;

                                    const key = String(id);

                                    // якщо юзер ще не чіпав інпут — показуємо "1" коли не обрано, або реальну qty коли обрано
                                    const fallbackValue = checked ? String(qty) : "1";
                                    const inputValue = (key in qtyDraftCreate) ? qtyDraftCreate[key] : fallbackValue;

                                    return (
                                        <div
                                            key={id}
                                            style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <CustomCheckbox
                                                    name={label}
                                                    value={String(id)}
                                                    isChecked={checked}
                                                    onChange={(isChecked) => {
                                                        // коміт одразу по чекбоксу: 0 <-> 1 (або зберігаємо існуючу qty)
                                                        setQtyInForm(setCreateForm, id, isChecked ? Math.max(1, qty) : 0);
                                                        clearQtyDraftKey(setQtyDraftCreate, id);
                                                    }}
                                                    darkText
                                                />
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 12, color: "#666" }}>К-ть</span>

                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={inputValue}
                                                    style={{ width: 72, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd" }}
                                                    onChange={(e) => {
                                                        const next = toDigitsOrEmpty(e.target.value); // "" або "123"
                                                        setQtyDraftCreate((prev) => ({ ...prev, [key]: next }));
                                                    }}
                                                    onBlur={(e) => {
                                                        const raw = toDigitsOrEmpty(e.target.value); // "" або "123"
                                                        const nextQty = raw === "" ? 0 : clampInt(raw, 0, 999);

                                                        setQtyInForm(setCreateForm, id, nextQty);
                                                        clearQtyDraftKey(setQtyDraftCreate, id);
                                                    }}

                                                />
                                            </div>
                                        </div>
                                    );
                                })}

                                {ctLoading &&
                                    <div style={{ padding: 8, fontSize: 12, color: "#666" }}>Завантаження…</div>}
                            </div>

                            {ctTotalPages > 1 && (
                                <div style={{ marginTop: 10 }}>
                                    <Pagination
                                        count={ctTotalPages}
                                        page={ctPage}
                                        siblingCount={1}
                                        boundaryCount={1}
                                        hidePrevButton
                                        hideNextButton
                                        onChange={(e, value) => loadComponentTemplatesPage(value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* image */}
                        <div>
                            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "#666" }}>
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
                                    setCreateForm((prev) => ({ ...prev, image: file }));
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
                <CentralPopup title="Редагування комплекту" onClose={closeEditPopup} verticalScroll>
                    <div style={{ display: "flex", flexDirection: "column", rowGap: 16 }}>
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
                                    clearErr(setEditErrors, "editName");
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
                                    clearErr(setEditErrors, "editShort");
                                },
                            }}
                        />

                        <InputBox
                            errors={editErrors}
                            name="editAddPrice"
                            label={<OptionLimitLabel text="Додаткова ціна витрати тканини" maxLength={MAX_ADDITIONAL_FABRIC_LENGTH} />}
                            placeholder="0"
                            type="number"
                            options={{
                                value: editForm.additional_fabric_consumption_price,
                                maxLength: MAX_ADDITIONAL_FABRIC_LENGTH,
                                onChange: (e) => {
                                    const value = String(e.target.value ?? "").slice(0, MAX_ADDITIONAL_FABRIC_LENGTH);
                                    setEditForm((prev) => ({
                                        ...prev,
                                        additional_fabric_consumption_price: value,
                                    }));
                                    clearErr(setEditErrors, "editAddPrice");
                                },
                            }}
                        />

                        <div>
                            <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
                                Розмір комплекту
                            </div>

                            <CustomLoadSelect
                                label="Оберіть розмір"
                                value={editForm.template}
                                onChange={(e) => {
                                    setEditForm((prev) => ({ ...prev, template: e.target.value }));
                                    clearErr(setEditErrors, "editTemplate");
                                }}
                                fetchPage={fetchKitSizesPageForSelect}
                                pageSize={25}
                                menuMaxHeight={340}
                                prefetchMinItems={30}
                                prependOptions={[{ name: "Оберіть розмір", value: "" }]}
                            />

                            {editErrors.editTemplate && (
                                <div className={styles.errorText}>{editErrors.editTemplate.message}</div>
                            )}
                        </div>

                        <div>
                            <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
                                Тип тканини
                            </div>

                            <CustomLoadSelect
                                label="Тип тканини"
                                value={editForm.fabric_type}
                                onChange={(e) => {
                                    setEditForm((prev) => ({ ...prev, fabric_type: e.target.value }));
                                    clearErr(setEditErrors, "editFabricType");
                                }}
                                fetchPage={fetchFabricTypesPageForSelect}
                                pageSize={50}
                                menuMaxHeight={340}
                                prefetchMinItems={30}
                                prependOptions={[{ name: "Тип тканини", value: "" }]}
                            />

                            {editErrors.editFabricType && (
                                <div className={styles.errorText}>{editErrors.editFabricType.message}</div>
                            )}
                        </div>

                        {/* component_size */}
                        <div>
                            <div style={{ marginBottom: 6, fontSize: 12, color: "#666" }}>
                                Компоненти
                            </div>

                            {(() => {
                                const s = summarizeSelected(editForm.component_size, ctCacheById, 6);

                                return (
                                    <div style={{ fontStyle: "italic", fontSize: 12, marginBottom: 8, color: "#666" }}>
                                        Вибрано: {s.totalQty} шт.
                                        {s.uniqueCount > 0 ? ` — ${s.shown.join(", ")}${s.hasMore ? "…" : ""}` : ""}
                                    </div>
                                );
                            })()}



                            <div style={{
                                height: 120,
                                overflow: "auto",
                                border: "1px solid #ddd",
                                borderRadius: 6,
                                padding: 8
                            }}>
                                {ctItems.map((ct) => {
                                    const id = ct?.id;
                                    if (id == null) return null;

                                    const label = ct?.name ?? `#${id}`;

                                    const qty = getQtyFromIds(editForm.component_size, id);
                                    const checked = qty > 0;

                                    const key = String(id);

                                    const fallbackValue = checked ? String(qty) : "1";
                                    const inputValue = (key in qtyDraftEdit) ? qtyDraftEdit[key] : fallbackValue;

                                    return (
                                        <div
                                            key={id}
                                            style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <CustomCheckbox
                                                    name={label}
                                                    value={String(id)}
                                                    isChecked={checked}
                                                    onChange={(isChecked) => {
                                                        setQtyInForm(setEditForm, id, isChecked ? Math.max(1, qty) : 0);
                                                        clearQtyDraftKey(setQtyDraftEdit, id);
                                                    }}
                                                    darkText
                                                />
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 12, color: "#666" }}>К-ть</span>

                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={inputValue}
                                                    style={{ width: 72, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd" }}
                                                    onChange={(e) => {
                                                        const next = toDigitsOrEmpty(e.target.value);
                                                        setQtyDraftEdit((prev) => ({ ...prev, [key]: next }));
                                                    }}
                                                    onBlur={(e) => {
                                                        const raw = toDigitsOrEmpty(e.target.value);
                                                        const nextQty = raw === "" ? 0 : clampInt(raw, 0, 999);

                                                        setQtyInForm(setEditForm, id, nextQty);
                                                        clearQtyDraftKey(setQtyDraftEdit, id);
                                                    }}

                                                />
                                            </div>
                                        </div>
                                    );
                                })}



                                {ctLoading &&
                                    <div style={{ padding: 8, fontSize: 12, color: "#666" }}>Завантаження…</div>}
                            </div>

                            {ctTotalPages > 1 && (
                                <div style={{ marginTop: 10 }}>
                                    <Pagination
                                        count={ctTotalPages}
                                        page={ctPage}
                                        siblingCount={1}
                                        boundaryCount={1}
                                        hidePrevButton
                                        hideNextButton
                                        onChange={(e, value) => loadComponentTemplatesPage(value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* image */}
                        <div>
                            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "#666" }}>
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
                                    setEditForm((prev) => ({ ...prev, image: file }));
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
                    title="Видалення комплекту"
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
                            Ви дійсно бажаєте видалити комплект?
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

export default KitTemplates;
