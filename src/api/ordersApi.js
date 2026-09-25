import { refreshAccessToken } from "./authApi";

const API_BASE_URL = "https://dev.panel.egodevelopment.pp.ua/admin_panel/api/v1";

const handleUnauthorized = async (retryFunction) => {
    try {
        const newToken = await refreshAccessToken();
        if (newToken) {
            return retryFunction(newToken);
        }
    } catch (error) {
        console.error("Error refreshing access token:", error);
    }

    return null;
};

const handleResponse = async (response, retryFunction) => {
    if (response.status === 401 || response.statusText === "Unauthorized") {
        return await handleUnauthorized(retryFunction);
    }

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    if (response.status === 204) {
        return true;
    }

    return await response.json();
};

export const fetchOrders = async (
    token,
    {
        status,
        sewer,
        cutter,
        packer,
        user,
        search,
        page = 1,
        page_size,
        for_cutter,
        for_sewer,
        for_packer,
        only_kit,
        only_warehouse_item,
    } = {}
) => {
    try {
        const params = new URLSearchParams();

        if (status != null && String(status).trim() !== "") {
            params.append("status", String(status).trim());
        }
        if (sewer != null && String(sewer).trim() !== "") {
            params.append("sewer", String(sewer).trim());
        }
        if (cutter != null && String(cutter).trim() !== "") {
            params.append("cutter", String(cutter).trim());
        }
        if (packer != null && String(packer).trim() !== "") {
            params.append("packer", String(packer).trim());
        }
        if (user != null && String(user).trim() !== "") {
            params.append("user", String(user).trim());
        }
        if (search != null && String(search).trim() !== "") {
            params.append("search", String(search).trim());
        }
        if (page != null) {
            params.append("page", String(page));
        }
        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }

        if (for_cutter === true) {
            params.append("for_cutter", "true");
        }
        if (for_sewer === true) {
            params.append("for_sewer", "true");
        }
        if (for_packer === true) {
            params.append("for_packer", "true");
        }

        if (only_kit === true) {
            params.append("only_kit", "true");
        }
        if (only_warehouse_item === true) {
            params.append("only_warehouse_item", "true");
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/employees/workdesk/manufacturing/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchOrders(newToken, {
                status,
                sewer,
                search,
                cutter,
                packer,
                user,
                page,
                page_size,
                for_cutter,
                for_sewer,
                for_packer,
                only_kit,
                only_warehouse_item,
            })
        );
    } catch (error) {
        console.error("Error fetching orders:", error);
        return { results: [], count: 0, next: null, previous: null };
    }
};

export const fetchOrderById = async (token, id) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/employees/workdesk/manufacturing/${id}/`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            }
        );

        return await handleResponse(response, (newToken) =>
            fetchOrderById(newToken, id)
        );
    } catch (error) {
        console.error("Error fetching order by id:", error);
        return {};
    }
};

export const updateOrder = async (token, id, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/employees/workdesk/manufacturing/${id}/`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        return await handleResponse(response, (newToken) =>
            updateOrder(newToken, id, payload)
        );
    } catch (error) {
        console.error("Error updating order:", error);
        throw error;
    }
};

export const fetchWarehouseItemLocations = async (token, warehouseItemId) => {
    try {
        if (warehouseItemId == null) {
            throw new Error("fetchWarehouseItemLocations: warehouseItemId is required");
        }

        const params = new URLSearchParams();
        params.append("warehouse_item", String(warehouseItemId));

        const response = await fetch(
            `${API_BASE_URL}/employees/workdesk/warehouse-item/?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            }
        );

        return await handleResponse(response, (newToken) =>
            fetchWarehouseItemLocations(newToken, warehouseItemId)
        );
    } catch (error) {
        console.error("Error fetching warehouse item locations:", error);
        return {};
    }
};

export const searchWarehouseFabrics = async (token, fabricCode, signal) => {
    try {
        const params = new URLSearchParams();

        if (fabricCode !== undefined && fabricCode !== null && String(fabricCode).trim() !== "") {
            params.append("name", String(fabricCode).trim());
        }

        const url = `${API_BASE_URL}/warehouses/fabrics/?${params.toString()}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            signal,
        });

        return await handleResponse(response, (newToken) =>
            searchWarehouseFabrics(newToken, fabricCode, signal)
        );
    } catch (error) {
        if (error?.name !== "AbortError") {
            console.error("Error searching warehouse fabrics:", error);
        }
        return [];
    }
};

export const fetchFabricRollsForProduction = async (
    token,
    fabricId,
    { page = 1, page_size, status } = {},
    signal
) => {
    try {
        if (fabricId == null) throw new Error("fetchFabricRollsForProduction: fabricId is required");

        const params = new URLSearchParams();

        if (page != null) params.append("page", String(page));
        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }
        if (status != null && String(status).trim() !== "") {
            params.append("status", String(status).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/warehouses/fabrics/${fabricId}/fabric-rolls/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            signal,
        });

        return await handleResponse(response, (newToken) =>
            fetchFabricRollsForProduction(newToken, fabricId, { page, page_size, status }, signal)
        );
    } catch (error) {
        if (error?.name !== "AbortError") {
            console.error("Error fetching production fabric rolls:", error);
        }
        return {};
    }
};

export const createProductionCost = async (token, payload) => {
    try {
        const response = await fetch(`${API_BASE_URL}/production/costs/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        return await handleResponse(response, (newToken) =>
            createProductionCost(newToken, payload)
        );
    } catch (error) {
        console.error("Error creating production cost:", error);
        throw error;
    }
};