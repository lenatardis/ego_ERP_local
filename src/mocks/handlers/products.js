import { http, HttpResponse } from 'msw';
import { API, withAuth, isSet, toBoolOrUndefined, paginate, imageFileToUrl } from './utils';
import { getCollection, saveCollection, nextId } from '../db';
import { DEMO_PRODUCTS, PRODUCT_CATEGORIES, PRODUCT_COLORS, PRODUCT_SIZES } from '../data/products';

// Response shapes follow the original API, as consumed by StorageProduct.jsx,
// NewProduct.jsx and EditableProductTable.jsx:
//   GET /warehouses/warehouse-item-templates/            -> { warehouse_item_templates, total_pages, count }
//   GET /warehouses/warehouse-item-templates/properties  -> { categories, colors, sizes }
//   POST /warehouses/warehouse-item-templates/ (multipart) -> created product; 400 { name: [...] } on a duplicate

const PRODUCTS_PAGE_SIZE = 25;

const products = () => getCollection('products', DEMO_PRODUCTS);

export const productHandlers = [
    http.get(`${API}/warehouses/warehouse-item-templates/properties`, withAuth(() =>
        HttpResponse.json({
            categories: PRODUCT_CATEGORIES,
            colors: PRODUCT_COLORS,
            sizes: PRODUCT_SIZES,
        })
    )),

    http.get(`${API}/warehouses/warehouse-item-templates/`, withAuth(({ request }) => {
        const q = new URL(request.url).searchParams;
        const category = q.get('category');
        const color = q.get('color');
        const size = q.get('size');
        const search = isSet(q.get('name')) ? q.get('name').trim().toLowerCase() : '';
        const inStock = toBoolOrUndefined(q.get('in_stock'));

        const filtered = products()
            .filter((p) => !isSet(category) || p.category.id === Number(category))
            .filter((p) => !search || p.name.toLowerCase().includes(search))
            .map((p) => ({
                ...p,
                // color / size filters narrow the variants shown for each product
                types: p.types.filter((t) =>
                    (!isSet(color) || t.color.id === Number(color))
                    && (!isSet(size) || t.size.id === Number(size))),
            }))
            .filter((p) => (!isSet(color) && !isSet(size)) || p.types.length > 0)
            .filter((p) => {
                const hasStock = p.types.some((t) => t.quantity > 0);
                if (inStock === true) return hasStock;
                if (inStock === false) return !hasStock;
                return true;
            });

        const { slice, totalPages } = paginate(filtered, q.get('page'), PRODUCTS_PAGE_SIZE);

        return HttpResponse.json({ count: filtered.length, total_pages: totalPages, warehouse_item_templates: slice });
    })),

    http.post(`${API}/warehouses/warehouse-item-templates/`, withAuth(async ({ request }) => {
        const fd = await request.formData();
        const name = String(fd.get('name') || '').trim();
        const category = PRODUCT_CATEGORIES.find((c) => c.id === Number(fd.get('category')));
        if (!name || !category) {
            return HttpResponse.json({ name: name ? undefined : ['This field is required.'], category: category ? undefined : ['Invalid category.'] }, { status: 400 });
        }

        const items = products();
        if (items.some((p) => p.category.id === category.id && p.name.toLowerCase() === name.toLowerCase())) {
            return HttpResponse.json({ name: ['WarehouseItemTemplate with this name and category already exists'] }, { status: 400 });
        }

        const images = await Promise.all(fd.getAll('images')
            .filter((file) => file instanceof File && file.size > 0)
            .map(imageFileToUrl));

        const product = { id: nextId(items), name, category, images, types: [] };

        items.unshift(product); // newest first, so it shows up at the top of the storage list
        saveCollection('products');

        return HttpResponse.json(product, { status: 201 });
    })),
];
