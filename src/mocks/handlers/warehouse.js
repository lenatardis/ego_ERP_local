import { http, HttpResponse } from 'msw';
import { API, withAuth } from './utils';
import { getCollection } from '../db';
import { DEMO_FABRIC_ROLLS } from '../data/fabrics';
import { DEMO_PRODUCTS } from '../data/products';
import { STANDARD_LENGTHS, WAREHOUSES, WAREHOUSE_RACKS, WAREHOUSE_CELLS } from '../data/warehouse';
// imported for its side effect too: the seed arrivals' rolls / units are part of the storage seed
import '../data/fabricArrivals';

// Response shapes follow the original API, as consumed by EditableFabricTable.jsx / EditableProductTable.jsx:
//   GET /warehouses/structure/                    -> [{ id, name, racks: [{ id, name, cells: [{ id, number, initial_capacity, remaining_capacity }] }] }]
//   GET /warehouses/fabric-rolls/standard-length/ -> [{ id, length }]
// remaining_capacity = initial_capacity minus what is in the cell right now: fabric rolls (new or opened)
// plus finished product items, so arrivals, cutting and packing change it.

const fabricRolls = () => getCollection('fabricRolls', DEMO_FABRIC_ROLLS); // fabricId -> rolls[]
const products = () => getCollection('products', DEMO_PRODUCTS);

const countOccupancy = (rollsByFabric, productList) => {
    const occupancy = {};
    Object.values(rollsByFabric).flat().forEach((roll) => {
        if (roll.cell?.id != null) occupancy[roll.cell.id] = (occupancy[roll.cell.id] || 0) + 1;
    });
    productList.forEach((product) => product.types.forEach((type) => type.units.forEach((unit) => {
        if (unit.cell?.id != null) occupancy[unit.cell.id] = (occupancy[unit.cell.id] || 0) + unit.current_quantity;
    })));
    return occupancy;
};

/** Pieces stored in each cell right now: { cellId: count }. */
export const liveOccupancy = () => countOccupancy(fabricRolls(), products());

let capacities = null;

/** A cell's capacity; never below what the seed data already keeps there, so the seed fits its warehouse. */
export const cellCapacity = (cellId) => {
    if (!capacities) {
        const seedOccupancy = countOccupancy(DEMO_FABRIC_ROLLS, DEMO_PRODUCTS);
        capacities = Object.fromEntries(WAREHOUSE_CELLS.map((c) => [c.id, Math.max(c.base_capacity, seedOccupancy[c.id] || 0)]));
    }
    return capacities[cellId] ?? 0;
};

export const warehouseHandlers = [
    http.get(`${API}/warehouses/structure/`, withAuth(() => {
        const occupancy = liveOccupancy();

        return HttpResponse.json(WAREHOUSES.map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
            racks: WAREHOUSE_RACKS.filter((r) => r.warehouse.id === warehouse.id).map((rack) => ({
                id: rack.id,
                name: rack.name,
                cells: rack.cells.map((cell) => ({
                    id: cell.id,
                    number: cell.number,
                    initial_capacity: cellCapacity(cell.id),
                    remaining_capacity: Math.max(0, cellCapacity(cell.id) - (occupancy[cell.id] || 0)),
                })),
            })),
        })));
    })),

    http.get(`${API}/warehouses/fabric-rolls/standard-length/`, withAuth(() => HttpResponse.json(STANDARD_LENGTHS))),
];
