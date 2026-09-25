import React, { useEffect, useMemo, useState } from "react";
import CentralPopup from "../../Common/CentralPopup/CentralPopup";
import styles from "../CutterFabricPopup/CutterFabricPopup.module.scss";
import {
    fetchWarehouseItemLocations,
    updateOrder,
} from "../../../api/ordersApi";

const normalizeWarehouseItemUnits = (response) => {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.warehouse_item_units)) {
        return response.warehouse_item_units;
    }

    if (Array.isArray(response?.results)) {
        return response.results;
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    return [];
};

const getLocationLabel = (unit) => {
    const warehouseName =
        unit?.cell?.rack?.warehouse?.name || "—";

    const rackName =
        unit?.cell?.rack?.name || "—";

    const cellNumber =
        unit?.cell?.number ?? "—";

    const currentQuantity =
        unit?.current_quantity ?? unit?.quantity ?? "—";

    return `Склад "${warehouseName}" / Стелаж "${rackName}" / Комірка № ${cellNumber} / Залишок ${currentQuantity}`;
};

const WarehouseItemPopup = ({
                                accessToken,
                                orderId,
                                warehouseItemId,
                                onClose,
                                onSuccess = () => {},
                            }) => {
    const [locations, setLocations] = useState([]);
    const [selectedLocationId, setSelectedLocationId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorText, setErrorText] = useState("");

    useEffect(() => {
        const loadLocations = async () => {
            if (!accessToken || !warehouseItemId) {
                setErrorText("Не вистачає даних для завантаження розташувань.");
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setErrorText("");

                const response = await fetchWarehouseItemLocations(
                    accessToken,
                    warehouseItemId
                );

                const normalizedLocations = normalizeWarehouseItemUnits(response);
                setLocations(normalizedLocations);

                if (!normalizedLocations.length) {
                    setErrorText("Немає доступних розташувань товару.");
                }
            } catch (error) {
                console.error(error);
                setLocations([]);
                setErrorText("Не вдалося завантажити розташування товару.");
            } finally {
                setIsLoading(false);
            }
        };

        loadLocations();
    }, [accessToken, warehouseItemId]);

    const selectedLocation = useMemo(
        () => locations.find((item) => item.id === selectedLocationId) || null,
        [locations, selectedLocationId]
    );

    const handleSelectLocation = async (location) => {
        if (!accessToken || !orderId || !warehouseItemId) {
            setErrorText("Не вистачає даних для збереження.");
            return;
        }

        if (!location?.id || !location?.cell?.id) {
            setErrorText("Некоректне розташування товару.");
            return;
        }

        try {
            setSelectedLocationId(location.id);
            setIsSubmitting(true);
            setErrorText("");

            const payload = {
                warehouse_item: {
                    id: warehouseItemId,
                    cell: location.cell.id,
                    unit: location.id,
                },
            };

            const response = await updateOrder(accessToken, orderId, payload);

            onSuccess(response);
            onClose();
        } catch (error) {
            console.error(error);
            setErrorText("Не вдалося зберегти вибір товару.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <CentralPopup
            title={"Вибір товару"}
            onClose={onClose}
            bigPopup
            verticalScroll
        >
            <div className={styles.popup}>
                {!!errorText && <p className={styles.error}>{errorText}</p>}

                {isLoading ? (
                    <div className={styles.block}>
                        <p className={styles.empty}>Завантаження розташувань...</p>
                    </div>
                ) : locations.length ? (
                    <div className={styles.block}>
                        <p className={styles.blockTitle}>Розташування товару на складі</p>

                        <div className={styles.list}>
                            {locations.map((location) => (
                                <button
                                    key={location.id}
                                    type="button"
                                    className={`${styles.listItem} ${
                                        selectedLocation?.id === location.id
                                            ? styles.active
                                            : ""
                                    }`}
                                    onClick={() => handleSelectLocation(location)}
                                    disabled={isSubmitting}
                                >
                                    <div className={styles.meta}>
                                        <span>{getLocationLabel(location)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </CentralPopup>
    );
};

export default WarehouseItemPopup;