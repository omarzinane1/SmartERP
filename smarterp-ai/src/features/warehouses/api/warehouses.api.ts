import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { stockSnapshot, movementSnapshot, warehouseSummaryMock } from '../../inventory/data/inventory.mock'
import { stockDemoDate, stockDemoPermissions } from '../../products/data/products.mock'
import { createWarehouseMock } from '../data/warehouses.mock'
import type { WarehouseDetail, WarehouseInput, WarehousesData, WarehouseSummary } from '../types/warehouses.types'
import type { InventoryRow, StockMovement } from '../../inventory/types/inventory.types'
export const getWarehouses = async (scope: string, signal?: AbortSignal): Promise<WarehousesData> => env.warehousesUseMock ? { warehouses: warehouseSummaryMock(scope), permissions: stockDemoPermissions, asOf: stockDemoDate } : (await apiClient.get('/warehouses/', { signal })).data
export const getWarehousesSummary = async (scope: string, signal?: AbortSignal): Promise<WarehouseSummary[]> => env.warehousesUseMock ? warehouseSummaryMock(scope) : (await apiClient.get('/warehouses/summary/', { signal })).data
export async function getWarehouseById(scope: string, id: number, signal?: AbortSignal): Promise<WarehouseDetail> { if (!env.warehousesUseMock) return (await apiClient.get(`/warehouses/${id}/`, { signal })).data; const w = warehouseSummaryMock(scope).find((w) => w.id === id); if (!w) throw new BusinessNotFoundError(); return { ...w, permissions: stockDemoPermissions, asOf: stockDemoDate } }
export const getWarehouseInventory = async (scope: string, id: number, signal?: AbortSignal): Promise<InventoryRow[]> => env.warehousesUseMock ? stockSnapshot(scope).filter((r) => r.warehouseId === id) : (await apiClient.get(`/warehouses/${id}/inventory/`, { signal })).data
export const getWarehouseMovements = async (scope: string, id: number, signal?: AbortSignal): Promise<StockMovement[]> => env.warehousesUseMock ? movementSnapshot(scope).filter((r) => r.warehouseId === id) : (await apiClient.get(`/warehouses/${id}/movements/`, { signal })).data
export const getWarehouseValuation = async (scope: string, id: number, signal?: AbortSignal): Promise<{ name: string; value: number }[]> => env.warehousesUseMock ? stockSnapshot(scope).filter((r) => r.warehouseId === id).map((r) => ({ name: r.productName, value: r.value })) : (await apiClient.get(`/warehouses/${id}/valuation/`, { signal })).data
export const createWarehouse = async (scope: string, v: WarehouseInput) => env.warehousesUseMock ? createWarehouseMock(scope, v) : (await apiClient.post('/warehouses/', { name: v.name, city: v.city, country: v.country, manager: v.manager, capacity: v.capacity, capacity_unit: 'unités' })).data
