import { getCollection } from '../../../lib/collectionApi'
import { postIdempotent } from '../../../lib/idempotentApi'
import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { catalogSnapshot, completeTransferMock, createMovementMock, inventorySummaryMock, movementSnapshot, saveTransferMock, stockSnapshot, transferSnapshot } from '../data/inventory.mock'
import { warehouseSnapshot } from '../../warehouses/data/warehouses.mock'
import { stockDemoDate, stockDemoPermissions } from '../../products/data/products.mock'
import type { InventoryRow, InventorySummary, MovementData, MovementInput, StockMovement, TransferData, TransferInput } from '../types/inventory.types'
export interface InventoryHealth { categories: { name: string; value: number }[]; warehouses: { name: string; value: number }[] }
export const getInventorySummary = async (scope: string, signal?: AbortSignal): Promise<InventorySummary> => env.inventoryUseMock ? inventorySummaryMock(scope) : (await apiClient.get('/inventory/summary/', { signal })).data
export async function getInventoryHealth(scope: string, signal?: AbortSignal): Promise<InventoryHealth> {
  if (!env.inventoryUseMock) return (await apiClient.get('/inventory/health/', { signal })).data
  const summary = inventorySummaryMock(scope), categories = new Map<string, number>()
  for (const p of summary.products) if (p.stockValue !== null) categories.set(p.category, Math.round(((categories.get(p.category) ?? 0) + p.stockValue) * 100) / 100)
  return { categories: [...categories].map(([name, value]) => ({ name, value })), warehouses: summary.warehouses.map((w) => ({ name: w.name, value: w.stockValue })) }
}
export const getCriticalProducts = async (scope: string, signal?: AbortSignal): Promise<InventoryRow[]> => env.inventoryUseMock ? stockSnapshot(scope).filter((r) => ['low_stock', 'out_of_stock'].includes(r.health)) : (await getCollection<{ rows: InventoryRow[] }, 'rows'>('/inventory/critical/', 'rows', signal)).rows
export const getRecentMovements = async (scope: string, signal?: AbortSignal): Promise<StockMovement[]> => env.inventoryUseMock ? movementSnapshot(scope).slice(0, 8) : (await apiClient.get('/inventory/recent-movements/', { signal })).data
export const getStockMovements = async (scope: string, signal?: AbortSignal): Promise<MovementData> => env.inventoryUseMock ? { movements: movementSnapshot(scope), products: catalogSnapshot(scope), stock: stockSnapshot(scope), warehouses: warehouseSnapshot(scope), permissions: stockDemoPermissions, asOf: stockDemoDate } : getCollection<MovementData, 'movements'>('/inventory/movements/', 'movements', signal)
export async function getStockMovementById(scope: string, id: number): Promise<StockMovement> { if (!env.inventoryUseMock) return (await apiClient.get(`/inventory/movements/${id}/`)).data; const m = movementSnapshot(scope).find((m) => m.id === id); if (!m) throw new BusinessNotFoundError(); return m }
export const createStockMovement = async (scope: string, v: MovementInput) => env.inventoryUseMock ? createMovementMock(scope, v) : postIdempotent<StockMovement>(scope, '/inventory/movements/', { product_id: v.productId, warehouse_id: v.warehouseId, quantity: v.quantity, type: v.type, date: v.date, source_reference: v.sourceReference, note: v.note, adjustment_direction: v.adjustmentDirection, ...(v.unitCost === undefined ? {} : { unit_cost: v.unitCost }) })
export const getStockTransfers = async (scope: string, signal?: AbortSignal): Promise<TransferData> => env.inventoryUseMock ? { transfers: transferSnapshot(scope), products: catalogSnapshot(scope), stock: stockSnapshot(scope), warehouses: warehouseSnapshot(scope), permissions: stockDemoPermissions, asOf: stockDemoDate, supportsStatusPatch: true } : getCollection<TransferData, 'transfers'>('/inventory/transfers/', 'transfers', signal)
const transferDTO = (v: TransferInput) => ({ source_warehouse_id: v.sourceId, destination_warehouse_id: v.destinationId, date: v.date, reference_external: v.referenceExternal, notes: v.notes, lines: v.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })) })
export const createStockTransfer = async (scope: string, v: TransferInput) => env.inventoryUseMock ? saveTransferMock(scope, v) : postIdempotent(scope, '/inventory/transfers/', transferDTO(v))
export const updateStockTransfer = async (scope: string, id: number, v: TransferInput | { status: 'ready' | 'in_transit' | 'cancelled' }) => env.inventoryUseMock ? saveTransferMock(scope, v, id) : 'status' in v ? (await apiClient.post(`/inventory/transfers/${id}/${({ ready: 'ready', in_transit: 'start', cancelled: 'cancel' } as const)[v.status]}/`, {})).data : (await apiClient.patch(`/inventory/transfers/${id}/`, transferDTO(v))).data
export const completeStockTransfer = async (scope: string, id: number) => env.inventoryUseMock ? completeTransferMock(scope, id) : (await apiClient.post(`/inventory/transfers/${id}/complete/`)).data
