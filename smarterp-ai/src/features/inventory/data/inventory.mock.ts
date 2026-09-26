import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { sumMoney } from '../../../lib/money'
import { productSnapshot, productsMock, stockDemoDate, stockDemoPermissions } from '../../products/data/products.mock'
import { productHealth } from '../../products/products.utils'
import type { CatalogProduct } from '../../products/types/products.types'
import { warehouseSnapshot, warehousesMock } from '../../warehouses/data/warehouses.mock'
import type { WarehouseSummary } from '../../warehouses/types/warehouses.types'
import { movementSchema, transferSchema } from '../schemas/inventory.schema'
import type { InventoryRow, InventorySummary, MovementInput, StockMovement, StockRow, StockTransfer, TransferInput, TransferStatus } from '../types/inventory.types'

interface StockStore { rows: StockRow[]; movements: StockMovement[]; transfers: StockTransfer[] }
const stores = new Map<string, StockStore>()
const quantity = (n: number) => Math.round(n * 1000) / 1000
function initialize(): StockStore {
  const rows = productsMock.filter((p) => p.type === 'product').flatMap((p, n) => warehousesMock.map((w): StockRow => {
    const onHand = p.id === 104 ? [120, 48, 0][w.id - 1] : p.id === 501 ? [600, 0, 0][w.id - 1] : p.id === 502 ? [540, 0, 0][w.id - 1] : n % 7 === 0 ? 0 : n % 7 === 1 ? 5 : n % 7 === 2 ? 220 + w.id * 30 : 30 + n * 2 + w.id * 8
    const reserved = p.id === 104 ? w.id === 1 ? 20 : 0 : Math.min(onHand, n % 5 === 0 ? 4 : 0)
    return { productId: p.id, warehouseId: w.id, onHand, reserved, incoming: 0, lastMovementAt: n % 8 === 0 ? '2026-05-15' : '2026-09-25' }
  }))
  const movements = rows.filter((r) => r.onHand > 0).map((r, n): StockMovement => {
    const product = productsMock.find((p) => p.id === r.productId)!, warehouse = warehousesMock.find((w) => w.id === r.warehouseId)!
    const type = (['in', 'out', 'adjustment', 'return'] as const)[n % 4]
    const delta = type === 'out' ? -5 : Math.min(5, r.onHand)
    return { id: 800 + n, reference: `MOV-2026-${String(800 + n).padStart(4, '0')}`, date: r.lastMovementAt, type, productId: r.productId, productName: product.name, warehouseId: warehouse.id, warehouseName: warehouse.name, destinationId: null, destinationName: null, quantity: delta, before: quantity(r.onHand - delta), after: r.onHand, sourceReference: 'SOLDE-INITIAL', sourcePath: null, user: 'Omar Zinane', note: 'Mouvement historique de démonstration. Quantités physiques avant/après.' }
  })
  return { rows, movements, transfers: [] }
}
function store(scope: string) {
  if (!stores.has(scope)) {
    stores.set(scope, initialize())
    const state = stores.get(scope)!
    const product = state.rows.find((r) => r.warehouseId === 1 && r.productId !== 104 && r.productId !== 501 && r.productId !== 502 && r.onHand - r.reserved > 20)!
    for (const [n, status] of (['draft', 'ready', 'in_transit', 'completed', 'cancelled'] as const).entries()) {
      const t: StockTransfer = { id: 120 + n, reference: `TRF-2026-${120 + n}`, sourceId: 1, destinationId: 2, sourceName: 'Casablanca Central', destinationName: 'Rabat Distribution', date: '2026-09-26', referenceExternal: '', notes: 'Transfert de démonstration', lines: [{ productId: product.productId, quantity: 2 }], status, user: 'Omar Zinane', activities: [], capabilities: transferCapabilities(status) }
      state.transfers.push(t)
      if (status === 'in_transit' || status === 'completed') dispatchTransfer(scope, t)
      if (status === 'completed') finishTransfer(scope, t)
    }
  }
  return stores.get(scope)!
}
export function stockSnapshot(scope: string): InventoryRow[] {
  const products = productSnapshot(scope), warehouses = warehouseSnapshot(scope)
  return structuredClone(store(scope).rows.map((r) => { const p = products.find((p) => p.id === r.productId)!; return { ...r, productName: p.name, sku: p.sku, warehouseName: warehouses.find((w) => w.id === r.warehouseId)!.name, available: quantity(r.onHand - r.reserved), value: Math.round(r.onHand * p.averageCost * 100) / 100, minimum: p.minimumStock, health: productHealth(p, r.onHand - r.reserved), unit: p.unit } }))
}
export function catalogSnapshot(scope: string): CatalogProduct[] {
  const rows = stockSnapshot(scope)
  return productSnapshot(scope).map((p) => {
    if (p.type === 'service') return { ...p, onHand: null, reserved: null, available: null, incoming: null, stockValue: null, stockHealth: 'not_stocked' }
    const stock = rows.filter((r) => r.productId === p.id), onHand = quantity(stock.reduce((s, r) => s + r.onHand, 0)), reserved = quantity(stock.reduce((s, r) => s + r.reserved, 0)), available = quantity(onHand - reserved)
    return { ...p, onHand, reserved, available, incoming: quantity(stock.reduce((s, r) => s + r.incoming, 0)), stockValue: sumMoney(stock.map((r) => r.value)), stockHealth: productHealth(p, available) }
  })
}
export function movementSnapshot(scope: string) { const products = productSnapshot(scope); return structuredClone(store(scope).movements.map((m) => ({ ...m, productName: products.find((p) => p.id === m.productId)?.name ?? m.productName })).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)) }
export const transferSnapshot = (scope: string) => structuredClone(store(scope).transfers)
export function warehouseSummaryMock(scope: string): WarehouseSummary[] {
  const rows = stockSnapshot(scope), transfers = transferSnapshot(scope)
  return warehouseSnapshot(scope).map((w) => { const stock = rows.filter((r) => r.warehouseId === w.id), usedCapacity = quantity(stock.reduce((s, r) => s + r.onHand, 0)); return { ...w, stockValue: sumMoney(stock.map((r) => r.value)), products: stock.filter((r) => r.onHand > 0).length, lowStock: stock.filter((r) => r.health === 'low_stock').length, outOfStock: stock.filter((r) => r.health === 'out_of_stock').length, usedCapacity, capacityPercent: w.capacity > 0 ? usedCapacity / w.capacity * 100 : null, incomingTransfers: transfers.filter((t) => t.destinationId === w.id && ['ready', 'in_transit'].includes(t.status)).length } })
}
export function inventorySummaryMock(scope: string): InventorySummary {
  const products = catalogSnapshot(scope), rows = stockSnapshot(scope)
  return { value: sumMoney(rows.map((r) => r.value)), available: quantity(rows.reduce((s, r) => s + r.available, 0)), lowStock: products.filter((p) => p.stockHealth === 'low_stock').length, outOfStock: products.filter((p) => p.stockHealth === 'out_of_stock').length, dormantValue: sumMoney(rows.filter((r) => r.lastMovementAt < '2026-07-02').map((r) => r.value)), incoming: quantity(rows.reduce((s, r) => s + r.incoming, 0)), products, rows, warehouses: warehouseSummaryMock(scope), permissions: stockDemoPermissions, asOf: stockDemoDate }
}
function getRow(scope: string, productId: number, warehouseId: number) {
  let row = store(scope).rows.find((r) => r.productId === productId && r.warehouseId === warehouseId)
  if (!row) { row = { productId, warehouseId, onHand: 0, reserved: 0, incoming: 0, lastMovementAt: stockDemoDate }; store(scope).rows.push(row) }
  return row
}
function appendMovement(scope: string, row: StockRow, delta: number, type: StockMovement['type'], date: string, sourceReference: string, note: string, destinationId: number | null = null) {
  const state = store(scope), id = Math.max(1000, ...state.movements.map((m) => m.id)) + 1
  const product = productSnapshot(scope).find((p) => p.id === row.productId)!, warehouse = warehouseSnapshot(scope).find((w) => w.id === row.warehouseId)!
  const before = row.onHand; row.onHand = quantity(row.onHand + delta); row.lastMovementAt = date
  const m: StockMovement = { id, reference: `MOV-DEMO-${id}`, date, type, productId: product.id, productName: product.name, warehouseId: warehouse.id, warehouseName: warehouse.name, destinationId, destinationName: warehouseSnapshot(scope).find((w) => w.id === destinationId)?.name ?? null, quantity: delta, before, after: row.onHand, sourceReference, sourcePath: type === 'transfer' ? '/inventory/transfers' : null, user: 'Omar Zinane', note }
  state.movements.unshift(m); return structuredClone(m)
}
export async function createMovementMock(scope: string, input: MovementInput) {
  await new Promise((r) => setTimeout(r, 250)); const v = movementSchema.parse(input)
  if (!productSnapshot(scope).some((p) => p.id === v.productId && p.type === 'product' && p.status === 'active') || !warehouseSnapshot(scope).some((w) => w.id === v.warehouseId && w.status === 'active')) throw new Error('Produit physique et dépôt actifs requis.')
  const row = getRow(scope, v.productId, v.warehouseId), delta = v.type === 'out' || v.type === 'adjustment' && v.adjustmentDirection === 'decrease' ? -v.quantity : v.quantity
  if (v.date < row.lastMovementAt || v.date > stockDemoDate) throw new Error('La date doit suivre le dernier mouvement et ne pas être future dans la simulation.')
  if (row.onHand + delta < row.reserved) throw new Error('Stock disponible insuffisant. Le stock réservé est protégé.')
  return appendMovement(scope, row, delta, v.type, v.date, v.sourceReference, v.note)
}
function transferCapabilities(status: TransferStatus) { return { canEdit: status === 'draft', canReady: status === 'draft', canStart: status === 'ready', canComplete: status === 'in_transit', canCancel: ['draft', 'ready'].includes(status) } }
function dispatchTransfer(scope: string, t: StockTransfer) {
  for (const l of t.lines) { const source = getRow(scope, l.productId, t.sourceId), destination = getRow(scope, l.productId, t.destinationId); appendMovement(scope, source, -l.quantity, 'transfer', stockDemoDate, t.reference, 'Expédition simulée. Quantités en transit.', t.destinationId); destination.incoming = quantity(destination.incoming + l.quantity) }
}
function finishTransfer(scope: string, t: StockTransfer) {
  for (const l of t.lines) { const destination = getRow(scope, l.productId, t.destinationId); appendMovement(scope, destination, l.quantity, 'transfer', stockDemoDate, t.reference, 'Réception de transfert simulée.', t.sourceId); destination.incoming = quantity(destination.incoming - l.quantity) }
}
export async function saveTransferMock(scope: string, input: TransferInput | { status: 'ready' | 'in_transit' | 'cancelled' }, id?: number) {
  await new Promise((r) => setTimeout(r, 250))
  const state = store(scope), original = state.transfers.find((t) => t.id === id)
  if ('status' in input) {
    if (!original || !(input.status === 'ready' && original.status === 'draft' || input.status === 'in_transit' && original.status === 'ready' || input.status === 'cancelled' && ['draft', 'ready'].includes(original.status))) throw new Error('Transition interdite.')
    if (input.status !== 'cancelled') { transferSchema(stockSnapshot(scope)).parse(original); if (![original.sourceId, original.destinationId].every((id) => warehouseSnapshot(scope).some((w) => w.id === id && w.status === 'active')) || !original.lines.every((l) => productSnapshot(scope).some((p) => p.id === l.productId && p.type === 'product' && p.status === 'active'))) throw new Error('Produits et dépôts actifs requis.') }
    if (input.status === 'in_transit') dispatchTransfer(scope, original)
    original.status = input.status; original.capabilities = transferCapabilities(input.status)
    original.activities.unshift({ id: crypto.randomUUID(), date: stockDemoDate, title: `Statut : ${input.status}`, detail: 'Transition simulée en mémoire.' }); return structuredClone(original)
  }
  const values = transferSchema(stockSnapshot(scope)).parse(input)
  if (![values.sourceId, values.destinationId].every((id) => warehouseSnapshot(scope).some((w) => w.id === id && w.status === 'active'))) throw new Error('Dépôts actifs requis.')
  if (!values.lines.every((line) => productSnapshot(scope).some((p) => p.id === line.productId && p.type === 'product' && p.status === 'active'))) throw new Error('Produits physiques actifs requis.')
  if (id !== undefined && (!original || original.status !== 'draft')) throw new Error('Transfert non modifiable.')
  const newId = id ?? Math.max(0, ...state.transfers.map((t) => t.id)) + 1
  const transfer: StockTransfer = { ...values, id: newId, reference: original?.reference ?? `TRF-DEMO-${newId}`, sourceName: warehouseSnapshot(scope).find((w) => w.id === values.sourceId)!.name, destinationName: warehouseSnapshot(scope).find((w) => w.id === values.destinationId)!.name, status: 'draft', user: 'Omar Zinane', capabilities: transferCapabilities('draft'), activities: [{ id: crypto.randomUUID(), date: stockDemoDate, title: 'Brouillon enregistré', detail: 'Simulation locale, aucun mouvement réel.' }] }
  if (original) Object.assign(original, transfer); else state.transfers.unshift(transfer)
  return structuredClone(transfer)
}
export async function completeTransferMock(scope: string, id: number) {
  await new Promise((r) => setTimeout(r, 250)); const transfer = store(scope).transfers.find((t) => t.id === id)
  if (!transfer) throw new BusinessNotFoundError()
  if (transfer.status !== 'in_transit') throw new Error('Seul un transfert en transit peut être terminé.')
  finishTransfer(scope, transfer); transfer.status = 'completed'; transfer.capabilities = transferCapabilities('completed'); transfer.activities.unshift({ id: crypto.randomUUID(), date: stockDemoDate, title: 'Transfert terminé', detail: 'Réception simulée, stocks locaux actualisés.' }); return structuredClone(transfer)
}
