import {refreshAccessToken} from './authApi';

const API_BASE_URL = 'https://dev.panel.egodevelopment.pp.ua/admin_panel/api/v1';

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
    return await response.json();
};


//fabrics

export const getFabrics = async (
    token,
    {
        page = 1,
        type_id,
        name,
        new_fabricroll_remainder_min,
        new_fabricroll_remainder_max,
        in_stock
    } = {},
    signal
) => {
    try {
        const params = new URLSearchParams();
        params.append('page', page);
        if (in_stock === true) {
            params.append('in_stock', 'true');
        }
        if (in_stock === false) {
            params.append('in_stock', 'false');
        }

        if (type_id !== undefined && type_id !== null && type_id !== '') {
            params.append('type_id', type_id);
        }
        if (name !== undefined && name !== null && name !== '') {
            params.append('name', name);
        }
        if (new_fabricroll_remainder_min != null) {
            params.append('new_fabricroll_remainder_min', String(new_fabricroll_remainder_min));
        }
        if (new_fabricroll_remainder_max != null) {
            params.append('new_fabricroll_remainder_max', String(new_fabricroll_remainder_max));
        }

        const url = `${API_BASE_URL}/warehouses/fabrics/?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            signal
        });

        return await handleResponse(response, (newToken) =>
            getFabrics(newToken, {
                page,
                type_id,
                name,
                new_fabricroll_remainder_min,
                new_fabricroll_remainder_max,
                in_stock
            }, signal)
        );
    } catch (error) {
        if (error?.name !== 'AbortError') {
            console.error('Error fetching fabrics:', error);
        }
        return [];
    }
};

export const fetchFilters = async (token) => {
    try {
        const response = await fetch(`${API_BASE_URL}/warehouses/fabrics/types-tags/`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchFilters(newToken));
    } catch (error) {
        console.error("Error fetching filter list:", error);
        return [];
    }
};

//editable fabric table

export const fetchStandardLength = async (token) => {
    try {
        const response = await fetch(`${API_BASE_URL}/warehouses/fabric-rolls/standard-length/`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchStandardLength(newToken));
    } catch (error) {
        console.error("Error fetching standard length:", error);
        return [];
    }
};

export const fetchWarehouseStructure = async (token) => {
    try {
        const response = await fetch(`${API_BASE_URL}/warehouses/structure/`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchWarehouseStructure(newToken));
    } catch (error) {
        console.error("Error fetching warehouse structure:", error);
        return [];
    }
};

export const fetchVendors = async (
    token,
    {
        page = 1,
        page_size = 25,
        search,
        uah_dept_min,
        uah_dept_max,
        usd_dept_min,
        usd_dept_max
    } = {}
) => {
    try {
        const params = new URLSearchParams();

        params.append("page", String(page));
        params.append("page_size", String(page_size));

        if (search !== undefined && search !== null && String(search).trim() !== "") {
            params.append("search", String(search).trim());
        }

        if (uah_dept_min !== undefined && uah_dept_min !== null && String(uah_dept_min).trim() !== "") {
            const normalizedMin = String(uah_dept_min).replace(/\s/g, "").replace(",", ".");
            params.append("uah_dept_min", normalizedMin);
        }

        if (uah_dept_max !== undefined && uah_dept_max !== null && String(uah_dept_max).trim() !== "") {
            const normalizedMax = String(uah_dept_max).replace(/\s/g, "").replace(",", ".");
            params.append("uah_dept_max", normalizedMax);
        }

        if (usd_dept_min !== undefined && usd_dept_min !== null && String(usd_dept_min).trim() !== "") {
            const normalizedMin = String(usd_dept_min).replace(/\s/g, "").replace(",", ".");
            params.append("usd_dept_min", normalizedMin);
        }

        if (usd_dept_max !== undefined && usd_dept_max !== null && String(usd_dept_max).trim() !== "") {
            const normalizedMax = String(usd_dept_max).replace(/\s/g, "").replace(",", ".");
            params.append("usd_dept_max", normalizedMax);
        }

        const response = await fetch(`${API_BASE_URL}/vendor-invoices/vendors/?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchVendors(newToken, {
                page,
                page_size,
                search,
                uah_dept_min,
                uah_dept_max,
                usd_dept_min,
                usd_dept_max
            })
        );
    } catch (error) {
        console.error("Error fetching vendors:", error);
        return {
            vendors: [],
            total_count: 0,
            total_pages: 0,
            current_page: 1,
        };
    }
};

export const createVendor = async (token, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/vendor-invoices/vendors/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        return await handleResponse(response, (newToken) =>
            createVendor(newToken, payload)
        );
    } catch (error) {
        console.error("Error creating vendor:", error);
        throw error;
    }
};

export const editVendor = async (token, id, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/vendor-invoices/vendors/${id}/`,
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
            editVendor(newToken, id, payload)
        );
    } catch (error) {
        console.error("Error editing vendor:", error);
        throw error;
    }
};

export const deleteVendor = async (token, id) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/vendor-invoices/vendors/${id}/`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.status === 401) {
            return await handleResponse(response, (newToken) =>
                deleteVendor(newToken, id)
            );
        }

        if (!response.ok) {
            let data = null;

            try {
                data = await response.json();
            } catch { }

            const err = new Error("Delete vendor failed");
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return true;
    } catch (error) {
        console.error("Error deleting vendor:", error);
        throw error;
    }
};

export const createFabricArrival = async (token, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/fabric-arrivals/`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        return await handleResponse(response, (newToken) =>
            createFabricArrival(newToken, payload)
        );
    } catch (error) {
        console.error('Error creating fabric arrival:', error);
        throw error;
    }
};

export const fetchAllArrivals = async (token, paramsObj = { page: 1 }) => {
    try {
        const params = new URLSearchParams();

        Object.entries(paramsObj).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });

        const url = `${API_BASE_URL}/warehouses/fabric-arrivals/?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(
            response,
            (newToken) => fetchAllArrivals(newToken, paramsObj)
        );
    } catch (error) {
        console.error("Error fetching all arrivals:", error);
        return [];
    }
};

export const fetchSpecificArrival = async (token, value) => {
    try {
        const response = await fetch(`${API_BASE_URL}/warehouses/fabric-arrivals/${value}/`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchSpecificArrival(newToken, value));
    } catch (error) {
        console.error("Error fetching specific arrival:", error);
        return {};
    }
};

export const editSpecificArrival = async (token, id, payload) => {
    try {
        const url = `${API_BASE_URL}/warehouses/fabric-arrivals/${id}/`;
        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };
        const body = JSON.stringify(payload);

        console.log('[API PATCH] Body:', body);

        const response = await fetch(url, {method: 'PATCH', headers, body});
        return await handleResponse(response, (newToken) =>
            editSpecificArrival(newToken, id, payload)
        );
    } catch (error) {
        console.error('Error editing specific arrival:', error);
        throw error;
    }
};


export const fetchProductProperties = async (token) => {
    try {
        const response = await fetch(`${API_BASE_URL}/warehouses/warehouse-item-templates/properties`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchProductProperties(newToken));
    } catch (error) {
        console.error("Error fetching product properties:", error);
        return [];
    }
};

export const fetchProduct = async (token, value) => {
    try {
        const response = await fetch(`${API_BASE_URL}/warehouses/warehouse-item-templates/?name=${value}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchProduct(newToken, value));
    } catch (error) {
        console.error("Error fetching product:", error);
        return {};
    }
};

export const createNewFabric = async (token, body) => {
    let fd;
    if (body instanceof FormData) {
        fd = body;
    } else {
        fd = new FormData();
        if (body.name) fd.append('name', body.name);
        if (body.description != null && body.description !== '') fd.append('description', body.description);
        if (body.type != null) fd.append('type', String(body.type));
        (body.tags ?? []).forEach(tid => fd.append('tags', String(tid)));
        if (Array.isArray(body.mono_fabric_type)) {
            fd.append('mono_fabric_type', JSON.stringify(body.mono_fabric_type));
        }
        fd.append('is_available', body.is_available ? 'true' : 'false');
        if (body.image) fd.append('image', body.image);
    }

    const response = await fetch(`${API_BASE_URL}/warehouses/fabrics/`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
        body: fd,
    });

    if (response.status === 400) {
        let errorData = null;

        try {
            errorData = await response.clone().json();
        } catch (e) {
            errorData = null;
        }

        const nameErrors = errorData?.name;
        const hasDuplicateFabricError =
            Array.isArray(nameErrors) &&
            nameErrors.includes('Fabric with this code already exists');

        if (hasDuplicateFabricError) {
            const error = new Error('Fabric with this code already exists');
            error.code = 'FABRIC_ALREADY_EXISTS';
            error.data = errorData;
            throw error;
        }
    }

    return await handleResponse(response, (newToken) => createNewFabric(newToken, fd));
};

export const createNewProduct = async (token, body) => {
    let fd;
    if (body instanceof FormData) {
        fd = body;
    } else {
        fd = new FormData();
        if (body.name) fd.append('name', body.name);
        if (body.type != null) fd.append('category', String(body.type));
        if (body.image) fd.append('image', body.image);
    }

    const response = await fetch(`${API_BASE_URL}/warehouses/warehouse-item-templates/`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
        body: fd,
    });

    if (response.status === 400) {
        let errorData = null;

        try {
            errorData = await response.clone().json();
        } catch (e) {
            errorData = null;
        }

        const nameErrors = errorData?.name;
        const hasDuplicateProductError =
            Array.isArray(nameErrors) &&
            nameErrors.includes('WarehouseItemTemplate with this name and category already exists');

        if (hasDuplicateProductError) {
            const error = new Error('WarehouseItemTemplate with this name and category already exists');
            error.code = 'PRODUCT_ALREADY_EXISTS';
            error.data = errorData;
            throw error;
        }
    }

    return await handleResponse(response, (newToken) => createNewProduct(newToken, fd));
};

export const fetchFinishedProducts = async (
    token,
    { name, category, prices__color, prices__size, in_stock, page = 1 } = {}
) => {
    try {
        const params = new URLSearchParams();

        if (name !== undefined && name !== null && String(name).trim() !== '') {
            params.append('name', String(name).trim());
        }
        if (category !== undefined && category !== null && String(category).trim() !== '') {
            params.append('category', String(category).trim());
        }
        if (prices__color !== undefined && prices__color !== null && String(prices__color).trim() !== '') {
            params.append('color', String(prices__color).trim());
        }
        if (prices__size !== undefined && prices__size !== null && String(prices__size).trim() !== '') {
            params.append('size', String(prices__size).trim());
        }

        if (in_stock === true) {
            params.append('in_stock', 'true');
        }
        if (in_stock === false) {
            params.append('in_stock', 'false');
        }

        params.append('page', page);

        const qs = params.toString();
        const url = `${API_BASE_URL}/warehouses/warehouse-item-templates/${qs ? `?${qs}` : ''}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchFinishedProducts(newToken, {
                name,
                category,
                prices__color,
                prices__size,
                in_stock,
                page
            })
        );
    } catch (error) {
        console.error('Error fetching finished products:', error);
        return [];
    }
};

//private payments
export const getPrivatAccounts = async (
    token,
    {
        account,
        amount,
        counterparty,
        assignment,
        operation_type,
        money_type,
        is_linked,          // boolean | "true" | "false"
        datetime_range,     // "dd.mm.yyyy-dd.mm.yyyy" | { from, to }
        search,
        page = 1,
    } = {}
) => {
    try {
        const params = new URLSearchParams();

        const appendIf = (key, val) => {
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                params.append(key, String(val).trim());
            }
        };

        appendIf('account', account);
        appendIf('amount', amount);
        appendIf('counterparty', counterparty);
        appendIf('assignment', assignment);
        appendIf('operation_type', operation_type);
        appendIf('money_type', money_type);

        if (typeof is_linked === 'boolean') {
            params.append('is_linked', is_linked ? 'true' : 'false');
        } else if (
            typeof is_linked === 'string' &&
            ['true', 'false'].includes(is_linked.trim().toLowerCase())
        ) {
            params.append('is_linked', is_linked.trim().toLowerCase());
        }

        if (datetime_range) {
            const toDDMMYYYY = (d) => {
                if (typeof d === 'string') return d; // вважаємо, що вже dd.mm.yyyy
                const dt = new Date(d);
                const pad = (n) => String(n).padStart(2, '0');
                return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
            };

            if (typeof datetime_range === 'string' && datetime_range.trim() !== '') {
                params.append('datetime_range', datetime_range.trim());
            } else if (
                typeof datetime_range === 'object' &&
                datetime_range.from &&
                datetime_range.to
            ) {
                params.append(
                    'datetime_range',
                    `${toDDMMYYYY(datetime_range.from)}-${toDDMMYYYY(datetime_range.to)}`
                );
            }
        }

        appendIf('search', search);

        params.append('page', Number.isFinite(page) ? String(page) : '1');

        const qs = params.toString();
        const url = `${API_BASE_URL}/accounting/private${qs ? `?${qs}` : ''}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) =>
            getPrivatAccounts(newToken, {
                account,
                amount,
                counterparty,
                assignment,
                operation_type,
                money_type,
                is_linked,
                datetime_range,
                search,
                page,
            })
        );
    } catch (error) {
        console.error('Error fetching Privat accounts:', error);
        return [];
    }
};

export const getPrivatAccountById = async (token, id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/accounting/private/${id}/`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) =>
            getPrivatAccountById(newToken, id)
        );
    } catch (error) {
        console.error('Error fetching Privat account by id:', error);
        return null;
    }
};

export const fetchCRMPayments = async (
    token,
    {
        page = 1,
        page_size = 25,
        search,
        type,
        method,
        status,
        receipt_approved,
        paid_date,
        is_linked,
    } = {}
) => {
    try {
        const params = new URLSearchParams();

        params.append("page", String(page));
        params.append("page_size", String(page_size));

        if (search !== undefined && search !== null && String(search).trim() !== "") {
            params.append("search", String(search).trim());
        }

        if (type !== undefined && type !== null && type !== "") {
            params.append("type", type);
        }

        if (method !== undefined && method !== null && method !== "") {
            params.append("method", method);
        }

        if (status !== undefined && status !== null && status !== "") {
            params.append("status", status);
        }

        if (
            receipt_approved !== undefined &&
            receipt_approved !== null &&
            receipt_approved !== ""
        ) {
            params.append("receipt_approved", receipt_approved);
        }

        if (paid_date !== undefined && paid_date !== null && paid_date !== "") {
            params.append("paid_date", paid_date);
        }

        if (is_linked !== undefined && is_linked !== null && is_linked !== "") {
            params.append("is_linked", is_linked);
        }

        const response = await fetch(
            `${API_BASE_URL}/accounting/payment_bill/?${params.toString()}`,
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
            fetchCRMPayments(newToken, {
                page,
                page_size,
                search,
                type,
                method,
                status,
                receipt_approved,
                paid_date,
                is_linked,
            })
        );
    } catch (error) {
        console.error("Error fetching CRM payments:", error);
        return {
            payment_bills: [],
            total_count: 0,
            total_pages: 0,
            current_page: 1,
        };
    }
};

export const getSpecificCRMPayment = async (token, id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/accounting/payment_bill/${id}/`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            getSpecificCRMPayment(newToken, id)
        );
    } catch (error) {
        console.error("Error fetching specific CRM payment:", error);
        throw error;
    }
};

export const editCRMPayment = async (token, id, body) => {
    try {
        const response = await fetch(`${API_BASE_URL}/accounting/payment_bill/${id}/`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        return await handleResponse(response, (newToken) =>
            editCRMPayment(newToken, id, body)
        );
    } catch (error) {
        console.error("Error editing CRM payment:", error);
        throw error;
    }
};

export const fetchBillCoincidance = async (token, privatbank_payment_id) => {
    if (!Number.isInteger(privatbank_payment_id)) {
        throw new Error('privatbank_payment_id must be an integer');
    }

    const qs = new URLSearchParams({ privatbank_payment_id: String(privatbank_payment_id) }).toString();
    const url = `${API_BASE_URL}/accounting/payment_bill/coincidence?${qs}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchBillCoincidance(newToken, privatbank_payment_id)
        );
    } catch (error) {
        console.error('Error fetching bill coincidence:', error);
        return [];
    }
};

export const linkPrivatPaymentToBill = async (token, id, paymentBillId) => {
    // валідація параметрів
    if (!Number.isInteger(id)) {
        throw new Error('id must be an integer');
    }
    if (!Number.isInteger(paymentBillId)) {
        throw new Error('payment_bill must be an integer');
    }

    const url = `${API_BASE_URL}/accounting/private/${id}/`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };
    const payload = { payment_bill: paymentBillId };
    const body = JSON.stringify(payload);

    try {
        console.log('[API PATCH] /accounting/private/:id payload:', payload);

        const response = await fetch(url, {
            method: 'PATCH',
            headers,
            body,
        });

        return await handleResponse(response, (newToken) =>
            linkPrivatPaymentToBill(newToken, id, paymentBillId)
        );
    } catch (error) {
        console.error('Error linking privat payment to bill:', error);
        throw error;
    }
};

export const fetchAccounts = async (token) => {
    try {
        const response = await fetch(`${API_BASE_URL}/accounting/private/accounts`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchAccounts(newToken));
    } catch (error) {
        console.error("Error fetching accounts:", error);
        return [];
    }
};

/*pricelist*/

export const fetchPricelists = async (
    token,
    { page = 1, status, is_default, page_size, title } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (status !== undefined && status !== null && String(status).trim() !== "") {
            params.append("status", String(status).trim());
        }
        if (is_default !== undefined && is_default !== null && String(is_default).trim() !== "") {
            params.append("is_default", String(is_default).trim());
        }
        if (page_size !== undefined && page_size !== null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }


        if (title !== undefined && title !== null && String(title).trim() !== "") {
            params.append("title", String(title).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/warehouses/prices-lists/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchPricelists(newToken, { page, status, is_default, page_size, title })
        );
    } catch (error) {
        console.error("Error fetching pricelists:", error);
        return [];
    }
};


export const createPricelist = async (token, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/prices-lists/`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );


        if (response.status === 401) {
            return await handleResponse(response, (newToken) =>
                createPricelist(newToken, payload)
            );
        }

        if (!response.ok) {
            let data = null;
            try {
                data = await response.json();
            } catch {}
            const err = new Error('Create pricelist failed');
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating pricelist:', error);
        throw error;
    }
};

export const editPricelist = async (token, id, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/prices-lists/${id}/`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        if (response.status === 401) {
            return await handleResponse(response, (newToken) =>
                editPricelist(newToken, id, payload)
            );
        }

        if (!response.ok) {
            let data = null;
            try {
                data = await response.json();
            } catch {}
            const err = new Error('Edit pricelist failed');
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return await response.json();
    } catch (error) {
        console.error('Error editing pricelist:', error);
        throw error;
    }
};

export const deletePricelist = async (token, id) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/prices-lists/${id}/`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.status === 401) {
            return await handleResponse(response, (newToken) =>
                deletePricelist(newToken, id)
            );
        }

        if (!response.ok) {
            let data = null;
            try {
                data = await response.json();
            } catch {}

            const err = new Error("Delete pricelist failed");
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return true;
    } catch (error) {
        console.error("Error deleting pricelist:", error);
        throw error;
    }
};


export const fetchSources = async (
    token,
    { page = 1, is_deleted = false, page_size, name } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (is_deleted !== undefined && is_deleted !== null) {
            params.append("is_deleted", String(is_deleted));
        }

        if (page_size !== undefined && page_size !== null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }

        if (name !== undefined && name !== null && String(name).trim() !== "") {
            params.append("name", String(name).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/warehouses/sources/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchSources(newToken, { page, is_deleted, page_size, name })
        );
    } catch (error) {
        console.error("Error fetching sources:", error);
        return [];
    }
};

export const createSource = async (token, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/sources/`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        return await handleResponse(response, (newToken) =>
            createSource(newToken, payload)
        );
    } catch (error) {
        console.error('Error creating sources:', error);
        throw error;
    }
};

export const editSource = async (token, id, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/sources/${id}/`,
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
            editSource(newToken, id, payload)
        );
    } catch (error) {
        console.error("Error editing source:", error);
        throw error;
    }
};

export const deleteSource = async (token, id, options = {}) => {
    const { ignoreWarning = false } = options;

    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/sources/${id}/?ignore_warning=${ignoreWarning}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.status === 204 || response.status === 200 || response.status === 202) {
            return true;
        }

        if (response.status === 400) {
            let data = null;

            try {
                data = await response.json();
            } catch {
                data = null;
            }

            const error = new Error(data?.error || "Не вдалося видалити джерело");
            error.status = 400;
            error.data = data;
            throw error;
        }

        return await handleResponse(response, (newToken) =>
            deleteSource(newToken, id, { ignoreWarning })
        );
    } catch (error) {
        console.error("Error deleting source:", error);
        throw error;
    }
};

export const fetchCurrentCashRate = async (token) => {
    try {
        const response = await fetch(`${API_BASE_URL}/warehouses/fabric-arrivals/currencies/`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchCurrentCashRate(newToken));
    } catch (error) {
        console.error("Error fetching current cash rate:", error);
        return {};
    }
};

/* items' prices */

export const fetchPricesItems = async (
    token,
    {
        managerId,
        pricesListId,
        isDeleted,
        isWarehouseItemType,
        isKit,
        isKitOption,
        isKitComponent,
        isKitComponentOption,
        page = 1,
        pageSize,
        name,
        hasPrice,
    } = {}
) => {
    try {
        const params = new URLSearchParams();

        if (managerId != null) params.append('manager_id', managerId);
        if (pricesListId != null) params.append('prices_list_id', pricesListId);
        if (isDeleted != null) params.append('is_deleted', String(isDeleted));

        if (isWarehouseItemType != null) {
            params.append('is_warehouse_item_type', String(isWarehouseItemType));
        }
        if (isKit != null) params.append('is_kit', String(isKit));
        if (isKitOption != null) params.append('is_kit_option', String(isKitOption));
        if (isKitComponent != null) params.append('is_kit_component', String(isKitComponent));
        if (isKitComponentOption != null) {
            params.append('is_kit_component_option', String(isKitComponentOption));
        }

        if (page != null) params.append('page', String(page));
        if (pageSize != null) params.append('page_size', String(pageSize));

        if (name) params.append('name', name);
        if (hasPrice != null) params.append('has_price', String(hasPrice));

        const query = params.toString();
        const url = `${API_BASE_URL}/warehouses/prices/items/${query ? `?${query}` : ''}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchPricesItems(newToken, {
                managerId,
                pricesListId,
                isDeleted,
                isWarehouseItemType,
                isKit,
                isKitOption,
                isKitComponent,
                isKitComponentOption,
                page,
                pageSize,
                name,
                hasPrice,
            })
        );
    } catch (error) {
        console.error("Error fetching prices items:", error);
        return [];
    }
};

export const addPrice = async (token, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/prices/`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        return await handleResponse(response, (newToken) =>
            addPrice(newToken, payload)
        );
    } catch (error) {
        console.error('Error adding prices:', error);
        throw error;
    }
};

export const editPrice = async (token, id, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/warehouses/prices/${id}/`,
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
            editPrice(newToken, id, payload)
        );
    } catch (error) {
        console.error("Error editing price:", error);
        throw error;
    }
};

export const deletePrice = async (token, id) => {
    try {
        const url = `${API_BASE_URL}/warehouses/prices/${id}/`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => deletePrice(newToken, id));

    } catch (error) {
        console.error('Error deleting price:', error);
        throw error;
    }
};

export const createCostPrice = async (token, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/production/cost_prices/`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        return await handleResponse(response, (newToken) =>
            createCostPrice(newToken, payload)
        );
    } catch (error) {
        console.error('Error creating cost price:', error);
        throw error;
    }
};

export const editCostPrice = async (token, id, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/production/cost_prices/${id}/`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        return await handleResponse(response, (newToken) =>
            editCostPrice(newToken, id, payload)
        );
    } catch (error) {
        console.error('Error editing cost price:', error);
        throw error;
    }
};

export const deleteCostPrice = async (token, id) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/production/cost_prices/${id}/`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            }
        );

        if ([200, 202, 204].includes(response.status)) {
            return true;
        }

        return await handleResponse(response, (newToken) =>
            deleteCostPrice(newToken, id)
        );
    } catch (error) {
        console.error("Error deleting cost price:", error);
        throw error;
    }
};

// component option templates

export const fetchComponentOptionTemplates = async (
    token,
    { page = 1, page_size, name, type_ids, part_ids, is_deleted } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }
        if (name != null && String(name).trim() !== "") {
            params.append("name", String(name).trim());
        }

        // NEW: бек чекає саме ці ключі
        if (type_ids != null && String(type_ids).trim() !== "") {
            params.append("type_ids", String(type_ids).trim()); // "1,2,3"
        }
        if (part_ids != null && String(part_ids).trim() !== "") {
            params.append("part_ids", String(part_ids).trim()); // "4,7"
        }

        if (is_deleted != null && String(is_deleted).trim() !== "") {
            params.append("is_deleted", String(is_deleted).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/calculator/component-option-templates/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchComponentOptionTemplates(newToken, { page, page_size, name, type_ids, part_ids, is_deleted })
        );
    } catch (error) {
        console.error("Error fetching component option templates:", error);
        return [];
    }
};


// calculator: component types
export const fetchComponentTypes = async (
    token,
    { page = 1, page_size, name, is_deleted } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }
        if (name != null && String(name).trim() !== "") {
            params.append("name", String(name).trim());
        }
        if (is_deleted != null && String(is_deleted).trim() !== "") {
            params.append("is_deleted", String(is_deleted).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/calculator/component-types/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchComponentTypes(newToken, { page, page_size, name, is_deleted })
        );
    } catch (error) {
        console.error("Error fetching component types:", error);
        return [];
    }
};

// calculator: option parts
export const fetchOptionParts = async (
    token,
    { page = 1, page_size, name, is_deleted, type } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }
        if (name != null && String(name).trim() !== "") {
            params.append("name", String(name).trim());
        }
        if (is_deleted != null && String(is_deleted).trim() !== "") {
            params.append("is_deleted", String(is_deleted).trim());
        }
        if (type != null && String(type).trim() !== "") {
            params.append("type", String(type).trim()); // component | kit
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/calculator/option-parts/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchOptionParts(newToken, { page, page_size, name, is_deleted, type })
        );
    } catch (error) {
        console.error("Error fetching option parts:", error);
        return [];
    }
};

// calculator: create component option template
export const createComponentOptionTemplate = async (token, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/calculator/component-option-templates/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        return await handleResponse(response, (newToken) =>
            createComponentOptionTemplate(newToken, payload)
        );
    } catch (error) {
        console.error("Error creating component option template:", error);
        throw error;
    }
};

// calculator: edit component option template
export const editComponentOptionTemplate = async (token, id, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/calculator/component-option-templates/${id}/`,
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
            editComponentOptionTemplate(newToken, id, payload)
        );
    } catch (error) {
        console.error("Error editing component option template:", error);
        throw error;
    }
};

// calculator: delete component option template
export const deleteComponentOptionTemplate = async (token, id) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/calculator/component-option-templates/${id}/`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            }
        );

        // DRF зазвичай повертає 204 No Content на delete
        if ([200, 202, 204].includes(response.status)) {
            return true;
        }

        return await handleResponse(response, (newToken) =>
            deleteComponentOptionTemplate(newToken, id)
        );
    } catch (error) {
        console.error("Error deleting component option template:", error);
        throw error;
    }
};

// calculator: option parts (create)
export const createOptionPart = async (token, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/calculator/option-parts/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload), // { name, type }
            }
        );

        return await handleResponse(response, (newToken) =>
            createOptionPart(newToken, payload)
        );
    } catch (error) {
        console.error("Error creating option part:", error);
        throw error;
    }
};

// calculator: option parts (edit)
export const editOptionPart = async (token, id, payload) => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/calculator/option-parts/${id}/`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload), // { name, type }
            }
        );

        return await handleResponse(response, (newToken) =>
            editOptionPart(newToken, id, payload)
        );
    } catch (error) {
        console.error("Error editing option part:", error);
        throw error;
    }
};

// calculator: option parts (delete)
export const deleteOptionPart = async (token, id, type) => {
    try {
        if (!id) throw new Error("deleteOptionPart: id is required");

        const qs = new URLSearchParams();
        // бек просить type -> передаємо як query
        if (type != null && String(type).trim() !== "") {
            qs.append("type", String(type).trim()); // "component" | "kit"
        }

        const url = `${API_BASE_URL}/calculator/option-parts/${id}/${qs.toString() ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        if ([200, 202, 204].includes(response.status)) return true;

        return await handleResponse(response, (newToken) => deleteOptionPart(newToken, id, type));
    } catch (error) {
        console.error("Error deleting option part:", error);
        throw error;
    }
};

// calculator: kit option templates

export const fetchKitOptionTemplates = async (
    token,
    { page = 1, page_size, name, is_deleted } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }
        if (name != null && String(name).trim() !== "") {
            params.append("name", String(name).trim());
        }
        if (is_deleted != null && String(is_deleted).trim() !== "") {
            params.append("is_deleted", String(is_deleted).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/calculator/kit-option-templates/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchKitOptionTemplates(newToken, { page, page_size, name, is_deleted })
        );
    } catch (error) {
        console.error("Error fetching kit option templates:", error);
        return [];
    }
};

export const createKitOptionTemplate = async (token, payload) => {
    try {
        // payload: { name, description, partIds: number[], imageFile?: File|null }
        const fd = new FormData();
        fd.append("name", payload.name);
        if (payload.description != null) fd.append("description", String(payload.description));

        // бек очікує part як string (приклад: [1,2,3])
        const partArr = Array.isArray(payload.partIds) ? payload.partIds.map((x) => Number(x)) : [];
        fd.append("part", JSON.stringify(partArr));

        if (payload.imageFile instanceof File) {
            fd.append("image", payload.imageFile);
        }

        const response = await fetch(`${API_BASE_URL}/calculator/kit-option-templates/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            body: fd,
        });

        return await handleResponse(response, (newToken) =>
            createKitOptionTemplate(newToken, payload)
        );
    } catch (error) {
        console.error("Error creating kit option template:", error);
        throw error;
    }
};

export const editKitOptionTemplate = async (token, id, payload) => {
    try {
        // payload: { name, description, partIds: number[], imageFile?: File|null }
        const fd = new FormData();
        fd.append("name", payload.name);
        if (payload.description != null) fd.append("description", String(payload.description));

        const partArr = Array.isArray(payload.partIds) ? payload.partIds.map((x) => Number(x)) : [];
        fd.append("part", JSON.stringify(partArr));

        // якщо файл не вибраний — НЕ апендимо image, щоб бек залишив старе
        if (payload.imageFile instanceof File) {
            fd.append("image", payload.imageFile);
        }

        const response = await fetch(`${API_BASE_URL}/calculator/kit-option-templates/${id}/`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            body: fd,
        });

        return await handleResponse(response, (newToken) =>
            editKitOptionTemplate(newToken, id, payload)
        );
    } catch (error) {
        console.error("Error editing kit option template:", error);
        throw error;
    }
};

export const deleteKitOptionTemplate = async (token, id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/calculator/kit-option-templates/${id}/`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        if ([200, 202, 204].includes(response.status)) return true;

        return await handleResponse(response, (newToken) =>
            deleteKitOptionTemplate(newToken, id)
        );
    } catch (error) {
        console.error("Error deleting kit option template:", error);
        throw error;
    }
};

// calculator: component types (create)
export const createComponentType = async (token, data) => {
    try {
        let fd;
        if (data instanceof FormData) {
            fd = data;
        } else {
            fd = new FormData();
            if (data?.name != null && String(data.name).trim() !== '') {
                fd.append('name', String(data.name).trim());
            }
            if (data?.mono_fabric_type != null && String(data.mono_fabric_type).trim() !== '') {
                fd.append('mono_fabric_type', String(data.mono_fabric_type).trim());
            }

            // file input: очікуємо File
            if (data?.image instanceof File) {
                fd.append('image', data.image);
            } else if (data?.image != null) {
                // якщо раптом прилетить не File — все одно передамо як строку (бек може ігнорити)
                fd.append('image', String(data.image));
            }
        }

        const response = await fetch(`${API_BASE_URL}/calculator/component-types/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            body: fd,
        });

        return await handleResponse(response, (newToken) => createComponentType(newToken, fd));
    } catch (error) {
        console.error('Error creating component type:', error);
        throw error;
    }
};

// calculator: component types (edit)
export const editComponentType = async (token, id, data) => {
    try {
        let fd;
        if (data instanceof FormData) {
            fd = data;
        } else {
            fd = new FormData();

            if (data?.name != null && String(data.name).trim() !== '') {
                fd.append('name', String(data.name).trim());
            }
            if (data?.mono_fabric_type != null && String(data.mono_fabric_type).trim() !== '') {
                fd.append('mono_fabric_type', String(data.mono_fabric_type).trim());
            }

            // якщо файл не вибраний — не апендимо, щоб бек лишив старе (як у твоєму createNewFabric)
            if (data?.image instanceof File) {
                fd.append('image', data.image);
            } else if (data?.image != null) {
                fd.append('image', String(data.image));
            }
        }

        const response = await fetch(`${API_BASE_URL}/calculator/component-types/${id}/`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            body: fd,
        });

        return await handleResponse(response, (newToken) => editComponentType(newToken, id, fd));
    } catch (error) {
        console.error('Error editing component type:', error);
        throw error;
    }
};

// calculator: component types (delete)
export const deleteComponentType = async (token, id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/calculator/component-types/${id}/`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        // успішні відповіді на delete
        if ([200, 202, 204].includes(response.status)) {
            return true;
        }

        return await handleResponse(response, (newToken) => deleteComponentType(newToken, id));
    } catch (error) {
        console.error('Error deleting component type:', error);
        throw error;
    }
};

// =====================
// CRM base url (тільки для products/type)
// =====================
const CRM_BASE_URL = 'https://dev.panel.egodevelopment.pp.ua/api/v1';

// products/type (CRM)
export const fetchProductTypesCRM = async (token) => {
    try {
        const response = await fetch(`${CRM_BASE_URL}/products/type/`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        return await handleResponse(response, (newToken) => fetchProductTypesCRM(newToken));
    } catch (error) {
        console.error('Error fetching product types (CRM):', error);
        return [];
    }
};

// calculator: component templates

// GET /calculator/component-templates/

export const fetchComponentTemplates = async (
    token,
    { page = 1, page_size, name, short_name, is_deleted, type_id, fabric_type_id } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }
        if (name != null && String(name).trim() !== "") {
            params.append("name", String(name).trim());
        }
        if (short_name != null && String(short_name).trim() !== "") {
            params.append("short_name", String(short_name).trim());
        }
        if (is_deleted != null && String(is_deleted).trim() !== "") {
            params.append("is_deleted", String(is_deleted).trim());
        }

        // ВАЖЛИВО: саме ці ключі бек і чекає
        if (type_id != null && String(type_id).trim() !== "") {
            params.append("type_id", String(type_id).trim());
        }
        if (fabric_type_id != null && String(fabric_type_id).trim() !== "") {
            params.append("fabric_type_id", String(fabric_type_id).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/calculator/component-templates/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchComponentTemplates(newToken, {
                page,
                page_size,
                name,
                short_name,
                is_deleted,
                type_id,
                fabric_type_id,
            })
        );
    } catch (error) {
        console.error("Error fetching component templates:", error);
        return [];
    }
};


// helpers for FormData
const appendIfNotEmpty = (fd, key, val) => {
    if (val == null) return;
    const s = String(val).trim();
    if (s === '') return;
    fd.append(key, s);
};

const appendIfInt = (fd, key, val) => {
    if (val == null) return;
    const s = String(val).trim();
    if (s === '') return;
    const n = Number(s);
    if (!Number.isFinite(n)) return;
    fd.append(key, String(Math.trunc(n)));
};

// POST /calculator/component-templates/
export const createComponentTemplate = async (token, payload) => {
    try {
        const fd = new FormData();

        appendIfNotEmpty(fd, 'name', payload?.name);
        appendIfNotEmpty(fd, 'short_name', payload?.short_name);
        appendIfNotEmpty(fd, 'size', payload?.size);

        appendIfInt(fd, 'fabric_a_count', payload?.fabric_a_count);
        appendIfInt(fd, 'fabric_b_count', payload?.fabric_b_count);

        // selects: очікуємо id
        appendIfInt(fd, 'type', payload?.type);
        appendIfInt(fd, 'fabric_type', payload?.fabric_type);

        if (payload?.image instanceof File) {
            fd.append('image', payload.image);
        }

        const response = await fetch(`${API_BASE_URL}/calculator/component-templates/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            body: fd,
        });

        return await handleResponse(response, (newToken) =>
            createComponentTemplate(newToken, payload)
        );
    } catch (error) {
        console.error('Error creating component template:', error);
        throw error;
    }
};


// PATCH /calculator/component-templates/{id}/
export const editComponentTemplate = async (token, id, payload) => {
    try {
        const fd = new FormData();

        appendIfNotEmpty(fd, 'name', payload?.name);
        appendIfNotEmpty(fd, 'short_name', payload?.short_name);

        // size може бути nullable — якщо хочеш дозволити “очистити”, передавай явно ''
        // а тут ми пусте НЕ апендимо, щоб бек лишив старе:
        appendIfNotEmpty(fd, 'size', payload?.size);

        appendIfInt(fd, 'fabric_a_count', payload?.fabric_a_count);
        appendIfInt(fd, 'fabric_b_count', payload?.fabric_b_count);

        appendIfInt(fd, 'type', payload?.type);
        appendIfInt(fd, 'fabric_type', payload?.fabric_type);

        // якщо файл не вибраний — не апендимо image
        if (payload?.image instanceof File) {
            fd.append('image', payload.image);
        }

        const response = await fetch(`${API_BASE_URL}/calculator/component-templates/${id}/`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            body: fd,
        });

        return await handleResponse(response, (newToken) =>
            editComponentTemplate(newToken, id, payload)
        );
    } catch (error) {
        console.error('Error editing component template:', error);
        throw error;
    }
};


// DELETE /calculator/component-templates/{id}/
export const deleteComponentTemplate = async (token, id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/calculator/component-templates/${id}/`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        if ([200, 202, 204].includes(response.status)) return true;

        return await handleResponse(response, (newToken) =>
            deleteComponentTemplate(newToken, id)
        );
    } catch (error) {
        console.error('Error deleting component template:', error);
        throw error;
    }
};

// =====================
// calculator: kit sizes
// =====================

// GET /calculator/kit-sizes/
// calculator: kit sizes

export const fetchKitSizes = async (
    token,
    { page = 1, page_size, name, short_name, is_deleted } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }
        if (name != null && String(name).trim() !== "") {
            params.append("name", String(name).trim());
        }
        if (short_name != null && String(short_name).trim() !== "") {
            params.append("short_name", String(short_name).trim());
        }
        if (is_deleted != null && String(is_deleted).trim() !== "") {
            params.append("is_deleted", String(is_deleted).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/calculator/kit-sizes/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchKitSizes(newToken, { page, page_size, name, short_name, is_deleted })
        );
    } catch (error) {
        console.error("Error fetching kit sizes:", error);
        return [];
    }
};

export const createKitSize = async (token, payload) => {
    try {
        const response = await fetch(`${API_BASE_URL}/calculator/kit-sizes/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: payload?.name,
                short_name: payload?.short_name,
            }),
        });

        return await handleResponse(response, (newToken) =>
            createKitSize(newToken, payload)
        );
    } catch (error) {
        console.error("Error creating kit size:", error);
        throw error;
    }
};

export const editKitSize = async (token, id, payload) => {
    try {
        const response = await fetch(`${API_BASE_URL}/calculator/kit-sizes/${id}/`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: payload?.name,
                short_name: payload?.short_name,
            }),
        });

        return await handleResponse(response, (newToken) =>
            editKitSize(newToken, id, payload)
        );
    } catch (error) {
        console.error("Error editing kit size:", error);
        throw error;
    }
};

export const deleteKitSize = async (token, id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/calculator/kit-sizes/${id}/`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        if ([200, 202, 204].includes(response.status)) return true;

        return await handleResponse(response, (newToken) =>
            deleteKitSize(newToken, id)
        );
    } catch (error) {
        console.error("Error deleting kit size:", error);
        throw error;
    }
};

// =====================
// calculator: kit templates
// =====================

export const fetchKitTemplates = async (
    token,
    { page = 1, page_size, name, short_name, is_deleted } = {}
) => {
    try {
        const params = new URLSearchParams();
        params.append("page", String(page));

        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }
        if (name != null && String(name).trim() !== "") {
            params.append("name", String(name).trim());
        }
        if (short_name != null && String(short_name).trim() !== "") {
            params.append("short_name", String(short_name).trim());
        }
        if (is_deleted != null && String(is_deleted).trim() !== "") {
            params.append("is_deleted", String(is_deleted).trim());
        }

        const qs = params.toString();
        const url = `${API_BASE_URL}/calculator/kit-templates/${qs ? `?${qs}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        return await handleResponse(response, (newToken) =>
            fetchKitTemplates(newToken, { page, page_size, name, short_name, is_deleted })
        );
    } catch (error) {
        console.error("Error fetching kit templates:", error);
        return [];
    }
};

export const createKitTemplate = async (token, payload) => {
    try {
        const fd = new FormData();

        if (payload?.name != null) fd.append("name", String(payload.name));
        if (payload?.short_name != null) fd.append("short_name", String(payload.short_name));

        if (payload?.additional_fabric_consumption_price != null && String(payload.additional_fabric_consumption_price).trim() !== "") {
            fd.append("additional_fabric_consumption_price", String(payload.additional_fabric_consumption_price));
        }

        // бек назвав "component_size", але по факту це масив id component_templates
        if (Array.isArray(payload?.component_size)) {
            fd.append("component_size", JSON.stringify(payload.component_size.map((x) => Number(x))));
        }

        if (payload?.template != null && String(payload.template).trim() !== "") {
            fd.append("template", String(payload.template)); // id kit size
        }

        if (payload?.fabric_type != null && String(payload.fabric_type).trim() !== "") {
            fd.append("fabric_type", String(payload.fabric_type)); // id з fetchProductTypesCRM
        }

        if (payload?.image instanceof File) {
            fd.append("image", payload.image);
        }

        const response = await fetch(`${API_BASE_URL}/calculator/kit-templates/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            body: fd,
        });

        return await handleResponse(response, (newToken) => createKitTemplate(newToken, payload));
    } catch (error) {
        console.error("Error creating kit template:", error);
        throw error;
    }
};

export const editKitTemplate = async (token, id, payload) => {
    try {
        const fd = new FormData();

        if (payload?.name != null) fd.append("name", String(payload.name));
        if (payload?.short_name != null) fd.append("short_name", String(payload.short_name));

        if (payload?.additional_fabric_consumption_price != null && String(payload.additional_fabric_consumption_price).trim() !== "") {
            fd.append("additional_fabric_consumption_price", String(payload.additional_fabric_consumption_price));
        }

        if (Array.isArray(payload?.component_size)) {
            fd.append("component_size", JSON.stringify(payload.component_size.map((x) => Number(x))));
        }

        if (payload?.template != null && String(payload.template).trim() !== "") {
            fd.append("template", String(payload.template));
        }

        if (payload?.fabric_type != null && String(payload.fabric_type).trim() !== "") {
            fd.append("fabric_type", String(payload.fabric_type));
        }

        // якщо файл не вибраний — не апендимо image, щоб бек лишив старе
        if (payload?.image instanceof File) {
            fd.append("image", payload.image);
        }

        const response = await fetch(`${API_BASE_URL}/calculator/kit-templates/${id}/`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            body: fd,
        });

        return await handleResponse(response, (newToken) => editKitTemplate(newToken, id, payload));
    } catch (error) {
        console.error("Error editing kit template:", error);
        throw error;
    }
};

export const deleteKitTemplate = async (token, id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/calculator/kit-templates/${id}/`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        if ([200, 202, 204].includes(response.status)) return true;

        return await handleResponse(response, (newToken) => deleteKitTemplate(newToken, id));
    } catch (error) {
        console.error("Error deleting kit template:", error);
        throw error;
    }
};

export const fetchFabricRolls = async (
    token,
    fabricId,
    { page = 1, page_size, status = ["NEW", "OPENED"] } = {},
    signal
) => {
    try {
        if (fabricId == null) throw new Error("fetchFabricRolls: fabricId is required");

        const params = new URLSearchParams();
        if (page != null) params.append("page", String(page));
        if (page_size != null && String(page_size).trim() !== "") {
            params.append("page_size", String(page_size).trim());
        }

        if (Array.isArray(status)) {
            status.forEach((item) => {
                if (item != null && String(item).trim() !== "") {
                    params.append("status", String(item).trim());
                }
            });
        } else if (status != null && String(status).trim() !== "") {
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
            fetchFabricRolls(newToken, fabricId, { page, page_size, status }, signal)
        );
    } catch (error) {
        if (error?.name !== "AbortError") {
            console.error("Error fetching fabric rolls:", error);
        }
        return {};
    }
};
// vendor payments
export const getVendorPayments = async (
    token,
    {
        page = 1,
        page_size = 25,
        search,
        source,
        operation_date,
        payer_account,
        recipient_account,
        payer,
        vendor,
        exchange_rate,
        fabric_arrival,
        status,
        document_num,
        uah_amount_min,
        uah_amount_max,
        usd_amount_min,
        usd_amount_max
    } = {}
) => {
    try {
        const params = new URLSearchParams();

        params.append("page", String(page));
        params.append("page_size", String(page_size));

        if (source !== undefined && source !== null && source !== "") {
            params.append("source", source);
        }

        if (operation_date !== undefined && operation_date !== null && operation_date !== "") {
            params.append("operation_date", operation_date);
        }

        if (payer_account !== undefined && payer_account !== null && payer_account !== "") {
            params.append("payer_account", payer_account);
        }

        if (search !== undefined && search !== null && String(search).trim() !== "") {
            params.append("search", String(search).trim());
        }

        if (recipient_account !== undefined && recipient_account !== null && recipient_account !== "") {
            params.append("recipient_account", recipient_account);
        }

        if (payer !== undefined && payer !== null && payer !== "") {
            params.append("payer", payer);
        }

        if (vendor !== undefined && vendor !== null && vendor !== "") {
            params.append("vendor", vendor);
        }

        if (exchange_rate !== undefined && exchange_rate !== null && exchange_rate !== "") {
            params.append("exchange_rate", exchange_rate);
        }

        if (fabric_arrival !== undefined && fabric_arrival !== null && fabric_arrival !== "") {
            params.append("fabric_arrival", fabric_arrival);
        }

        if (status !== undefined && status !== null && status !== "") {
            params.append("status", status);
        }

        if (document_num !== undefined && document_num !== null && document_num !== "") {
            params.append("document_num", document_num);
        }

        if (uah_amount_min !== undefined && uah_amount_min !== null && String(uah_amount_min).trim() !== "") {
            const normalizedMin = String(uah_amount_min).replace(/\s/g, "").replace(",", ".");
            params.append("uah_amount_min", normalizedMin);
        }

        if (uah_amount_max !== undefined && uah_amount_max !== null && String(uah_amount_max).trim() !== "") {
            const normalizedMax = String(uah_amount_max).replace(/\s/g, "").replace(",", ".");
            params.append("uah_amount_max", normalizedMax);
        }

        if (usd_amount_min !== undefined && usd_amount_min !== null && String(usd_amount_min).trim() !== "") {
            const normalizedMin = String(usd_amount_min).replace(/\s/g, "").replace(",", ".");
            params.append("usd_amount_min", normalizedMin);
        }

        if (usd_amount_max !== undefined && usd_amount_max !== null && String(usd_amount_max).trim() !== "") {
            const normalizedMax = String(usd_amount_max).replace(/\s/g, "").replace(",", ".");
            params.append("usd_amount_max", normalizedMax);
        }

        const response = await fetch(
            `${API_BASE_URL}/vendor-invoices/payments/?${params.toString()}`,
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
            getVendorPayments(newToken, {
                page,
                page_size,
                search,
                source,
                operation_date,
                payer_account,
                recipient_account,
                payer,
                vendor,
                exchange_rate,
                fabric_arrival,
                status,
                document_num,
                uah_amount_min,
                uah_amount_max,
                usd_amount_min,
                usd_amount_max
            })
        );
    } catch (error) {
        console.error("Error fetching vendor payments:", error);
        return {
            vendor_payments: [],
            total_count: 0,
            total_pages: 0,
            current_page: 1,
        };
    }
};

export const createVendorPayment = async (token, body) => {
  try {
    let fd;

    if (body instanceof FormData) {
      fd = body;
    } else {
      fd = new FormData();

      if (body.source != null && body.source !== "") {
        fd.append("source", body.source);
      }

      if (body.operation_date != null && body.operation_date !== "") {
        fd.append("operation_date", body.operation_date);
      }

      if (body.vendor != null && body.vendor !== "") {
        fd.append("vendor", String(body.vendor));
      }

      if (body.fabric_arrival != null && body.fabric_arrival !== "") {
        fd.append("fabric_arrival", String(body.fabric_arrival));
      }

      if (body.document) {
        fd.append("document", body.document);
      }


      if (body.payer_account != null && body.payer_account !== "") {
        fd.append("payer_account", body.payer_account);
      }

      if (body.recipient_account != null && body.recipient_account !== "") {
        fd.append("recipient_account", body.recipient_account);
      }

      if (body.payer != null && body.payer !== "") {
        fd.append("payer", body.payer);
      }

        if (body.uah_amount != null && String(body.uah_amount).trim() !== "") {
            fd.append("uah_amount", String(body.uah_amount).replace(/\s/g, "").replace(",", "."));
        }

        if (body.usd_amount != null && String(body.usd_amount).trim() !== "") {
            fd.append("usd_amount", String(body.usd_amount).replace(/\s/g, "").replace(",", "."));
        }

      if (body.exchange_rate != null && String(body.exchange_rate).trim() !== "") {
        fd.append("exchange_rate", String(body.exchange_rate).replace(/\s/g, "").replace(",", "."));
      }

      if (body.comment != null && body.comment !== "") {
        fd.append("comment", body.comment);
      }

      if (body.status != null && body.status !== "") {
        fd.append("status", body.status);
      }
    }

    const response = await fetch(`${API_BASE_URL}/vendor-invoices/payments/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: fd,
    });

    return await handleResponse(response, (newToken) =>
      createVendorPayment(newToken, fd)
    );
  } catch (error) {
    console.error("Error creating vendor payment:", error);
    throw error;
  }
};

export const editVendorPayment = async (token, id, body) => {
  try {
    let fd;

    if (body instanceof FormData) {
      fd = body;
    } else {
      fd = new FormData();

      if (body.source != null && body.source !== "") {
        fd.append("source", body.source);
      }

      if (body.operation_date != null && body.operation_date !== "") {
        fd.append("operation_date", body.operation_date);
      }

      if (body.vendor != null && body.vendor !== "") {
        fd.append("vendor", String(body.vendor));
      }

      if (body.fabric_arrival != null && body.fabric_arrival !== "") {
        fd.append("fabric_arrival", String(body.fabric_arrival));
      }

      if (body.document) {
        fd.append("document", body.document);
      }


      if (body.payer_account != null && body.payer_account !== "") {
        fd.append("payer_account", body.payer_account);
      }

      if (body.recipient_account != null && body.recipient_account !== "") {
        fd.append("recipient_account", body.recipient_account);
      }

      if (body.payer != null && body.payer !== "") {
        fd.append("payer", body.payer);
      }
        if (body.uah_amount != null && String(body.uah_amount).trim() !== "") {
            fd.append("uah_amount", String(body.uah_amount).replace(/\s/g, "").replace(",", "."));
        }

        if (body.usd_amount != null && String(body.usd_amount).trim() !== "") {
            fd.append("usd_amount", String(body.usd_amount).replace(/\s/g, "").replace(",", "."));
        }

      if (body.exchange_rate != null && String(body.exchange_rate).trim() !== "") {
        fd.append("exchange_rate", String(body.exchange_rate).replace(/\s/g, "").replace(",", "."));
      }

      if (body.comment != null && body.comment !== "") {
        fd.append("comment", body.comment);
      }

      if (body.status != null && body.status !== "") {
        fd.append("status", body.status);
      }

      if (body.deleted_at != null && body.deleted_at !== "") {
        fd.append("deleted_at", body.deleted_at);
      }
    }

    const response = await fetch(`${API_BASE_URL}/vendor-invoices/payments/${id}/`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: fd,
    });

    return await handleResponse(response, (newToken) =>
      editVendorPayment(newToken, id, fd)
    );
  } catch (error) {
    console.error("Error editing vendor payment:", error);
    throw error;
  }
};

export const deleteVendorPayment = async (token, id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/vendor-invoices/payments/${id}/`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        if (response.status === 401) {
            return await handleResponse(response, (newToken) =>
                deleteVendorPayment(newToken, id)
            );
        }

        if (!response.ok) {
            let data = null;

            try {
                data = await response.json();
            } catch { }

            const err = new Error("Delete vendor payment failed");
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return true;
    } catch (error) {
        console.error("Error deleting vendor payment:", error);
        throw error;
    }
};

export const getSpecificVendorPayment = async (token, id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/vendor-invoices/payments/${id}/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    return await handleResponse(response, (newToken) =>
      getSpecificVendorPayment(newToken, id)
    );
  } catch (error) {
    console.error("Error getting specific vendor payment:", error);
    throw error;
  }
};


