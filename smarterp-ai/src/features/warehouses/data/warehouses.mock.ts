import { z } from 'zod'
import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import type { Warehouse, WarehouseInput } from '../types/warehouses.types'
export const warehouseSchema: z.ZodType<WarehouseInput, WarehouseInput> = z.object({ name: z.string().trim().min(2).max(150), city: z.string().trim().min(1).max(100), country: z.string().trim().min(1).max(100), manager: z.string().trim().min(1).max(120), capacity: z.number().int().positive().max(10000000) })
export const warehousesMock: Warehouse[] = [{ id: 1, reference: 'WH-001', name: 'Casablanca Central', city: 'Casablanca', country: 'Maroc', manager: 'Ahmed Mansouri', capacity: 5000, capacityUnit: 'unités', status: 'active' }, { id: 2, reference: 'WH-002', name: 'Rabat Distribution', city: 'Rabat', country: 'Maroc', manager: 'Salma Idrissi', capacity: 2400, capacityUnit: 'unités', status: 'active' }, { id: 3, reference: 'WH-003', name: 'Tanger Logistique', city: 'Tanger', country: 'Maroc', manager: 'Youssef Bennani', capacity: 1000, capacityUnit: 'unités', status: 'active' }]
const stores = new Map<string, Warehouse[]>()
function store(scope: string) { if (!stores.has(scope)) stores.set(scope, structuredClone(warehousesMock)); return stores.get(scope)! }
export const warehouseSnapshot = (scope: string) => structuredClone(store(scope))
export function warehouseById(scope: string, id: number) { const warehouse = store(scope).find((w) => w.id === id); if (!warehouse) throw new BusinessNotFoundError(); return structuredClone(warehouse) }
export async function createWarehouseMock(scope: string, input: WarehouseInput) { await new Promise((r) => setTimeout(r, 250)); const values = warehouseSchema.parse(input), id = Math.max(...store(scope).map((w) => w.id)) + 1; const row: Warehouse = { ...values, id, reference: `WH-${String(id).padStart(3, '0')}`, status: 'active', capacityUnit: 'unités' }; store(scope).push(row); return structuredClone(row) }
