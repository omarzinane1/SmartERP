import { useMutation, useQuery } from '@tanstack/react-query'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { env } from '../../../config/env'
import * as api from '../api/inventory.api'
import type { MovementInput, TransferInput } from '../types/inventory.types'
export const stockQueryNames = ['products', 'product', 'product-metrics', 'product-history', 'inventory-summary', 'inventory-health', 'inventory-critical', 'inventory-recent', 'movements', 'transfers', 'warehouses', 'warehouse', 'warehouse-inventory', 'warehouse-movements', 'warehouse-valuation', 'reports', 'report-analytics', 'forecast', 'forecast-drivers', 'ai-opportunities', 'approvals']
export function useInventoryDashboard() {
  const { scope, key } = useBusinessScope()
  const summary = useQuery({ ...options, queryKey: [...key('inventory-summary'), env.inventoryUseMock], queryFn: ({ signal }) => api.getInventorySummary(scope, signal) })
  const can = (permission: string) => summary.data?.permissions.includes(permission) ?? false
  const health = useQuery({ ...options, queryKey: [...key('inventory-health'), env.inventoryUseMock], enabled: can('inventory.view') && can('inventory.analytics.view'), queryFn: ({ signal }) => api.getInventoryHealth(scope, signal) })
  const critical = useQuery({ ...options, queryKey: [...key('inventory-critical'), env.inventoryUseMock], enabled: can('inventory.view'), queryFn: ({ signal }) => api.getCriticalProducts(scope, signal) })
  const recent = useQuery({ ...options, queryKey: [...key('inventory-recent'), env.inventoryUseMock], enabled: can('inventory.view') && can('inventory.movements.view'), queryFn: ({ signal }) => api.getRecentMovements(scope, signal) })
  return { summary, health, critical, recent, can, isDemo: env.inventoryUseMock }
}
export function useStockMovements() {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('movements'), env.inventoryUseMock], queryFn: ({ signal }) => api.getStockMovements(scope, signal) })
  const create = useMutation({ ...options, mutationFn: (v: MovementInput) => api.createStockMovement(scope, v), onSuccess: () => invalidate(stockQueryNames) })
  const detail = useMutation({ ...options, mutationFn: (id: number) => api.getStockMovementById(scope, id) })
  return { ...query, create, detail, isDemo: env.inventoryUseMock }
}
export function useStockTransfers() {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('transfers'), env.inventoryUseMock], queryFn: ({ signal }) => api.getStockTransfers(scope, signal) })
  const save = useMutation({ ...options, mutationFn: ({ input, id }: { input: TransferInput; id?: number }) => id ? api.updateStockTransfer(scope, id, input) : api.createStockTransfer(scope, input), onSuccess: () => invalidate(stockQueryNames) })
  const action = useMutation({ ...options, mutationFn: ({ id, action }: { id: number; action: 'ready' | 'in_transit' | 'completed' | 'cancelled' }) => action === 'completed' ? api.completeStockTransfer(scope, id) : api.updateStockTransfer(scope, id, { status: action }), onSuccess: () => invalidate(stockQueryNames) })
  return { ...query, save, action, isDemo: env.inventoryUseMock }
}
