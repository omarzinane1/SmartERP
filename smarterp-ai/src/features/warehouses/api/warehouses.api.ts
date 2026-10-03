import { getCollection } from '../../../lib/collectionApi'
import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { stockSnapshot, movementSnapshot, warehouseSummaryMock } from '../../inventory/data/inventory.mock'
import { stockDemoDate, stockDemoPermissions } from '../../products/data/products.mock'
import { createWarehouseMock } from '../data/warehouses.mock'
import { warehouseValuationMock } from '../data/warehouseDetail.mock'
import type { WarehouseValuation } from '../types/warehouses.types'
import type { WarehouseDetail, WarehouseInput, WarehousesData, WarehouseSummary } from '../types/warehouses.types'
import type { InventoryRow, StockMovement } from '../../inventory/types/inventory.types'
export const getWarehouses = async (scope: string, signal?: AbortSignal): Promise<WarehousesData> => env.warehousesUseMock ? { warehouses: warehouseSummaryMock(scope), permissions: stockDemoPermissions, asOf: stockDemoDate } : getCollection<WarehousesData, 'warehouses'>('/warehouses/', 'warehouses', signal)
export const getWarehousesSummary = async (scope: string, signal?: AbortSignal): Promise<WarehouseSummary[]> => env.warehousesUseMock ? warehouseSummaryMock(scope) : (await getCollection<WarehousesData, 'warehouses'>('/warehouses/summary/', 'warehouses', signal)).warehouses
export async function getWarehouseById(scope: string, id: number, signal?: AbortSignal): Promise<WarehouseDetail> { if (!env.warehousesUseMock) return (await apiClient.get(`/warehouses/${id}/`, { signal })).data; const w = warehouseSummaryMock(scope).find((w) => w.id === id); if (!w) throw new BusinessNotFoundError(); return { ...w, permissions: stockDemoPermissions, asOf: stockDemoDate } }
export const getWarehouseInventory = async (scope: string, id: number, signal?: AbortSignal): Promise<InventoryRow[]> => env.warehousesUseMock ? stockSnapshot(scope).filter((r) => r.warehouseId === id) : (await getCollection<{ rows: InventoryRow[] }, 'rows'>(`/warehouses/${id}/inventory/`, 'rows', signal)).rows
export const getWarehouseMovements = async (scope: string, id: number, signal?: AbortSignal): Promise<StockMovement[]> => env.warehousesUseMock ? movementSnapshot(scope).filter((r) => r.warehouseId === id) : (await getCollection<{ movements: StockMovement[] }, 'movements'>(`/warehouses/${id}/movements/`, 'movements', signal)).movements
export async function getWarehouseValuation(scope: string, id: number, signal?: AbortSignal): Promise<WarehouseValuation> { if (env.warehousesUseMock) return warehouseValuationMock(scope, id); const data: WarehouseValuation | WarehouseValuation['byProduct'] = (await apiClient.get(`/warehouses/${id}/valuation/`, { signal })).data; return Array.isArray(data) ? { byProduct: data, history: [], source: 'Historique de valorisation non fourni par le serveur.' } : data }
export const createWarehouse = async (scope: string, v: WarehouseInput) => env.warehousesUseMock ? createWarehouseMock(scope, v) : (await apiClient.post('/warehouses/', { name: v.name, city: v.city, country: v.country, manager: v.manager, capacity: v.capacity, capacity_unit: 'unités' })).data
