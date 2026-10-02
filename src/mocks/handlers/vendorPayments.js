import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toNumberOrNull, paginate, notFound } from './utils';
import { getCollection, saveCollection, nextId } from '../db';
import { DEMO_VENDOR_PAYMENTS } from '../data/vendorPayments';
import { DEMO_VENDORS, toIso } from '../data/vendors';
import { findFabricArrival } from './fabricArrivals';

// Response shapes follow the original API, as consumed by PaymentForVendors.jsx and NewVendorPayment.jsx:
//   GET    /vendor-invoices/payments/      -> { vendor_payments, total_count, total_pages, current_page }
//   POST   /vendor-invoices/payments/      -> payment   (multipart/form-data)
//   GET    /vendor-invoices/payments/:id/  -> payment
//   PATCH  /vendor-invoices/payments/:id/  -> payment   (multipart/form-data)
//   DELETE /vendor-invoices/payments/:id/  -> 204
// A payment's vendor and fabric_arrival are nested objects; they are stored by id and expanded here.
// Changes are persisted in the visitor's browser (see src/mocks/db.js).

const COLLECTION = 'vendorPayments';
const TEXT_FIELDS = ['source', 'operation_date', 'payer_account', 'recipient_account', 'payer', 'status', 'comment'];
const DECIMAL_FIELDS = ['uah_amount', 'usd_amount', 'exchange_rate'];
// assumption: the original model's default status for a new payment (the create form has no status field)
const DEFAULT_STATUS = 'UNPAID';

const payments = () => getCollection(COLLECTION, DEMO_VENDOR_PAYMENTS);
const vendors = () => getCollection('vendors', DEMO_VENDORS);
const findActive = (id) => payments().find((p) => p.id === Number(id) && !p.deleted_at);

const serialize = ({ vendor_id, fabric_arrival_id, ...payment }) => {
    const vendor = vendors().find((v) => v.id === vendor_id);
    const arrival = findFabricArrival(fabric_arrival_id);
    return {
        ...payment,
        vendor: vendor ? { id: vendor.id, full_name: vendor.full_name } : null,
        fabric_arrival: arrival
            ? { id: arrival.id, arrival_date: arrival.arrival_date, document_num: arrival.document_num }
            : null,
    };
};

const toDecimalString = (value) => {
    const n = toNumberOrNull(value);
    return n == null ? null : n.toFixed(2);
};

/**
 * Copies the multipart fields sent by createVendorPayment / editVendorPayment onto a stored payment.
 * The API layer only sends non-empty fields, so absent fields keep their current value.
 * Uploaded documents are not stored: a file can't be kept in localStorage in a form the table link can open.
 */
const applyFormData = (payment, fd) => {
    TEXT_FIELDS.forEach((key) => {
        if (fd.has(key)) payment[key] = String(fd.get(key));
    });
    DECIMAL_FIELDS.forEach((key) => {
        if (fd.has(key)) payment[key] = toDecimalString(fd.get(key));
    });
    if (fd.has('vendor')) payment.vendor_id = Number(fd.get('vendor'));
    if (fd.has('fabric_arrival')) payment.fabric_arrival_id = Number(fd.get('fabric_arrival'));
};

const includesCI = (value, needle) => String(value ?? '').toLowerCase().includes(needle);

export const vendorPaymentHandlers = [
    http.get(`${API}/vendor-invoices/payments/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const text = (key) => (isSet(q.get(key)) ? q.get(key).trim().toLowerCase() : '');

        const search = text('search');
        const source = q.get('source');
        const status = q.get('status');
        const operationDate = q.get('operation_date');
        const vendor = text('vendor');
        const payer = text('payer');
        const payerAccount = text('payer_account');
        const recipientAccount = text('recipient_account');
        const documentNum = text('document_num');
        const fabricArrival = text('fabric_arrival');
        const exchangeRate = toNumberOrNull(q.get('exchange_rate'));
        const uahMin = toNumberOrNull(q.get('uah_amount_min'));
        const uahMax = toNumberOrNull(q.get('uah_amount_max'));
        const usdMin = toNumberOrNull(q.get('usd_amount_min'));
        const usdMax = toNumberOrNull(q.get('usd_amount_max'));

        const filtered = payments()
            .filter((p) => !p.deleted_at)
            .map(serialize)
            .filter((p) => {
                const vendorName = p.vendor?.full_name;
                const docNum = p.fabric_arrival?.document_num;

                if (search && ![vendorName, p.payer, p.comment, docNum, p.payer_account, p.recipient_account]
                    .some((f) => includesCI(f, search))) return false;
                if (isSet(source) && p.source !== source) return false;
                if (isSet(status) && p.status !== status) return false;
                if (isSet(operationDate) && p.operation_date !== operationDate) return false;
                if (vendor && !includesCI(vendorName, vendor)) return false;
                if (payer && !includesCI(p.payer, payer)) return false;
                if (payerAccount && !includesCI(p.payer_account, payerAccount)) return false;
                if (recipientAccount && !includesCI(p.recipient_account, recipientAccount)) return false;
                if (documentNum && !includesCI(docNum, documentNum)) return false;
                if (fabricArrival && String(p.fabric_arrival?.id) !== fabricArrival
                    && !includesCI(p.fabric_arrival?.arrival_date, fabricArrival)) return false;
                if (exchangeRate != null && Number(p.exchange_rate) !== exchangeRate) return false;

                const uah = Number(p.uah_amount) || 0;
                const usd = Number(p.usd_amount) || 0;
                if (uahMin != null && uah < uahMin) return false;
                if (uahMax != null && uah > uahMax) return false;
                if (usdMin != null && usd < usdMin) return false;
                if (usdMax != null && usd > usdMax) return false;
                return true;
            })
            // newest entries first, so a just-created payment shows up at the top of page 1
            .sort((a, b) => b.created.localeCompare(a.created) || b.id - a.id);

        const { slice, totalPages, current } = paginate(filtered, q.get('page'), q.get('page_size'));

        return HttpResponse.json({
            vendor_payments: slice,
            total_count: filtered.length,
            total_pages: totalPages,
            current_page: current,
        });
    })),

    http.post(`${API}/vendor-invoices/payments/`, withAuth(async ({ request }) => {
        const fd = await request.formData();
        const payment = {
            id: nextId(payments()),
            source: '',
            operation_date: '',
            payer_account: '',
            recipient_account: '',
            payer: '',
            vendor_id: null,
            fabric_arrival_id: null,
            status: DEFAULT_STATUS,
            document: null,
            uah_amount: null,
            usd_amount: null,
            exchange_rate: null,
            comment: '',
            created: toIso(new Date()),
            deleted_at: null,
        };
        applyFormData(payment, fd);

        payments().push(payment);
        saveCollection(COLLECTION);

        return HttpResponse.json(serialize(payment), { status: 201 });
    })),

    http.get(`${API}/vendor-invoices/payments/:id/`, withAuth(({ params }) => {
        const payment = findActive(params.id);
        return payment ? HttpResponse.json(serialize(payment)) : notFound();
    })),

    http.patch(`${API}/vendor-invoices/payments/:id/`, withAuth(async ({ request, params }) => {
        const payment = findActive(params.id);
        if (!payment) return notFound();

        applyFormData(payment, await request.formData());
        saveCollection(COLLECTION);

        return HttpResponse.json(serialize(payment));
    })),

    // soft delete, like vendors; the UI only offers it for payments that are not PAID
    http.delete(`${API}/vendor-invoices/payments/:id/`, withAuth(({ params }) => {
        const payment = findActive(params.id);
        if (!payment) return notFound();

        payment.deleted_at = toIso(new Date());
        saveCollection(COLLECTION);

        return new HttpResponse(null, { status: 204 });
    })),
];
