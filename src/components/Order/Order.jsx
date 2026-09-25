import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./Order.module.scss";
import IconUserPlaceholder from "../../assets/icons/user.svg";
import Clock from "./Clock/Clock.jsx";
import CheckboxList from "./CheckboxList/CheckboxList.jsx";
import ProtectedImage from "../Common/ProtectedImage/ProtectedImage";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { setIsActivePopup } from "../../store/main-slice.js";
import SidePopup from "../Common/SidePopup/SidePopup.jsx";
import { getProfile } from "../../store/selectors";
import { fetchOrderById, updateOrder } from "../../api/ordersApi";
import CutterFabricPopup from "./CutterFabricPopup/CutterFabricPopup.jsx";
import WarehouseItemPopup from "./WarehouseItemPopup/WarehouseItemPopup.jsx";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";
import CompleteWorkPopup from "./CompleteWorkPopup/CompleteWorkPopup.jsx";


const ORDER_STATUS_LABELS = {
    NEW: "Нове",
    IN_PROGRESS: "В роботі",
    COMPLETED: "Завершено",
    AWAITING_CUTTING: "Очікує крійки",
    ON_CUT: "На крійці",
    AWAITING_SEWING: "Очікує пошиття",
    ON_SEWING: "На пошитті",
    AWAITING_PACKAGING: "Очікує пакування",
    ON_PACKAGING: "На пакуванні",
    IS_PACKED: "Запаковано",
    SHIPMENT_READY: "Готово до відправки",
    DELIVERED: "Доставлено",
};

const getStoredAccessToken = () => {
    return (
        localStorage.getItem("access") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("access_token") ||
        ""
    );
};

const decodeBase64Url = (value) => {
    try {
        let base64 = value.replace(/-/g, "+").replace(/_/g, "/");

        while (base64.length % 4 !== 0) {
            base64 += "=";
        }

        return atob(base64);
    } catch (error) {
        console.error("Cannot decode token payload:", error);
        return "";
    }
};

const getUserIdFromToken = (token) => {
    try {
        if (!token) return null;

        const payloadPart = token.split(".")[1];
        if (!payloadPart) return null;

        const decodedPayload = JSON.parse(decodeBase64Url(payloadPart));

        return (
            decodedPayload.user_id ||
            decodedPayload.userId ||
            decodedPayload.id ||
            null
        );
    } catch (error) {
        console.error("Cannot parse user id from token:", error);
        return null;
    }
};

const getTextValue = (value, fallback = "—") => {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }

    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }

    if (typeof value === "object") {
        if (typeof value.name === "string" && value.name.trim()) {
            return value.name;
        }

        if (typeof value.title === "string" && value.title.trim()) {
            return value.title;
        }

        if (typeof value.comment === "string" && value.comment.trim()) {
            return value.comment;
        }

        if (value.id !== undefined && value.id !== null) {
            return `#${value.id}`;
        }
    }

    return fallback;
};

const getMetersLabel = (value) => {
    const number = Math.abs(Number(value));

    if (!Number.isFinite(number)) {
        return "метрів";
    }

    const lastTwo = number % 100;
    const lastOne = number % 10;

    if (lastTwo >= 11 && lastTwo <= 14) {
        return "метрів";
    }

    if (lastOne === 1) {
        return "метр";
    }

    if (lastOne >= 2 && lastOne <= 4) {
        return "метри";
    }

    return "метрів";
};

const normalizeImageUrl = (value) => {
    if (!value || typeof value !== "string") {
        return "";
    }

    const url = value.trim();

    if (!url) {
        return "";
    }

    return url;
};

const formatDateTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return `${date.toLocaleDateString("uk-UA")} / ${date.toLocaleTimeString(
        "uk-UA",
        {
            hour: "2-digit",
            minute: "2-digit",
        }
    )}`;
};

const getOrderNumber = (order) => {
    if (!order) return "—";

    if (order?.order && typeof order.order === "object") {
        return (
            order.order.id ||
            order.order.general_order_number ||
            order.order.order_number ||
            order.id ||
            "—"
        );
    }

    if (
        order?.order !== null &&
        order?.order !== undefined &&
        order?.order !== ""
    ) {
        return order.order;
    }

    return order?.id || "—";
};

const getImageUrl = (order) => {
    const kitImage = order?.kit?.fabric_image;
    if (typeof kitImage === "string" && kitImage.trim()) {
        return normalizeImageUrl(kitImage);
    }

    const warehouseImage = order?.warehouse_item?.image;
    if (typeof warehouseImage === "string" && warehouseImage.trim()) {
        return normalizeImageUrl(warehouseImage);
    }

    return "";
};

const getSetSizeValue = (order) => {
    const warehouseItemSize = getTextValue(order?.warehouse_item?.size);
    if (warehouseItemSize !== "—") return warehouseItemSize;

    const kitName = getTextValue(order?.kit?.name);
    if (kitName !== "—") return kitName;

    const warehouseItemName = getTextValue(order?.warehouse_item?.name);
    if (warehouseItemName !== "—") return warehouseItemName;

    return "—";
};

const getCompletionItems = (order) => {
    const items = [];

    if (Array.isArray(order?.kit?.component)) {
        order.kit.component.forEach((component) => {
            if (
                component?.name &&
                typeof component.name === "string" &&
                component.name.trim()
            ) {
                items.push(component.name.trim());
            }
        });
    }

    const uniqueItems = [...new Set(items)];

    if (uniqueItems.length > 0) {
        return uniqueItems;
    }

    const warehouseName = getTextValue(order?.warehouse_item?.name, "");
    if (warehouseName) {
        return [warehouseName];
    }

    return ["—"];
};

const getCheckboxItems = (order) => {
    if (Array.isArray(order?.kit?.component) && order.kit.component.length > 0) {
        return order.kit.component.map((component, index) => ({
            id: component?.id ?? index + 1,
            name: component?.name || "—",
            is_sewn: Boolean(component?.is_sewn),
            is_packed: Boolean(component?.is_packed),
        }));
    }

    const warehouseName = getTextValue(order?.warehouse_item?.name, "");
    if (warehouseName) {
        return [
            {
                id: 1,
                name: warehouseName,
                is_packed: Boolean(order?.warehouse_item?.is_packed),
            },
        ];
    }

    return [{ id: 1, name: "—" }];
};

const getOptionsItems = (order) => {
    if (!order?.kit || !Array.isArray(order.kit.option)) {
        return [];
    }

    const options = order.kit.option
        .map((optionItem) => {
            if (
                optionItem?.name &&
                typeof optionItem.name === "string" &&
                optionItem.name.trim()
            ) {
                return optionItem.name.trim();
            }

            return null;
        })
        .filter(Boolean);

    return [...new Set(options)];
};

const getCurrentRoleLabel = (groups) => {
    if (!Array.isArray(groups) || groups.length === 0) {
        return "Робітник";
    }

    if (groups.includes("Швачка")) {
        return "Швачка";
    }

    if (groups.includes("Швея")) {
        return "Швея";
    }

    return groups[0];
};

const getEmployeeFullName = (worker) => {
    const firstName = worker?.employee?.first_name?.trim?.() || "";
    const lastName = worker?.employee?.last_name?.trim?.() || "";

    return [firstName, lastName].filter(Boolean).join(" ").trim();
};

const getPrimaryExecutors = (order) => {
    const workers = [
        {
            label: "Закрійник",
            worker: order?.cutter,
        },
        {
            label: "Швачка",
            worker: order?.sewer,
        },
        {
            label: "Пакувальник",
            worker: order?.packer,
        },
    ];

    return workers
        .map(({ label, worker }) => {
            if (!worker) return null;

            const fullName = getEmployeeFullName(worker);
            if (!fullName) return null;

            return {
                label,
                fullName,
            };
        })
        .filter(Boolean);
};

const getWorkerId = (worker) => {
    if (!worker) return null;

    if (typeof worker !== "object") {
        return worker;
    }

    return worker.employee?.id ?? null;
};

const getHistoryItems = (order) => {
    if (!Array.isArray(order?.history) || order.history.length === 0) {
        return [];
    }

    return order.history.map((item, index) => ({
        id: item?.id || index,
        text: item?.text || "",
    }));
};

const getCuttingCostItems = (order) => {
    if (!Array.isArray(order?.costs) || order.costs.length === 0) {
        return [];
    }

    return order.costs.map((cost, index) => {
        const cutterFirstName =
            cost?.cutter?.first_name?.trim?.() ||
            cost?.cutter?.employee?.first_name?.trim?.() ||
            "";
        const cutterLastName =
            cost?.cutter?.last_name?.trim?.() ||
            cost?.cutter?.employee?.last_name?.trim?.() ||
            "";

        const cutterFullName =
            [cutterFirstName, cutterLastName].filter(Boolean).join(" ").trim() || "—";

        return {
            id: cost?.id || index,
            fabricRollId: cost?.fabric_roll?.id ?? "—",
            fabricName: cost?.fabric_roll?.fabric?.name || "—",
            fabricType: cost?.fabric_roll?.fabric?.type?.type || "—",
            usedLength: cost?.used_length ?? "—",
            cutterFullName,
        };
    });
};

const Order = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const { first_name, last_name, photo, groups } = useAppSelector(getProfile);

    const routeOrder = location.state?.order || null;
    const routeOrderId = location.state?.orderId || routeOrder?.id || null;

    const token = getStoredAccessToken();
    const currentUserId = getUserIdFromToken(token);

    const [orderData, setOrderData] = useState(routeOrder);
    const [selectedItems, setSelectedItems] = useState([]);
    const [showSidePopup, setShowSidePopup] = useState(false);
    const [showCutterPopup, setShowCutterPopup] = useState(false);
    const [showWarehouseItemPopup, setShowWarehouseItemPopup] = useState(false);
    const [isLoading, setIsLoading] = useState(!routeOrder && !!routeOrderId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorText, setErrorText] = useState("");
    const [showCompleteWorkPopup, setShowCompleteWorkPopup] = useState(false);
    const [isFinishingWork, setIsFinishingWork] = useState(false);
    const [completeWorkRole, setCompleteWorkRole] = useState("");

    const order = orderData || routeOrder;
    const isWarehouseOrder = !!order?.warehouse_item;
    const hasWarehouseCell = !!order?.warehouse_item?.cell;

    const isCutter = Array.isArray(groups) && groups.includes("Закрійник");
    const isSewer =
        Array.isArray(groups) &&
        (groups.includes("Швачка") || groups.includes("Швея"));
    const isPacker = Array.isArray(groups) && groups.includes("Пакувальник");

    const isCutterWithKit = isCutter && !!order?.kit;

    const canUpdateOrder = useMemo(() => {
        if (!order || !currentUserId) return false;

        if (isCutter) return Number(getWorkerId(order?.cutter)) === Number(currentUserId);
        if (isSewer) return Number(getWorkerId(order?.sewer)) === Number(currentUserId);
        if (isPacker) return Number(getWorkerId(order?.packer)) === Number(currentUserId);

        return false;
    }, [order, currentUserId, isCutter, isSewer, isPacker]);

    const checkboxArray = useMemo(() => getCheckboxItems(order), [order]);

    const warehouseCheckboxId = checkboxArray[0]?.id ?? 1;

    const isWarehousePackedChecked = useMemo(() => {
        return selectedItems.some(
            (item) => Number(item?.id) === Number(warehouseCheckboxId)
        );
    }, [selectedItems, warehouseCheckboxId]);

    const hasWarehousePackedChanged = useMemo(() => {
        if (!isWarehouseOrder || !hasWarehouseCell) {
            return true;
        }

        return isWarehousePackedChecked !== Boolean(order?.warehouse_item?.is_packed);
    }, [
        isWarehouseOrder,
        hasWarehouseCell,
        isWarehousePackedChecked,
        order?.warehouse_item?.is_packed,
    ]);

    const orderNumber = getOrderNumber(order);
    const imageUrl = getImageUrl(order);
    const setSize = getSetSizeValue(order);
    const completionItems = getCompletionItems(order);
    const optionsItems = getOptionsItems(order);
    const statusLabel =
        ORDER_STATUS_LABELS[order?.status] || order?.status || "—";
    const historyItems = getHistoryItems(order);
    const roleLabel = getCurrentRoleLabel(groups);
    const primaryExecutors = getPrimaryExecutors(order);

    const warehouseName = getTextValue(order?.warehouse_item?.name);
    const warehouseCategory = getTextValue(order?.warehouse_item?.category);
    const warehouseColor = getTextValue(order?.warehouse_item?.color);
    const warehouseSize = getTextValue(order?.warehouse_item?.size);
    const cuttingCosts = Array.isArray(order?.costs) ? order.costs : [];
    const cuttingCostItems = useMemo(() => getCuttingCostItems(order), [order]);


    const refreshOrder = async () => {
        if (!token || !(routeOrderId || order?.id)) {
            return null;
        }

        try {
            setErrorText("");

            const refreshedOrder = await fetchOrderById(
                token,
                routeOrderId || order?.id
            );

            setOrderData(refreshedOrder);
            return refreshedOrder;
        } catch (error) {
            console.error("Order refresh error:", error);
            setErrorText("Не вдалося оновити деталку замовлення.");
            return null;
        }
    };

    useEffect(() => {
        const loadOrder = async () => {
            if (!token || !routeOrderId) {
                return;
            }

            try {
                setIsLoading(true);
                await refreshOrder();
            } finally {
                setIsLoading(false);
            }
        };

        loadOrder();
    }, [token, routeOrderId]);

    const redirectToMyActiveOrders = () => {
        setShowCompleteWorkPopup(false);
        setCompleteWorkRole("");
        dispatch(setIsActivePopup(false));

        navigate("/orders", {
            replace: true,
            state: {
                activeTab: "my",
            },
        });
    };

    useEffect(() => {
        if (!isWarehouseOrder || !hasWarehouseCell) {
            return;
        }

        if (order?.warehouse_item?.is_packed) {
            setSelectedItems(
                checkboxArray.length
                    ? [
                        {
                            id: checkboxArray[0].id,
                            name: checkboxArray[0].name,
                        },
                    ]
                    : []
            );
        } else {
            setSelectedItems([]);
        }
    }, [
        isWarehouseOrder,
        hasWarehouseCell,
        order?.warehouse_item?.is_packed,
        checkboxArray,
    ]);

    useEffect(() => {
        if (!isSewer || !order?.kit || !Array.isArray(order?.kit?.component)) {
            return;
        }

        const sewnItems = checkboxArray.filter((item) => item?.is_sewn);

        setSelectedItems(sewnItems);
    }, [isSewer, order?.kit, order?.kit?.component, checkboxArray]);

    useEffect(() => {
        if (!isPacker) {
            return;
        }

        if (isWarehouseOrder && hasWarehouseCell) {
            const packedItems = checkboxArray.filter((item) => item?.is_packed);
            setSelectedItems(packedItems);
            return;
        }

        if (order?.kit && Array.isArray(order?.kit?.component)) {
            const packedItems = checkboxArray.filter((item) => item?.is_packed);
            setSelectedItems(packedItems);
        }
    }, [
        isPacker,
        isWarehouseOrder,
        hasWarehouseCell,
        order?.kit,
        order?.kit?.component,
        checkboxArray,
    ]);

    const openSidePopup = () => {
        setShowSidePopup(true);
        dispatch(setIsActivePopup(true));
    };

    const closeSidePopup = () => {
        setShowSidePopup(false);
        dispatch(setIsActivePopup(false));
    };

    const openCutterPopup = () => {
        if (!canUpdateOrder) return;

        setShowCutterPopup(true);
        dispatch(setIsActivePopup(true));
    };

    const closeCutterPopup = () => {
        setShowCutterPopup(false);
        dispatch(setIsActivePopup(false));
    };

    const openWarehouseItemPopup = () => {
        if (!canUpdateOrder) return;

        setShowWarehouseItemPopup(true);
        dispatch(setIsActivePopup(true));
    };

    const closeWarehouseItemPopup = () => {
        setShowWarehouseItemPopup(false);
        dispatch(setIsActivePopup(false));
    };

    const openCompleteWorkPopup = () => {
        if (!canUpdateOrder || (!isCutter && !isSewer && !isPacker)) return;

        setCompleteWorkRole(
            isCutter ? "cutter" : isSewer ? "sewer" : isPacker ? "packer" : ""
        );
        setShowCompleteWorkPopup(true);
        dispatch(setIsActivePopup(true));
    };

    const closeCompleteWorkPopup = () => {
        if (isFinishingWork) return;

        setShowCompleteWorkPopup(false);
        setCompleteWorkRole("");
        dispatch(setIsActivePopup(false));
    };

    const handleCompletedWork = async () => {
        if (!canUpdateOrder || !token || !order?.id) return;

        if (isWarehouseOrder && hasWarehouseCell) {
            const nextPackedValue = isWarehousePackedChecked;
            const currentPackedValue = Boolean(order?.warehouse_item?.is_packed);

            if (nextPackedValue === currentPackedValue) {
                return;
            }

            try {
                setIsSubmitting(true);
                setErrorText("");

                const updatedOrder = await updateOrder(token, order.id, {
                    warehouse_item: {
                        id: order.warehouse_item.id,
                        is_packed: nextPackedValue,
                    },
                });

                setOrderData(updatedOrder);
            } catch (error) {
                console.error("Warehouse item pack update error:", error);
                setErrorText("Не вдалося зберегти статус пакування.");
            } finally {
                setIsSubmitting(false);
            }

            return;
        }

        const normalizedSelectedIds = new Set(
            (selectedItems || []).map((item) => {
                if (typeof item === "object" && item !== null) {
                    return Number(item.id);
                }

                return Number(item);
            })
        );

        if (isSewer && Array.isArray(order?.kit?.component)) {
            const componentPayload = order.kit.component.map((component) => ({
                id: component.id,
                is_sewn: normalizedSelectedIds.has(Number(component.id)),
            }));

            try {
                setIsSubmitting(true);
                setErrorText("");

                const updatedOrder = await updateOrder(token, order.id, {
                    component: componentPayload,
                });

                setOrderData(updatedOrder);
            } catch (error) {
                console.error("Sewer component update error:", error);
                setErrorText("Не вдалося зберегти виконану роботу швачки.");
            } finally {
                setIsSubmitting(false);
            }

            return;
        }

        if (isPacker && Array.isArray(order?.kit?.component)) {
            const componentPayload = order.kit.component.map((component) => ({
                id: component.id,
                is_packed: normalizedSelectedIds.has(Number(component.id)),
            }));

            try {
                setIsSubmitting(true);
                setErrorText("");

                const updatedOrder = await updateOrder(token, order.id, {
                    component: componentPayload,
                });

                setOrderData(updatedOrder);
            } catch (error) {
                console.error("Packer component update error:", error);
                setErrorText("Не вдалося зберегти виконану роботу пакувальника.");
            } finally {
                setIsSubmitting(false);
            }

            return;
        }
    };

    const handleCompleteCutterWork = async () => {
        if (!canUpdateOrder || !isCutter || !token || !order?.id) return;

        try {
            setIsFinishingWork(true);
            setErrorText("");

            await updateOrder(token, order.id, {
                status: "AWAITING_SEWING",
            });

            redirectToMyActiveOrders();
        } catch (error) {
            console.error("Complete cutter work error:", error);
            setErrorText("Не вдалося завершити роботу та передати замовлення швачці.");
        } finally {
            setIsFinishingWork(false);
        }
    };

    const handleCompleteSewerWork = async () => {
        if (!canUpdateOrder || !isSewer || !token || !order?.id) return;

        try {
            setIsFinishingWork(true);
            setErrorText("");

            await updateOrder(token, order.id, {
                status: "AWAITING_PACKAGING",
            });

            redirectToMyActiveOrders();
        } catch (error) {
            console.error("Complete sewer work error:", error);
            setErrorText("Не вдалося завершити роботу та передати замовлення пакувальнику.");
        } finally {
            setIsFinishingWork(false);
        }
    };

    const handleCompletePackerWork = async () => {
        if (!canUpdateOrder || !isPacker || !token || !order?.id) return;

        try {
            setIsFinishingWork(true);
            setErrorText("");

            await updateOrder(token, order.id, {
                status: "SHIPMENT_READY",
            });

            redirectToMyActiveOrders();
        } catch (error) {
            console.error("Complete packer work error:", error);
            setErrorText("Не вдалося завершити роботу та перевести замовлення в готовність до відправки.");
        } finally {
            setIsFinishingWork(false);
        }
    };

    if (!routeOrderId && !routeOrder) {
        return (
            <div className={styles.order}>
                <div className={styles.order__content}>
                    <p>Не передано дані замовлення.</p>
                </div>
            </div>
        );
    }

    if (isLoading && !order) {
        return (
            <div className={styles.order}>
                <div className={styles.order__content}>
                    <p>Завантаження...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.order}>
            <ArrBack />
            <div className={styles.order__header}>
                <div className={styles.order__headerRow}>
                    <div className={styles.userBlock}>
                        <div className={styles.userLogoPlaceholder}>
                            <img src={photo ? photo : IconUserPlaceholder} alt="" />
                        </div>

                        <div className={styles.nameBlock}>
                            <h3>
                                {last_name} {first_name}
                            </h3>
                            <p>{roleLabel}</p>
                        </div>
                    </div>

                    <div className={styles.infoBlock}>
                        <div className={styles.timeBlock}>
                            <div className={styles.currentTime}>
                                <p className={styles.currentTimeCaption}>Поточний час</p>
                                <Clock />
                            </div>
                        </div>

                        <div className={styles.btnBlock}>
                            <button className={"btnDark"} type="button">
                                <span>Історія роботи</span>
                            </button>

                            <button
                                className={styles.btnGrey}
                                type="button"
                                onClick={openSidePopup}
                            >
                                <span>Задачі</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.order__content}>
                {errorText ? <p>{errorText}</p> : null}

                <div className={styles.grid}>
                    <div>
                        <div className={styles.titleRow}>
                            <h2>CRM замовлення №{orderNumber}</h2>
                            <div className={styles.label}>
                                <span>{statusLabel}</span>
                            </div>
                        </div>

                        <div className={styles.infoRow}>
                            <div>
                                <h3>
                                    {isWarehouseOrder
                                        ? "Інформація про готову продукцію"
                                        : "Інформація про комплект"}
                                </h3>

                                <div className={styles.paramsBlock}>
                                    {isWarehouseOrder ? (
                                        <>
                                            <p>
                                                Назва: <span>{warehouseName}</span>
                                            </p>

                                            <p>
                                                Категорія: <span>{warehouseCategory}</span>
                                            </p>

                                            <p>
                                                Колір: <span>{warehouseColor}</span>
                                            </p>

                                            <p>
                                                Розмір: <span>{warehouseSize}</span>
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p>
                                                Назва: <span>{setSize}</span>
                                            </p>

                                            <p>
                                                Комплектація:{" "}
                                                <span>{completionItems.join(", ")}</span>
                                            </p>

                                            {order?.kit && optionsItems.length > 0 && (
                                                <p>
                                                    Опції: <span>{optionsItems.join(", ")}</span>
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className={styles.historyBlock}>
                                <div className={styles.historyBlock__header}>
                                    <p>Історія замовлення</p>
                                </div>

                                <div className={styles.historyBlock__content}>
                                    <p className={styles.historyBlock__caption}>
                                        Відповідальний
                                    </p>
                                    <div className={styles.historyBlock__name}>
                                        {primaryExecutors.length > 0 ? (
                                            primaryExecutors.map(({ label, fullName }) => (
                                                <p key={`${label}-${fullName}`}>
                                                    {label}: <b>{fullName}</b>
                                                </p>
                                            ))
                                        ) : (
                                            <p>—</p>
                                        )}
                                    </div>

                                    <p className={styles.historyBlock__caption}>
                                        Останнє оновлення
                                    </p>
                                    <p>{formatDateTime(order?.modified)}</p>
                                </div>
                            </div>
                        </div>

                        {isSewer && cuttingCostItems.length > 0 && (
                            <div className={styles.sewerCuttingInfo}>
                                <h3>Кройка рулонів: </h3>

                                {cuttingCostItems.map((item) => (
                                    <p key={item.id}>
                                        · викроїно рулон <strong>#{item.fabricRollId}</strong> (тканина{" "}
                                        <strong>{item.fabricName}</strong>, тип {item.fabricType}) на довжину{" "}
                                        <strong>{item.usedLength}</strong> {getMetersLabel(item.usedLength)} закройщиком{" "}
                                        "<strong>{item.cutterFullName}</strong>"
                                    </p>
                                ))}
                            </div>
                        )}

                        <div className={styles.processedBlock}>
                            {isCutterWithKit ? (
                                <>
                                    {cuttingCosts.length > 0 && (
                                        <div className={styles.cuttingInfo}>
                                            {cuttingCosts.map((cost) => (
                                                <p key={cost.id}>
                                                    · викроїно рулон <strong>#{cost?.fabric_roll?.id}</strong> (
                                                    тканина <strong>{cost?.fabric_roll?.fabric?.name || "—"}</strong>, тип{" "}
                                                    {cost?.fabric_roll?.fabric?.type?.type || "—"})
                                                    {" "}на довжину <strong>{cost?.used_length ?? "—"}</strong>{" "}
                                                    {getMetersLabel(cost?.used_length)}.
                                                </p>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        className={"btnDark"}
                                        type="button"
                                        onClick={openCutterPopup}
                                    >
                                        <span>Вибір тканини</span>
                                    </button>
                                </>
                            ) : isWarehouseOrder && !hasWarehouseCell ? (
                                <button
                                    className={"btnDark"}
                                    type="button"
                                    onClick={openWarehouseItemPopup}
                                    disabled={!canUpdateOrder}
                                >
                                    <span>Вибір товару</span>
                                </button>
                            ) : (
                                <>
                                    <CheckboxList
                                        array={checkboxArray}
                                        selectedItems={selectedItems}
                                        setSelectedItems={setSelectedItems}
                                    />

                                    <button
                                        className={"btnDark"}
                                        type="button"
                                        onClick={handleCompletedWork}
                                        disabled={
                                            !canUpdateOrder ||
                                            isSubmitting ||
                                            (isWarehouseOrder && hasWarehouseCell && !hasWarehousePackedChanged)
                                        }
                                    >
                                        <span>{isSubmitting ? "Збереження..." : "Внести виконану роботу"}</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className={styles.imgWrap}>
                            <ProtectedImage
                                src={imageUrl}
                                alt={`Замовлення № ${orderNumber}`}
                                token={token}
                                className={styles.photo}
                                fallbackClassName={styles.photoPlaceholder}
                            />
                        </div>
                    </div>
                </div>

                <div className={`${styles.actionGrid}`}>
                    <div>
                        <div className={styles.actionHistory}>
                            <h4>Історія дій робітника по даному замовленню</h4>

                            <div className={styles.actionRow}>
                                {historyItems.length > 0 ? (
                                    historyItems.map((historyItem) => (
                                        <div key={historyItem.id}>
                                            <p>{historyItem.text}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div>
                                        <p># Замовлення № {orderNumber} / Історія відсутня</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {(isCutter || isSewer || isPacker) && (
                            <button
                                type="button"
                                className="btnDark"
                                onClick={openCompleteWorkPopup}
                                disabled={!canUpdateOrder || isFinishingWork}
                                style={{ marginTop: "20px", width: "100%" }}
                            >
                                <span>{isFinishingWork ? "Завершення..." : "Завершити роботу"}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showSidePopup && (
                <SidePopup title={"Задачі"} onClose={closeSidePopup} />
            )}

            {showCutterPopup && (
                <CutterFabricPopup
                    accessToken={token}
                    cutterId={currentUserId}
                    orderId={order?.id || routeOrderId}
                    onClose={closeCutterPopup}
                    onSuccess={async () => {
                        await refreshOrder();
                    }}
                />
            )}

            {showWarehouseItemPopup && (
                <WarehouseItemPopup
                    accessToken={token}
                    orderId={order?.id}
                    warehouseItemId={order?.warehouse_item?.id}
                    onClose={closeWarehouseItemPopup}
                    onSuccess={async () => {
                        const refreshedOrder = await fetchOrderById(
                            token,
                            routeOrderId || order?.id
                        );
                        setOrderData(refreshedOrder);
                    }}
                />
            )}
            {showCompleteWorkPopup && (
                <CompleteWorkPopup
                    onClose={closeCompleteWorkPopup}
                    onConfirm={
                        completeWorkRole === "packer"
                            ? handleCompletePackerWork
                            : completeWorkRole === "sewer"
                                ? handleCompleteSewerWork
                                : handleCompleteCutterWork
                    }
                    isSubmitting={isFinishingWork}
                    text={
                        completeWorkRole === "packer"
                            ? "Після завершення дане замовлення буде переведено в готовність до відправки."
                            : completeWorkRole === "sewer"
                                ? "Після завершення дане замовлення буде передано пакувальнику."
                                : "Після завершення дане замовлення буде передано швачці."
                    }
                />
            )}
        </div>
    );
};

export default Order;