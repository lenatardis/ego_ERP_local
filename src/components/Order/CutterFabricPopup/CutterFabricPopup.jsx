import React, { useMemo, useState } from "react";
import CentralPopup from "../../Common/CentralPopup/CentralPopup";
import styles from "./CutterFabricPopup.module.scss";
import {
    createProductionCost,
    fetchFabricRollsForProduction,
    searchWarehouseFabrics,
} from "../../../api/ordersApi";

const normalizeFabricsList = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.fabrics)) return response.fabrics;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.data)) return response.data;
    return [];
};

const normalizeRollsList = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.fabric_rolls)) return response.fabric_rolls;
    if (Array.isArray(response?.["fabric-rolls"])) return response?.["fabric-rolls"];
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.data)) return response.data;
    return [];
};

const getFabricLabel = (fabric) => {
    return (
        fabric?.name ||
        fabric?.fabric_code ||
        fabric?.code ||
        fabric?.article ||
        `Тканина #${fabric?.id}`
    );
};

const getFabricMeta = (fabric) => {
    const typeName = fabric?.type?.type || "";
    const monoType = Array.isArray(fabric?.mono_fabric_type)
        ? fabric.mono_fabric_type.join(", ")
        : "";

    return [typeName, monoType].filter(Boolean).join(" / ");
};

const getRollAvailableLength = (roll) => {
    return (
        roll?.current_length ??
        roll?.available_length ??
        roll?.rest_length ??
        roll?.remaining_length ??
        roll?.length ??
        ""
    );
};

const getRollLabel = (roll) => {
    const warehouseName =
        roll?.cell?.rack?.warehouse?.name ||
        roll?.warehouse?.name ||
        "—";

    const rackName =
        roll?.cell?.rack?.name ||
        roll?.rack?.name ||
        "—";

    const cellNumber =
        roll?.cell?.number ??
        roll?.number ??
        "—";

    const availableLength = getRollAvailableLength(roll);

    if (availableLength !== "") {
        return `Склад "${warehouseName}" / Стелаж "${rackName}" / Комірка № ${cellNumber} / Доступно ${availableLength} метрів`;
    }

    return `Склад "${warehouseName}" / Стелаж "${rackName}" / Комірка № ${cellNumber}`;
};

const CutterFabricPopup = ({
    accessToken,
    orderId,
    cutterId,
    onClose,
    onSuccess = () => { },
}) => {
    const [searchValue, setSearchValue] = useState("");
    const [fabrics, setFabrics] = useState([]);
    const [rolls, setRolls] = useState([]);
    const [selectedFabric, setSelectedFabric] = useState(null);
    const [selectedRoll, setSelectedRoll] = useState(null);
    const [usedLength, setUsedLength] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingRolls, setIsLoadingRolls] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorText, setErrorText] = useState("");


    const selectedRollAvailableLength = useMemo(() => {
        if (!selectedRoll) return null;

        const value = Number(getRollAvailableLength(selectedRoll));
        return Number.isFinite(value) ? value : null;
    }, [selectedRoll]);


    const lengthErrorText = useMemo(() => {
        if (!selectedRoll || usedLength === "") return "";

        const value = Number(usedLength);

        if (!Number.isFinite(value) || value < 1) {
            return `Не доступна довжина рулона, доступно ${selectedRollAvailableLength}м`;
        }

        if (
            selectedRollAvailableLength !== null &&
            value > selectedRollAvailableLength
        ) {
            return `Не доступна довжина рулона, доступно ${selectedRollAvailableLength}м`;
        }

        return "";
    }, [usedLength, selectedRoll, selectedRollAvailableLength]);

    const canSubmit = useMemo(() => {
        return (
            !!selectedRoll?.id &&
            !!cutterId &&
            usedLength !== "" &&
            !lengthErrorText
        );
    }, [selectedRoll, cutterId, usedLength, lengthErrorText]);

    const handleSearch = async () => {
        if (!searchValue.trim()) {
            setErrorText("Введіть код тканини.");
            return;
        }

        try {
            setIsSearching(true);
            setErrorText("");
            setSelectedFabric(null);
            setSelectedRoll(null);
            setRolls([]);
            setUsedLength("");
            setFabrics([]);

            const response = await searchWarehouseFabrics(
                accessToken,
                searchValue.trim()
            );

            const normalizedFabrics = normalizeFabricsList(response);
            setFabrics(normalizedFabrics);

            if (!normalizedFabrics.length) {
                setErrorText("Тканину не знайдено.");
            }
        } catch (error) {
            console.log(error);
            setFabrics([]);
            setErrorText("Не вдалося знайти тканину.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectFabric = async (fabric) => {
        try {
            setSelectedFabric(fabric);
            setSelectedRoll(null);
            setUsedLength("");
            setErrorText("");
            setRolls([]);
            setIsLoadingRolls(true);

            const response = await fetchFabricRollsForProduction(accessToken, fabric.id);
            const normalizedRolls = normalizeRollsList(response);

            setRolls(normalizedRolls);

            if (!normalizedRolls.length) {
                setErrorText("Для цієї тканини немає рулонів на складі.");
            } else {
                setErrorText("");
            }
        } catch (error) {
            console.log(error);
            setRolls([]);
            setErrorText("Не вдалося завантажити рулони.");
        } finally {
            setIsLoadingRolls(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedRoll?.id || !usedLength) {
            setErrorText("Оберіть рулон і введіть довжину.");
            return;
        }

        if (lengthErrorText) {
            return;
        }

        try {
            setIsSubmitting(true);
            setErrorText("");

            const payload = {
                used_length: Number(usedLength),
                cutter: Number(cutterId),
                manufacturing: Number(orderId),
                fabric_roll: Number(selectedRoll.id),
            };

            const response = await createProductionCost(accessToken, payload);

            await onSuccess(response);
            onClose();

        } catch (error) {
            console.log(error);
            setErrorText("Не вдалося зберегти виконану роботу.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <CentralPopup
            title={"Внести виконану роботу"}
            onClose={onClose}
            bigPopup
            verticalScroll
        >
            <div className={styles.popup}>
                <div className={styles.searchRow}>
                    <input
                        type="text"
                        className={"baseInput"}
                        placeholder={"Введіть код тканини"}
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                    />

                    <button
                        type="button"
                        className={"btnDark"}
                        onClick={handleSearch}
                        disabled={isSearching}
                    >
                        <span>{isSearching ? "Пошук..." : "Пошук"}</span>
                    </button>
                </div>

                {!!errorText && <p className={styles.error}>{errorText}</p>}

                {!!fabrics.length && (
                    <div className={styles.block}>
                        <p className={styles.blockTitle}>Знайдені тканини</p>

                        <div className={styles.list}>
                            {fabrics.map((fabric) => (
                                <button
                                    key={fabric.id}
                                    type="button"
                                    className={`${styles.listItem} ${selectedFabric?.id === fabric.id ? styles.active : ""
                                        }`}
                                    onClick={() => handleSelectFabric(fabric)}
                                >
                                    <div className={styles.meta}>
                                        <span>{getFabricLabel(fabric)}</span>
                                        {!!getFabricMeta(fabric) && (
                                            <span>{getFabricMeta(fabric)}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {isLoadingRolls && (
                    <div className={styles.block}>
                        <p className={styles.empty}>Завантаження рулонів...</p>
                    </div>
                )}

                {!!rolls.length && (
                    <div className={styles.block}>
                        <p className={styles.blockTitle}>Рулони на складі</p>

                        <div className={styles.list}>
                            {rolls.map((roll) => (
                                <button
                                    key={roll.id}
                                    type="button"
                                    className={`${styles.listItem} ${selectedRoll?.id === roll.id ? styles.active : ""
                                        }`}
                                    onClick={() => setSelectedRoll(roll)}
                                >
                                    <div className={styles.meta}>
                                        <span>{getRollLabel(roll)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!!selectedRoll && (
                    <div className={styles.lengthRow}>
                        <p className={styles.blockTitle}>Вкажіть довжину, на яку треба покроїти вибраний рулон</p>

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={"baseInput"}
                            placeholder={"Введіть довжину"}
                            value={usedLength}
                            onChange={(e) => setUsedLength(e.target.value)}
                        />

                        {!!lengthErrorText && (
                            <p className={styles.error}>{lengthErrorText}</p>
                        )}
                    </div>
                )}

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={"btnDark"}
                        onClick={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                    >
                        <span>{isSubmitting ? "Збереження..." : "Покроїти"}</span>
                    </button>
                </div>
            </div>
        </CentralPopup>
    );
};

export default CutterFabricPopup;