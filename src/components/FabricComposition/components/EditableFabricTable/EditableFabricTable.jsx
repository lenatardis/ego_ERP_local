import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import styles from '../../../../components/Common/Table/Table.module.scss';
import innerStyles from './EditableFabricTable.module.scss';
import { fetchStandardLength, fetchWarehouseStructure, getFabrics } from '../../../../api/tablesApi.js';
import { getAccessToken } from "../../../../api/authStorage.js";
import WhiteCustomSelect from '../../../../components/Common/WhiteCustomSelect/WhiteCustomSelect.jsx';
import NewCustomSelect from "../../../Common/NewCustomSelect/NewCustomSelect.jsx";
import CentralPopup from "../../../Common/CentralPopup/CentralPopup.jsx";
import NewFabric from "../NewFabric/NewFabric.jsx";
import Tooltip from "@mui/material/Tooltip";
import InfoIcon from "../../../../assets/icons/info.svg";
import IconClose from "../../../../assets/icons/cross.svg";

// універсальний парсер чисел
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
    const num = parseDecimal(n);
    if (!Number.isFinite(num)) return '';
    return Number(num.toFixed(2));
};


const EditableFabricTable = ({ mode = 'create', exchangeRate, readOnly = false, onCapacityValidationChange }, ref) => {
    const emptyRow = (locked = false) => ({
        fabric: { id: '', name: '' },
        category: '',
        type: '',
        rolls: '',
        size: { id: '', name: '' },
        customSize: '',
        warehouse: { id: '', name: '' },
        locker: { id: '', name: '' },
        cell: { id: '', name: '' },
        priceUAH: '',
        priceUSD: '',
        sumUAH: '',
        sumUSD: '',
        ids: [],
        readonlyFabric: locked,
        priceUAHManual: false,
        isPersisted: false,
        originalCellId: '',
        originalQty: 0,
    });

    const [rows, setRows] = useState([emptyRow(false)]);
    const rowsRef = useRef(rows);

    useEffect(() => {
        rowsRef.current = rows;
    }, [rows]);

    const [standardLengthOptions, setStandardLengthOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [whTree, setWhTree] = useState([]);
    const [fabricHints, setFabricHints] = useState({});
    const [fabricCodeBlurred, setFabricCodeBlurred] = useState({});
    const fabricTimersRef = useRef({});
    const [fabricLoading, setFabricLoading] = useState({});
    const [rowErrors, setRowErrors] = useState({});
    const [capacityPopupInfo, setCapacityPopupInfo] = useState(null);
    const [activeCapacityErrorRows, setActiveCapacityErrorRows] = useState({});
    const capacityCheckTimerRef = useRef(null);
    const lastCapacityTouchedRowRef = useRef(null);
    const capacityChangeSourceRef = useRef(null);
    const [isCreateFabricPopupOpen, setIsCreateFabricPopupOpen] = useState(false);
    const [createFabricRowIndex, setCreateFabricRowIndex] = useState(null);

    const fabricTooltip =
        'Введіть код існуючої тканини або створіть нову в попапі (кнопка +). Якщо тканина існує, її категорія та тип заповняться автоматично. Є підказки для швидкого вибору коду';
    const priceUAHTooltip =
        'Розраховується автоматично від ціни за 1м в доларах по поточному курсу, але ви можете відкорегувати це значення вручну';


    const gridTemplate = {
        gridTemplateColumns: `
    20px
    minmax(90px, 1.1fr)
    minmax(70px, 0.9fr)
    minmax(65px, 0.8fr)
    minmax(70px, 0.85fr)
    minmax(72px, 0.8fr)
    minmax(120px, 1.35fr)
    minmax(60px, 0.75fr)
    minmax(60px, 0.75fr)
    minmax(90px, 1fr)
    minmax(80px, 0.9fr)
    minmax(90px, 1fr)
    minmax(80px, 0.9fr)
`
    };

    const getRowLength = (row) => {
        const standardLengthName =
            row.size?.name ||
            standardLengthOptions.find(opt => Number(opt.value) === Number(row.size?.id))?.name ||
            '';

        const stdLen = toNum(standardLengthName);
        const customLen = toNum(row.customSize);

        return customLen > 0 ? customLen : stdLen;
    };

    const recalcRowsByExchangeRate = (inputRows, currentExchangeRate) => {

        const rate = toNum(currentExchangeRate);

        if (!Number.isFinite(rate) || rate <= 0) {
            return inputRows.map(row => ({
                ...row,
                priceUAH: row.priceUAHManual ? row.priceUAH : '',
                sumUAH: '',
                sumUSD: '',
            }));
        }

        return inputRows.map(row => {

            const rolls = toNum(row.rolls);
            const priceUSD = toNum(row.priceUSD);

            const length = getRowLength(row);
            if (row.priceUAHManual) {
                const manualPriceUAH = toNum(row.priceUAH);

                const sumUAH =
                    rolls > 0 && manualPriceUAH > 0 && length > 0
                        ? toMoney(rolls * manualPriceUAH * length)
                        : '';

                const sumUSD =
                    rolls > 0 && priceUSD > 0 && length > 0
                        ? toMoney(rolls * priceUSD * length)
                        : '';

                return {
                    ...row,
                    sumUAH,
                    sumUSD,
                };
            }

            if (priceUSD <= 0) {
                return {
                    ...row,
                    priceUAH: '',
                    sumUAH: '',
                    sumUSD: '',
                    priceUAHManual: false,
                };
            }

            const priceUAH = toMoney(priceUSD * rate);

            const sumUAH =
                rolls > 0 && priceUAH > 0 && length > 0
                    ? toMoney(rolls * priceUAH * length)
                    : '';

            const sumUSD =
                rolls > 0 && priceUSD > 0 && length > 0
                    ? toMoney(rolls * priceUSD * length)
                    : '';

            return {
                ...row,
                priceUAH,
                sumUAH,
                sumUSD,
                priceUAHManual: false,
            };
        });
    };

    const handleChange = (index, key, value) => {
        setRows(prev => {
            const next = [...prev];
            const row = { ...next[index] };

            // Оновлюємо значення
            if (key === 'priceUAH') {
                // ЯВНА ручна правка гривні
                row.priceUAH = value;
                row.priceUAHManual =
                    value !== '' && value !== null && value !== undefined;
            } else {
                row[key] = value;
            }

            const rolls = toNum(row.rolls);
            const priceUSD = toNum(row.priceUSD);
            const priceUAH = toNum(row.priceUAH);
            const rate = toNum(exchangeRate);

            // довжина рулону
            const length = getRowLength(row);

            if (key === 'priceUSD') {
                if (rate > 0 && priceUSD > 0) {
                    row.priceUAH = toMoney(priceUSD * rate);
                    row.priceUAHManual = false; // тепер значення автоматичне
                } else if (!priceUSD) {
                    row.priceUAH = '';
                    row.priceUAHManual = false;
                }
            }

            const actualPriceUAH = toNum(row.priceUAH);
            const actualPriceUSD = toNum(row.priceUSD);

            row.sumUAH =
                rolls > 0 && actualPriceUAH > 0 && length > 0
                    ? toMoney(rolls * actualPriceUAH * length)
                    : '';

            row.sumUSD =
                rolls > 0 && actualPriceUSD > 0 && length > 0
                    ? toMoney(rolls * actualPriceUSD * length)
                    : '';

            next[index] = row;
            return next;
        });
        if (key === 'rolls') {
            scheduleCapacityValidation({
                rowIndex: index,
                source: 'quantity',
                delay: 500,
                showPopup: true,
            });
        }
    };


    const handleAddRow = () => {
        setRows(prev => [...prev, emptyRow(false)]);
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

        setFabricHints(prev => {
            const next = {};
            Object.entries(prev || {}).forEach(([key, value]) => {
                const idx = Number(key);
                if (idx === rowIndex) return;
                next[idx > rowIndex ? idx - 1 : idx] = value;
            });
            return next;
        });

        setFabricLoading(prev => {
            const next = {};
            Object.entries(prev || {}).forEach(([key, value]) => {
                const idx = Number(key);
                if (idx === rowIndex) return;
                next[idx > rowIndex ? idx - 1 : idx] = value;
            });
            return next;
        });

        setFabricCodeBlurred(prev => {
            const next = {};
            Object.entries(prev || {}).forEach(([key, value]) => {
                const idx = Number(key);
                if (idx === rowIndex) return;
                next[idx > rowIndex ? idx - 1 : idx] = value;
            });
            return next;
        });

        if (fabricTimersRef.current[rowIndex]) {
            clearTimeout(fabricTimersRef.current[rowIndex]);
        }

        const nextTimers = {};
        Object.entries(fabricTimersRef.current || {}).forEach(([key, value]) => {
            const idx = Number(key);
            if (idx === rowIndex) return;
            nextTimers[idx > rowIndex ? idx - 1 : idx] = value;
        });
        fabricTimersRef.current = nextTimers;
    };

    useEffect(() => {
        (async () => {
            try {
                setIsLoading(true);
                const token = getAccessToken();
                const data = await fetchStandardLength(token);

                const opts = (data || []).map(item => ({
                    value: item.id,
                    name: String(item.length)
                }));
                setStandardLengthOptions(opts);
            } catch (e) {
                console.log(e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

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
                            remainingCapacity: c.remaining_capacity,
                        })),
                    })),
                }));
                setWhTree(normalized);
            } catch (e) {
                console.error(e);
            } finally {

            }
        })();
    }, []);

    //sizes
    const handleStandardSizeChange = (rowIndex, newValue) => {
        const id = newValue === '' ? '' : Number(newValue);
        setRows(prev => {
            const next = [...prev];

            if (id === '') {
                next[rowIndex].size = { id: '', name: '' };
            } else {
                const picked = standardLengthOptions.find(o => o.value === id);
                next[rowIndex].size = { id, name: picked ? picked.name : '' };
            }

            next[rowIndex].customSize = '';

            // перерахунок сум з урахуванням нової довжини
            const row = next[rowIndex];
            const rolls = toNum(row.rolls);
            const priceUAH = toNum(row.priceUAH);
            const priceUSD = toNum(row.priceUSD);
            const length = getRowLength(row);

            row.sumUAH =
                rolls > 0 && priceUAH > 0 && length > 0
                    ? toMoney(rolls * priceUAH * length)
                    : '';

            row.sumUSD =
                rolls > 0 && priceUSD > 0 && length > 0
                    ? toMoney(rolls * priceUSD * length)
                    : '';

            return next;
        });
    };

    const handleCustomSizeChange = (rowIndex, value) => {
        setRows(prev => {
            const next = [...prev];
            next[rowIndex].customSize = value;
            next[rowIndex].size = { id: '', name: '' };

            // перерахунок сум з урахуванням нової довжини
            const row = next[rowIndex];
            const rolls = toNum(row.rolls);
            const priceUAH = toNum(row.priceUAH);
            const priceUSD = toNum(row.priceUSD);
            const length = getRowLength(row);
            row.sumUAH =
                rolls > 0 && priceUAH > 0 && length > 0
                    ? toMoney(rolls * priceUAH * length)
                    : '';

            row.sumUSD =
                rolls > 0 && priceUSD > 0 && length > 0
                    ? toMoney(rolls * priceUSD * length)
                    : '';

            return next;
        });
    };



    //warehouse, locker, cell

    const toOptions = (arr = []) => arr.map(x => ({ value: x.id, name: x.name }));

    const getWarehouseOptions = () => toOptions(whTree);

    const getRackOptions = (warehouseId) => {
        const w = whTree.find(x => x.id === warehouseId);
        return toOptions(w?.racks || []);
    };

    const getCellOptions = (warehouseId, rackId) => {
        const w = whTree.find(x => x.id === warehouseId);
        const r = w?.racks?.find(x => x.id === rackId);
        return toOptions(r?.cells || []);
    };

    const getWarehouseLabel = () => {
        if (!whTree.length) return 'Оберіть';
        const options = getWarehouseOptions();
        return options.length ? 'Оберіть' : 'Немає';
    };

    const getRackLabel = (warehouseId) => {
        if (!warehouseId) return <>Спочатку<br />склад</>;

        const options = getRackOptions(warehouseId);
        return options.length ? 'Оберіть' : 'Немає';
    };

    const getCellLabel = (warehouseId, rackId) => {
        if (!rackId) return <>Спочатку<br />стелаж</>;

        const options = getCellOptions(warehouseId, rackId);
        return options.length ? 'Оберіть' : 'Немає';
    };

    const findById = (arr, id) => arr.find(x => x.id === id) || null;

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

    const getOriginalQtyByCell = (cellId, sourceRows = rowsRef.current) => {
        if (mode !== 'edit' || !cellId) return 0;

        return sourceRows.reduce((sum, row) => {
            if (Number(row.originalCellId) !== Number(cellId)) return sum;
            return sum + toNum(row.originalQty);
        }, 0);
    };


    const buildCapacityViolations = (inputRows = rowsRef.current) => {
        const groups = {};

        inputRows.forEach((row, rowIndex) => {
            const cellId = row.cell?.id;
            const qty = toNum(row.rolls);

            if (!cellId || qty <= 0) return;

            const cellMeta = getCellMetaById(cellId);
            if (!cellMeta) return;

            const remaining = parseDecimal(cellMeta.remainingCapacity);
            if (!Number.isFinite(remaining)) return;

            const originalQty = getOriginalQtyByCell(cellId, inputRows);
            const limit = remaining + originalQty;
            const key = String(cellId);

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
                rowNumber: rowIndex + 1,
                qty,
                fabricName: row.fabric?.name || '',
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
                const rowNumbers = item.rows.map(row => row.rowNumber).join(', ');

                const hasSingleRow = item.rows.length === 1;

                const editCapacityText = mode === 'edit'
                    ? hasSingleRow
                        ? `Ви можете вказати максимум ${formatCapacityNumber(item.capacityLimit)} для рядка № ${rowNumbers} або обирати інші комірки на складі. (З урахуванням раніше збереженої кількості доступно: ${formatCapacityNumber(item.remainingCapacity)}, раніше збережено в цій накладній в цій комірці: ${formatCapacityNumber(item.originalQty)}). `
                        : `Ви можете перерозподіляти сумарну кількість в межах ${formatCapacityNumber(item.capacityLimit)} між рядками № ${rowNumbers} або обирати інші комірки на складі. (Без урахування раніше збереженої кількості доступно: ${formatCapacityNumber(item.remainingCapacity)}, раніше збережено в цій накладній в цій комірці: ${formatCapacityNumber(item.originalQty)}). `
                    : `Максимум доступно: ${formatCapacityNumber(item.capacityLimit)}. `;

                return `✓ ${item.cellLabel}: ${editCapacityText}У формі сумарно (в різних рядках) вказано - ${formatCapacityNumber(item.totalQty)}. Перевірте кількість в рядках № ${rowNumbers}.`;
            })
            .join('\n');
    };

    const getCapacityFieldErrorText = (violation) => {
        if (!violation) return 'Перевищено місткість комірки на складі';

        return `Перевищено місткість комірки на складі`;
    };

    const makeActiveViolationPopupInfo = (violation, touchedRowIndex) => {
        if (!violation) return null;

        return {
            ...violation,
            touchedRowIndex,
            touchedRowNumber: touchedRowIndex != null ? touchedRowIndex + 1 : null,
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
        const nextActiveRows = {};

        violations.forEach(violation => {
            violation.rows.forEach(row => {
                nextActiveRows[row.rowIndex] = true;
            });
        });

        setActiveCapacityErrorRows(nextActiveRows);

        setRowErrors(prev => {
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
                    next[row.rowIndex] = {
                        ...(next[row.rowIndex] || {}),
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
        touchedRowIndex = lastCapacityTouchedRowRef.current,
        showPopup = false
    } = {}) => {
        if (readOnly || !Array.isArray(whTree) || !whTree.length) {
            notifyCapacityValidationChange([]);
            return [];
        }

        const violations = buildCapacityViolations(rowsRef.current);

        let activeViolation = null;

        if (touchedRowIndex != null) {
            const found = violations.find(violation =>
                violation.rows.some(row => row.rowIndex === touchedRowIndex)
            );

            if (found) {
                activeViolation = makeActiveViolationPopupInfo(found, touchedRowIndex);
            }
        }

        applyCapacityValidationState({
            violations
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
        source,
        delay = 0,
        showPopup = true,
    } = {}) => {
        if (readOnly) return;

        lastCapacityTouchedRowRef.current = rowIndex;
        capacityChangeSourceRef.current = source;

        if (capacityCheckTimerRef.current) {
            clearTimeout(capacityCheckTimerRef.current);
        }

        capacityCheckTimerRef.current = setTimeout(() => {
            runCapacityValidation({
                source,
                touchedRowIndex: rowIndex,
                showPopup
            });
        }, delay);
    };

    const handleWarehouseSelect = (rowIndex, idStr) => {
        const id = idStr === '' ? '' : Number(idStr);
        setRows(prev => {
            const next = [...prev];
            if (id === '') {
                next[rowIndex].warehouse = { id: '', name: '' };
            } else {
                const w = findById(whTree, id);
                next[rowIndex].warehouse = { id, name: w?.name || '' };
            }
            next[rowIndex].locker = { id: '', name: '' };
            next[rowIndex].cell = { id: '', name: '' };
            return next;
        });
        scheduleCapacityValidation({
            rowIndex,
            source: 'warehouse',
            delay: 0,
            showPopup: false,
        });
    };

    const handleRackSelect = (rowIndex, idStr) => {
        const id = idStr === '' ? '' : Number(idStr);
        setRows(prev => {
            const next = [...prev];
            const wid = next[rowIndex].warehouse.id;
            if (!wid || id === '') {
                next[rowIndex].locker = { id: '', name: '' };
            } else {
                const rack = findById(findById(whTree, wid)?.racks || [], id);
                next[rowIndex].locker = { id, name: rack?.name || '' };
            }
            next[rowIndex].cell = { id: '', name: '' };
            return next;
        });
        scheduleCapacityValidation({
            rowIndex,
            source: 'rack',
            delay: 0,
            showPopup: false,
        });
    };

    const handleCellSelect = (rowIndex, idStr) => {
        const id = idStr === '' ? '' : Number(idStr);
        setRows(prev => {
            const next = [...prev];
            const wid = next[rowIndex].warehouse.id;
            const rid = next[rowIndex].locker.id;

            if (!wid || !rid || id === '') {
                next[rowIndex].cell = { id: '', name: '' };
            } else {
                const cell = findById(
                    findById(findById(whTree, wid)?.racks || [], rid)?.cells || [],
                    id
                );
                next[rowIndex].cell = { id, name: cell?.name || '' };
            }
            return next;
        });
        scheduleCapacityValidation({
            rowIndex,
            source: 'cell',
            delay: 50,
            showPopup: true,
        });
    };

    //warehouse, cell (edit mode!)

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
        setRows(prev => prev.map(r => {
            const copy = { ...r };
            if (copy.size?.id && !copy.size.name) {
                const opt = standardLengthOptions.find(o => o.value === copy.size.id);
                if (opt) copy.size = { id: copy.size.id, name: opt.name };
            }
            if (copy.cell?.id && (!copy.warehouse?.id || !copy.locker?.id || !copy.cell?.name)) {
                const path = findCellPath(copy.cell.id);
                if (path) Object.assign(copy, path);
            }
            return copy;
        }));
    };

    useEffect(() => {
        enrichRowsFromDicts(); /* eslint-disable-next-line */
    }, [standardLengthOptions, whTree]);

    const needsEnrichRow = (r) =>
        r?.cell?.id &&
        (!r?.warehouse?.id || !r?.locker?.id || !r?.cell?.name);

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

    useEffect(() => {
        if (!Array.isArray(whTree) || !whTree.length) return;
        if (!rows.some(needsEnrichRow)) return;
        enrichRowsFromDicts();
    }, [rows, whTree]);

    // code and autohints, category, type

    const mapFabricsToHints = (list = []) => list.map(f => ({
        id: f.id,
        name: f.name,
        typeName: f.type?.type || '',
        monoTypes: Array.isArray(f.mono_fabric_type) ? f.mono_fabric_type : [],
    }));

    const handleFabricCodeChange = (rowIndex, value) => {
        setRows(prev => {
            const next = [...prev];
            next[rowIndex].fabric = { id: '', name: value };
            next[rowIndex].category = '';
            next[rowIndex].type = '';
            return next;
        });

        setFabricCodeBlurred(prev => ({
            ...prev,
            [rowIndex]: false,
        }));

        if (fabricTimersRef.current[rowIndex]) {
            clearTimeout(fabricTimersRef.current[rowIndex]);
        }

        const trimmed = (value || '').trim();

        if (trimmed === '') {
            setRows(prev => {
                const next = [...prev];
                next[rowIndex].fabric = { id: '', name: '' };
                next[rowIndex].category = '';
                next[rowIndex].type = '';
                return next;
            });
            setFabricHints(prev => ({ ...prev, [rowIndex]: [] }));
            setFabricLoading(prev => ({ ...prev, [rowIndex]: false }));
            return;
        }

        if (trimmed.length < 2) {
            setFabricHints(prev => ({ ...prev, [rowIndex]: [] }));
            setFabricLoading(prev => ({ ...prev, [rowIndex]: false }));
            return;
        }

        //debounce
        fabricTimersRef.current[rowIndex] = setTimeout(async () => {
            try {
                setFabricLoading(prev => ({ ...prev, [rowIndex]: true }));
                const token = getAccessToken();
                const resp = await getFabrics(token, { page: 1, name: trimmed });
                const hints = mapFabricsToHints(resp?.fabrics || []);
                setFabricHints(prev => ({ ...prev, [rowIndex]: hints }));

                const exact = hints.find(h => h.name === trimmed);
                if (exact) {
                    setRows(prev => {
                        const next = [...prev];
                        next[rowIndex].fabric = { id: exact.id, name: exact.name };
                        next[rowIndex].category = exact.typeName;
                        next[rowIndex].type = exact.monoTypes.join(', ');
                        return next;
                    });
                }
            } catch (e) {
                console.error('fabric hints fetch failed', e);
                setFabricHints(prev => ({ ...prev, [rowIndex]: [] }));
            } finally {
                setFabricLoading(prev => ({ ...prev, [rowIndex]: false }));
            }
        }, 400);
    };


    const handleFabricCodeBlur = (rowIndex) => {
        setFabricCodeBlurred(prev => ({
            ...prev,
            [rowIndex]: true,
        }));

        const code = rows[rowIndex]?.fabric?.name?.trim();
        if (!code) return;

        const hints = fabricHints[rowIndex] || [];
        const exact = hints.find(h => h.name === code);

        if (exact) {
            setRows(prev => {
                const next = [...prev];
                next[rowIndex].fabric = { id: exact.id, name: exact.name };
                next[rowIndex].category = exact.typeName;
                next[rowIndex].type = exact.monoTypes.join(', ');
                return next;
            });

            setFabricCodeBlurred(prev => ({
                ...prev,
                [rowIndex]: false,
            }));
        }
    };

    const openCreateFabricPopup = (rowIndex) => {
        setCreateFabricRowIndex(rowIndex);
        setIsCreateFabricPopupOpen(true);
    };

    const closeCreateFabricPopup = () => {
        setIsCreateFabricPopupOpen(false);
        setCreateFabricRowIndex(null);
    };

    const handleFabricCreated = async (createdFabric, meta = {}) => {
        const rowIndex = createFabricRowIndex;
        if (rowIndex == null) {
            closeCreateFabricPopup();
            return;
        }

        const fallbackName = meta?.name || rows[rowIndex]?.fabric?.name || '';
        const fallbackTypeName = meta?.typeName || '';
        const fallbackMonoTypes = Array.isArray(meta?.monoTypes) ? meta.monoTypes : [];

        let resolved = null;

        try {
            const token = getAccessToken();
            const resp = await getFabrics(token, { page: 1, name: fallbackName });
            const hints = mapFabricsToHints(resp?.fabrics || []);
            setFabricHints(prev => ({ ...prev, [rowIndex]: hints }));
            resolved = hints.find(h => h.name === fallbackName) || hints[0] || null;
        } catch (e) {
            console.error('Failed to resolve created fabric from search:', e);
        }

        setRows(prev => {
            const next = [...prev];
            const row = { ...next[rowIndex] };

            if (resolved) {
                row.fabric = { id: resolved.id, name: resolved.name };
                row.category = resolved.typeName || '';
                row.type = Array.isArray(resolved.monoTypes)
                    ? resolved.monoTypes.join(', ')
                    : '';
            } else {
                row.fabric = {
                    id: createdFabric?.id ?? '',
                    name: createdFabric?.name ?? fallbackName,
                };
                row.category =
                    createdFabric?.type?.type ??
                    createdFabric?.type_name ??
                    fallbackTypeName ??
                    '';

                const mono =
                    Array.isArray(createdFabric?.mono_fabric_type)
                        ? createdFabric.mono_fabric_type
                        : fallbackMonoTypes;

                row.type = Array.isArray(mono) ? mono.join(', ') : '';
            }

            next[rowIndex] = row;
            return next;
        });

        setFabricLoading(prev => ({ ...prev, [rowIndex]: false }));
        closeCreateFabricPopup();
    };
    //memory cleanup
    useEffect(() => {
        return () => {
            Object.values(fabricTimersRef.current || {}).forEach(id => clearTimeout(id));

            if (capacityCheckTimerRef.current) {
                clearTimeout(capacityCheckTimerRef.current);
            }
        };
    }, []);


    //validation and payload

    const VALIDATION_FIELD_LABELS = {
        fabric: 'код тканини',
        rolls: 'кількість рулонів',
        length: 'довжина рулону',
        cell: 'комірка',
        capacity: 'місткість комірки',
        priceUSD: 'ціна за 1м, $',
        priceUAH: 'ціна за 1м, грн',
    };

    const getFabricValidationFieldNames = (errors = {}) =>
        Object.keys(errors)
            .map(key => VALIDATION_FIELD_LABELS[key])
            .filter(Boolean);

    const getFabricValidationInfo = (errors = {}) => {
        const messages = [];

        rows.forEach((row, index) => {
            const rowError = errors[index] || {};

            const fieldNames = getFabricValidationFieldNames(rowError)
                .filter(field => field !== VALIDATION_FIELD_LABELS.capacity);

            if (!fieldNames.length) return;

            const rowNumber = index + 1;
            const fabricName = row.fabric?.name?.trim();

            const rowLabel = fabricName
                ? `В рядку ${rowNumber} в тканині ${fabricName}`
                : `В рядку ${rowNumber}`;

            messages.push({
                prefix: `${rowLabel} є незаповнені поля:`,
                fields: [...new Set(fieldNames)],
            });
        });

        return messages;
    };

    const validateAndBuildPayload = () => {
        const errors = {};
        const payload = [];

        rows.forEach((r, i) => {
            const touched = Boolean(
                r.fabric?.name || r.rolls || r.size?.id || r.customSize ||
                r.warehouse.id || r.locker.id || r.cell.id ||
                r.priceUAH || r.priceUSD
            );
            if (!touched) return;

            const e = {};
            const qty = toNum(r.rolls);
            const hasFabric = !!r.fabric?.id;
            const hasCell = !!r.cell?.id;
            const customLen = parseDecimal(r.customSize);
            const stdLenId = r.size?.id ? Number(r.size.id) : NaN;
            const hasCustom = Number.isFinite(customLen) && customLen > 0;
            const hasStd = Number.isFinite(stdLenId) && stdLenId > 0;

            const priceUAHNum = toNum(r.priceUAH);
            const priceUSDNum = toNum(r.priceUSD);

            if (!hasFabric) e.fabric = 'Оберіть тканину';
            if (!Number.isInteger(qty) || qty < 1) e.rolls = 'К-ть ≥ 1';
            if (!hasCell) e.cell = 'Оберіть комірку';
            if (!(hasCustom || hasStd) || (hasCustom && hasStd)) e.length = 'Вкажіть довжину';

            if (r.priceUAH !== '' && priceUAHNum < 0) e.priceUAH = 'Не може бути < 0';
            if (r.priceUSD !== '' && priceUSDNum < 0) e.priceUSD = 'Не може бути < 0';

            if (Object.keys(e).length) {
                errors[i] = e;
            } else {
                const rowOut = {
                    quantity: qty,
                    item: {
                        status: 'NEW',
                        ...(hasCustom ? { initial_custom_length: customLen } : { initial_length: stdLenId }),
                        price_uah: toMoney(priceUAHNum) || 0,
                        price_usd: toMoney(priceUSDNum) || 0,
                        fabric: Number(r.fabric.id),
                        cell: Number(r.cell.id),
                    },
                };
                if (mode === 'edit' && Array.isArray(r.ids) && r.ids.length) {
                    rowOut.ids = r.ids.map(Number);
                }
                payload.push(rowOut);
            }
        });

       const capacityViolations = buildCapacityViolations(rowsRef.current);

        capacityViolations.forEach(violation => {
            violation.rows.forEach(row => {
                errors[row.rowIndex] = {
                    ...(errors[row.rowIndex] || {}),
                    capacity: getCapacityFieldErrorText(violation),
                };
            });
        });

        setRowErrors(errors);

        const capacityRowsMap = {};
        capacityViolations.forEach(violation => {
            violation.rows.forEach(row => {
                capacityRowsMap[row.rowIndex] = true;
            });
        });
        setActiveCapacityErrorRows(capacityRowsMap);

        const fabricValidationInfo = getFabricValidationInfo(errors);
        const capacityValidationInfo = {
            hasErrors: capacityViolations.length > 0,
            violations: capacityViolations,
            summaryText: getCapacitySummaryText(capacityViolations),
        };

        notifyCapacityValidationChange(capacityViolations);

        return {
            isValid: Object.keys(errors).length === 0 && payload.length > 0,
            payload,
            errors,
            fabricValidationInfo,
            capacityValidationInfo,
        };
    };

    //edit mode setup
    const mapEditFabricRollToRow = (fr) => {
        const fabricId = fr?.fabric?.id ?? '';
        const fabricName = fr?.fabric?.name ?? '';
        const category = fr?.fabric?.type_name ?? '';
        const typeMono = Array.isArray(fr?.fabric?.mono_fabric_type) ? fr.fabric.mono_fabric_type.join(', ') : '';

        const initialLengthId = fr?.item?.initial_length ?? '';
        const customLen = fr?.item?.initial_custom_length ?? '';
        const priceUAH = fr?.item?.price_uah ?? '';
        const priceUSD = fr?.item?.price_usd ?? '';
        const sumUAH = fr?.item?.total_price_uah ?? '';
        const sumUSD = fr?.item?.total_price_usd ?? '';
        const qty = fr?.quantity != null ? String(fr.quantity) : '';

        const cellId = (fr?.cell_id ?? fr?.cell?.id ?? '');

        return {
            fabric: { id: fabricId, name: fabricName },
            category,
            type: typeMono,
            rolls: qty,
            size: initialLengthId ? { id: Number(initialLengthId), name: '' } : { id: '', name: '' },
            customSize: customLen || '',
            warehouse: { id: '', name: '' },
            locker: { id: '', name: '' },
            cell: cellId ? { id: cellId, name: '' } : { id: '', name: '' },
            priceUAH,
            priceUSD,
            sumUAH,
            sumUSD,
            ids: Array.isArray(fr?.ids) ? fr.ids : [],
            readonlyFabric: true,
            priceUAHManual: false,
            isPersisted: true,
            originalCellId: cellId ? Number(cellId) : '',
            originalQty: toNum(qty),
        };
    };


    const loadFromEdit = (fabric_rolls = []) => {
        const mapped = (fabric_rolls || []).map(mapEditFabricRollToRow);
        setRows(mapped.length ? mapped : [emptyRow(false)]);
    };

    const loadFromEditAndRecalc = (fabric_rolls = []) => {
        const mapped = (fabric_rolls || []).map(mapEditFabricRollToRow);
        const preparedRows = mapped.length ? mapped : [emptyRow(false)];
        setRows(recalcRowsByExchangeRate(preparedRows, exchangeRate));
    };


    //data transfer
    useImperativeHandle(ref, () => ({
        getRows: () => rows,
        validateAndBuildPayload,
        loadFromEdit,
        loadFromEditAndRecalc,
        getCapacityValidationInfo: () => {
            const violations = buildCapacityViolations(rowsRef.current);

            return {
                hasErrors: violations.length > 0,
                violations,
                summaryText: getCapacitySummaryText(violations),
            };
        },
    }), [rows, exchangeRate, whTree]);

    useEffect(() => {
        setRows(prev => recalcRowsByExchangeRate(prev, exchangeRate));
    }, [exchangeRate]);

    return (
        <div>
            <div className={`${styles.editableTable} ${innerStyles.muiLocal} editableTable`}>
                <div className={styles.gridTable__header} style={gridTemplate}>
                    <div>№</div>
                    <div>Код тканини</div>
                    <div>Категорія</div>
                    <div>Тип тканини</div>
                    <div>Кількість рулонів</div>
                    <div>Довжина рулону, м</div>
                    <div>Склад</div>
                    <div>Стелаж</div>
                    <div>Комірка</div>
                    <div>Ціна за 1 м рулону,<br />$</div>
                    <div>Ціна за 1 м рулону,<br />грн</div>
                    <div>Сума,<br />$</div>
                    <div>Сума,<br />грн</div>
                </div>
                <div className={styles.tableRows}>
                    {rows.map((row, idx) => {
                        const isLocked = !!row.readonlyFabric;
                        const canRemoveRow = !readOnly && idx !== 0 && !row.isPersisted;
                        return (
                            <div className={innerStyles.rowBlock} key={idx}>
                                {canRemoveRow && (
                                    <button
                                        type="button"
                                        className={innerStyles.removeRowBtn}
                                        onClick={() => handleRemoveRow(idx)}
                                        aria-label="Видалити рядок"
                                    >
                                        <img src={IconClose} alt="" />
                                    </button>
                                )}
                                <div className={styles.gridTable__row} style={gridTemplate}>
                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}><input type="text" value={String(idx + 1)} readOnly /></div>
                                    <div className={`${styles.gridTable__cell}`}>
                                        <div className={innerStyles.fabricCellWrap}>
                                            {!isLocked && !readOnly && (
                                                <button
                                                    type="button"
                                                    className={innerStyles.createFabricBtn}
                                                    title="Створити нову тканину"
                                                    onClick={() => openCreateFabricPopup(idx)}
                                                    aria-label="Створити нову тканину"
                                                />
                                            )}

                                            {!isLocked && !readOnly && (
                                                <div className={innerStyles.fabricTooltip}>
                                                    <Tooltip title={fabricTooltip} arrow placement="top">
                                                        <img src={InfoIcon} className={innerStyles.infoIcon} alt="Інфо" />
                                                    </Tooltip>
                                                </div>
                                            )}

                                            <input
                                                list={isLocked ? undefined : `fabricCodes-${idx}`}
                                                value={row.fabric.name}
                                                onChange={isLocked ? undefined : (e) => handleFabricCodeChange(idx, e.target.value)}
                                                onBlur={isLocked ? undefined : () => handleFabricCodeBlur(idx)}
                                                placeholder="Введіть код"
                                                autoComplete="off"
                                                autoCorrect="off"
                                                spellCheck={false}
                                                autoCapitalize="off"
                                                readOnly={isLocked || readOnly}
                                                className={innerStyles.fullBorder}
                                            />
                                        </div>

                                        {!isLocked && !readOnly && (
                                            <datalist id={`fabricCodes-${idx}`}>
                                                {(fabricHints[idx] || []).map(h => (
                                                    <option key={h.id} value={h.name} />
                                                ))}
                                            </datalist>
                                        )}

                                        {!isLocked
                                            && !readOnly
                                            && fabricCodeBlurred[idx]
                                            && row.fabric.name?.trim()?.length >= 2
                                            && !row.fabric?.id
                                            && !fabricLoading[idx]
                                            && fabricHints[idx] !== undefined
                                            && fabricHints[idx]?.length > 0 && (
                                                <div className={innerStyles.hintEmpty}>
                                                    Є тканини зі схожим кодом. Оберіть потрібну тканину з підказок.
                                                </div>
                                            )}

                                        {!isLocked
                                            && !readOnly
                                            && row.fabric.name?.trim()?.length >= 2
                                            && !row.fabric?.id
                                            && !fabricLoading[idx]
                                            && fabricHints[idx] !== undefined
                                            && fabricHints[idx]?.length === 0 && (
                                                <div className={innerStyles.hintEmpty}>
                                                    Нічого не знайдено серед наявних тканин, можете створити нову тканину
                                                </div>
                                            )}

                                        {rowErrors[idx]?.fabric && (
                                            <div className={innerStyles.err}>{rowErrors[idx].fabric}</div>
                                        )}
                                    </div>

                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}>
                                        <input
                                            type="text"
                                            value={row.category}
                                            onChange={(e) => handleChange(idx, 'category', e.target.value)}
                                            autoComplete="off"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            autoCapitalize="off"
                                            readOnly
                                        />
                                    </div>
                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}>
                                        <input type="text" value={row.type || ''} readOnly />
                                    </div>
                                    <div className={`${styles.gridTable__cell}`}>
                                        <input
                                            type="number"
                                            value={row.rolls}
                                            onChange={readOnly ? undefined : (e) => handleChange(idx, 'rolls', e.target.value)}
                                            placeholder="Введіть"
                                            readOnly={readOnly}
                                            className={`${innerStyles.fullBorder} ${activeCapacityErrorRows[idx] ? innerStyles.capacityWarningBorder : ''}`}
                                        />
                                        {rowErrors[idx]?.rolls &&
                                            <div className={innerStyles.err}>{rowErrors[idx].rolls}</div>}

                                        {rowErrors[idx]?.capacity &&
                                            <div className={innerStyles.err}>{rowErrors[idx].capacity}</div>}
                                    </div>
                                    <div className={styles.gridTable__cell}>
                                        <div className={innerStyles.sizeCell}>
                                            <div className={innerStyles.fullBorder}>
                                                <NewCustomSelect
                                                    value={row.size.id ?? ''}
                                                    onChange={readOnly ? undefined : (e) => handleStandardSizeChange(idx, e.target.value)}
                                                    options={standardLengthOptions}
                                                    label={isLoading ? 'Завантаження…' : 'Оберіть'}
                                                    height="32px"
                                                    numeric
                                                    disabled={readOnly}
                                                    menuLeftAlign
                                                />
                                            </div>
                                            <div className={innerStyles.or}>або</div>
                                            <input className={innerStyles.fullBorder}
                                                type="number"
                                                placeholder="Введіть"
                                                value={row.customSize}
                                                onChange={readOnly ? undefined : (e) => handleCustomSizeChange(idx, e.target.value)}
                                                min={0}
                                                step="0.01"
                                                readOnly={readOnly}
                                            />
                                            {rowErrors[idx]?.length &&
                                                <div className={innerStyles.err}>{rowErrors[idx].length}</div>}
                                        </div>
                                    </div>

                                    <div className={`${styles.gridTable__cell} ${innerStyles.noRightBorder}`}>
                                        <WhiteCustomSelect
                                            value={row.warehouse.id ?? ''}
                                            onChange={readOnly ? undefined : (e) => handleWarehouseSelect(idx, e.target.value)}
                                            options={getWarehouseOptions()}
                                            label={getWarehouseLabel()}
                                            height="32px"
                                            disabled={readOnly}
                                            menuLeftAlign
                                        />
                                    </div>


                                    <div className={`${styles.gridTable__cell} ${innerStyles.noRightBorder}`}>
                                        <WhiteCustomSelect
                                            value={row.locker.id ?? ''}
                                            onChange={readOnly ? undefined : (e) => handleRackSelect(idx, e.target.value)}
                                            options={getRackOptions(row.warehouse.id)}
                                            height="32px"
                                            label={getRackLabel(row.warehouse.id)}
                                            disabled={readOnly}
                                            menuLeftAlign
                                        />
                                    </div>



                                    <div className={`${styles.gridTable__cell}`}>
                                        <div className={innerStyles.fullBorder}>
                                            <WhiteCustomSelect
                                                value={row.cell.id ?? ''}
                                                onChange={readOnly ? undefined : (e) => handleCellSelect(idx, e.target.value)}
                                                options={getCellOptions(row.warehouse.id, row.locker.id)}
                                                label={getCellLabel(row.warehouse.id, row.locker.id)}
                                                height="32px"
                                                disabled={readOnly}
                                                menuLeftAlign
                                            />
                                        </div>

                                        {rowErrors[idx]?.cell &&
                                            <div className={innerStyles.err}>{rowErrors[idx].cell}</div>}
                                    </div>
                                    <div className={`${styles.gridTable__cell}`}>
                                        <div className={innerStyles.noRightBorder}>
                                            <input
                                                type="number"
                                                value={row.priceUSD}
                                                onChange={readOnly ? undefined : (e) => handleChange(idx, 'priceUSD', e.target.value)}
                                                readOnly={readOnly}
                                                placeholder="Введіть"
                                            />
                                        </div>

                                        {rowErrors[idx]?.priceUSD &&
                                            <div className={innerStyles.err}>{rowErrors[idx].priceUSD}</div>}
                                    </div>
                                    <div className={`${styles.gridTable__cell}`}>
                                        <div className={innerStyles.fabricCellWrap}>
                                            {!readOnly && (
                                                <div className={`${innerStyles.fabricTooltip} ${innerStyles.priceTooltipRight}`}>
                                                    <Tooltip title={priceUAHTooltip} arrow placement="top">
                                                        <img src={InfoIcon} className={innerStyles.infoIcon} alt="Інфо" />
                                                    </Tooltip>
                                                </div>
                                            )}
                                            <div className={innerStyles.fullBorder}>
                                                <input
                                                    type="number"
                                                    value={row.priceUAH}
                                                    onChange={readOnly ? undefined : (e) => handleChange(idx, 'priceUAH', e.target.value)}
                                                    readOnly={readOnly}
                                                />
                                            </div>


                                        </div>

                                        {rowErrors[idx]?.priceUAH &&
                                            <div className={innerStyles.err}>{rowErrors[idx].priceUAH}</div>}
                                    </div>

                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}>
                                        <input
                                            type="number"
                                            value={row.sumUSD}
                                            readOnly
                                        />
                                    </div>
                                    <div className={`${styles.gridTable__cell} ${styles.notEditableCell}`}><input
                                        type="number"
                                        value={row.sumUAH}
                                        readOnly
                                    /></div>

                                </div>
                            </div>

                        );
                    })}
                </div>
            </div>

            {!readOnly && (
                <button className={innerStyles.addBtn} type="button" onClick={handleAddRow}>
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

                           {mode !== 'edit' && (<p style={{ margin: 0 }}>
                                Максимум для поточної форми:{' '}
                                <strong>{formatCapacityNumber(capacityPopupInfo.capacityLimit)}</strong>
                            </p>)}

                            {mode === 'edit' && (
                                <p style={{ margin: 0 }}>
                                    {capacityPopupInfo.rows.length === 1 ? (
                                        <>
                                            Ви можете вказати максимум <strong>{formatCapacityNumber(capacityPopupInfo.capacityLimit)}</strong> для рядка № <strong>{capacityPopupInfo.rows.map(row => row.rowNumber).join(', ')}</strong> або обирати інші комірки на складі.
                                        </>
                                    ) : (
                                        <>
                                            Ви можете перерозподіляти сумарну кількість в межах <strong>{formatCapacityNumber(capacityPopupInfo.capacityLimit)}</strong> між рядками <strong> {capacityPopupInfo.rows.map(row => row.rowNumber).join(', ')}</strong> або обирати інші комірки на складі.
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
                                Перевірте сумарну кількість в рядках № {' '}
                                <strong>
                                    {capacityPopupInfo.rows.map(row => row.rowNumber).join(', ')}
                                </strong>
                            </p>

                            <p style={{ margin: 0 }}>
                                {mode === 'edit' && capacityPopupInfo.rows.length === 1 ? (
                                    <>
                                        Щоб увійти в ліміт зменште кількість в цій тканині або оберіть іншу комірку.
                                    </>
                                ) : (
                                    <>
                                        Щоб увійти в ліміт зменште кількість в цій тканині або перерозподіліть кількість з іншою тканиною, що зберігається в цій комірці (цю комірку використовують рядки: <strong>
                                            {capacityPopupInfo.rows.map(row => row.rowNumber).join(', ')}
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
            {!readOnly && isCreateFabricPopupOpen && (
                <CentralPopup
                    title="Створення нової тканини"
                    onClose={closeCreateFabricPopup}
                    verticalScroll
                    bigPopup
                >
                    <NewFabric
                        popupMode
                        initialName={createFabricRowIndex != null ? rows[createFabricRowIndex]?.fabric?.name || '' : ''}
                        alreadyExists={createFabricRowIndex != null ? !!rows[createFabricRowIndex]?.fabric?.id : false}
                        onCreated={handleFabricCreated}
                    />
                </CentralPopup>
            )}
        </div>
    );
};

export default forwardRef(EditableFabricTable);
