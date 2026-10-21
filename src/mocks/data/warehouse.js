// Warehouse structure shared by the storage seeds (fabric rolls, product units) and the arrival forms
// (the original backend is unavailable). Served by src/mocks/handlers/warehouse.js:
//   GET /warehouses/structure/                  -> [{ id, name, racks: [{ id, name, cells: [{ id, number, initial_capacity, remaining_capacity }] }] }]
//   GET /warehouses/fabric-rolls/standard-length/ -> [{ id, length }]
// Racks A–C hold fabric rolls (cells 1–12), racks D–E finished products (cells 1–20); cell ids are unique
// across the whole structure.

export const WAREHOUSES = [
    { id: 1, name: 'Основний склад' },
    { id: 2, name: 'Склад №2' },
];

const RACK_SPECS = [
    { name: 'A', cells: 12, kind: 'fabric' },
    { name: 'B', cells: 12, kind: 'fabric' },
    { name: 'C', cells: 12, kind: 'fabric' },
    { name: 'D', cells: 20, kind: 'product' },
    { name: 'E', cells: 20, kind: 'product' },
];

// assumption: capacity is counted in pieces stored in a cell — fabric rolls or finished product items
const BASE_CAPACITY = { fabric: [8, 10, 12, 15], product: [40, 50, 60] };

let nextCellId = 1;

export const WAREHOUSE_RACKS = WAREHOUSES.flatMap((warehouse, wi) =>
    RACK_SPECS.map((spec, ri) => ({
        id: wi * 10 + ri + 1,
        name: spec.name,
        kind: spec.kind,
        warehouse,
        cells: Array.from({ length: spec.cells }, (_, ci) => ({
            id: nextCellId++,
            number: ci + 1,
            // deterministic spread of capacities (the seed's occupancy may raise a cell's capacity, see the handler)
            base_capacity: BASE_CAPACITY[spec.kind][(ci * 7 + ri * 3 + wi) % BASE_CAPACITY[spec.kind].length],
        })),
    })));

export const WAREHOUSE_CELLS = WAREHOUSE_RACKS.flatMap((rack) => rack.cells.map((cell) => ({ ...cell, rack })));

export const FABRIC_CELLS = WAREHOUSE_CELLS.filter((c) => c.rack.kind === 'fabric');
export const PRODUCT_CELLS = WAREHOUSE_CELLS.filter((c) => c.rack.kind === 'product');

export const findWarehouseCell = (id) => WAREHOUSE_CELLS.find((c) => c.id === Number(id)) || null;

const findCellAt = (warehouseId, rackName, number) =>
    WAREHOUSE_CELLS.find((c) => c.rack.warehouse.id === warehouseId && c.rack.name === rackName && c.number === number);

const rackRef = (rack) => ({ id: rack.id, name: rack.name, warehouse: { ...rack.warehouse } });

/** `cell` of a fabric roll, as the storage pages read it ({ id, name, rack: { name, warehouse } }). */
export const rollCellRef = (cell) => ({ id: cell.id, name: String(cell.number), rack: rackRef(cell.rack) });

/** `cell` of a product unit, as the storage / packer pages read it ({ id, number, rack: { name, warehouse } }). */
export const unitCellRef = (cell) => ({ id: cell.id, number: cell.number, rack: rackRef(cell.rack) });

export const rollCellAt = (warehouseId, rackName, number) => rollCellRef(findCellAt(warehouseId, rackName, number));
export const unitCellAt = (warehouseId, rackName, number) => unitCellRef(findCellAt(warehouseId, rackName, number));

// Standard roll lengths offered by the fabric arrival form ("Довжина рулону, м"); a custom length can be typed instead.
export const STANDARD_LENGTHS = [
    { id: 1, length: 10 },
    { id: 2, length: 20 },
];
