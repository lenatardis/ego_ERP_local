// EditableProductTable.jsx
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import styles from '../../../../components/Common/Table/Table.module.scss';
import innerStyles from '../EditableFabricTable/EditableFabricTable.module.scss';
import WhiteCustomSelect from '../../../../components/Common/WhiteCustomSelect/WhiteCustomSelect.jsx';
import { getAccessToken } from "../../../../api/authStorage.js";
import { fetchProductProperties, fetchProduct, fetchWarehouseStructure } from "../../../../api/tablesApi.js";
import NewCustomSelect from "../../../Common/NewCustomSelect/NewCustomSelect.jsx";
import CentralPopup from "../../../Common/CentralPopup/CentralPopup.jsx";
import NewProduct from "../NewProduct/NewProduct.jsx";
import Tooltip from "@mui/material/Tooltip";
import InfoIcon from "../../../../assets/icons/info.svg";
import IconClose from "../../../../assets/icons/cross.svg";

const toSizeName = (s) => `${s.width}x${s.length}`;
const toOptions = (arr = [], mapName = (x) => x.name) => arr.map(x => ({ value: x.id, name: mapName(x) }));

const EditableProductTable = ({ mode = 'create', exchangeRate, readOnly = false, onCapacityValidationChange }, ref) => {
    // ----- options (from backend) -----
    const [colorOptions, setColorOptions] = useState([]);
    const [sizeOptions, setSizeOptions] = useState([]);
    const [categoryDict, setCategoryDict] = useState([]);
    const [sourceDict, setSourceDict] = useState([]);

    // склад дерево
    const [whTree, setWhTree] = useState([]);

    const emptyVariant = () => ({
        colorId: '', sizeId: '',
        quantity: '',
        warehouse: { id: '', name: '' },
        locker: { id: '', name: '' },
        cell: { id: '', name: '' },
        priceUAH: '', priceUSD: '',
        sumUAH: '', sumUSD: '',
        unit_id: undefined,
        priceUAHManual: false,
        originalCellId: '',
        originalQty: 0
    });
    const emptyRow = (locked = false) => ({
        template: { id: '', name: '' },
        category: { id: '', name: '' },
        variants: [emptyVariant()],
        readonlyTemplate: locked,
        isPersisted: false,
    });

    const [rows, setRows] = useState([emptyRow(false)]);
    const rowsRef = useRef(rows);

    useEffect(() => {
        rowsRef.current = rows;
    }, [rows]);

    const [productHints, setProductHints] = useState({});
    const [productLoading, setProductLoading] = useState({});
    const [productNameBlurred, setProductNameBlurred] = useState({});
    const productTimersRef = useRef({});

    const [rowErrors, setRowErrors] = useState({});
    const [variantErrors, setVariantErrors] = useState({});
    const [capacityPopupInfo, setCapacityPopupInfo] = useState(null);
    const [activeCapacityErrorVariants, setActiveCapacityErrorVariants] = useState({});
    const capacityCheckTimerRef = useRef(null);
    const lastCapacityTouchedVariantRef = useRef(null);
    const capacityChangeSourceRef = useRef(null);
    const [isCreateProductPopupOpen, setIsCreateProductPopupOpen] = useState(false);
    const [createProductRowIndex, setCreateProductRowIndex] = useState(null);
    const productTooltip =
        'Введіть назву існуючого товару або створіть новий у попапі (кнопка +). Якщо товар існує, його категорія заповниться автоматично. Є підказки для швидкого вибору назви';

    const priceUAHTooltip =
        'Розраховується автоматично від ціни за одиницю в доларах по поточному курсу, але ви можете відкорегувати це значення вручну';

    const gridTemplate = { gridTemplateColumns: '20px minmax(100px,1fr) minmax(20px,1fr) minmax(100px,1fr) minmax(100px,1fr) minmax(110px,0.8fr) minmax(130px,1fr) minmax(100px,1fr) minmax(100px,1fr) minmax(20px,1fr) minmax(20px,1fr) minmax(20px,1fr) minmax(20px,1fr)' };

    const parseDecimal = (value) => {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : NaN;
        }
        const raw = String(value ?? '')
            .trim()
            .replace(',', '.')
            .replace(/\s+/g, '');

        if (!raw) return NaN;
        const n = Number(raw);
        return Number.isFinite(n) ? n : NaN;
    };

    const toNum = (v) => {
        const n = parseDecimal(v);
        return Number.isFinite(n) ? n : 0;
    };

    const toMoney = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return '';
        // тут як раз фіксуємо 2 знаки після коми
        return Number(num.toFixed(2));
    };



    const ensureFirstVariant = (rowIndex) => {
        setRows(prev => {
            const next = [...prev];
            if (!next[rowIndex].variants || next[rowIndex].variants.length === 0) {
                next[rowIndex].variants = [emptyVariant()];
            }
            return next;
        });
    };

    const handleRemoveRow = (rowIndex) => {
        setRows(prev => {
            if (rowIndex === 0) return prev;

            const row = prev[rowIndex];
            if (!row || row.isPersisted) return prev;

            return prev.filter((_, idx) => idx !== rowIndex);
        });

        setRowErrors(prev => {
            const next = {};
            Object.entries(prev || {}).forEach(([key, value]) => {
                const idx = Number(key);
                if (idx === rowIndex) return;
                next[idx > rowIndex ? idx - 1 : idx] = value;
            });
            return next;
        });

        setVariantErrors(prev => {
            const next = {};
            Object.entries(prev || {}).forEach(([key, value]) => {
                const [ri, vi] = String(key).split(':').map(Number);
                if (ri === rowIndex) return;
                const newRi = ri > rowIndex ? ri - 1 : ri;
                next[`${newRi}:${vi}`] = value;
            });
            return next;
        });

        setProductHints(prev => {
            const next = {};
            Object.entries(prev || {}).forEach(([key, value]) => {
                const idx = Number(key);
                if (idx === rowIndex) return;
                next[idx > rowIndex ? idx - 1 : idx] = value;
            });
            return next;
        });

        setProductLoading(prev => {
            const next = {};
            Object.entries(prev || {}).forEach(([key, value]) => {
                const idx = Number(key);
                if (idx === rowIndex) return;
                next[idx > rowIndex ? idx - 1 : idx] = value;
            });
            return next;
        });

        if (productTimersRef.current[rowIndex]) {
            clearTimeout(productTimersRef.current[rowIndex]);
        }

        const nextTimers = {};
        Object.entries(productTimersRef.current || {}).forEach(([key, value]) => {
            const idx = Number(key);
            if (idx === rowIndex) return;
            nextTimers[idx > rowIndex ? idx - 1 : idx] = value;
        });
        productTimersRef.current = nextTimers;
    };

    const recalcRowsByExchangeRate = (inputRows, currentExchangeRate) => {
        const rate = toNum(currentExchangeRate);

        if (!Number.isFinite(rate) || rate <= 0) {
            return inputRows.map(row => ({
                ...row,
                variants: (row.variants || []).map(v => ({
                    ...v,
                    priceUAH: v.priceUAHManual ? v.priceUAH : '',
                    sumUAH: '',
                    sumUSD: '',
                })),
            }));
        }

        return inputRows.map(row => ({
            ...row,
            variants: (row.variants || []).map(v => {
                const qty = toNum(v.quantity);
                const pd = toNum(v.priceUSD);

                if (v.priceUAHManual) {
                    const pu = toNum(v.priceUAH);

                    const sumUAH = (qty > 0 && pu > 0) ? toMoney(qty * pu) : '';
                    const sumUSD = (qty > 0 && pd > 0) ? toMoney(qty * pd) : '';

                    return {
                        ...v,
                        sumUAH,
                        sumUSD,
                    };
                }

                if (pd <= 0) {
                    return {
                        ...v,
                        priceUAH: '',
                        sumUAH: '',
                        sumUSD: '',
                        priceUAHManual: false,
                    };
                }

                const priceUAH = toMoney(pd * rate);
                const sumUAH = (qty > 0 && priceUAH > 0) ? toMoney(qty * priceUAH) : '';
                const sumUSD = (qty > 0 && pd > 0) ? toMoney(qty * pd) : '';

                return {
                    ...v,
                    priceUAH,
                    sumUAH,
                    sumUSD,
                    priceUAHManual: false,
                };
            }),
        }));
    };

    useEffect(() => {
        (async () => {
            try {
                const token = getAccessToken();
                const props = await fetchProductProperties(token);
                setColorOptions(toOptions(props?.colors || []));
                setSizeOptions(toOptions(props?.sizes || [], toSizeName));
                setCategoryDict(props?.categories || []);
                setSourceDict(props?.sources || []);
            } catch (e) {
                console.error('product properties fetch failed', e);
                setColorOptions([]);
                setSizeOptions([]);
            }
        })();
    }, []);

    // склад дерево
    useEffect(() => {
        (async () => {
            try {
                const token = getAccessToken();
                const data = await fetchWarehouseStructure(token);
                const normalized = (data || []).map(w => ({
                    id: w.id,
                    name: w.name,
                    racks: (w.racks || []).map(r => ({
                        id: r.id,
                        name: String(r.name ?? ''),
                        cells: (r.cells || []).map(c => ({
                            id: c.id,
                            name: String(c.number ?? ''),
                            initialCapacity: c.initial_capacity,
                            remainingCapacity: c.remaining_capacity
                        })),
                    })),
                }));
                setWhTree(normalized);
            } catch (e) {
                console.error('warehouse tree fetch failed', e);
                setWhTree([]);
            }
        })();
    }, []);

    useEffect(() => {
        return () => {
            Object.values(productTimersRef.current || {}).forEach(id => clearTimeout(id));

            if (capacityCheckTimerRef.current) {
                clearTimeout(capacityCheckTimerRef.current);
            }
        };
    }, []);

    const findById = (arr, id) => arr.find(x => x.id === id) || null;
    const whOptions = () => toOptions(whTree);
    const rackOptions = (wid) => toOptions((findById(whTree, wid)?.racks) || []);

    const getRackLabel = (wid) => {
        if (!wid) return <>Спочатку<br />склад</>;

        const options = rackOptions(wid);
        return options.length ? 'Оберіть' : 'Немає';
    };

    const cellOptions = (wid, rid) => {
        const w = findById(whTree, wid);
        const r = findById(w?.racks || [], rid);
        return toOptions(r?.cells || []);
    };

    const getCellLabel = (wid, rid) => {
        if (!rid) return <>Спочатку<br />стелаж</>;

        const options = cellOptions(wid, rid);
        return options.length ? 'Оберіть' : 'Немає';
    };

    const formatCapacityNumber = (value) => {
        const n = parseDecimal(value);
        if (!Number.isFinite(n)) return '0';
        return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
    };

    const getCellMetaById = (cellId) => {
        if (!cellId || !Array.isArray(whTree)) return null;

        for (const warehouse of whTree) {
            for (const rack of (warehouse.racks || [])) {
                const cell = (rack.cells || []).find(
                    c => Number(c.id) === Number(cellId)
                );

                if (cell) {
                    return {
                        id: cell.id,
                        name: cell.name,
                        initialCapacity: cell.initialCapacity,
                        remainingCapacity: cell.remainingCapacity,
                        warehouseName: warehouse.name,
                        rackName: rack.name,
                    };
                }
            }
        }

        return null;
    };

    const getCellDisplayName = (cellMeta) => {
        if (!cellMeta) return 'комірка не визначена';

        return [
            cellMeta.warehouseName ? `склад ${cellMeta.warehouseName}` : '',
            cellMeta.rackName ? `стелаж ${cellMeta.rackName}` : '',
            cellMeta.name ? `комірка ${cellMeta.name}` : '',
        ].filter(Boolean).join(' / ');
    };

const getColorName = (colorId) =>
    colorOptions.find(c => Number(c.value) === Number(colorId))?.name || '';

const getSizeName = (sizeId) =>
    sizeOptions.find(s => Number(s.value) === Number(sizeId))?.name || '';

const getProductVariantLabel = (row, variant, rowNumber, variantNumber) => {
    const productName = row?.template?.name?.trim();
    const colorName = getColorName(variant?.colorId);
    const sizeName = getSizeName(variant?.sizeId);

    const parts = [
        productName ? `товар ${productName}` : `товар у рядку № ${rowNumber}`,
        colorName ? `колір ${colorName}` : '',
        sizeName ? `розмір ${sizeName}` : '',
    ].filter(Boolean);

    return `${parts.join(', ')} — позиція № ${rowNumber}.${variantNumber}`;
};

const getOriginalQtyByCell = (cellId, sourceRows = rowsRef.current) => {
    if (mode !== 'edit' || !cellId) return 0;

    return sourceRows.reduce((sum, row) => {
        return sum + (row.variants || []).reduce((variantSum, variant) => {
            if (Number(variant.originalCellId) !== Number(cellId)) return variantSum;
            return variantSum + toNum(variant.originalQty);
        }, 0);
    }, 0);
};

const buildCapacityViolations = (inputRows = rowsRef.current) => {
    const groups = {};

    inputRows.forEach((row, rowIndex) => {
        (row.variants || []).forEach((variant, variantIndex) => {
            const cellId = variant.cell?.id;
            const qty = toNum(variant.quantity);

            if (!cellId || qty <= 0) return;

            const cellMeta = getCellMetaById(cellId);
            if (!cellMeta) return;

            const remaining = parseDecimal(cellMeta.remainingCapacity);
            if (!Number.isFinite(remaining)) return;

            const originalQty = getOriginalQtyByCell(cellId, inputRows);
            const limit = remaining + originalQty;
            const key = String(cellId);
            const rowNumber = rowIndex + 1;
            const variantNumber = variantIndex + 1;

            if (!groups[key]) {
                groups[key] = {
                    cellId: Number(cellId),
                    cellMeta,
                    cellLabel: getCellDisplayName(cellMeta),
                    initialCapacity: parseDecimal(cellMeta.initialCapacity),
                    remainingCapacity: remaining,
                    originalQty,
                    capacityLimit: limit,
                    totalQty: 0,
                    rows: [],
                };
            }

            groups[key].totalQty += qty;
            groups[key].rows.push({
                rowIndex,
                variantIndex,
                key: `${rowIndex}:${variantIndex}`,
                rowNumber,
                variantNumber,
                positionLabel: `${rowNumber}.${variantNumber}`,
                qty,
                productName: row.template?.name || '',
                colorName: getColorName(variant.colorId),
                sizeName: getSizeName(variant.sizeId),
                displayLabel: getProductVariantLabel(row, variant, rowNumber, variantNumber),
            });
        });
    });

        return Object.values(groups)
            .filter(group => group.totalQty > group.capacityLimit)
            .map(group => ({
                ...group,
                overflow: group.totalQty - group.capacityLimit,
            }));
    };

    const getCapacitySummaryText = (violations = []) => {
        if (!violations.length) return '';

        return violations
            .map(item => {
                const positionNumbers = item.rows.map(row => row.positionLabel).join(', ');
                const hasSinglePosition = item.rows.length === 1;

                const editCapacityText = mode === 'edit'
                    ? hasSinglePosition
                        ? `Ви можете вказати максимум ${formatCapacityNumber(item.capacityLimit)} для позиції № ${positionNumbers} або обирати інші комірки на складі. (З урахуванням раніше збереженої кількості доступно: ${formatCapacityNumber(item.remainingCapacity)}, раніше збережено в цій накладній в цій комірці: ${formatCapacityNumber(item.originalQty)}). `
                        : `Ви можете перерозподіляти сумарну кількість в межах ${formatCapacityNumber(item.capacityLimit)} між позиціями № ${positionNumbers} або обирати інші комірки на складі. (Без урахування раніше збереженої кількості доступно: ${formatCapacityNumber(item.remainingCapacity)}, раніше збережено в цій накладній в цій комірці: ${formatCapacityNumber(item.originalQty)}). `
                    : `Максимум доступно: ${formatCapacityNumber(item.capacityLimit)}. `;

                return `✓ ${item.cellLabel}: ${editCapacityText}У формі сумарно (в різних позиціях товарів) вказано - ${formatCapacityNumber(item.totalQty)}. Перевірте кількість в позиціях № ${positionNumbers}.`;
            })
            .join('\n');
    };

    const getCapacityFieldErrorText = () => {
        return 'Перевищено місткість комірки на складі';
    };

    const makeActiveViolationPopupInfo = (violation, touchedVariant) => {
        if (!violation) return null;

        return {
            ...violation,
            touchedVariant,
        };
    };

    const notifyCapacityValidationChange = (violations = []) => {
        if (typeof onCapacityValidationChange !== 'function') return;

        onCapacityValidationChange({
            hasErrors: violations.length > 0,
            violations,
            summaryText: getCapacitySummaryText(violations),
        });
    };

    const applyCapacityValidationState = ({
        violations = [],
    } = {}) => {
        const nextActiveVariants = {};

        violations.forEach(violation => {
            violation.rows.forEach(row => {
                nextActiveVariants[row.key] = true;
            });
        });

        setActiveCapacityErrorVariants(nextActiveVariants);

        setVariantErrors(prev => {
            const next = {};

            Object.entries(prev || {}).forEach(([key, value]) => {
                const cleanValue = { ...(value || {}) };
                delete cleanValue.capacity;

                if (Object.keys(cleanValue).length) {
                    next[key] = cleanValue;
                }
            });

            violations.forEach(violation => {
                violation.rows.forEach(row => {
                    next[row.key] = {
                        ...(next[row.key] || {}),
                        capacity: getCapacityFieldErrorText(violation),
                    };
                });
            });

            return next;
        });

        notifyCapacityValidationChange(violations);
    };

    const runCapacityValidation = ({
        source = 'silent',
        touchedVariant = lastCapacityTouchedVariantRef.current,
        showPopup = false,
    } = {}) => {
        if (readOnly || !Array.isArray(whTree) || !whTree.length) {
            notifyCapacityValidationChange([]);
            return [];
        }

        const violations = buildCapacityViolations(rowsRef.current);

        let activeViolation = null;

        if (touchedVariant?.key) {
            const found = violations.find(violation =>
                violation.rows.some(row => row.key === touchedVariant.key)
            );

            if (found) {
                activeViolation = makeActiveViolationPopupInfo(found, touchedVariant);
            }
        }

        applyCapacityValidationState({
            violations,
        });

        if (showPopup && activeViolation) {
            setCapacityPopupInfo({
                ...activeViolation,
                source,
            });
        }

        return violations;
    };

    const scheduleCapacityValidation = ({
        rowIndex,
        variantIndex,
        source,
        delay = 0,
        showPopup = true,
    } = {}) => {
        if (readOnly) return;

        const touchedVariant =
            rowIndex != null && variantIndex != null
                ? {
                    rowIndex,
                    variantIndex,
                    key: `${rowIndex}:${variantIndex}`,
                }
                : null;

        lastCapacityTouchedVariantRef.current = touchedVariant;
        capacityChangeSourceRef.current = source;

        if (capacityCheckTimerRef.current) {
            clearTimeout(capacityCheckTimerRef.current);
        }

        capacityCheckTimerRef.current = setTimeout(() => {
            runCapacityValidation({
                source,
                touchedVariant,
                showPopup,
            });
        }, delay);
    };

    // Product name (template) w/ hints
    const mapProductsToHints = (results = []) =>
        results.map(p => ({
            id: p.id,
            name: p.name,
            categoryId: p.category?.id ?? '',
            categoryName: p.category?.name ?? '',
        }));

    const handleNameChange = (rowIndex, value) => {
        setRows(prev => {
            const next = [...prev];
            const row = { ...next[rowIndex] };

            row.template = { id: '', name: value };
            row.category = { id: '', name: '' };

            if (!row.variants || row.variants.length === 0) {
                row.variants = [emptyVariant()];
            }

            next[rowIndex] = row;
            return next;
        });

        setProductNameBlurred(prev => ({
            ...prev,
            [rowIndex]: false,
        }));


        if (productTimersRef.current[rowIndex]) {
            clearTimeout(productTimersRef.current[rowIndex]);
        }

        const trimmed = (value || '').trim();

        if (trimmed === '' || trimmed.length < 2) {
            setProductHints(prev => ({ ...prev, [rowIndex]: [] }));
            setProductLoading(prev => ({ ...prev, [rowIndex]: false }));
            return;
        }

        productTimersRef.current[rowIndex] = setTimeout(async () => {
            try {
                setProductLoading(prev => ({ ...prev, [rowIndex]: true }));
                const token = getAccessToken();
                const resp = await fetchProduct(token, trimmed);
                const hints = mapProductsToHints(resp?.warehouse_item_templates || []);
                setProductHints(prev => ({ ...prev, [rowIndex]: hints }));

                const exact = hints.find(h => h.name === trimmed);
                if (exact) {
                    setRows(prev => {
                        const next = [...prev];
                        next[rowIndex].template = { id: exact.id, name: exact.name };
                        next[rowIndex].category = {
                            id: exact.categoryId,
                            name: exact.categoryName
                        };
                        return next;
                    });
                }
            } catch (e) {
                console.error('product hints fetch failed', e);
                setProductHints(prev => ({ ...prev, [rowIndex]: [] }));
            } finally {
                setProductLoading(prev => ({ ...prev, [rowIndex]: false }));
            }
        }, 400);
    };

    const handleNameBlur = (rowIndex) => {
        setProductNameBlurred(prev => ({
            ...prev,
            [rowIndex]: true,
        }));

        const current = rows[rowIndex]?.template?.name?.trim();

        if (!current) return;

        const hints = productHints[rowIndex] || [];
        const exact = hints.find(h => h.name === current);

        if (exact) {
            setRows(prev => {
                const next = [...prev];
                next[rowIndex].template = { id: exact.id, name: exact.name };
                next[rowIndex].category = { id: exact.categoryId, name: exact.categoryName };
                return next;
            });

            setProductNameBlurred(prev => ({
                ...prev,
                [rowIndex]: false,
            }));

            ensureFirstVariant(rowIndex);
        }
    };

    const openCreateProductPopup = (rowIndex) => {
        setCreateProductRowIndex(rowIndex);
        setIsCreateProductPopupOpen(true);
    };

    const closeCreateProductPopup = () => {
        setIsCreateProductPopupOpen(false);
        setCreateProductRowIndex(null);
    };

    const handleProductCreated = async (createdProduct, meta = {}) => {
        const rowIndex = createProductRowIndex;
        if (rowIndex == null) {
            closeCreateProductPopup();
            return;
        }

        const fallbackName = meta?.name || rows[rowIndex]?.template?.name || '';
        const fallbackCategoryName = meta?.categoryName || '';

        let resolved = null;

        try {
            const token = getAccessToken();
            const resp = await fetchProduct(token, fallbackName);
            const hints = mapProductsToHints(resp?.warehouse_item_templates || []);
            setProductHints(prev => ({ ...prev, [rowIndex]: hints }));
            resolved = hints.find(h => h.name === fallbackName) || hints[0] || null;
        } catch (e) {
            console.error('Failed to resolve created product from search:', e);
        }

        setRows(prev => {
            const next = [...prev];
            const row = { ...next[rowIndex] };

            if (resolved) {
                row.template = { id: resolved.id, name: resolved.name };
                row.category = {
                    id: resolved.categoryId || '',
                    name: resolved.categoryName || '',
                };
            } else {
                row.template = {
                    id: createdProduct?.id ?? '',
                    name: createdProduct?.name ?? fallbackName,
                };
                row.category = {
                    id:
                        createdProduct?.category?.id ??
                        createdProduct?.category_id ??
                        '',
                    name:
                        createdProduct?.category?.name ??
                        createdProduct?.category_name ??
                        fallbackCategoryName ??
                        '',
                };
            }

            if (!row.variants || row.variants.length === 0) {
                row.variants = [emptyVariant()];
            }

            next[rowIndex] = row;
            return next;
        });

        setProductLoading(prev => ({ ...prev, [rowIndex]: false }));
        closeCreateProductPopup();
    };

    // Variants (subrows)
    const addVariantWith = (rowIndex, patch = {}) => {
        setRows(prev => {
            const next = [...prev];
            const v = { ...emptyVariant(), ...patch };
            next[rowIndex].variants.push(v);
            return next;
        });
    };

    const handleAddColor = (rowIndex, colorIdStr) => {
        const colorId = colorIdStr === '' ? '' : Number(colorIdStr);
        if (colorId === '') return;
        ensureFirstVariant(rowIndex);
        setRows(prev => {
            const next = [...prev];
            const variants = [...(next[rowIndex].variants || [])];
            const targetIdx = variants.findIndex(v => !v.colorId); // перший без кольору
            if (targetIdx !== -1) variants[targetIdx] = { ...variants[targetIdx], colorId };
            else variants.push({ ...emptyVariant(), colorId });
            next[rowIndex].variants = variants;
            return next;
        });
    };

    const handleAddSize = (rowIndex, sizeIdStr) => {
        const sizeId = sizeIdStr === '' ? '' : Number(sizeIdStr);
        if (sizeId === '') return;
        ensureFirstVariant(rowIndex);
        setRows(prev => {
            const next = [...prev];
            const variants = [...(next[rowIndex].variants || [])];
            const targetIdx = variants.findIndex(v => !v.sizeId); // перший без розміру
            if (targetIdx !== -1) variants[targetIdx] = { ...variants[targetIdx], sizeId };
            else variants.push({ ...emptyVariant(), sizeId });
            next[rowIndex].variants = variants;
            return next;
        });
    };

    const updateVariant = (rowIndex, varIndex, patch) => {
        setRows(prev => {
            const next = [...prev];
            const prevVariant = next[rowIndex].variants[varIndex];
            const v = { ...prevVariant, ...patch };

            // ручна правка гривні
            if (Object.prototype.hasOwnProperty.call(patch, 'priceUAH')) {
                const raw = patch.priceUAH;
                v.priceUAH = raw;
                v.priceUAHManual = raw !== '' && raw !== null && raw !== undefined;
            }

            const rate = toNum(exchangeRate);

            // авто: USD -> UAH
            if (Object.prototype.hasOwnProperty.call(patch, 'priceUSD')) {
                const rawUSD = patch.priceUSD;
                v.priceUSD = rawUSD;

                const pdNum = toNum(v.priceUSD);

                if (rate > 0 && pdNum > 0) {
                    v.priceUAH = toMoney(pdNum * rate);
                    v.priceUAHManual = false;
                } else if (!pdNum) {
                    v.priceUAH = '';
                    v.priceUAHManual = false;
                }
            }

            const qty = toNum(v.quantity);
            const pu = toNum(v.priceUAH);
            const pd = toNum(v.priceUSD);

            v.sumUAH = (qty > 0 && pu > 0) ? toMoney(qty * pu) : '';
            v.sumUSD = (qty > 0 && pd > 0) ? toMoney(qty * pd) : '';

            next[rowIndex].variants[varIndex] = v;
            return next;
        });

        if (Object.prototype.hasOwnProperty.call(patch, 'quantity')) {
            scheduleCapacityValidation({
                rowIndex,
                variantIndex: varIndex,
                source: 'quantity',
                delay: 500,
                showPopup: true,
            });
        }
    };


    // warehouse chain for variant
    const handleVarWarehouse = (ri, vi, idStr) => {
        const id = idStr === '' ? '' : Number(idStr);
        setRows(prev => {
            const next = [...prev];
            const v = { ...next[ri].variants[vi] };
            if (id === '') v.warehouse = { id: '', name: '' };
            else {
                const w = findById(whTree, id);
                v.warehouse = { id, name: w?.name || '' };
            }
            v.locker = { id: '', name: '' };
            v.cell = { id: '', name: '' };
            next[ri].variants[vi] = v;
            return next;
        });
        scheduleCapacityValidation({
            rowIndex: ri,
            variantIndex: vi,
            source: 'warehouse',
            delay: 0,
            showPopup: false,
        });
    };

    const handleVarRack = (ri, vi, idStr) => {
        const id = idStr === '' ? '' : Number(idStr);
        setRows(prev => {
            const next = [...prev];
            const v = { ...next[ri].variants[vi] };
            const wid = v.warehouse.id;
            if (!wid || id === '') v.locker = { id: '', name: '' };
            else {
                const rack = findById(findById(whTree, wid)?.racks || [], id);
                v.locker = { id, name: rack?.name || '' };
            }
            v.cell = { id: '', name: '' };
            next[ri].variants[vi] = v;
            return next;
        });
        scheduleCapacityValidation({
            rowIndex: ri,
            variantIndex: vi,
            source: 'rack',
            delay: 0,
            showPopup: false,
        });
    };

    const handleVarCell = (ri, vi, idStr) => {
        const id = idStr === '' ? '' : Number(idStr);
        setRows(prev => {
            const next = [...prev];
            const v = { ...next[ri].variants[vi] };
            const wid = v.warehouse.id;
            const rid = v.locker.id;

            if (!wid || !rid || id === '') {
                v.cell = { id: '', name: '' };
            } else {
                const cell = findById(
                    findById(findById(whTree, wid)?.racks || [], rid)?.cells || [],
                    id
                );
                v.cell = { id, name: cell?.name || '' };
            }

            next[ri].variants[vi] = v;
            return next;
        });
        scheduleCapacityValidation({
            rowIndex: ri,
            variantIndex: vi,
            source: 'cell',
            delay: 50,
            showPopup: true,
        });
    };
    // знайти warehouse/rack/cell за cellId
    const findCellPath = (cellId) => {
        if (!cellId || !Array.isArray(whTree)) return null;

        for (const w of whTree) {
            for (const r of (w.racks || [])) {
                const c = (r.cells || []).find(cc => Number(cc.id) === Number(cellId));
                if (c) {
                    return {
                        warehouse: { id: w.id, name: w.name },
                        locker: { id: r.id, name: r.name },
                        cell: { id: c.id, name: c.name },
                    };
                }
            }
        }

        return null;
    };

    const enrichRowsFromDicts = () => {
        setRows(prev => prev.map(row => {
            const copy = { ...row };
            copy.variants = (copy.variants || []).map(v => {
                const needsPath =
                    v.cell?.id &&
                    (!v.warehouse?.id || !v.locker?.id || !v.cell?.name);
                if (needsPath) {
                    const path = findCellPath(v.cell.id);
                    if (path) return { ...v, ...path };
                }
                return v;
            });
            return copy;
        }));
    };

    useEffect(() => {
        if (readOnly) return;
        if (!Array.isArray(whTree) || !whTree.length) return;

        const violations = buildCapacityViolations(rowsRef.current);

        // Тихо оновлюємо capacity-стан після будь-яких структурних змін.
        // Popup не відкриваємо, щоб він не з'являвся при завантаженні edit mode / enrich / видаленні.
        applyCapacityValidationState({
            violations,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, whTree, readOnly]);


    // Validation & Payload
    const isVariantTouched = (v) =>
        Boolean(
            v.colorId || v.sizeId || v.quantity ||
            v.warehouse.id || v.locker.id || v.cell.id ||
            v.priceUAH || v.priceUSD
        );

    const VALIDATION_FIELD_LABELS = {
        template: 'назва товару',
        color: 'колір',
        size: 'розмір',
        quantity: 'кількість',
        cell: 'комірка',
        capacity: 'місткість комірки',
        priceUAH: 'ціна од., грн',
        priceUSD: 'ціна од., $',
    };

    const getVariantValidationFieldNames = (errors = {}) =>
        Object.keys(errors)
            .map(key => VALIDATION_FIELD_LABELS[key])
            .filter(Boolean);

    const getProductValidationInfo = (rErrors = {}, vErrors = {}) => {
        const messages = [];

        rows.forEach((row, ri) => {
            const rowFieldNames = [];

            if (rErrors[ri]?.template) {
                rowFieldNames.push(VALIDATION_FIELD_LABELS.template);
            }

            const variantsWithErrors = (row.variants || [])
                .map((v, vi) => {
                    const variantFieldNames = getVariantValidationFieldNames(vErrors[`${ri}:${vi}`])
                        .filter(field => field !== VALIDATION_FIELD_LABELS.capacity);
                    return {
                        variant: v,
                        variantIndex: vi,
                        fieldNames: variantFieldNames,
                    };
                })
                .filter(item => item.fieldNames.length > 0);



            const rowNumber = ri + 1;
            const productName = row.template?.name?.trim();

            const getProductLabel = (variant = {}) => {
                const colorName = colorOptions.find(c => Number(c.value) === Number(variant.colorId))?.name;
                const sizeName = sizeOptions.find(s => Number(s.value) === Number(variant.sizeId))?.name;

                if (productName) {
                    const productDetails = [colorName, sizeName].filter(Boolean);

                    return productDetails.length
                        ? `В рядку ${rowNumber} в товарі ${productName}, ${productDetails.join(', ')}`
                        : `В рядку ${rowNumber} в товарі ${productName}`;
                }

                const details = [];

                if (colorName) {
                    details.push(`з кольором ${colorName}`);
                }

                if (sizeName) {
                    details.push(`з розміром ${sizeName}`);
                }

                return details.length
                    ? `В рядку ${rowNumber} в товарі ${details.join(' і ')}`
                    : `В рядку ${rowNumber} в товарі без назви`;
            };

            const hasOnlyProductName =
                productName &&
                row.template?.id &&
                !(row.variants || []).some(isVariantTouched);

            if (hasOnlyProductName) {
                messages.push({
                    prefix: `В рядку ${rowNumber} вказано назву товару ${productName}, але не заповнено дані варіанта. Щоб зберегти товар, додайте:`,
                    fields: ['колір', 'розмір', 'кількість', 'комірку', 'ціну од., $', 'ціну од., грн'],
                });

                return;
            }

            if (!rowFieldNames.length && !variantsWithErrors.length) return;

            variantsWithErrors.forEach(({ variant, fieldNames }) => {
                const parts = [...rowFieldNames, ...fieldNames];
                const uniqueParts = [...new Set(parts)];

                messages.push({
                    prefix: `${getProductLabel(variant)} є незаповнені поля:`,
                    fields: uniqueParts,
                });
            });

            if (rowFieldNames.length && !variantsWithErrors.length) {
                messages.push({
                    prefix: `${getProductLabel()} є незаповнені поля:`,
                    fields: rowFieldNames,
                });
            }
        });

        return messages;
    };

    const validateAndBuildPayload = () => {
        const rErrors = {};
        const vErrors = {};
        const out = [];

        rows.forEach((row, ri) => {
            const rowTouched = Boolean(
                row.template?.name ||
                (row.variants || []).some(isVariantTouched)
            );
            if (!rowTouched) return;

            if (!row.template?.id) {
                rErrors[ri] = { ...(rErrors[ri] || {}), template: 'Оберіть товар з підказки' };
            }

            (row.variants || []).forEach((v, vi) => {
                const touched = isVariantTouched(v);
                if (!touched) return;

                const ve = {};

                const qtyNum = toNum(v.quantity);
                const priceUAHNum = toNum(v.priceUAH);
                const priceUSDNum = toNum(v.priceUSD);

                if (!v.colorId) ve.color = 'Оберіть колір';
                if (!v.sizeId) ve.size = 'Оберіть розмір';

                if (!Number.isInteger(qtyNum) || qtyNum < 1) {
                    ve.quantity = 'К-ть ≥ 1';
                }

                if (!v.cell?.id) ve.cell = 'Оберіть комірку';
                if (!(priceUAHNum > 0)) ve.priceUAH = 'Ціна > 0';
                if (!(priceUSDNum > 0)) ve.priceUSD = 'Ціна > 0';

                if (Object.keys(ve).length) {
                    vErrors[`${ri}:${vi}`] = ve;
                } else {
                    const one = {
                        cell: Number(v.cell.id),
                        price_uah: toMoney(priceUAHNum),
                        price_usd: toMoney(priceUSDNum),
                        initial_quantity: qtyNum,
                        template: Number(row.template.id),
                        size: Number(v.sizeId),
                        color: Number(v.colorId),
                    };
                    if (mode === 'edit' && v.unit_id != null) {
                        one.unit_id = Number(v.unit_id);
                    }
                    out.push(one);
                }
            });
        });

        const capacityViolations = buildCapacityViolations(rowsRef.current);

        capacityViolations.forEach(violation => {
            violation.rows.forEach(row => {
                vErrors[row.key] = {
                    ...(vErrors[row.key] || {}),
                    capacity: getCapacityFieldErrorText(violation),
                };
            });
        });

        setRowErrors(rErrors);
        setVariantErrors(vErrors);

        const capacityVariantsMap = {};
        capacityViolations.forEach(violation => {
            violation.rows.forEach(row => {
                capacityVariantsMap[row.key] = true;
            });
        });
        setActiveCapacityErrorVariants(capacityVariantsMap);

        const productValidationInfo = getProductValidationInfo(rErrors, vErrors);

        const capacityValidationInfo = {
            hasErrors: capacityViolations.length > 0,
            violations: capacityViolations,
            summaryText: getCapacitySummaryText(capacityViolations),
        };

        notifyCapacityValidationChange(capacityViolations);

        return {
            isValid:
                Object.keys(rErrors).length === 0 &&
                Object.keys(vErrors).length === 0 &&
                out.length > 0,
            payload: out,
            rErrors,
            vErrors,
            productValidationInfo,
            capacityValidationInfo
        };
    };

    const loadFromEditAndRecalc = (templates = []) => {
        const mapped = (templates || []).map(t => {
            const row = emptyRow(true);
            row.isPersisted = true;

            row.template = {
                id: t?.warehouse_item_template?.id ?? '',
                name: t?.warehouse_item_template?.name ?? '',
            };

            row.category = {
                id: t?.warehouse_item_template?.category_id ?? '',
                name:
                    t?.warehouse_item_template?.category_name ??
                    t?.warehouse_item_template?.category?.name ??
                    '',
            };

            row.variants = (t?.units || []).map(u => {
                const rawCellId = u?.cell_id ?? u?.cell?.id ?? '';
                const cellId = rawCellId === '' ? '' : Number(rawCellId);

                return {
                    colorId: u?.color?.id ?? '',
                    sizeId: u?.size?.id ?? '',
                    quantity: u?.quantity != null ? String(u.quantity) : '',
                    warehouse: { id: '', name: '' },
                    locker: { id: '', name: '' },
                    cell: { id: cellId, name: '' },

                    priceUAH: u?.price_uah ?? '',
                    priceUSD: u?.price_usd ?? '',
                    sumUAH: u?.total_price_uah ?? '',
                    sumUSD: u?.total_price_usd ?? '',

                    priceUAHManual: false,
                    unit_id: u?.unit_id ?? undefined,
                    originalCellId: cellId ? Number(cellId) : '',
                    originalQty: toNum(u?.quantity),
                };
            });

            return row;
        });

        const preparedRows = mapped.length ? mapped : [emptyRow(false)];
        setRows(recalcRowsByExchangeRate(preparedRows, exchangeRate));
    };


    useImperativeHandle(ref, () => ({
        getRows: () => rows,
        validateAndBuildPayload,
        // loadFromEdit очікує структуру warehouse_item_units
        loadFromEdit: (templates = []) => {
            const mapped = (templates || []).map(t => {
                const row = emptyRow(true); // у edit блокуємо назву
                row.isPersisted = true;

                row.template = {
                    id: t?.warehouse_item_template?.id ?? '',
                    name: t?.warehouse_item_template?.name ?? '',
                };

                row.category = {
                    id: t?.warehouse_item_template?.category_id ?? '',
                    name:
                        t?.warehouse_item_template?.category_name ??
                        t?.warehouse_item_template?.category?.name ??
                        '',
                };

                row.variants = (t?.units || []).map(u => {
                    const rawCellId = u?.cell_id ?? u?.cell?.id ?? '';
                    const cellId = rawCellId === '' ? '' : Number(rawCellId);
                    const priceUSD = u?.price_usd ?? '';

                    return {
                        colorId: u?.color?.id ?? '',
                        sizeId: u?.size?.id ?? '',
                        quantity: u?.quantity != null ? String(u.quantity) : '',
                        warehouse: { id: '', name: '' },
                        locker: { id: '', name: '' },
                        cell: { id: cellId, name: '' },

                        priceUAH: u?.price_uah ?? '',
                        priceUSD,
                        sumUAH: u?.total_price_uah ?? '',
                        sumUSD: u?.total_price_usd ?? '',

                        priceUAHManual: false,

                        unit_id: u?.unit_id ?? undefined,
                        originalCellId: cellId ? Number(cellId) : '',
                        originalQty: toNum(u?.quantity),
                    };
                });

                return row;
            });

            setRows(mapped.length ? mapped : [emptyRow(false)]);
        },
        loadFromEditAndRecalc,
        getCapacityValidationInfo: () => {
            const violations = buildCapacityViolations(rowsRef.current);

            return {
                hasErrors: violations.length > 0,
                violations,
                summaryText: getCapacitySummaryText(violations),
            };
        },

    }), [rows, mode, exchangeRate, whTree]);

    useEffect(() => {
        enrichRowsFromDicts();
    }, [whTree]);

    const variantNeedsPath = (v) =>
        v?.cell?.id &&
        (!v?.warehouse?.id || !v?.locker?.id || !v?.cell?.name);

    useEffect(() => {
        if (!Array.isArray(whTree) || !whTree.length) return;
        const needs = rows.some(row => (row.variants || []).some(variantNeedsPath));
        if (!needs) return;
        enrichRowsFromDicts();
    }, [rows, whTree]);

    useEffect(() => {
        setRows(prev => recalcRowsByExchangeRate(prev, exchangeRate));
    }, [exchangeRate]);


    return (
        <div>
            <div className={`${styles.editableTable} ${innerStyles.muiLocal} editableTable`}>
                <div className={styles.gridTable__header} style={gridTemplate}>
                    <div>№</div>
                    <div>Назва</div>
                    <div>Категорія</div>
                    <div>Колір</div>
                    <div>Розмір</div>
                    <div>К-ть</div>
                    <div>Склад</div>
                    <div>Стелаж</div>
                    <div>Комірка</div>
                    <div>Ціна од.,$</div>
                    <div>Ціна од.,грн</div>
                    <div>Сума, $</div>
                    <div>Сума, грн</div>
                </div>

                <div className={styles.tableRows}>
                    {rows.map((row, ri) => {
                        const isLocked = !!row.readonlyTemplate;
                        const canRemoveRow = !readOnly && ri !== 0 && !row.isPersisted;
                        return (
                            <div className={innerStyles.rowBlock} key={ri}>
                                {canRemoveRow && (
                                    <button
                                        type="button"
                                        className={innerStyles.removeRowBtn}
                                        onClick={() => handleRemoveRow(ri)}
                                        aria-label="Видалити рядок"
                                    >
                                        <img src={IconClose} alt="" />
                                    </button>
                                )}
                                <div className={styles.gridTable__row} style={gridTemplate}>
                                    {/* № */}
                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}><input type="text" value={String(ri + 1)}
                                        readOnly /></div>

                                    {/* Назва (template) */}
                                    <div className={styles.gridTable__cell}>
                                        <div className={innerStyles.fabricCellWrap}>
                                            {!isLocked && !readOnly && (
                                                <button
                                                    type="button"
                                                    className={`${innerStyles.createFabricBtn} ${innerStyles.productAddIcon}`}
                                                    title="Створити новий товар"
                                                    onClick={() => openCreateProductPopup(ri)}
                                                    aria-label="Створити новий товар"
                                                />
                                            )}

                                            {!isLocked && !readOnly && (
                                                <div className={`${innerStyles.fabricTooltip} ${innerStyles.productTooltip}`}>
                                                    <Tooltip title={productTooltip} arrow placement="top">
                                                        <img src={InfoIcon} className={innerStyles.infoIcon} alt="Інфо" />
                                                    </Tooltip>
                                                </div>
                                            )}

                                            <input
                                                list={isLocked || readOnly ? undefined : `productNames-${ri}`}
                                                value={row.template.name}
                                                onChange={isLocked || readOnly ? undefined : (e) => handleNameChange(ri, e.target.value)}
                                                onBlur={isLocked || readOnly ? undefined : () => handleNameBlur(ri)}
                                                placeholder="Введіть назву"
                                                autoComplete="off"
                                                autoCorrect="off"
                                                spellCheck={false}
                                                autoCapitalize="off"
                                                readOnly={isLocked || readOnly}
                                                className={innerStyles.fullBorder}
                                            />
                                        </div>

                                        {!isLocked && !readOnly && (
                                            <datalist id={`productNames-${ri}`}>
                                                {(productHints[ri] || []).map(h => (
                                                    <option key={h.id} value={h.name} />
                                                ))}
                                            </datalist>
                                        )}

                                        {!isLocked
                                            && !readOnly
                                            && productNameBlurred[ri]
                                            && row.template.name?.trim()?.length >= 2
                                            && !row.template?.id
                                            && !productLoading[ri]
                                            && productHints[ri] !== undefined
                                            && productHints[ri]?.length > 0 && (
                                                <div className={innerStyles.hintEmpty}>
                                                    Знайдено схожі товари. Оберіть потрібний товар з підказки або створіть новий, натиснувши +
                                                </div>
                                            )}

                                        {!isLocked
                                            && !readOnly
                                            && productNameBlurred[ri]
                                            && row.template.name?.trim()?.length >= 2
                                            && !row.template?.id
                                            && !productLoading[ri]
                                            && productHints[ri] !== undefined
                                            && productHints[ri]?.length === 0 && (
                                                <div className={innerStyles.hintEmpty}>
                                                    Товар з такою назвою не знайдено. Ви можете створити його, натиснувши +
                                                </div>
                                            )}

                                        {rowErrors[ri]?.template && (
                                            <div className={innerStyles.err}>{rowErrors[ri].template}</div>
                                        )}
                                    </div>

                                    {/* Категорія (readonly, з продукту) */}
                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}>
                                        <input type="text" value={row.category.name} readOnly />
                                    </div>

                                    {/* Колір */}
                                    <div className={styles.gridTable__cell}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`c-${vi}`} style={{ marginBottom: 4 }}>
                                                <div className={innerStyles.noRightBorder}>
                                                    <NewCustomSelect
                                                        value={v.colorId ?? ''}
                                                        onChange={readOnly ? undefined : (e) => updateVariant(ri, vi, { colorId: e.target.value === '' ? '' : Number(e.target.value) })}
                                                        options={colorOptions}
                                                        label="Оберіть"
                                                        height="32px"
                                                        disabled={readOnly}
                                                        menuLeftAlign
                                                    />
                                                </div>

                                                {variantErrors[`${ri}:${vi}`]?.color && <div
                                                    className={innerStyles.err}>{variantErrors[`${ri}:${vi}`].color}</div>}
                                            </div>
                                        ))}
                                        {!readOnly && (
                                            <div className={innerStyles.noRightBorder}>
                                                <NewCustomSelect
                                                    value=""
                                                    onChange={(e) => handleAddColor(ri, e.target.value)}
                                                    options={colorOptions}
                                                    label={<>+ Додати<br />колір</>}
                                                    height="32px"
                                                    menuLeftAlign
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Розмір */}
                                    <div className={styles.gridTable__cell}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`s-${vi}`} style={{ marginBottom: 4 }}>
                                                <div className={innerStyles.fullBorder}>
                                                    <NewCustomSelect
                                                        value={v.sizeId ?? ''}
                                                        onChange={readOnly ? undefined : (e) => updateVariant(ri, vi, { sizeId: e.target.value === '' ? '' : Number(e.target.value) })}
                                                        options={sizeOptions}
                                                        label="Оберіть"
                                                        height="32px"
                                                        numeric
                                                        disabled={readOnly}
                                                        menuLeftAlign
                                                    />
                                                </div>

                                                {variantErrors[`${ri}:${vi}`]?.size && <div
                                                    className={innerStyles.err}>{variantErrors[`${ri}:${vi}`].size}</div>}
                                            </div>
                                        ))}
                                        {!readOnly && (<div>
                                            <div className={innerStyles.fullBorder}>
                                                <NewCustomSelect
                                                    value=""
                                                    onChange={(e) => handleAddSize(ri, e.target.value)}
                                                    options={sizeOptions}
                                                    label={<>+ Додати<br />розмір</>}
                                                    height="32px"
                                                    numeric
                                                    menuLeftAlign
                                                />
                                            </div>
                                        </div>
                                        )}
                                    </div>

                                    {/* К-сть */}
                                    <div className={styles.gridTable__cell}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`q-${vi}`} style={{ marginBottom: 4 }}>
                                                <input
                                                    type="number"
                                                    className={`${innerStyles.fullBorder} ${activeCapacityErrorVariants[`${ri}:${vi}`] ? innerStyles.capacityWarningBorder : ''}`}
                                                    value={v.quantity}
                                                    onChange={readOnly ? undefined : (e) => updateVariant(ri, vi, { quantity: e.target.value })}
                                                    placeholder="Введіть"
                                                    disabled={readOnly}
                                                    readOnly={readOnly}
                                                />
                                                {variantErrors[`${ri}:${vi}`]?.quantity && <div
                                                    className={innerStyles.err}>{variantErrors[`${ri}:${vi}`].quantity}</div>}
                                                {variantErrors[`${ri}:${vi}`]?.capacity && (
                                                    <div className={innerStyles.err}>
                                                        {variantErrors[`${ri}:${vi}`].capacity}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Склад / Шкаф  / Комірка */}
                                    <div className={styles.gridTable__cell}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`w-${vi}`} style={{ marginBottom: 4 }} className={innerStyles.noRightBorder}>
                                                <WhiteCustomSelect
                                                    value={v.warehouse.id ?? ''}
                                                    onChange={readOnly ? undefined : (e) => handleVarWarehouse(ri, vi, e.target.value)}
                                                    options={whOptions()}
                                                    label="Оберіть"
                                                    height="32px"
                                                    disabled={readOnly}
                                                    menuLeftAlign
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className={styles.gridTable__cell}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`r-${vi}`} style={{ marginBottom: 4 }} className={innerStyles.noRightBorder}>
                                                <WhiteCustomSelect
                                                    value={v.locker.id ?? ''}
                                                    onChange={readOnly ? undefined : (e) => handleVarRack(ri, vi, e.target.value)}
                                                    options={rackOptions(v.warehouse.id)}
                                                    label={getRackLabel(v.warehouse.id)}
                                                    height="32px"
                                                    disabled={readOnly}
                                                    menuLeftAlign
                                                />
                                            </div>
                                        ))}
                                    </div>



                                    <div className={styles.gridTable__cell}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`c2-${vi}`} style={{ marginBottom: 4 }}>
                                                <div className={innerStyles.noRightBorder}>
                                                    <WhiteCustomSelect
                                                        value={v.cell.id ?? ''}
                                                        onChange={readOnly ? undefined : (e) => handleVarCell(ri, vi, e.target.value)}
                                                        options={cellOptions(v.warehouse.id, v.locker.id)}
                                                        label={getCellLabel(v.warehouse.id, v.locker.id)}
                                                        height="32px"
                                                        disabled={readOnly}
                                                        menuLeftAlign
                                                    />
                                                </div>

                                                {variantErrors[`${ri}:${vi}`]?.cell && <div
                                                    className={innerStyles.err}>{variantErrors[`${ri}:${vi}`].cell}</div>}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Ціна $ */}
                                    <div className={styles.gridTable__cell}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`pd-${vi}`} style={{ marginBottom: 4 }}>
                                                <div className={innerStyles.noRightBorder}>
                                                    <input
                                                        type="number"
                                                        value={v.priceUSD}
                                                        onChange={readOnly ? undefined : (e) => updateVariant(ri, vi, { priceUSD: e.target.value })}
                                                        readOnly={readOnly}
                                                    />
                                                </div>

                                                {variantErrors[`${ri}:${vi}`]?.priceUSD && <div
                                                    className={innerStyles.err}>{variantErrors[`${ri}:${vi}`].priceUSD}</div>}
                                            </div>
                                        ))}
                                    </div>
                                    <div className={styles.gridTable__cell}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`pu-${vi}`} style={{ marginBottom: 4 }}>
                                                <div className={`${innerStyles.fabricCellWrap} ${innerStyles.fullBorder}`}>
                                                    {!readOnly && (
                                                        <div className={`${innerStyles.fabricTooltip} ${innerStyles.priceTooltipRight}`}>
                                                            <Tooltip title={priceUAHTooltip} arrow placement="top">
                                                                <img src={InfoIcon} className={innerStyles.infoIcon} alt="Інфо" />
                                                            </Tooltip>
                                                        </div>
                                                    )}

                                                    <input
                                                        type="number"
                                                        value={v.priceUAH}
                                                        onChange={readOnly ? undefined : (e) => updateVariant(ri, vi, { priceUAH: e.target.value })}
                                                        readOnly={readOnly}
                                                    />
                                                </div>

                                                {variantErrors[`${ri}:${vi}`]?.priceUAH && (
                                                    <div className={innerStyles.err}>{variantErrors[`${ri}:${vi}`].priceUAH}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`sd-${vi}`} style={{ marginBottom: 4 }}>
                                                <input type="number" value={v.sumUSD} readOnly />
                                            </div>
                                        ))}
                                    </div>
                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}>
                                        {row.variants.map((v, vi) => (
                                            <div key={`su-${vi}`} style={{ marginBottom: 4 }}>
                                                <input type="number" value={v.sumUAH} readOnly />
                                            </div>
                                        ))}
                                    </div>

                                </div>
                            </div>

                        );
                    })}
                </div>
            </div>

            {!readOnly && (
                <button
                    className={innerStyles.addBtn}
                    type="button"
                    onClick={() => setRows(prev => [...prev, emptyRow(false)])}
                >
                    <span>Додати новий запис</span>
                </button>
            )}

            {!readOnly && capacityPopupInfo && (
                <CentralPopup
                    title=""
                    onClose={() => setCapacityPopupInfo(null)}
                    infoPopup
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            rowGap: "16px",
                            justifyContent: "space-between",
                            height: "100%",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                rowGap: "8px",
                                textAlign: "left",
                            }}
                        >
                            <h3
                                style={{
                                    paddingBottom: 0,
                                    textAlign: "center",
                                }}
                            >
                                Перевищено місткість комірки на складі
                            </h3>

                            <p style={{ margin: 0 }}>
                                Для <strong>{capacityPopupInfo.cellLabel}</strong> перевищено сумарну допустиму кількість.
                            </p>

                            {mode !== 'edit' && (
                                <p style={{ margin: 0 }}>
                                    Максимум для поточної форми:{' '}
                                    <strong>{formatCapacityNumber(capacityPopupInfo.capacityLimit)}</strong>
                                </p>
                            )}

                            {mode === 'edit' && (
                                <p style={{ margin: 0 }}>
                                    {capacityPopupInfo.rows.length === 1 ? (
                                        <>
                                            Ви можете вказати максимум <strong>{formatCapacityNumber(capacityPopupInfo.capacityLimit)}</strong> для позиції № <strong>{capacityPopupInfo.rows.map(row => row.positionLabel).join(', ')}</strong> або обирати інші комірки на складі.
                                        </>
                                    ) : (
                                        <>
                                            Ви можете перерозподіляти сумарну кількість в межах <strong>{formatCapacityNumber(capacityPopupInfo.capacityLimit)}</strong> між позиціями <strong> {capacityPopupInfo.rows.map(row => row.positionLabel).join(', ')}</strong> або обирати інші комірки на складі.
                                        </>
                                    )}
                                    {' '}
                                    (З урахуванням раніше збереженої кількості доступно:{' '}
                                    <strong>{formatCapacityNumber(capacityPopupInfo.remainingCapacity)}</strong>,
                                    {' '}раніше збережено в цій накладній в цій комірці:{' '}
                                    <strong>{formatCapacityNumber(capacityPopupInfo.originalQty)}</strong>).
                                </p>
                            )}

                            <p style={{ margin: 0 }}>
                                Зараз у формі для цієї комірки сумарно вказано:{' '}
                                <strong>{formatCapacityNumber(capacityPopupInfo.totalQty)}</strong>
                            </p>

                            <p style={{ margin: 0 }}>
                                Перевірте сумарну кількість в позиціях №{' '}
                                <strong>
                                    {capacityPopupInfo.rows.map(row => row.positionLabel).join(', ')}
                                </strong>
                            </p>

                            <p style={{ margin: 0 }}>
                                {mode === 'edit' && capacityPopupInfo.rows.length === 1 ? (
                                    <>
                                        Щоб увійти в ліміт зменште кількість в цій позиції товару або оберіть іншу комірку.
                                    </>
                                ) : (
                                    <>
                                        Щоб увійти в ліміт зменште кількість в цій позиції товару або перерозподіліть кількість з іншою позицією товару, що зберігається в цій комірці (цю комірку використовують позиції: <strong>
                                            {capacityPopupInfo.rows.map(row => row.positionLabel).join(', ')}
                                        </strong>), або оберіть іншу комірку.
                                    </>
                                )}
                            </p>
                        </div>

                        <button
                            type="button"
                            className="btnDark"
                            style={{
                                width: "200px",
                                alignSelf: "center",
                            }}
                            onClick={() => setCapacityPopupInfo(null)}
                        >
                            <span>Ок</span>
                        </button>
                    </div>
                </CentralPopup>
            )}

            {!readOnly && isCreateProductPopupOpen && (
                <CentralPopup
                    title="Створення нового товару"
                    onClose={closeCreateProductPopup}
                    verticalScroll
                    bigPopup
                >
                    <NewProduct
                        popupMode
                        initialName={createProductRowIndex != null ? rows[createProductRowIndex]?.template?.name || '' : ''}
                        alreadyExists={createProductRowIndex != null ? !!rows[createProductRowIndex]?.template?.id : false}
                        onCreated={handleProductCreated}
                    />
                </CentralPopup>
            )}
        </div>
    );
};

export default forwardRef(EditableProductTable);
