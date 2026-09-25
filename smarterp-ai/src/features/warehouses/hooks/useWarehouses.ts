import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { stockQueryNames } from '../../inventory/hooks/useStockData'
import { getStockTransfers } from '../../inventory/api/inventory.api'
import * as api from '../api/warehouses.api'
import type { WarehouseInput } from '../types/warehouses.types'
export function useWarehouses() {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('warehouses'), env.warehousesUseMock], queryFn: ({ signal }) => api.getWarehouses(scope, signal) })
  const create = useMutation({ ...options, mutationFn: (v: WarehouseInput) => api.createWarehouse(scope, v), onSuccess: () => invalidate(stockQueryNames) })
  return { ...query, create, isDemo: env.warehousesUseMock }
}
export function useWarehouseDetail(id: number, valid: boolean) {
  const { scope, key } = useBusinessScope()
  const detail = useQuery({ ...options, queryKey: [...key('warehouse'), env.warehousesUseMock, id], enabled: valid, queryFn: ({ signal }) => api.getWarehouseById(scope, id, signal) })
  const can = (p: string) => detail.data?.permissions.includes(p) ?? false
  const enabled = can('warehouses.view') && can('inventory.view')
  const inventory = useQuery({ ...options, queryKey: [...key('warehouse-inventory'), env.warehousesUseMock, id], enabled, queryFn: ({ signal }) => api.getWarehouseInventory(scope, id, signal) })
  const movements = useQuery({ ...options, queryKey: [...key('warehouse-movements'), env.warehousesUseMock, id], enabled: enabled && can('inventory.movements.view'), queryFn: ({ signal }) => api.getWarehouseMovements(scope, id, signal) })
  const valuation = useQuery({ ...options, queryKey: [...key('warehouse-valuation'), env.warehousesUseMock, id], enabled, queryFn: ({ signal }) => api.getWarehouseValuation(scope, id, signal) })
  const transfers = useQuery({ ...options, queryKey: [...key('transfers'), env.inventoryUseMock], enabled: can('warehouses.view') && can('inventory.transfers.view'), queryFn: ({ signal }) => getStockTransfers(scope, signal) })
  return { detail, inventory, movements, valuation, transfers, can, isDemo: env.warehousesUseMock }
}
