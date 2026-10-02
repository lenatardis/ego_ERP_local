import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, paginate } from './utils';
import { getCollection } from '../db';
import { DEMO_FABRIC_ARRIVALS, DEMO_USD_RATE } from '../data/fabricArrivals';
import { DEMO_VENDORS } from '../data/vendors';

// Response shapes follow the original API, as consumed by NewVendorPayment.jsx, ArrivalList.jsx
// and the arrival forms (CurrencyRateInfo):
//   GET /warehouses/fabric-arrivals/             -> { fabric_arrivals, total_count, total_pages, current_page }
//   GET /warehouses/fabric-arrivals/currencies/  -> { exchange_rate: { buy, sale } }
// Creating / editing arrivals is not mocked yet.

const ARRIVALS_PAGE_SIZE = 25;

const arrivals = () => getCollection('fabricArrivals', DEMO_FABRIC_ARRIVALS);
const vendors = () => getCollection('vendors', DEMO_VENDORS);

export const findFabricArrival = (id) => arrivals().find((a) => a.id === Number(id)) || null;

/** Stored arrival -> API shape (vendor expanded into a nested object). */
export const serializeFabricArrival = ({ vendor_id, ...arrival }) => {
    const vendor = vendors().find((v) => v.id === vendor_id);
    return { ...arrival, vendor: vendor ? { id: vendor.id, full_name: vendor.full_name } : null };
};

export const fabricArrivalHandlers = [
    http.get(`${API}/warehouses/fabric-arrivals/currencies/`, withAuth(() =>
        HttpResponse.json({ exchange_rate: DEMO_USD_RATE })
    )),

    http.get(`${API}/warehouses/fabric-arrivals/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;

        const filtered = arrivals()
            .filter((a) => {
                if (q.get('with_fabric_rolls') === 'true' && !a.fabric_rolls?.length) return false;
                if (q.get('with_warehouse_item_units') === 'true' && !a.warehouse_item_units?.length) return false;
                if (isSet(q.get('vendor')) && a.vendor_id !== Number(q.get('vendor'))) return false;
                return true;
            })
            // newest first
            .sort((a, b) => b.id - a.id);

        const { slice, totalPages, current } = paginate(filtered, q.get('page'), q.get('page_size') || ARRIVALS_PAGE_SIZE);

        return HttpResponse.json({
            fabric_arrivals: slice.map(serializeFabricArrival),
            total_count: filtered.length,
            total_pages: totalPages,
            current_page: current,
        });
    })),
];
