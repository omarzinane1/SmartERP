import { sumMoney } from '../../../lib/money'
import { movementSnapshot, stockSnapshot } from '../../inventory/data/inventory.mock'
import { productSnapshot, stockDemoDate } from '../../products/data/products.mock'
import type { WarehouseValuation } from '../types/warehouses.types'
export function warehouseValuationMock(scope: string, id: number): WarehouseValuation {
  const rows = stockSnapshot(scope).filter((r) => r.warehouseId === id), movements = movementSnapshot(scope).filter((m) => m.warehouseId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id), costs = new Map(productSnapshot(scope).map((p) => [p.id, p.averageCost]))
  let value = sumMoney(rows.map((r) => r.value))
  const daily = new Map<string, number>([[stockDemoDate, value]])
  for (const movement of movements) { if (!daily.has(movement.date)) daily.set(movement.date, value); value = sumMoney([value, -movement.quantity * (costs.get(movement.productId) ?? 0)]) }
  return { byProduct: rows.map((r) => ({ name: r.productName, value: r.value })), history: rows.length ? [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })) : [], source: 'Reconstitution à partir des mouvements et des coûts moyens actuels constants ; aucune évolution historique des coûts n’est supposée.' }
}
