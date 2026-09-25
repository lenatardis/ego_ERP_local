export const MAIN_TABS = [
    { value: "my", label: "Мої активні замовлення" },
    { value: "all", label: "Всі доступні замовлення" },
    { value: "shipment_ready", label: "Всі замовлення готові до відправки" },
    { value: "delivered", label: "Всі доставлені замовлення" },
];

export const ORDER_TYPE_TABS = [
    { value: "kit", label: "Комплекти" },
    { value: "warehouse_item", label: "Товари зі складу" },
];

export const STATUS_OPTIONS = [
    { value: "", name: "Всі" },
    { value: "NEW", name: "Нове" },
    { value: "IN_PROGRESS", name: "В роботі" },
    { value: "AWAITING_CUTTING", name: "Очікує крійки" },
    { value: "ON_CUT", name: "На крійці" },
    { value: "AWAITING_SEWING", name: "Очікує пошиття" },
    { value: "ON_SEWING", name: "На пошитті" },
    { value: "AWAITING_PACKAGING", name: "Очікує пакування" },
    { value: "IS_PACKED", name: "Запаковано" },
    { value: "SHIPMENT_READY", name: "Готово до відправки" },
    { value: "COMPLETED", name: "Завершено" },
];

export const getStoredAccessToken = () => {
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

export const getUserIdFromToken = (token) => {
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

export const normalizeOrdersResponse = (payload) => {
    if (Array.isArray(payload)) {
        return {
            results: payload,
            count: payload.length,
            next: null,
            previous: null,
        };
    }

    return {
        results: Array.isArray(payload?.results) ? payload.results : [],
        count: payload?.count ?? 0,
        next: payload?.next ?? null,
        previous: payload?.previous ?? null,
    };
};

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("uk-UA");
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

const normalizeImageUrl = (value) => {
    if (!value || typeof value !== "string") return "";

    const url = value.trim();
    if (!url) return "";

    return url;
};

const getImageUrl = (item) => {
    const kitImage = item?.kit?.fabric_image;
    if (typeof kitImage === "string" && kitImage.trim()) {
        return normalizeImageUrl(kitImage);
    }

    const warehouseImage = item?.warehouse_item?.image;
    if (typeof warehouseImage === "string" && warehouseImage.trim()) {
        return normalizeImageUrl(warehouseImage);
    }

    return "";
};

const getSetSizeValue = (item) => {
    const warehouseItemSize = getTextValue(item?.warehouse_item?.size);
    if (warehouseItemSize !== "—") return warehouseItemSize;

    const kitText = getTextValue(item?.kit);
    if (kitText !== "—") return kitText;

    const warehouseItemText = getTextValue(item?.warehouse_item);
    if (warehouseItemText !== "—") return warehouseItemText;

    return "—";
};

const getNameValue = (item) => {
    const kitName = getTextValue(item?.kit?.name);
    if (kitName !== "—") return kitName;

    const warehouseItemName = getTextValue(item?.warehouse_item?.name);
    if (warehouseItemName !== "—") return warehouseItemName;

    return getSetSizeValue(item);
};

const getCategoryValue = (item) => {
    return getTextValue(item?.warehouse_item?.category);
};

const getColorValue = (item) => {
    return getTextValue(item?.warehouse_item?.color);
};

const getCompletionValue = (item) => {
    if (!item?.kit || !Array.isArray(item.kit.component)) {
        return "";
    }

    const componentNames = item.kit.component
        .map((component) => {
            if (
                component?.name &&
                typeof component.name === "string" &&
                component.name.trim()
            ) {
                return component.name.trim();
            }

            return null;
        })
        .filter(Boolean);

    return [...new Set(componentNames)].join(", ");
};

const getOptionsValue = (item) => {
    if (!item?.kit || !Array.isArray(item.kit.option)) {
        return "";
    }

    const optionNames = item.kit.option
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

    return [...new Set(optionNames)].join(", ");
};

const getAssigneeId = (value) => {
    if (value && typeof value === "object") {
        return value.id ?? null;
    }

    return value ?? null;
};

export const mapOrderToRow = (item) => {
    const directCommentValue = getTextValue(item?.comment);

    return {
        id: item.id,
        type: item?.kit ? "kit" : item?.warehouse_item ? "warehouse_item" : "",
        orderNumber: item?.order?.id ? `#${item.order.id}` : `#${item.id}`,
        receivedDate: formatDate(item.created),
        imageUrl: getImageUrl(item),
        setSize: getSetSizeValue(item),
        nameValue: getNameValue(item),
        categoryValue: getCategoryValue(item),
        colorValue: getColorValue(item),
        completionValue: getCompletionValue(item),
        optionsValue: getOptionsValue(item),
        directCommentValue,
        comment:
            directCommentValue !== "—"
                ? directCommentValue
                : getTextValue(item?.warehouse_item?.comment),
        barcode: item?.barcode || "",
        cutter: getAssigneeId(item?.cutter),
        sewer: getAssigneeId(item?.sewer),
        packer: getAssigneeId(item?.packer),
        raw: item,
    };
};

export const filterRowsBySearch = (rows, search) => {
    const normalizedSearch = String(search || "").trim().toLowerCase();

    if (!normalizedSearch) {
        return rows;
    }

    return rows.filter((row) =>
        [
            row.id,
            row.orderNumber,
            row.receivedDate,
            row.nameValue,
            row.categoryValue,
            row.colorValue,
            row.setSize,
            row.completionValue,
            row.optionsValue,
            row.comment,
            row.directCommentValue,
            row.barcode,
        ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
    );
};

export const getDefaultAvailableStatus = ({ isCutter, isSewer, isPacker }) => {
    if (isCutter) return "AWAITING_CUTTING";
    if (isSewer) return "AWAITING_SEWING";
    if (isPacker) return "AWAITING_PACKAGING";
    return "";
};

export const getColumnTitles = ({ activeTab, activeOrderType }) => {
    if (activeOrderType === "warehouse_item") {
        return {
            thirdColumnTitle: "Назва товару",
            fourthColumnTitle: "Розмір",
        };
    }

    return {
        thirdColumnTitle:
            activeTab === "my" ? "Назва" : "Розмір комплекту",
        fourthColumnTitle: "Комплектація",
    };
};