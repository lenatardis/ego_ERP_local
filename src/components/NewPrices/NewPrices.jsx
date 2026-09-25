import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback
} from "react";
import styles from "./NewPrices.module.scss";
import SearchFilter from "../Common/SearchFilter/SearchFilter";
import Filter from "../Common/Filter/Filter";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import CustomSelect from "../Common/CustomSelect/CustomSelect";
import {Pagination} from '@mui/material';
import Table from "../Common/Table/Table.jsx";
import TableFixedHeader from "../Common/Table/TableFixedHeader.jsx";
import Preloader from "../Common/Preloader/Preloader.jsx";
import ColorRow from "../FabricComposition/StorageProduct/ColorRow/ColorRow.jsx";

import {useUnsavedCtx} from "../../guards/UnsavedChangesContext";
import {useStickyXScroll} from '../../hooks/useStickyXScroll.jsx';
import CurrencyRateInfo from "../Common/CurrencyRateInfo/CurrencyRateInfo.jsx";

import {
    fetchPricesItems,
    fetchPricelists,
    addPrice,
    editPrice,
    deletePrice,
    fetchCurrentCashRate,
    createCostPrice,
    editCostPrice,
    deleteCostPrice,
} from "../../api/tablesApi.js";
import {getAccessToken, getUserId} from "../../api/authStorage.js";
import Tooltip from "@mui/material/Tooltip";
import InfoIcon from "../../assets/icons/info.svg";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";

/* helpers */
const toSizeName = (s) => `${s.width}x${s.length}`;
const safeVal = (v) => (v != null ? v : "");

const TABS = [
    {
        key: "products",
        label: "Товари",
        flag: {isWarehouseItemType: true},
    },
    {
        key: "kits",
        label: "Комплекти",
        flag: {isKit: true},
    },
    {
        key: "kitOptions",
        label: "Опції комплектів",
        flag: {isKitOption: true},
    },
    {
        key: "components",
        label: "Компоненти",
        flag: {isKitComponent: true},
    },
    {
        key: "componentOptions",
        label: "Опції компонентів",
        flag: {isKitComponentOption: true},
    },
];

const TAB_FLAGS = TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.flag || {};
    return acc;
}, {});

const PRICE_FILTER_OPTIONS = [
    {name: "Усі", value: ""},
    {name: "Тільки з цінами", value: "true"},
    {name: "Без цін", value: "false"},
];

const TAB_ENTITY_FIELD = {
    products: "warehouse_item_type",
    kits: "kit_template",
    kitOptions: "kit_option_template",
    components: "kit_component_template",
    componentOptions: "component_option_template",
};

const createInitialTabSlice = () => ({
    rows: [], // [{...}] для конкретного табу
    page: 1,
    totalPages: 0,
    filters: {hasPrice: ""},
    filterParams: {
        page: 1,
        name: null,
        hasPrice: null,
    }
});

/* HTML <table> or TSV parser */
function parseClipboard(e) {
    // 1) HTML-таблиця (Excel/Sheets)
    const html = e.clipboardData?.getData?.("text/html");
    if (html && html.includes("<table")) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const table = doc.querySelector("table");
            if (table) {
                const rows = [];
                for (const tr of table.querySelectorAll("tr")) {
                    const row = [];
                    for (const cell of tr.querySelectorAll("td,th")) {
                        row.push(cell.textContent.replace(/\u00A0/g, " ").trim());
                    }
                    if (row.some((v) => v !== "")) rows.push(row);
                }
                if (rows.length) return rows;
            }
        } catch {
            // ignore
        }
    }
    // 2) TSV / plain text
    const text = e.clipboardData?.getData?.("text/plain") || "";
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length);
    const data = lines.map((line) => line.split("\t"));
    return data;
}

const parseNumber = (raw) => {
    if (raw == null) return 0;
    if (typeof raw === "number") return isFinite(raw) ? raw : 0;
    const s = String(raw)
        .replace(/грн/gi, "")
        .replace(/[^\d.,\- ]/g, "")
        .replace(/\s+/g, "")
        .replace(/,/g, ".");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
};

const formatMoney = (n) => (Number.isFinite(n) ? n : 0).toFixed(2);
const formatPercent = (n) => (Number.isFinite(n) ? n : 0).toFixed(2);

const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN);
const eq2 = (a, b) => {
    const aa = round2(a);
    const bb = round2(b);
    return Number.isFinite(aa) && Number.isFinite(bb) && aa === bb;
};


const PlusSquareIcon = ({size = 12, className, ...props}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={className}
        {...props}
    >
        <rect
            x="0.75"
            y="0.75"
            width="10.5"
            height="10.5"
            rx="4"
            ry="4"
            stroke="currentColor"
            strokeWidth="1.5"
        />
        <path
            d="M3 6h6M6 3v6"
            stroke="#201827"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </svg>
);

const MinusSquareIcon = ({size = 12, className, ...props}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={className}
        {...props}
    >
        <rect
            x="0.75"
            y="0.75"
            width="10.5"
            height="10.5"
            rx="4"
            ry="4"
            stroke="currentColor"
            strokeWidth="1.5"
        />
        <path
            d="M3 6h6"
            stroke="#201827"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </svg>
);

export const SaveCircleIcon = ({
                                   size = 18,
                                   fill = "#2ECC71",
                                   className,
                                   ...props
                               }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <circle cx="12" cy="12" r="10" fill={fill}/>
        <path
            d="M7.5 12.5l3 3 6-6"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export const RestoreIcon = ({
                                size = 18,
                                color = 'currentColor',
                                className,
                                ...props
                            }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 256 256"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={className}
        {...props}
    >
        <path
            fill={color}
            d="M171.2,192.6c-14.5,10.7-32.4,15.7-50.3,13.8c-0.8-0.1-1.6-0.2-2.5-0.3c-1.6-0.2-3.2-0.5-4.8-0.8
         c-1-0.2-1.9-0.4-2.9-0.7c-1.5-0.3-3-0.7-4.5-1.2c-0.7-0.2-1.4-0.5-2.1-0.7c-4.2-1.4-8.2-3.2-12-5.4l-0.3-0.1
         c-8.4-4.9-15.9-11.3-21.9-18.9c-0.3-0.4-0.6-0.8-0.9-1.2c-10.7-14.1-16.6-31.4-16.5-49.1H70c0.5,0,0.9-0.3,1.1-0.7
         c0.2-0.4,0.2-0.9-0.1-1.3L41.7,79.9c-0.2-0.4-0.6-0.6-1.1-0.6c-0.4,0-0.8,0.2-1.1,0.6L10.2,126c-0.3,0.4-0.3,0.9-0.1,1.3
         c0.2,0.5,0.7,0.7,1.1,0.7h17.5c0,21.8,6.5,42.1,17.6,58.7c0.1,0.3,0.2,0.5,0.4,0.7c1.2,1.7,2.4,3.3,3.7,4.9
         c0.5,0.6,0.9,1.2,1.4,1.8c1.8,2.3,3.7,4.4,5.7,6.6l0.5,0.6c8.6,9,18.8,16.3,30.2,21.5l1.8,0.9c2.1,0.9,4.3,1.7,6.4,2.4
         c1,0.4,2,0.7,3.1,1.1c1.9,0.6,3.8,1.1,5.8,1.6c1.3,0.3,2.6,0.7,3.9,0.9c0.5,0.1,1,0.3,1.6,0.4c1.8,0.3,3.7,0.5,5.5,0.8l2,0.3
         c23.7,2.4,47.5-4,66.6-18.3c5.4-4.1,6.7-11.7,2.9-17.3c-1.8-2.7-4.5-4.5-7.7-5.1C177,189.9,173.7,190.7,171.2,192.6z
         M227.1,128c0-20.8-6-41.2-17.5-58.6c-0.2-0.3-0.3-0.6-0.5-0.8c-1.4-2-2.8-4-4.3-5.9l-0.5-0.7c-9.8-12.5-22.5-22.5-37-29.1
         c-0.4-0.2-0.8-0.4-1.2-0.6c-2.3-1-4.6-1.8-7-2.7c-0.9-0.3-1.7-0.6-2.6-0.9c-2-0.6-4.1-1.2-6.2-1.7c-1.2-0.3-2.3-0.6-3.5-0.8
         c-0.6-0.1-1.1-0.3-1.7-0.4c-1.6-0.3-3.2-0.4-4.7-0.6c-1.1-0.1-2.2-0.3-3.2-0.5c-2.6-0.3-5.2-0.4-7.8-0.4c-0.5,0-1-0.1-1.5-0.1
         c-20.5,0-40.4,6.6-56.9,18.7c-5.4,4.1-6.7,11.7-3,17.3c1.8,2.7,4.5,4.5,7.7,5.1c3.1,0.6,6.4-0.2,8.9-2.1
         c14.5-10.7,32.5-15.7,50.4-13.8l2,0.3c1.8,0.2,3.6,0.5,5.3,0.9c0.8,0.1,1.5,0.3,2.3,0.5c1.7,0.4,3.4,0.9,5.1,1.4l1.6,0.6
         c1.9,0.7,3.8,1.3,5.7,2.2l0.6,0.3c11.1,5,20.9,12.7,28.4,22.3l0.1,0.2c11.1,14.2,17.2,31.8,17.1,49.9h-17.5c-0.5,0-0.9,0.3-1.1,0.7
         c-0.2,0.4-0.2,0.9,0.1,1.3l29.4,46.1c0.2,0.4,0.6,0.6,1.1,0.6c0.4,0,0.8-0.2,1.1-0.6l29.4-46c0,0,0.1-0.1,0.1-0.1
         c0.6-0.8,0-2-1-1.9H227.1z"
        />
    </svg>
);

// спроба дістати HTTP-статус із різних форм помилки
const getHttpStatusFromError = (err) => {
    if (!err || typeof err !== "object") return undefined;

    // “звичайні” поля
    if (typeof err.status === "number") return err.status;
    if (typeof err.statusCode === "number") return err.statusCode;
    if (typeof err.responseStatus === "number") return err.responseStatus;

    if (err.response && typeof err.response.status === "number") {
        return err.response.status;
    }
    if (err.response && typeof err.response.statusCode === "number") {
        return err.response.statusCode;
    }

    // вкладене поле error
    if (err.error && typeof err.error === "object") {
        const nested = getHttpStatusFromError(err.error);
        if (typeof nested === "number") return nested;
    }

    // fallback: парсимо повідомлення "HTTP error! Status: 400"
    if (typeof err.message === "string") {
        const match = err.message.match(/Status:\s*(\d{3})/i);
        if (match) {
            const code = Number(match[1]);
            if (Number.isFinite(code)) return code;
        }
    }

    return undefined;
};

// COST: список полів собівартості в рядку
const COST_FIELDS = [
    "costRawMaterialUah",
    "costRawMaterialUsd",
    "costRawMaterialQty",
    "costLaborUah",
    "costLaborUsd",
    "costPackagingUah",
    "costPackagingUsd",
];

const COST_BASE_FIELDS = {
    costRawMaterialUah: "baseCostRawMaterialUah",
    costRawMaterialUsd: "baseCostRawMaterialUsd",
    costRawMaterialQty: "baseCostRawMaterialQty",
    costLaborUah: "baseCostLaborUah",
    costLaborUsd: "baseCostLaborUsd",
    costPackagingUah: "baseCostPackagingUah",
    costPackagingUsd: "baseCostPackagingUsd",
};

const RAW_MATERIAL_LOCK_TABS = new Set(["products", "kits", "components"]);
const NO_DATA_LABEL = "Немає даних";

const NO_DATA_TOOLTIP =
    "По цьому товару немає надходжень";

const NO_ARRIVALS_TOTAL_TOOLTIP =
    "Немає надходжень, тому неможливо порахувати загальну собівартість";

const isNoArrivalsRow = (tabKey, row) =>
    RAW_MATERIAL_LOCK_TABS.has(tabKey) && (row?.rawMaterialUahNoData || row?.rawMaterialUsdNoData);




const isCostFieldDirty = (row, field) =>
    String(row[field] ?? "") !== String(row[COST_BASE_FIELDS[field]] ?? "");

const getRowCostDirtyFields = (row) =>
    COST_FIELDS.filter((field) => isCostFieldDirty(row, field));

const rowCostDirtyCount = (row) => getRowCostDirtyFields(row).length;


// нормалізація priceRef з відповіді API
const normalizePriceRefFromApi = (apiPrice, fallback = null, defaultPricesListId = null) => {
    if (!apiPrice && !fallback && !defaultPricesListId) return null;
    const base = apiPrice || {};
    return {
        id: base.id ?? fallback?.id ?? null,
        pricesListId:
            base.prices_list?.id ??
            base.prices_list_id ??
            fallback?.pricesListId ??
            defaultPricesListId ??
            null,
        managerId: base.manager_id ?? fallback?.managerId ?? null,
    };
};

/**
 * Маппінг одного item з /warehouses/prices/items/ у рядок таблиці
 * prices → масив за всіма прайслистами в порядку pricelistsMeta
 */
const mapApiPriceItemToRow = (item, pricelistsMeta) => {
    const pricesByListId = {};
    (item.prices ?? []).forEach((p) => {
        if (!p || p.prices_list_id == null) return;
        pricesByListId[String(p.prices_list_id)] = p;
    });

    const pricesArr = pricelistsMeta.map((pl) => {
        const rec = pricesByListId[String(pl.id)];
        return rec && rec.price != null ? String(rec.price) : "";
    });

    const priceRefs = pricelistsMeta.map((pl) => {
        const rec = pricesByListId[String(pl.id)];
        return rec
            ? {
                id: rec.id,
                pricesListId: rec.prices_list_id,
                managerId: rec.manager_id,
            }
            : null;
    });

    // cost_price
    const costPrice = item.cost_price || {};
    const autoCalc = costPrice.auto_calculation || {};
    const costItem = costPrice.item || null;

    const hasAutoUah = autoCalc && autoCalc.uah != null;
    const hasAutoUsd = autoCalc && autoCalc.usd != null;

// ✅ нове: кейс "item є, але unit costs = 0 і авто-розрахунку немає" => трактуємо як "Немає даних"
    const hasAutoCalculation = !!costPrice?.auto_calculation;

    const isZeroNoData =
        !hasAutoCalculation &&
        !!costItem &&
        Number(costItem.raw_material_unit_cost_price_uah ?? NaN) === 0 &&
        Number(costItem.raw_material_unit_cost_price_usd ?? NaN) === 0;

    const rawMaterialUahNoData =
        (((!costItem || costItem.raw_material_unit_cost_price_uah == null) && !hasAutoUah) ||
            isZeroNoData);

    const rawMaterialUsdNoData =
        (((!costItem || costItem.raw_material_unit_cost_price_usd == null) && !hasAutoUsd) ||
            isZeroNoData);

    const costRawMaterialUah =
        costItem && costItem.raw_material_unit_cost_price_uah != null
            ? String(costItem.raw_material_unit_cost_price_uah)
            : hasAutoUah
                ? String(autoCalc.uah)
                : "";

    const costRawMaterialUsd =
        costItem && costItem.raw_material_unit_cost_price_usd != null
            ? String(costItem.raw_material_unit_cost_price_usd)
            : hasAutoUsd
                ? String(autoCalc.usd)
                : "";

    const costRawMaterialQty =
        costItem && costItem.raw_material_quantity != null
            ? String(costItem.raw_material_quantity)
            : "";

    const costLaborUah =
        costItem && costItem.labor_cost_price_uah != null
            ? String(costItem.labor_cost_price_uah)
            : "";

    const costLaborUsd =
        costItem && costItem.labor_cost_price_usd != null
            ? String(costItem.labor_cost_price_usd)
            : "";

    const costPackagingUah =
        costItem && costItem.packaging_cost_price_uah != null
            ? String(costItem.packaging_cost_price_uah)
            : "";

    const costPackagingUsd =
        costItem && costItem.packaging_cost_price_usd != null
            ? String(costItem.packaging_cost_price_usd)
            : "";

    const costMaterialName = costItem?.material ?? "";

    return {
        id: item.id,
        sku: String(item.id),
        type: safeVal(item.type),
        name: safeVal(item.name),
        size: safeVal(item.size),
        fabricType: safeVal(item.fabric_type),
        color: item.color ?? null,

        // собівартість (детальні поля)
        costMaterialName,
        costRawMaterialUah,
        costRawMaterialUsd,
        costRawMaterialQty,
        costLaborUah,
        costLaborUsd,
        costPackagingUah,
        costPackagingUsd,

        baseCostRawMaterialUah: costRawMaterialUah,
        baseCostRawMaterialUsd: costRawMaterialUsd,
        baseCostRawMaterialQty: costRawMaterialQty,
        baseCostLaborUah: costLaborUah,
        baseCostLaborUsd: costLaborUsd,
        baseCostPackagingUah: costPackagingUah,
        baseCostPackagingUsd: costPackagingUsd,
        rawMaterialUahNoData,
        rawMaterialUsdNoData,

      
        // backend totals: єдина точка правди
        cost: "",
        totalCostUah: hasAutoUah ? Number(autoCalc.uah) : 0,
        totalCostUsd: hasAutoUsd ? Number(autoCalc.usd) : 0,

        costPriceRef: {
            id: costItem?.id ?? null,
            warning: costPrice.warning ?? null,
            autoUah: hasAutoUah ? Number(autoCalc.uah) : 0,
            autoUsd: hasAutoUsd ? Number(autoCalc.usd) : 0,
            lastExchangeRate: costPrice?.last_exchange_rate?.exchange_rate ?? null,
            lastArrivalDate: costPrice?.last_exchange_rate?.arrival_date ?? null,
        },
        prices: pricesArr,
        basePrices: pricesArr.slice(),
        priceRefs,
        raw: item,
    };
};

// для пошуку
const buildNameVariants = (raw) => {
    if (!raw) return [];

    const original = String(raw).trim();
    if (!original) return [];

    const first = original.charAt(0);
    const rest = original.slice(1);

    let toggled = original;

    if (first === first.toLowerCase() && first !== first.toUpperCase()) {
        toggled = first.toUpperCase() + rest;
    }

    else if (first === first.toUpperCase() && first !== first.toLowerCase()) {
        toggled = first.toLowerCase() + rest;
    }

    const variants = [original];
    if (toggled !== original) {
        variants.push(toggled);
    }

    return variants;
};


const NewPrices = () => {
    const {setDirtyCount, saveAllRef} = useUnsavedCtx();

    const scrollRef = useRef(null);
    const rootRef = useRef(null);

    const [isShowFilter, setIsShowFilter] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentUsdRate, setCurrentUsdRate] = useState(null);
    const [currentUsdSaleRate, setCurrentUsdSaleRate] = useState(null);

    // таби
    const [activeTab, setActiveTab] = useState("products");

    const [tabState, setTabState] = useState(() => {
        const initial = {};
        TABS.forEach((tab) => {
            initial[tab.key] = createInitialTabSlice();
        });
        return initial;
    });

    const currentTabSlice = tabState[activeTab];
    const {rows, page, totalPages, filters, filterParams} = currentTabSlice;

    // список усіх прайслистів (динамічні колонки)
    const [pricelistsMeta, setPricelistsMeta] = useState([]);
    const priceCols = pricelistsMeta.length;

    // стани змін/збереження
    const [savingCells, setSavingCells] = useState({}); // { `${rowIdx}-${priceIdx}`: true }
    const [savingCostRows, setSavingCostRows] = useState({});
    const [expandedExtras, setExpandedExtras] = useState({}); // { [priceIdx]: true }

    const [costExtrasUahOpenByTab, setCostExtrasUahOpenByTab] = useState(() => {
        const initial = {};
        TABS.forEach((tab) => {
            initial[tab.key] = false;
        });
        return initial;
    });

    const [costExtrasUsdOpenByTab, setCostExtrasUsdOpenByTab] = useState(() => {
        const initial = {};
        TABS.forEach((tab) => {
            initial[tab.key] = false;
        });
        return initial;
    });

    const showCostExtrasUah = !!costExtrasUahOpenByTab[activeTab];
    const showCostExtrasUsd = !!costExtrasUsdOpenByTab[activeTab];


    /* sticky ghost scroll */
    const {mainRef, StickyBar, recalcX} = useStickyXScroll({
        offsetBottom: 0,
        trackHeight: 16,
        zIndex: 60,
    });

    /* ===== завантаження всіх прайслистів для побудови колонок ===== */
    useEffect(() => {
        const loadAllPricelists = async () => {
            try {
                setIsLoading(true);
                const token = getAccessToken();
                if (!token) {
                    console.warn("No access token, cannot load pricelists");
                    setPricelistsMeta([]);
                    return;
                }

                let currentPage = 1;
                let pagesTotal = 1;
                const acc = [];

                while (currentPage <= pagesTotal) {
                    const data = await fetchPricelists(token, {page: currentPage});
                    const lists = data?.prices_lists ?? data?.pricesLists ?? [];
                    pagesTotal = data?.total_pages ?? data?.totalPages ?? 1;

                    acc.push(
                        ...lists.map((pl) => ({
                            id: pl.id,
                            title: pl.title ?? pl.name ?? "",
                            raw: pl,
                        }))
                    );

                    currentPage += 1;
                }

                setPricelistsMeta(acc);
            } catch (e) {
                console.error("Failed to load pricelists in NewPrices:", e);
                setPricelistsMeta([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadAllPricelists();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const token = getAccessToken();
                const resp = await fetchCurrentCashRate(token);

                const usd = resp?.exchange_rate;

                const buyNum = parseNumber(usd?.buy);
                const saleNum = parseNumber(usd?.sale);

                if (Number.isFinite(buyNum) && buyNum > 0) {
                    setCurrentUsdRate(buyNum);
                } else {
                    setCurrentUsdRate(null);
                }

                if (Number.isFinite(saleNum) && saleNum > 0) {
                    setCurrentUsdSaleRate(saleNum);
                } else {
                    setCurrentUsdSaleRate(null);
                }
            } catch (e) {
                console.error("Failed to fetch current cash rate for NewPrices:", e);
                setCurrentUsdRate(null);
                setCurrentUsdSaleRate(null);
            }
        })();
    }, []);

    /* ===== утиліти для оновлення стану табів ===== */

    const updateTabSlice = useCallback((tabKey, updater) => {
        setTabState((prev) => {
            const prevSlice = prev[tabKey];
            const nextSlice =
                typeof updater === "function"
                    ? updater(prevSlice)
                    : {...prevSlice, ...updater};
            return {
                ...prev,
                [tabKey]: nextSlice,
            };
        });
    }, []);

    const setRowsForTab = useCallback(
        (tabKey, updater) => {
            updateTabSlice(tabKey, (slice) => ({
                ...slice,
                rows: typeof updater === "function" ? updater(slice.rows) : updater,
            }));
        },
        [updateTabSlice]
    );

    /* ====== реальне завантаження даних для конкретного табу з бекенду ====== */
    const fetchData = useCallback(
        async (tabKey, params) => {
            // без прайслистів немає сенсу тягнути прайси (нам потрібні колонки)
            if (!priceCols) return;

            try {
                setIsLoading(true);
                const token = getAccessToken();
                if (!token) {
                    console.warn("No access token, cannot load prices items");
                    setTabState((prev) => ({
                        ...prev,
                        [tabKey]: {
                            ...prev[tabKey],
                            rows: [],
                            totalPages: 0,
                        },
                    }));
                    return;
                }

                const flags = TAB_FLAGS[tabKey] || {};
                const currentPage = params?.page ?? 1;

                // формуємо максимум 2 варіанти для name: "Ковдра" → ["Ковдра", "ковдра"]
                const nameVariants = buildNameVariants(params?.name);
                // якщо name не заданий – просто один прохід без name
                const variantsToTry = nameVariants.length ? nameVariants : [undefined];

                let finalItems = [];
                let finalPage = currentPage;
                let finalTotalPages = 1;

                for (const nameVariant of variantsToTry) {
                    const apiParams = {
                        page: currentPage,
                        name: nameVariant,                      // undefined → параметр name не піде в запит
                        hasPrice: params?.hasPrice ?? undefined,
                        ...flags,
                    };

                    const data = await fetchPricesItems(token, apiParams);
                    const items = data?.items ?? data?.results ?? [];

                    // якщо щось знайшли або це варіант без name – беремо його й зупиняємося
                    if (items.length > 0 || nameVariant === undefined) {
                        finalItems = items;
                        finalPage = data?.current_page ?? data?.currentPage ?? currentPage;
                        finalTotalPages = data?.total_pages ?? data?.totalPages ?? 1;
                        break;
                    }
                }

                const mapped = finalItems.map((item) =>
                    mapApiPriceItemToRow(item, pricelistsMeta)
                );
                const withIdx = mapped.map((r, idx) => ({...r, __rowIndex: idx}));

                setTabState((prev) => ({
                    ...prev,
                    [tabKey]: {
                        ...prev[tabKey],
                        rows: withIdx,
                        page: finalPage,
                        totalPages: finalTotalPages,
                    },
                }));
            } catch (e) {
                console.error("Error loading prices items:", e);
                setTabState((prev) => ({
                    ...prev,
                    [tabKey]: {
                        ...prev[tabKey],
                        rows: [],
                        totalPages: 0,
                    },
                }));
            } finally {
                setIsLoading(false);
            }
        },
        [priceCols, pricelistsMeta]
    );


    // перше завантаження для активного табу — тільки після того, як є прайслисти
    useEffect(() => {
        if (!priceCols) return;
        const initialSlice = tabState[activeTab];
        if (!initialSlice.rows.length) {
            fetchData(activeTab, initialSlice.filterParams);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [priceCols, activeTab]);

    // коли міняється кількість прайс-колонок — підрізаємо expandedExtras
    useEffect(() => {
        setExpandedExtras((prev) => {
            const next = {};
            for (let i = 0; i < priceCols; i++) {
                if (prev[i]) next[i] = true;
            }
            return next;
        });
    }, [priceCols]);

    const onSendFilters = (tabKey, newFilterParams) => {
        const next = {...newFilterParams, page: 1};

        updateTabSlice(tabKey, (slice) => ({
            ...slice,
            filterParams: next,
            page: 1,
        }));

        fetchData(tabKey, next);
    };

    const handlePaginationChange = (event, value) => {
        if (page !== value) {
            const next = {...filterParams, page: value};

            updateTabSlice(activeTab, (slice) => ({
                ...slice,
                filterParams: next,
                page: value,
            }));

            window.scrollTo({top: 0, behavior: "auto"});
            fetchData(activeTab, next);
        }
    };

    const setPriceCell = useCallback(
        (rowIdx, priceIdx, val) => {
            setRowsForTab(activeTab, (prevRows) => {
                const next = prevRows.map((r) => ({...r}));
                const row = {...next[rowIdx]};
                const prices = row.prices.slice();
                prices[priceIdx] = val;
                row.prices = prices;
                next[rowIdx] = row;
                return next;
            });
        },
        [activeTab, setRowsForTab]
    );

    const sanitizeLoose = (raw) =>
        String(raw ?? "").replace(/[^0-9\s.,грн]/gi, "");

    const handleInputChange = (rowIdx, priceIdx, e) => {
        const clean = sanitizeLoose(e.target.value);
        setPriceCell(rowIdx, priceIdx, clean);
    };

    const handlePaste = (rowIdx, priceIdx, e) => {
        e.preventDefault();
        const matrix = parseClipboard(e);
        if (!matrix || !matrix.length) return;

        setRowsForTab(activeTab, (prevRows) => {
            const next = prevRows.map((r) => ({...r, prices: r.prices.slice()}));
            for (let r = 0; r < matrix.length; r++) {
                const rr = rowIdx + r;
                if (rr >= next.length) break;
                for (let c = 0; c < matrix[r].length; c++) {
                    const cc = priceIdx + c;
                    if (cc >= priceCols) break;
                    next[rr].prices[cc] = matrix[r][c];
                }
            }
            return next;
        });

        setExpandedExtras({});
        recalcX();
    };

    /* ====== changed/dirty helpers для поточного табу ====== */
    const isCellDirty = (row, idx) =>
        String(row.prices[idx] ?? "") !== String(row.basePrices[idx] ?? "");

    const rowDirtyCount = (row) =>
        row.prices.reduce((acc, _, i) => acc + (isCellDirty(row, i) ? 1 : 0), 0) +
        rowCostDirtyCount(row);

    const totalDirty = useMemo(
        () => rows.reduce((acc, r) => acc + rowDirtyCount(r), 0),
        [rows]
    );

    const getBackendTotalCostUah = useCallback(
        (row) => Number.isFinite(Number(row?.totalCostUah))
            ? Number(row.totalCostUah)
            : 0,
        []
    );

    const getBackendTotalCostUsd = useCallback(
        (row) => Number.isFinite(Number(row?.totalCostUsd))
            ? Number(row.totalCostUsd)
            : 0,
        []
    );

    const hasBackendTotalCost = useCallback((row) => {
        const uah = getBackendTotalCostUah(row);
        const usd = getBackendTotalCostUsd(row);
        return uah > 0 || usd > 0;
    }, [getBackendTotalCostUah, getBackendTotalCostUsd]);
    /**
     * Зберегти набір клітинок (rowIdx / priceIdx) у поточному табі (ціни):
     * - вирішує POST vs PATCH
     * - часткові помилки: успішні клітинки стають чистими, невдалі лишаються dirty
     */
    const saveCells = useCallback(
        async (cells) => {
            if (!cells.length) return;
            if (!priceCols) return;

            // помітити клітинки як "у процесі збереження"
            setSavingCells((prev) => {
                const clone = {...prev};
                for (const {rowIdx, priceIdx} of cells) {
                    clone[`${rowIdx}-${priceIdx}`] = true;
                }
                return clone;
            });

            const token = getAccessToken();
            if (!token) {
                window.alert(
                    "Не вдалося отримати токен доступу. Авторизуйся знову і повтори спробу."
                );
                // прибираємо спінери
                setSavingCells((prev) => {
                    const clone = {...prev};
                    for (const {rowIdx, priceIdx} of cells) {
                        delete clone[`${rowIdx}-${priceIdx}`];
                    }
                    return clone;
                });
                return;
            }

            let successCount = 0;
            let failCount = 0;
            let hasLastPriceDeleteError = false;

            // ключ → { priceRef?: {...} }
            const successMap = new Map();

            for (const {rowIdx, priceIdx} of cells) {
                const row = rows[rowIdx];
                if (!row) {
                    failCount++;
                    continue;
                }

                const plMeta = pricelistsMeta[priceIdx];
                if (!plMeta || !plMeta.id) {
                    console.error("Missing pricelist metadata for column", {
                        priceIdx,
                        plMeta,
                    });
                    failCount++;
                    continue;
                }

                const rawValue = row.prices[priceIdx];
                const rawStr = rawValue == null ? "" : String(rawValue).trim();

                // порожня клітинка = видалення
                const isDeleting = rawStr === "";
                const numeric = isDeleting ? null : parseNumber(rawValue);

                const existingRef = (row.priceRefs || [])[priceIdx] || null;

                try {
                    if (existingRef && existingRef.id) {
                        if (isDeleting) {
                            // DELETE існуючої ціни
                            console.log("[DELETE price]", {
                                rowIdx,
                                priceIdx,
                                priceId: existingRef.id,
                                row,
                                plMeta,
                            });

                            await deletePrice(token, existingRef.id);

                            // після успішного delete більше немає priceRef
                            successMap.set(`${rowIdx}-${priceIdx}`, {
                                priceRef: null,
                            });
                        } else {
                            // PATCH існуючої ціни
                            const payload = {
                                sell_price: numeric,
                            };

                            console.log("[PATCH price]", {
                                rowIdx,
                                priceIdx,
                                priceId: existingRef.id,
                                payload,
                                row,
                                plMeta,
                            });

                            const updated = await editPrice(token, existingRef.id, payload);

                            const newRef = normalizePriceRefFromApi(
                                updated,
                                existingRef,
                                plMeta.id
                            );

                            successMap.set(`${rowIdx}-${priceIdx}`, {
                                priceRef: newRef,
                            });
                        }
                    } else {
                        if (isDeleting) {
                            // не було ціни і зараз порожньо – нічого не робимо
                        } else {
                            // POST нової ціни
                            const entityField = TAB_ENTITY_FIELD[activeTab];
                            const ownerPayload = entityField
                                ? {[entityField]: row.id}
                                : {};

                            const payload = {
                                sell_price: numeric,
                                prices_list: plMeta.id,
                                ...ownerPayload,
                            };

                            const created = await addPrice(token, payload);

                            const newRef = normalizePriceRefFromApi(
                                created,
                                null,
                                plMeta.id
                            );

                            successMap.set(`${rowIdx}-${priceIdx}`, {
                                priceRef: newRef,
                            });
                        }
                    }

                    successCount++;
                } catch (err) {
                    const status = getHttpStatusFromError(err);

                    // ✅ 204 No Content при видаленні — вважаємо успішною операцією
                    // також прикриваємо кейс, коли handleResponse кидає чистий SyntaxError
                    if (
                        isDeleting &&
                        (status === 204 ||
                            (!status && err && err.name === "SyntaxError"))
                    ) {
                        successMap.set(`${rowIdx}-${priceIdx}`, {
                            priceRef: null,
                        });
                        successCount++;
                        // не логимо як помилку і не збільшуємо failCount
                        continue;
                    }

                    console.error("Failed to save price cell", {
                        rowIdx,
                        priceIdx,
                        err,
                    });

                    // 400 при видаленні трактуємо як бізнес-правило:
                    // "не можна видалити останню ціну по товару"
                    if (isDeleting && status === 400) {
                        hasLastPriceDeleteError = true;
                    }

                    failCount++;
                }
            }

            if (successMap.size > 0) {
                // оновлюємо basePrices / priceRefs тільки для успішних клітинок
                setRowsForTab(activeTab, (prevRows) => {
                    const next = prevRows.map((r) => ({...r}));
                    successMap.forEach((val, key) => {
                        const [rStr, cStr] = key.split("-");
                        const rIdx = Number(rStr);
                        const cIdx = Number(cStr);
                        const row = next[rIdx];
                        if (!row) return;

                        const updatedRow = {
                            ...row,
                            prices: row.prices.slice(),
                            basePrices: row.basePrices.slice(),
                            priceRefs: (row.priceRefs || []).slice(),
                        };

                        updatedRow.basePrices[cIdx] = updatedRow.prices[cIdx];

                        // важливо: дозволяємо записати навіть null
                        if ("priceRef" in val) {
                            updatedRow.priceRefs[cIdx] = val.priceRef;
                        }

                        next[rIdx] = updatedRow;
                    });

                    return next;
                });
            }

            // прибираємо спінери
            setSavingCells((prev) => {
                const clone = {...prev};
                for (const {rowIdx, priceIdx} of cells) {
                    delete clone[`${rowIdx}-${priceIdx}`];
                }
                return clone;
            });

            if (hasLastPriceDeleteError) {
                window.alert(
                    "Не можна видалити ціну цього запису, оскільки в інших прайслистах для нього не залишиться жодної ціни. " +
                    "Додайте ціну в іншому прайслисті і повторіть спробу."
                );
            } else if (failCount > 0) {
                window.alert(
                    `Не вдалося зберегти ${failCount} цін(и). Успішно збережено: ${successCount}. Деталі в консолі.`
                );
            }
        },
        [activeTab, rows, priceCols, pricelistsMeta, setRowsForTab]
    );

    // формування payload для собівартості
    // формування payload для собівартості
    const buildCostPayloadForRow = useCallback(
        (row) => {
            const isNoDataLockedUah =
                RAW_MATERIAL_LOCK_TABS.has(activeTab) && row.rawMaterialUahNoData;

            const isNoDataLockedUsd =
                RAW_MATERIAL_LOCK_TABS.has(activeTab) && row.rawMaterialUsdNoData;

            const payload = {
                // IMPORTANT: unit raw material fields додаємо нижче умовно
                raw_material_quantity: parseNumber(row.costRawMaterialQty),
                labor_cost_price_uah: parseNumber(row.costLaborUah),
                labor_cost_price_usd: parseNumber(row.costLaborUsd),
                packaging_cost_price_uah: parseNumber(row.costPackagingUah),
                packaging_cost_price_usd: parseNumber(row.costPackagingUsd),
                exchange_rate: currentUsdRate ?? null,
            };

            // ✅ якщо "Немає даних" — НЕ ПЕРЕДАЄМО ці поля взагалі
            if (!isNoDataLockedUah) {
                payload.raw_material_unit_cost_price_uah = parseNumber(row.costRawMaterialUah);
            }
            if (!isNoDataLockedUsd) {
                payload.raw_material_unit_cost_price_usd = parseNumber(row.costRawMaterialUsd);
            }

            const entityField = TAB_ENTITY_FIELD[activeTab];
            if (entityField) {
                payload[entityField] = row.id;
            }

            const managerIdRaw = getUserId && getUserId();
            if (managerIdRaw != null && managerIdRaw !== "") {
                const n = Number(managerIdRaw);
                if (!Number.isNaN(n)) payload.manager = n;
            }

            return payload;
        },
        [activeTab, currentUsdRate]
    );

    // збереження собівартості для одного рядка (POST/PATCH/DELETE)
    const saveCostForRow = useCallback(
        async (row) => {
            if (!row) return;
            const dirtyFields = getRowCostDirtyFields(row);
            if (!dirtyFields.length) return;

            const token = getAccessToken();
            if (!token) {
                window.alert(
                    "Не вдалося отримати токен доступу. Авторизуйся знову і повтори спробу."
                );
                return;
            }

            const allEmpty = COST_FIELDS.every((field) => {
                const v = row[field];
                return v == null || String(v).trim() === "";
            });

            const existingId = row.costPriceRef?.id ?? null;
            const rowIndex = row.__rowIndex;

            // вмикаємо лоадер для всіх cost-клітинок цього рядка
            setSavingCostRows((prev) => ({ ...prev, [rowIndex]: true }));

            try {
                if (existingId && allEmpty) {
                    // DELETE /production/cost_prices/{id}/
                    const ok = await deleteCostPrice(token, existingId);
                    if (ok) {
                        setRowsForTab(activeTab, (prevRows) => {
                            const next = prevRows.map((r) => ({...r}));
                            const idx = row.__rowIndex;
                            const current = {...next[idx]};

                            COST_FIELDS.forEach((field) => {
                                const baseField = COST_BASE_FIELDS[field];
                                current[baseField] = current[field];
                            });

                            current.costPriceRef = {
                                ...(current.costPriceRef || {}),
                                id: null,
                            };

                            next[idx] = current;
                            return next;
                        });
                    }
                } else if (!allEmpty) {
                    const payload = buildCostPayloadForRow(row);
                    let saved;
                    if (existingId) {
                        saved = await editCostPrice(token, existingId, payload);
                    } else {
                        saved = await createCostPrice(token, payload);
                    }

                    const newId = saved?.id ?? existingId ?? null;
                    const materialName = saved?.material ?? row.costMaterialName;

                    setRowsForTab(activeTab, (prevRows) => {
                        const next = prevRows.map((r) => ({...r}));
                        const idx = row.__rowIndex;
                        const current = {...next[idx]};

                        COST_FIELDS.forEach((field) => {
                            const baseField = COST_BASE_FIELDS[field];
                            current[baseField] = current[field];
                        });

                        current.costMaterialName = materialName;
                        current.costPriceRef = {
                            ...(current.costPriceRef || {}),
                            id: newId,
                        };

                        next[idx] = current;
                        return next;
                    });
                }
            } catch (err) {
                console.error("Failed to save cost price", err);
                window.alert("Не вдалося зберегти собівартість. Деталі в консолі.");
            } finally {
                // вимикаємо лоадер
                setSavingCostRows((prev) => {
                    const clone = {...prev};
                    delete clone[rowIndex];
                    return clone;
                });
            }
        },
        [activeTab, buildCostPayloadForRow, setRowsForTab]
    );


    const updateRow = async (rowIdx) => {
        const row = rows[rowIdx];
        if (!row) return;

        const dirtyIdx = row.prices
            .map((_, i) => i)
            .filter((i) => isCellDirty(row, i));

        const hasCostDirty = rowCostDirtyCount(row) > 0;

        const cells = dirtyIdx.map((i) => ({rowIdx, priceIdx: i}));

        if (cells.length) {
            await saveCells(cells);
        }
        if (hasCostDirty) {
            await saveCostForRow(row);
        }
    };

    const restoreRow = (rowIdx) => {
        setRowsForTab(activeTab, (prevRows) => {
            const next = prevRows.map((r) => ({...r}));
            const r = {...next[rowIdx]};
            r.prices = r.basePrices.slice();

            // скидати собівартість до бази
            COST_FIELDS.forEach((field) => {
                const baseField = COST_BASE_FIELDS[field];
                r[field] = r[baseField];
            });

            next[rowIdx] = r;
            return next;
        });
    };

    const saveAll = async () => {
        const priceCells = [];
        const costRows = [];

        rows.forEach((r, rowIdx) => {
            r.prices.forEach((_, priceIdx) => {
                if (isCellDirty(r, priceIdx)) {
                    priceCells.push({rowIdx, priceIdx});
                }
            });

            if (rowCostDirtyCount(r) > 0) {
                costRows.push(r);
            }
        });

        if (!priceCells.length && !costRows.length) return;

        if (priceCells.length) {
            await saveCells(priceCells);
        }

        if (costRows.length) {
            for (const row of costRows) {
                // послідовно, щоб не плодити зайвих паралельних PATCH/POST
                // (за потреби можна буде оптимізувати)
                // eslint-disable-next-line no-await-in-loop
                await saveCostForRow(row);
            }
        }
    };

    const restoreAll = useCallback(() => {
        setRowsForTab(activeTab, (prevRows) =>
            prevRows.map((r) => {
                const clone = {...r, prices: r.basePrices.slice()};
                COST_FIELDS.forEach((field) => {
                    const baseField = COST_BASE_FIELDS[field];
                    clone[field] = clone[baseField];
                });
                return clone;
            })
        );
    }, [activeTab, setRowsForTab]);

    /* non-editable cell */
    const neCell = (content, { compact = false, relative = false, className = "" } = {}) => (
        <div
            className={`neCell ${styles.neCellInner} ${
                compact ? styles.compact : ""
            } ${relative ? styles.neCellInnerRel : ""} ${className}`}
        >
            {content}
        </div>
    );


    const IconBtn = ({title, disabled, onClick, children}) => (
        <button
            type="button"
            title={title}
            aria-label={title}
            disabled={!!disabled}
            onClick={disabled ? undefined : onClick}
            className={`${styles.rowBtn} ${
                disabled ? styles.disabledBtn : ""
            }`}
        >
            {children}
        </button>
    );

    const renderPriceInput = (row, rowIdx, priceIdx, pricelistId) => {
        const val = row.prices[priceIdx] ?? "";
        const dirty = isCellDirty(row, priceIdx);
        const hasExtrasOnTheLeft =
            priceIdx > 0 && !!expandedExtras[priceIdx - 1];
        const loading = !!savingCells[`${rowIdx}-${priceIdx}`];

        return (
            <div className={styles.inputWrap}>
                <input
                    className={`${styles.cellInput} ${
                        dirty ? styles.changedInput : ""
                    } ${
                        hasExtrasOnTheLeft ? "cellInputWithLeftBorder" : ""
                    }`}
                    value={val}
                    onChange={(e) => handleInputChange(rowIdx, priceIdx, e)}
                    onPaste={(e) => handlePaste(rowIdx, priceIdx, e)}
                    inputMode="text"
                    placeholder=""
                    data-pricelist-id={pricelistId ?? ""}
                />
                {loading && (
                    <div className={styles.spinnerMiniWrap}>
                        <div className={styles.spinnerMini}/>
                    </div>
                )}
            </div>
        );
    };

    const renderCostUsdCell = (row) => {
        const totalUsd = getBackendTotalCostUsd(row);

        if (totalUsd <= 0) {
            return renderNoArrivalsDash();
        }

        return neCell(formatMoney(totalUsd));
    };

    const NO_LAST_RATE_TOOLTIP =
        "Немає курсу останнього надходження, тому неможливо порахувати собівартість за курсом останнього надходження";

    const renderDashWithTooltip = (tooltip) =>
        neCell(
            <div className={styles.noArrivalsCell}>
                <span>-</span>
                <Tooltip title={tooltip} arrow placement="top">
                    <img src={InfoIcon} className={styles.infoIcon} alt="Інфо" />
                </Tooltip>
            </div>,
            { relative: true }
        );

    const calcLastArrivalUsdDiff = useCallback((row) => {
        if (isNoArrivalsRow(activeTab, row)) {
            return { kind: "noArrivals" };
        }

        const lastRate = parseNumber(row?.costPriceRef?.lastExchangeRate);
        if (!Number.isFinite(lastRate) || lastRate <= 0) {
            return { kind: "noRate" };
        }

        const totalUah = getBackendTotalCostUah(row);

        if (!Number.isFinite(totalUah) || totalUah <= 0) {
            return { kind: "noTotal" };
        }

        const lastUsdRaw = totalUah / lastRate;
        if (!Number.isFinite(lastUsdRaw) || lastUsdRaw <= 0) {
            return { kind: "noLastUsd" };
        }

        const currentUsdRaw = getBackendTotalCostUsd(row);

        // ключове: усе вирішуємо по значеннях "як на екрані"
        const lastUsd = round2(lastUsdRaw);
        const currentUsd = round2(currentUsdRaw);

        // якщо поточне $ не рахується — показуємо тільки lastUsd, без % і без класу
        if (!Number.isFinite(currentUsd) || currentUsd <= 0) {
            return { kind: "ok", lastUsd, showDiff: false, diffPct: 0, cls: "" };
        }

        // якщо на екрані однакові — теж без %
        if (lastUsd === currentUsd) {
            return { kind: "ok", lastUsd, showDiff: false, diffPct: 0, cls: "" };
        }

        const diffPct = round2(((lastUsd - currentUsd) / currentUsd) * 100);

        // якщо % після округлення = 0.00 — не показуємо і не підсвічуємо
        if (!Number.isFinite(diffPct) || diffPct === 0) {
            return { kind: "ok", lastUsd, showDiff: false, diffPct: 0, cls: "" };
        }

        const cls = diffPct > 0 ? "rateBad" : "rateGood";
        return { kind: "ok", lastUsd, showDiff: true, diffPct, cls };
    }, [activeTab, getBackendTotalCostUah, getBackendTotalCostUsd]);

        const LAST_ARRIVAL_USD_EXPLAIN_TOOLTIP =
        "Розрахунок: Загальна собівартість, грн із бекенду / курс USD останнього надходження. " +
        "Тобто береться backend-значення auto_calculation.uah і ділиться на last_exchange_rate.exchange_rate.";


// ✅ $ за курсом останнього надходження + індикатор різниці від поточного курсу
        const renderCostUsdLastArrivalCell = (row) => {
        const r = calcLastArrivalUsdDiff(row);

        if (r.kind === "noArrivals") return renderNoArrivalsDash();
        if (r.kind === "noRate") return renderDashWithTooltip(NO_LAST_RATE_TOOLTIP);
        if (r.kind !== "ok") return neCell("-");

        const content = !r.showDiff ? (
            <div className={styles.noArrivalsCell}>
                <span>{formatMoney(r.lastUsd)}</span>
                <Tooltip title={LAST_ARRIVAL_USD_EXPLAIN_TOOLTIP} arrow placement="top">
                    <img src={InfoIcon} className={styles.infoIcon} alt="Інфо" />
                </Tooltip>
            </div>
        ) : (
            <div className="rateCompareWrap">
                <div className={styles.noArrivalsCell}>
                    <span>{formatMoney(r.lastUsd)}</span>
                    <Tooltip title={LAST_ARRIVAL_USD_EXPLAIN_TOOLTIP} arrow placement="top">
                        <img src={InfoIcon} className={styles.infoIcon} alt="Інфо" />
                    </Tooltip>
                </div>
                <div className="rateDiff">
                    {`${r.diffPct > 0 ? "+" : ""}${r.diffPct.toFixed(2)}%`}
                </div>
            </div>
        );

        return neCell(content, {relative: true});
    };

    const getLastArrivalCellClass = (row) => {
        const r = calcLastArrivalUsdDiff(row);
        return r.kind === "ok" ? (r.cls || "") : "";
    };

    const PriceHeader = ({idx, title, status}) => {
        const isOpen = !!expandedExtras[idx];

        const statusLabel =
            status === "ACTIVE"
                ? "активний"
                : status === "DEPRECATED"
                    ? "неактивний"
                    : null;

        const statusClass =
            status === "ACTIVE"
                ? styles.priceStatusActive
                : status === "DEPRECATED"
                    ? styles.priceStatusDeprecated
                    : "";

        return (
            <div className={styles.priceHeader}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpandedExtras((prev) => ({
                            ...prev,
                            [idx]: !prev[idx],
                        }));
                    }}
                    aria-label={
                        isOpen
                            ? "Згорнути маржу/націнку"
                            : "Показати маржу/націнку"
                    }
                    title={
                        isOpen
                            ? "Сховати маржу і націнку"
                            : "Показати маржу і націнку"
                    }
                    className={styles.extraBtn}
                >
                    {isOpen ? (
                        <MinusSquareIcon size={18}/>
                    ) : (
                        <PlusSquareIcon size={18}/>
                    )}
                </button>
                <div className={styles.innerTitle}>
                    {title || `Прайсліст ${idx + 1}`}<br/>
                    {statusLabel && (
                        <>
                            <span
                                className={`${styles.priceStatus} ${statusClass}`}
                            >
                                {statusLabel}
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderMarginPercentCell = (row, priceIdx) => {
    const price = parseNumber(row.prices?.[priceIdx]);
    const costUah = getBackendTotalCostUah(row);

    if (costUah <= 0 || price <= 0) return neCell("-");
    const markup = price - costUah;
    const marginPct = (markup / price) * 100;
    return neCell(formatPercent(marginPct));
};

const renderMarkupMoneyCell = (row, priceIdx) => {
    const price = parseNumber(row.prices?.[priceIdx]);
    const costUah = getBackendTotalCostUah(row);

    if (costUah <= 0 || price <= 0) return neCell("-");
    const markup = price - costUah;
    return neCell(formatMoney(markup));
};
    const showSizeColumn =
        activeTab === "products" ||
        activeTab === "kits" ||
        activeTab === "components";

    const showFabricTypeColumn =
        activeTab === "kits" ||
        activeTab === "components";

    const showColorColumn = activeTab === "products";

    const showAnyCostColumns =
        activeTab !== "kitOptions" &&
        activeTab !== "componentOptions";

  
    const handleCostInputChange = useCallback(
        (rowIdx, field, rawVal) => {
            const isLockedField =
                RAW_MATERIAL_LOCK_TABS.has(activeTab) &&
                (
                    (field === "costRawMaterialUah" && rows[rowIdx]?.rawMaterialUahNoData) ||
                    (field === "costRawMaterialUsd" && rows[rowIdx]?.rawMaterialUsdNoData)
                );

            if (isLockedField) return;
            const clean = sanitizeLoose(rawVal);
            setRowsForTab(activeTab, (prevRows) => {
                const next = prevRows.map((r) => ({...r}));
                const row = {...next[rowIdx]};
                row[field] = clean;

                const uahToUsdMap = {
                    costRawMaterialUah: "costRawMaterialUsd",
                    costLaborUah: "costLaborUsd",
                    costPackagingUah: "costPackagingUsd",
                };

                const linkedUsdField = uahToUsdMap[field];
                if (
                    linkedUsdField &&
                    currentUsdRate &&
                    Number.isFinite(currentUsdRate)
                ) {
                    const num = parseNumber(clean);
                    if (Number.isFinite(num) && clean.trim() !== "") {
                        row[linkedUsdField] = (num / currentUsdRate).toFixed(4);
                    } else if (clean.trim() === "") {
                        row[linkedUsdField] = "";
                    }
                }

                next[rowIdx] = row;
                return next;
            });
        },
        [activeTab, setRowsForTab, currentUsdRate]
    );

    const renderCostInput = useCallback(
        (row, field) => {
            const isLockedNoData =
                RAW_MATERIAL_LOCK_TABS.has(activeTab) &&
                (
                    (field === "costRawMaterialUah" && row.rawMaterialUahNoData) ||
                    (field === "costRawMaterialUsd" && row.rawMaterialUsdNoData)
                );

            const loading = !!savingCostRows[row.__rowIndex];

            if (isLockedNoData) {
                return (
                    <div className={styles.inputWrap}>
                        <input
                            className={styles.cellInput}
                            value={NO_DATA_LABEL}
                            readOnly
                            inputMode="text"
                        />

                        <Tooltip title={NO_DATA_TOOLTIP} arrow placement="top">
                            <img
                                src={InfoIcon}
                                className={styles.infoIcon}
                                alt="Інфо"
                            />
                        </Tooltip>

                        {loading && (
                            <div className={styles.spinnerMiniWrap}>
                                <div className={styles.spinnerMini} />
                            </div>
                        )}
                    </div>
                );
            }

            const val = row[field] ?? "";
            const dirty = isCostFieldDirty(row, field);

            return (
                <div className={styles.inputWrap}>
                    <input
                        className={`${styles.cellInput} ${dirty ? styles.changedInput : ""}`}
                        value={val}
                        onChange={(e) =>
                            handleCostInputChange(row.__rowIndex, field, e.target.value)
                        }
                        inputMode="text"
                    />
                    {loading && (
                        <div className={styles.spinnerMiniWrap}>
                            <div className={styles.spinnerMini} />
                        </div>
                    )}
                </div>
            );
        },
        [activeTab, handleCostInputChange, savingCostRows]
    );

    const renderNoArrivalsDash = () =>
        neCell(
            <div className={styles.noArrivalsCell}>
                <span>-</span>
                <Tooltip title={NO_ARRIVALS_TOTAL_TOOLTIP} arrow placement="top">
                    <img src={InfoIcon} className={styles.infoIcon} alt="Інфо" />
                </Tooltip>
            </div>,
            { relative: true }
        );

    const columns = useMemo(() => {
        const cols = [
            {
                key: "sku",
                title: "ID",
                width: "80px",
                render: (v) => neCell(v),
            },
            {
                key: "type",
                title: "Тип",
                width: "140px",
                render: (v) => neCell(v),
            },
            {
                key: "name",
                title: "Назва",
                render: (v) => neCell(v),
            }
        ];

        if (showSizeColumn) {
            cols.push({
                key: "size",
                title: "Розмір",
                width: "130px",
                render: (v) => neCell(v || "-"),
            });
        }

        if (showFabricTypeColumn) {
            cols.push({
                key: "fabricType",
                title: "Тип тканини",
                width: "160px",
                render: (v) => neCell(v || "-"),
            });
        }

        if (showColorColumn) {
            cols.push({
                key: "color",
                title: "Колір",
                width: "140px",
                render: (v) =>
                    neCell(
                        <div className={styles.centerFlex}>
                            <ColorRow colors={v ? [{ title: v }] : []} />
                        </div>
                    ),
            });
        }

     if (showAnyCostColumns) {
    cols.push({
        key: "cost_uah_total",
        title: (
            <div className={styles.priceHeader}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setCostExtrasUahOpenByTab((prev) => ({
                            ...prev,
                            [activeTab]: !prev[activeTab],
                        }));
                    }}
                    aria-label={
                        showCostExtrasUah
                            ? "Згорнути додаткові гривневі колонки собівартості"
                            : "Показати додаткові гривневі колонки собівартості"
                    }
                    title={
                        showCostExtrasUah
                            ? "Сховати гривневі деталі собівартості"
                            : "Показати гривневі деталі собівартості"
                    }
                    className={styles.extraBtn}
                >
                    {showCostExtrasUah ? (
                        <MinusSquareIcon size={18}/>
                    ) : (
                        <PlusSquareIcon size={18}/>
                    )}
                </button>
                <div className={styles.innerTitle}>Загальна собівартість, грн</div>
            </div>
        ),
        width: "130px",
        render: (_, row) => {
            const totalUah = getBackendTotalCostUah(row);

            if (totalUah <= 0) {
                return renderNoArrivalsDash();
            }

            return neCell(formatMoney(totalUah));
        },
    });
}

       if (showAnyCostColumns && showCostExtrasUah) {

    cols.push(
        {
            key: "cost_material_qty",
            title: "К-ть сировини",
            width: "130px",
            render: (_, row) => renderCostInput(row, "costRawMaterialQty"),
            cellClassKey: "inputCellFirst",
        },
        {
            key: "cost_material_uah",
            title: "В-ть одиниці сировини, грн",
            width: "130px",
            render: (_, row) => renderCostInput(row, "costRawMaterialUah"),
            cellClassKey: "inputCell",
        },
        {
            key: "cost_work_uah",
            title: "В-ть роботи, грн",
            width: "130px",
            render: (_, row) => renderCostInput(row, "costLaborUah"),
            cellClassKey: "inputCell",
        },
        {
            key: "cost_pack_uah",
            title: "В-ть пакування, грн",
            width: "130px",
            render: (_, row) => renderCostInput(row, "costPackagingUah"),
            cellClassKey: "inputCell",
        },
        {
            key: "cost_usd_last_arrival",
            title: (
                <>
                    Заг соб-ть
                    <br />
                    за курсом $ ост. надходж.
                </>
            ),
            width: "130px",
            render: (_, row) => renderCostUsdLastArrivalCell(row),
            cellClassName: (_, row) => getLastArrivalCellClass(row),
        }
    );
}

if (showAnyCostColumns) {
    cols.push({
        key: "cost_usd_total",
        title: (
            <div className={styles.priceHeader}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setCostExtrasUsdOpenByTab((prev) => ({
                            ...prev,
                            [activeTab]: !prev[activeTab],
                        }));
                    }}
                    aria-label={
                        showCostExtrasUsd
                            ? "Згорнути додаткові доларові колонки собівартості"
                            : "Показати додаткові доларові колонки собівартості"
                    }
                    title={
                        showCostExtrasUsd
                            ? "Сховати доларові деталі собівартості"
                            : "Показати доларові деталі собівартості"
                    }
                    className={styles.extraBtn}
                >
                    {showCostExtrasUsd ? (
                        <MinusSquareIcon size={18}/>
                    ) : (
                        <PlusSquareIcon size={18}/>
                    )}
                </button>
                <div className={styles.innerTitle}>Загальна собівартість, $</div>
            </div>
        ),
        width: "130px",
        render: (_, row) => renderCostUsdCell(row),
    });
}

if (showAnyCostColumns && showCostExtrasUsd) {
    cols.push(
        {
            key: "cost_material_usd",
            title: "В-ть одиниці сировини, $",
            width: "130px",
            render: (_, row) => renderCostInput(row, "costRawMaterialUsd"),
            cellClassKey: "inputCellFirst",
        },
        {
            key: "cost_work_usd",
            title: "В-ть роботи, $",
            width: "130px",
            render: (_, row) => renderCostInput(row, "costLaborUsd"),
            cellClassKey: "inputCell",
        },
        {
            key: "cost_pack_usd",
            title: "В-ть пакування, $",
            width: "130px",
            render: (_, row) => renderCostInput(row, "costPackagingUsd"),
            cellClassKey: "inputCell",
        }
    );
}


        for (let i = 0; i < priceCols; i++) {
            const isFirstPrice = i === 0;
            const plMeta = pricelistsMeta[i];

            cols.push({
                key: `pl_${plMeta?.id ?? i}`,
                title: (
                    <PriceHeader
                        idx={i}
                        title={plMeta?.title || `Прайсліст ${i + 1}`}
                        status={plMeta?.raw?.status || plMeta?.status}
                    />
                ),
                width: "160px",
                render: (_, row) =>
                    renderPriceInput(
                        row,
                        row.__rowIndex,
                        i,
                        plMeta?.id
                    ),
                cellClassKey: isFirstPrice
                    ? "inputCellFirst"
                    : "inputCell",
            });

            if (expandedExtras[i]) {
                cols.push({
                    key: `pl_${plMeta?.id ?? i}_margin_pct`,
                    title: "Маржа, %",
                    width: "120px",
                    render: (_, row) => renderMarginPercentCell(row, i),
                });
                cols.push({
                    key: `pl_${plMeta?.id ?? i}_markup_uah`,
                    title: "Націнка, грн",
                    width: "130px",
                    render: (_, row) => renderMarkupMoneyCell(row, i),
                });
            }
        }

        cols.push({
            key: "controls",
            title: "",
            width: "88px",
            render: (_, row) => {
                const dirtyCount = rowDirtyCount(row);
                const canSave = dirtyCount > 0;
                return neCell(
                    <div className={styles.btnRow}>
                        <IconBtn
                            title={
                                canSave
                                    ? "Зберегти рядок"
                                    : "Немає змін для збереження"
                            }
                            disabled={!canSave}
                            onClick={() => updateRow(row.__rowIndex)}
                        >
                            <SaveCircleIcon
                                size={20}
                                fill={
                                    canSave ? "#2ECC71" : "#BBDDC7"
                                }
                            />
                        </IconBtn>

                        <IconBtn
                            title="Відновити рядок"
                            onClick={() => restoreRow(row.__rowIndex)}
                            disabled={!canSave}
                        >
                            <RestoreIcon
                                size={20}
                                color="#201827"
                            />
                        </IconBtn>
                    </div>,
                    {compact: true}
                );
            },
        });

        return cols;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        priceCols,
        rows,
        savingCells,
        expandedExtras,
        pricelistsMeta,
        activeTab,
        showAnyCostColumns,
        showCostExtrasUah,
        showCostExtrasUsd,
        showSizeColumn,
        showFabricTypeColumn,
        showColorColumn,
        getBackendTotalCostUah,
        getBackendTotalCostUsd,
        renderCostInput
    ]);

    /* ====== ре-вимірювання для ghost-scroll при зміні ширини ====== */
    useEffect(() => {
        recalcX();
    }, [expandedExtras, showCostExtrasUah, showCostExtrasUsd, recalcX]);

    useEffect(() => {
        recalcX();
    }, [priceCols, rows.length, recalcX]);

    const onClose = () => setIsShowFilter(false);

    const handlePriceFilterChange = (event) => {
        const value = event.target.value; // "", "true", "false"

        let hasPrice = null;
        if (value === "true") hasPrice = true;
        else if (value === "false") hasPrice = false;
        // "" ⇒ hasPrice = null ⇒ не передаємо параметр

        const next = {
            ...filterParams,
            page: 1,
            hasPrice,
        };

        updateTabSlice(activeTab, (slice) => ({
            ...slice,
            filters: {...slice.filters, hasPrice: value},
            filterParams: next,
            page: 1,
        }));

        onSendFilters(activeTab, next);
    };


    const resetAllFilters = () => {
        const clearedFilters = {hasPrice: ""};

        const next = {
            page: 1,
            name: "",
            hasPrice: null,
        };

        updateTabSlice(activeTab, (slice) => ({
            ...slice,
            filters: clearedFilters,
            filterParams: next,
            page: 1,
        }));

        fetchData(activeTab, next);
    };

  


   const uahCostExtrasColsCount =
    showAnyCostColumns && showCostExtrasUah
        ? (
            1 + // К-ть сировини
            1 + // В-ть одиниці сировини, грн
            1 + // В-ть роботи, грн
            1 + // В-ть пакування, грн
            1   // Заг соб-ть за курсом $ ост. надходж.
        )
        : 0;

const usdCostExtrasColsCount =
    showAnyCostColumns && showCostExtrasUsd
        ? 3 // В-ть одиниці сировини, $, В-ть роботи, $, В-ть пакування, $
        : 0;

const totalCostMainColsCount =
    showAnyCostColumns ? 2 : 0; // Загальна собівартість, грн + Загальна собівартість, $

const minWidthPx =
    80 +
    140 +
    240 +
    (showSizeColumn ? 130 : 0) +
    (showFabricTypeColumn ? 160 : 0) +
    (showColorColumn ? 140 : 0) +
    (130 * totalCostMainColsCount) +
    (130 * uahCostExtrasColsCount) +
    (130 * usdCostExtrasColsCount) +
    Array.from({ length: priceCols }).reduce(
        (acc, _, i) =>
            acc + 160 + (expandedExtras[i] ? 120 + 130 : 0),
        0
    ) +
    88 +
    64;

    const scrollWrapStyle = {overflowX: "auto", paddingBottom: 8};
    const innerStyle = {minWidth: `${minWidthPx}px`};

    // синхронізація dirtyCount з глобальним UnsavedChangesContext
    useEffect(() => {
        setDirtyCount(totalDirty || 0);
        return () => {
            setDirtyCount(0);
        };
    }, [totalDirty, setDirtyCount]);

    // глобальна кнопка SaveAll з UnsavedChangesContext
    useEffect(() => {
        saveAllRef.current = saveAll;
        return () => {
            if (saveAllRef.current === saveAll)
                saveAllRef.current = null;
        };
    }, [saveAll, saveAllRef]);

    const resetHorizontalScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        // скидаємо скрол
        el.scrollTo({left: 0, behavior: "auto"});

        // оновимо трек для ghost-scroll
        recalcX();
    }, [recalcX]);

    /* ====== таби + алерт при перемиканні з незбереженими змінами ====== */
    const handleTabClick = (tabKey) => {
        if (tabKey === activeTab) return;

        // якщо є незбережені зміни – попереджаємо, як і раніше
        if (totalDirty > 0) {
            const ok = window.confirm(
                `Ви внесли зміни у ${totalDirty} запис(ах).\n` +
                `Щоб перейти до іншої таблиці, потрібно або зберегти зміни, або скасувати їх.\n\n` +
                `Натисніть "OK", щоб СКАСУВАТИ незбережені зміни в поточній таблиці й перейти.\n` +
                `Натисніть "Скасувати", щоб залишитися в поточній таблиці`
            );

            if (!ok) return;

            // discard усі зміни в поточному табі перед переходом
            restoreAll();
        }

        // схлопуємо додаткові колонки (маржа/націнка)
        setExpandedExtras({});

        // скидаємо горизонтальний скрол для таблиці й хедера
        resetHorizontalScroll();

        // беремо поточний slice цільового табу
        const targetSlice = tabState[tabKey];

        // форсимо першу сторінку для ЦЬОГО табу
        const nextFilterParams = {
            ...targetSlice.filterParams,
            page: 1,
        };

        // оновлюємо slice цього табу: page та filterParams.page → 1
        updateTabSlice(tabKey, (slice) => ({
            ...slice,
            page: 1,
            filterParams: nextFilterParams,
        }));

        // перемикаємо таб
        setActiveTab(tabKey);

        // завжди перевантажуємо дані для табу вже з page = 1
        fetchData(tabKey, nextFilterParams);
    };

    return (
        <div ref={rootRef}>
            <ArrBack/>  
            <SearchFilter
                onOpenFilter={() => setIsShowFilter(true)}
                searchValue={filterParams.name}
                setSearchValue={(value) =>
                    updateTabSlice(activeTab, (slice) => ({
                        ...slice,
                        filterParams: {
                            ...slice.filterParams,
                            name: value,
                        },
                    }))
                }
                onSearch={() => onSendFilters(activeTab, {...filterParams, page: 1})}

                title={"Ціни"}
            />

            {/* таби */}
            <div className={styles.tabs}>
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`${styles.tabBtn} ${
                            activeTab === tab.key ? styles.activeTab : ""
                        }`}
                        onClick={() => handleTabClick(tab.key)}
                    >
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>
            <CurrencyRateInfo
                buyRate={currentUsdRate}
                saleRate={currentUsdSaleRate}
            />

            <TableFixedHeader
                columns={columns}
                subtitle={null}
                equalColumns={false}
                centered
                priceTable
                scrollContainerRef={scrollRef}
                minWidth={minWidthPx}
                stickyTop={0}
                stickyZIndex={8}
            />
            <div
                style={scrollWrapStyle}
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
                <div style={innerStyle}>
                    <Table
                        columns={columns}
                        data={rows}
                        centered
                        priceTable
                        hideHeader
                        subtitle={null}
                    />
                </div>
            </div>

            <StickyBar/>

            <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
                <CustomSelect
                    label="З цінами"
                    value={filters.hasPrice}
                    onChange={handlePriceFilterChange}
                    options={PRICE_FILTER_OPTIONS}
                />
            </Filter>

            <PopupCloser isShow={isShowFilter} onClose={onClose}/>

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

            {totalDirty > 0 && (
                <div className={styles.saveBox}>
                    <div className={styles.question}>
                        Зберегти зміни у {totalDirty} запис(ах)?
                    </div>
                    <button
                        className={"btnDark"}
                        type="button"
                        onClick={saveAll}
                    >
                        <span>Зберегти</span>
                    </button>
                    <button type="button" onClick={restoreAll}>
                        <span>Відновити</span>
                    </button>
                </div>
            )}

            {isLoading && <Preloader/>}
        </div>
    );
};

export default NewPrices;
