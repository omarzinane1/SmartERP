import { calculateLineAmounts, sumMoney } from '../../lib/money'
import type { PurchaseFilters, PurchaseOrder } from './types/purchases.types'
export const purchaseDefaultFilters: PurchaseFilters = { search: '', supplier: '', buyer: '', status: '', receipt: '', dateFrom: '', dateTo: '', expectedFrom: '', expectedTo: '', quick: '' }
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
export function receiptProgress(order: Pick<PurchaseOrder, 'lines'>) {
  const ordered = order.lines.reduce((sum, line) => sum + line.quantity, 0)
  const received = order.lines.reduce((sum, line) => sum + line.receivedQuantity, 0)
  return { ordered, received, percent: ordered ? Math.round(received / ordered * 100) : 0 }
}
export const isDeliveryOverdue = (order: PurchaseOrder, asOf: string) => order.status === 'confirmed' && order.receiptStatus !== 'received' && order.expectedDate < asOf
export function purchaseSummary(orders: PurchaseOrder[], asOf: string) {
  const confirmed = orders.filter((order) => order.status === 'confirmed')
  const waiting = confirmed.filter((order) => order.receiptStatus !== 'received')
  return { month: sumMoney(confirmed.filter((order) => order.date.slice(0, 7) === asOf.slice(0, 7)).map((order) => order.total)), open: orders.filter((order) => ['draft', 'sent'].includes(order.status) || order.status === 'confirmed' && order.receiptStatus !== 'received').length, expected: waiting.length, overdue: waiting.filter((order) => isDeliveryOverdue(order, asOf)).length, remaining: sumMoney(waiting.flatMap((order) => order.lines.map((line) => calculateLineAmounts({ ...line, quantity: line.quantity - line.receivedQuantity }).total))) }
}
export function filterPurchases(orders: PurchaseOrder[], f: PurchaseFilters, asOf: string, buyer: string) {
  return orders.filter((o) => (!f.search || normalizeSearch([o.reference, o.supplierName, o.buyer].join(' ')).includes(normalizeSearch(f.search))) && (!f.supplier || o.supplierId === Number(f.supplier)) && (!f.buyer || o.buyer === f.buyer) && (!f.status || o.status === f.status) && (!f.receipt || o.receiptStatus === f.receipt) && (!f.dateFrom || o.date >= f.dateFrom) && (!f.dateTo || o.date <= f.dateTo) && (!f.expectedFrom || o.expectedDate >= f.expectedFrom) && (!f.expectedTo || o.expectedDate <= f.expectedTo) && (!f.quick || f.quick === 'mine' && o.buyer === buyer || f.quick === 'draft' && o.status === 'draft' || f.quick === 'confirm' && o.status === 'sent' || f.quick === 'expected' && o.status === 'confirmed' && o.receiptStatus !== 'received' || f.quick === 'partial' && o.receiptStatus === 'partially_received' || f.quick === 'overdue' && isDeliveryOverdue(o, asOf)))
}
