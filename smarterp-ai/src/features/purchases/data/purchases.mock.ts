import { calculateTotals } from '../../../lib/money'
import { changeSupplierPurchases, supplierSnapshot, suppliersMock } from '../../suppliers/data/suppliers.mock'
import { purchaseSchema, receiptSchema } from '../schemas/purchase.schema'
import { receiptProgress } from '../purchases.utils'
import type { PurchaseInput, PurchaseOrder, PurchasingPermission, ReceiptInput } from '../types/purchases.types'

export const purchasingDemoDate = '2026-09-30'
export const purchasingPermissions: PurchasingPermission[] = ['suppliers.view', 'suppliers.edit', 'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.confirm', 'receipts.create', 'supplier_invoices.view', 'supplier_invoices.create', 'supplier_invoices.edit', 'payments.view', 'payments.create', 'finance.view', 'ai.use']
export class PurchasingNotFoundError extends Error {}
export const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 250))
const stores = new Map<string, PurchaseOrder[]>()
function initialize() {
  return suppliersMock.flatMap((s, index): PurchaseOrder[] => {
    const id = index === 0 ? 321 : 400 + index
    const status = index < 4 ? 'confirmed' : (['draft', 'sent', 'confirmed', 'cancelled'] as const)[index % 4]
    const total = index === 0 ? 86400 : Math.round(s.purchaseVolume * .4)
    const lines = index === 0 ? [
      { id: 'box', productName: 'Premium Packaging Box', description: 'Carton renforcé · lot professionnel', quantity: 1000, receivedQuantity: 600, unitPrice: 45, discountRate: 0, taxRate: 20, previousPrice: 42.6, averagePrice: 43.64 },
      { id: 'film', productName: 'Film de protection', description: 'Rouleau recyclable', quantity: 900, receivedQuantity: 540, unitPrice: 30, discountRate: 0, taxRate: 20, previousPrice: 30, averagePrice: 29.5 },
    ] : [{ id: `line-${id}`, productName: `${s.category} · fourniture`, description: 'Lot de démonstration', quantity: 10, receivedQuantity: status === 'confirmed' ? index % 3 === 0 ? 10 : index % 3 === 1 ? 5 : 0 : 0, unitPrice: total / 10, discountRate: 0, taxRate: 0, previousPrice: total / 10 * .95, averagePrice: total / 10 * .98 }]
    const received = lines.some((l) => l.receivedQuantity > 0)
    const order: PurchaseOrder = { id, reference: `PO-2026-${String(id).padStart(4, '0')}`, supplierId: s.id, supplierName: s.name, date: '2026-09-22', expectedDate: index % 3 === 0 ? '2026-09-29' : '2026-10-05', buyer: s.buyer, warehouse: 'Casablanca Central', notes: '', lines, total: calculateTotals(lines).total, status, receiptStatus: !received ? 'not_received' : lines.every((l) => l.quantity === l.receivedQuantity) ? 'received' : 'partially_received', billingStatus: 'not_billed', billedAmount: 0, paidAmount: 0, invoiceIds: [], receipts: received ? [{ id: index === 0 ? 148 : 200 + index, reference: `REC-2026-${String(index === 0 ? 148 : 200 + index).padStart(4, '0')}`, date: '2026-09-25', warehouse: 'Casablanca Central', lines: lines.map((l) => ({ lineId: l.id, quantity: l.receivedQuantity })) }] : [], documents: [], activities: [{ id: `created-${id}`, date: '2026-09-22', title: 'Commande créée', detail: 'Données de démonstration' }], capabilities: { canEdit: status === 'draft', canSend: status === 'draft', canConfirm: status === 'draft' || status === 'sent', canReceive: status === 'confirmed', canBill: status === 'confirmed' } }
    const historicalTotal = s.purchaseVolume - (status === 'confirmed' ? order.total : 0)
    if (!historicalTotal) return [order]
    const history: PurchaseOrder = { ...structuredClone(order), id: 10000 + s.id, reference: `PO-2026-H${s.id}`, date: '2026-03-01', expectedDate: '2026-03-20', status: 'confirmed', receiptStatus: 'received', total: historicalTotal, lines: [{ ...lines[0], id: `history-${s.id}`, productName: `Historique ${s.category}`, quantity: 1, receivedQuantity: 1, unitPrice: historicalTotal, taxRate: 0, previousPrice: null, averagePrice: null }], receipts: [{ id: 10000 + s.id, reference: `REC-2026-H${s.id}`, date: '2026-03-18', warehouse: order.warehouse, lines: [{ lineId: `history-${s.id}`, quantity: 1 }] }], activities: [{ id: `history-${s.id}`, date: '2026-03-18', title: 'Réception historique', detail: 'Achats antérieurs regroupés dans la démonstration' }], capabilities: { canEdit: false, canSend: false, canConfirm: false, canReceive: false, canBill: false } }
    return [order, history]
  })
}
function store(scope: string) { if (!stores.has(scope)) stores.set(scope, initialize()); return stores.get(scope)! }
export function purchaseSnapshot(scope: string) { const suppliers = supplierSnapshot(scope); return structuredClone(store(scope).map((o) => ({ ...o, supplierName: suppliers.find((s) => s.id === o.supplierId)?.name ?? o.supplierName }))) }
export function purchaseById(scope: string, id: number) { const order = purchaseSnapshot(scope).find((o) => o.id === id); if (!order) throw new PurchasingNotFoundError(); return order }
export async function savePurchaseMock(scope: string, input: PurchaseInput, id?: number) {
  await mockDelay()
  const values = purchaseSchema.parse(input)
  const supplier = supplierSnapshot(scope).find((s) => s.id === values.supplierId && s.status === 'active')
  if (!supplier) throw new Error('Fournisseur indisponible')
  const original = id === undefined ? undefined : store(scope).find((o) => o.id === id)
  if (id !== undefined && (!original || original.status !== 'draft')) throw new Error('Commande non modifiable')
  const nextId = id ?? Math.max(...store(scope).map((o) => o.id)) + 1
  const order: PurchaseOrder = { ...values, lines: values.lines.map((l) => ({ ...l, receivedQuantity: 0 })), id: nextId, reference: original?.reference ?? `PO-DEMO-${nextId}`, supplierName: supplier.name, total: calculateTotals(values.lines).total, status: 'draft', receiptStatus: 'not_received', billingStatus: 'not_billed', receipts: [], invoiceIds: [], billedAmount: 0, paidAmount: 0, documents: [], activities: [...original?.activities ?? [], { id: crypto.randomUUID(), date: purchasingDemoDate, title: 'Brouillon enregistré', detail: 'Simulation en mémoire' }], capabilities: { canEdit: true, canSend: true, canConfirm: true, canReceive: false, canBill: false } }
  if (original) Object.assign(original, order); else store(scope).unshift(order)
  return structuredClone(order)
}
export async function purchaseActionMock(scope: string, id: number, action: 'send' | 'confirm' | 'receive', input?: ReceiptInput) {
  await mockDelay()
  const order = store(scope).find((o) => o.id === id)
  if (!order) throw new PurchasingNotFoundError()
  if (action === 'receive') {
    if (order.status !== 'confirmed' || order.receiptStatus === 'received' || !input) throw new Error('Réception impossible')
    const values = receiptSchema(order).parse(input)
    values.lines.forEach((line) => { const original = order.lines.find((l) => l.id === line.lineId)!; original.receivedQuantity = Math.round((original.receivedQuantity + line.quantity) * 1000) / 1000 })
    const receiptId = Math.max(20000, ...store(scope).flatMap((o) => o.receipts.map((r) => r.id))) + 1
    order.receipts.push({ ...values, lines: values.lines.filter((l) => l.quantity > 0), id: receiptId, reference: `REC-DEMO-${receiptId}` })
    const progress = receiptProgress(order)
    order.receiptStatus = progress.received >= progress.ordered ? 'received' : 'partially_received'
  } else {
    if (action === 'send' && order.status !== 'draft' || action === 'confirm' && !['draft', 'sent'].includes(order.status)) throw new Error('Transition interdite')
    purchaseSchema.parse(order)
    order.status = action === 'send' ? 'sent' : 'confirmed'
    if (action === 'confirm') changeSupplierPurchases(scope, order.supplierId, order.total, order.date)
  }
  order.capabilities = { canEdit: false, canSend: false, canConfirm: order.status === 'sent', canReceive: order.status === 'confirmed' && order.receiptStatus !== 'received', canBill: order.status === 'confirmed' }
  order.activities.unshift({ id: crypto.randomUUID(), date: input?.date ?? purchasingDemoDate, title: action === 'receive' ? 'Réception simulée' : action === 'send' ? 'Envoi simulé' : 'Confirmation simulée', detail: action === 'send' ? 'Aucun e-mail envoyé.' : 'Aucun mouvement de stock ou engagement réel.' })
  return structuredClone(order)
}
