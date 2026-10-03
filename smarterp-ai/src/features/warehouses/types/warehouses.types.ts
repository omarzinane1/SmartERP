export interface WarehouseInput { name: string; city: string; country: string; manager: string; capacity: number }
export interface Warehouse extends Omit<WarehouseInput, 'capacity'> { capacity: number | null; id: number; reference: string; status: 'active' | 'inactive'; capacityUnit: string }
export interface WarehouseSummary extends Warehouse { stockValue: number | null; products: number | null; lowStock: number | null; outOfStock: number | null; usedCapacity: number | null; capacityPercent: number | null; incomingTransfers: number | null }
export interface WarehousesData { warehouses: WarehouseSummary[]; permissions: string[]; asOf: string }
export interface WarehouseDetail extends WarehouseSummary { permissions: string[]; asOf: string }
export interface WarehouseValuation { byProduct: { name: string; value: number }[]; history: { date: string; value: number }[]; source: string }
