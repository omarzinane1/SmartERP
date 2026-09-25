export interface WarehouseInput { name: string; city: string; country: string; manager: string; capacity: number }
export interface Warehouse extends WarehouseInput { id: number; reference: string; status: 'active' | 'inactive'; capacityUnit: string }
export interface WarehouseSummary extends Warehouse { stockValue: number; products: number; lowStock: number; outOfStock: number; usedCapacity: number; capacityPercent: number | null; incomingTransfers: number }
export interface WarehousesData { warehouses: WarehouseSummary[]; permissions: string[]; asOf: string }
export interface WarehouseDetail extends WarehouseSummary { permissions: string[]; asOf: string }
