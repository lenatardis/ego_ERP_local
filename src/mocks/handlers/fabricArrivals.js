import { http, HttpResponse, bypass } from 'msw';
import { API, withAuth, isSet, paginate } from './utils';
import { getCollection } from '../db';
import { DEMO_FABRIC_ARRIVALS, DEMO_USD_RATE } from '../data/fabricArrivals';
import { DEMO_VENDORS } from '../data/vendors';

// Response shapes follow the original API, as consumed by NewVendorPayment.jsx, ArrivalList.jsx
// and the arrival forms (CurrencyRateInfo):
//   GET /warehouses/fabric-arrivals/             -> { fabric_arrivals, total_count, total_pages, current_page }
//   GET /warehouses/fabric-arrivals/currencies/  -> { exchange_rate: { buy, sale } }
//       today's USD cash rate: Monobank (buy / sell), else the NBU official rate (as both),
//       else the PrivatBank snapshot DEMO_USD_RATE (PrivatBank's API can't be called from a browser: no CORS)
// Creating / editing arrivals is not mocked yet.

const ARRIVALS_PAGE_SIZE = 25;

// ---- Today's USD cash rate ----

const RATE_CACHE_KEY = 'ego-demo:erp:usdRate';
// Monobank's public endpoint answers 429 when called too often, so a fetched rate is reused for a while
const RATE_TTL_MS = 30 * 60 * 1000;
const RATE_RETRY_MS = 5 * 60 * 1000;
const RATE_TIMEOUT_MS = 4000;
const USD = 840;
const UAH = 980;

const toRate = (buy, sale) => {
    const b = Number(buy);
    const s = Number(sale);
    return b > 0 && s > 0 ? { buy: b.toFixed(2), sale: s.toFixed(2) } : null;
};

const fetchJson = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RATE_TIMEOUT_MS);
    try {
        // bypass(): a real request, not intercepted by the mock worker
        const response = await fetch(bypass(new Request(url, { signal: controller.signal })));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

const RATE_SOURCES = [
    async () => {
        const list = await fetchJson('https://api.monobank.ua/bank/currency');
        const usd = list.find((r) => r.currencyCodeA === USD && r.currencyCodeB === UAH);
        return toRate(usd?.rateBuy, usd?.rateSell);
    },
    async () => {
        const [usd] = await fetchJson('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json');
        return toRate(usd?.rate, usd?.rate);
    },
];

const readCachedRate = () => {
    try {
        const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY));
        return cached && Date.now() < cached.expires ? cached.rate : null;
    } catch {
        return null;
    }
};

const cacheRate = (rate, ttl) => {
    try {
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, expires: Date.now() + ttl }));
    } catch {
        // storage unavailable: the rate is fetched again next time
    }
};

let pendingRate = null;

/** Today's USD cash rate { buy, sale }; several pages asking at once share one lookup. */
const getUsdRate = () => {
    const cached = readCachedRate();
    if (cached) return Promise.resolve(cached);

    pendingRate ??= (async () => {
        for (const source of RATE_SOURCES) {
            try {
                const rate = await source();
                if (rate) {
                    cacheRate(rate, RATE_TTL_MS);
                    return rate;
                }
            } catch (error) {
                console.warn('[demo] USD rate source failed:', error);
            }
        }
        cacheRate(DEMO_USD_RATE, RATE_RETRY_MS);
        return DEMO_USD_RATE;
    })().finally(() => {
        pendingRate = null;
    });

    return pendingRate;
};

const arrivals = () => getCollection('fabricArrivals', DEMO_FABRIC_ARRIVALS);
const vendors = () => getCollection('vendors', DEMO_VENDORS);

export const findFabricArrival = (id) => arrivals().find((a) => a.id === Number(id)) || null;

/** Stored arrival -> API shape (vendor expanded into a nested object). */
export const serializeFabricArrival = ({ vendor_id, ...arrival }) => {
    const vendor = vendors().find((v) => v.id === vendor_id);
    return { ...arrival, vendor: vendor ? { id: vendor.id, full_name: vendor.full_name } : null };
};

export const fabricArrivalHandlers = [
    http.get(`${API}/warehouses/fabric-arrivals/currencies/`, withAuth(async () =>
        HttpResponse.json({ exchange_rate: await getUsdRate() })
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
