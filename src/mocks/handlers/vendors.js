import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toNumberOrNull, paginate, notFound } from './utils';
import { getCollection, saveCollection, nextId } from '../db';
import { DEMO_VENDORS, toIso, money } from '../data/vendors';
import { DEMO_VENDOR_PAYMENTS } from '../data/vendorPayments';

// Response shapes follow the original API, as consumed by VendorManagement.jsx, VendorDebtList.jsx,
// NewVendorPayment.jsx and the fabric/product arrival forms:
//   GET    /vendor-invoices/vendors/       -> { vendors, total_count, total_pages, current_page }
//   POST   /vendor-invoices/vendors/       -> vendor
//   PATCH  /vendor-invoices/vendors/:id/   -> vendor
//   DELETE /vendor-invoices/vendors/:id/   -> 204
// Changes are persisted in the visitor's browser (see src/mocks/db.js).
// `dept` is derived from vendor payments (Взаєморозрахунок з постачальниками), so the debt list always
// matches that page: the vendor owes the sum of its payments that are not PAID yet.

const COLLECTION = 'vendors';
const EDITABLE_FIELDS = ['full_name', 'email', 'phone'];

const vendors = () => getCollection(COLLECTION, DEMO_VENDORS);
const payments = () => getCollection('vendorPayments', DEMO_VENDOR_PAYMENTS);
const findActive = (id) => vendors().find((v) => v.id === Number(id) && !v.deleted_at);

const OUTSTANDING_STATUSES = ['UNPAID', 'WAIT_FOR_PAY'];

/** Vendor's debt from payments that are still outstanding (not paid, not deleted). */
const debtOf = (vendorId) => {
    let uah = 0;
    let usd = 0;
    payments().forEach((p) => {
        if (p.vendor_id !== vendorId || p.deleted_at || !OUTSTANDING_STATUSES.includes(p.status)) return;
        uah += Number(p.uah_amount) || 0;
        usd += Number(p.usd_amount) || 0;
    });
    return { uah: money(uah), usd: money(usd), dept_paid_off: uah === 0 && usd === 0 };
};

const serialize = (vendor) => ({ ...vendor, dept: debtOf(vendor.id) });

export const vendorHandlers = [
    http.get(`${API}/vendor-invoices/vendors/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const search = isSet(q.get('search')) ? q.get('search').trim().toLowerCase() : '';
        const uahMin = toNumberOrNull(q.get('uah_dept_min'));
        const uahMax = toNumberOrNull(q.get('uah_dept_max'));
        const usdMin = toNumberOrNull(q.get('usd_dept_min'));
        const usdMax = toNumberOrNull(q.get('usd_dept_max'));

        const filtered = vendors()
            .filter((v) => !v.deleted_at)
            .map(serialize)
            .filter((v) => {
                if (search && ![v.full_name, v.email, v.phone].some((f) => f.toLowerCase().includes(search))) return false;
                const uah = Number(v.dept.uah);
                const usd = Number(v.dept.usd);
                if (uahMin != null && uah < uahMin) return false;
                if (uahMax != null && uah > uahMax) return false;
                if (usdMin != null && usd < usdMin) return false;
                if (usdMax != null && usd > usdMax) return false;
                return true;
            })
            // newest first, so a just-created vendor shows up on page 1
            .sort((a, b) => b.created.localeCompare(a.created) || b.id - a.id);

        const { slice, totalPages, current } = paginate(filtered, q.get('page'), q.get('page_size'));

        return HttpResponse.json({
            vendors: slice,
            total_count: filtered.length,
            total_pages: totalPages,
            current_page: current,
        });
    })),

    http.post(`${API}/vendor-invoices/vendors/`, withAuth(async ({ request }) => {
        const { full_name, email = '', phone } = await request.json();
        const now = toIso(new Date());
        const vendor = {
            id: nextId(vendors()),
            full_name,
            email,
            phone,
            created: now,
            modified: now,
            deleted_at: null,
        };

        vendors().push(vendor);
        saveCollection(COLLECTION);

        return HttpResponse.json(serialize(vendor), { status: 201 });
    })),

    http.patch(`${API}/vendor-invoices/vendors/:id/`, withAuth(async ({ request, params }) => {
        const vendor = findActive(params.id);
        if (!vendor) return notFound();

        const payload = await request.json();
        EDITABLE_FIELDS.forEach((key) => {
            if (payload?.[key] !== undefined) vendor[key] = payload[key];
        });
        vendor.modified = toIso(new Date());
        saveCollection(COLLECTION);

        return HttpResponse.json(serialize(vendor));
    })),

    // soft delete: the record keeps its deleted_at timestamp, like the original model
    http.delete(`${API}/vendor-invoices/vendors/:id/`, withAuth(({ params }) => {
        const vendor = findActive(params.id);
        if (!vendor) return notFound();

        vendor.deleted_at = toIso(new Date());
        saveCollection(COLLECTION);

        return new HttpResponse(null, { status: 204 });
    })),
];
