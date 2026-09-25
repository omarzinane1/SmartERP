import { sumMoney } from '../../lib/money'
import { daysBetween, normalizeSearch } from '../purchases/purchases.utils'
import type { PayableBucket, SupplierInvoice, SupplierInvoiceFilters } from './types/supplierInvoices.types'
export const supplierInvoiceDefaultFilters: SupplierInvoiceFilters = { search: '', supplier: '', buyer: '', order: '', status: '', payment: '', dateFrom: '', dateTo: '', aging: '', quick: '' }
export const payableBalance = (invoice: Pick<SupplierInvoice, 'total' | 'paidAmount'>) => Math.max(0, sumMoney([invoice.total, -invoice.paidAmount]))
export const isPayableOverdue = (i: SupplierInvoice, asOf: string) => i.workflowStatus === 'posted' && payableBalance(i) > 0 && i.dueDate < asOf
export function payableBucket(i: SupplierInvoice, asOf: string) {
  if (i.workflowStatus !== 'posted' || payableBalance(i) <= 0) return null
  const days = daysBetween(i.dueDate, asOf)
  return days <= 0 ? 'current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+'
}
export function payableAging(invoices: SupplierInvoice[], asOf: string): PayableBucket[] {
  return [['current', 'Non échues'], ['1-30', '1–30 jours'], ['31-60', '31–60 jours'], ['61-90', '61–90 jours'], ['90+', '90+ jours']].map(([key, label]) => { const rows = invoices.filter((i) => payableBucket(i, asOf) === key); return { key, label, amount: sumMoney(rows.map(payableBalance)), count: rows.length } })
}
export function payableSummary(invoices: SupplierInvoice[], asOf: string) {
  const posted = invoices.filter((i) => i.workflowStatus === 'posted')
  return { balance: sumMoney(posted.map(payableBalance)), soon: sumMoney(posted.filter((i) => daysBetween(asOf, i.dueDate) >= 0 && daysBetween(asOf, i.dueDate) <= 7).map(payableBalance)), overdue: sumMoney(posted.filter((i) => isPayableOverdue(i, asOf)).map(payableBalance)), paid: sumMoney(posted.flatMap((i) => i.payments.filter((p) => p.status === 'completed' && p.date.slice(0, 7) === asOf.slice(0, 7)).map((p) => p.amount))) }
}
export function filterSupplierInvoices(invoices: SupplierInvoice[], f: SupplierInvoiceFilters, asOf: string) {
  return invoices.filter((i) => (!f.search || normalizeSearch([i.reference, i.supplierReference, i.supplierName, i.orderReference].join(' ')).includes(normalizeSearch(f.search))) && (!f.supplier || i.supplierId === Number(f.supplier)) && (!f.buyer || i.buyer === f.buyer) && (!f.order || i.orderId === Number(f.order)) && (!f.status || i.workflowStatus === f.status) && (!f.payment || i.paymentStatus === f.payment) && (!f.dateFrom || i.invoiceDate >= f.dateFrom) && (!f.dateTo || i.invoiceDate <= f.dateTo) && (!f.aging || payableBucket(i, asOf) === f.aging) && (!f.quick || f.quick === 'unpaid' && i.workflowStatus === 'posted' && payableBalance(i) > 0 || f.quick === 'overdue' && isPayableOverdue(i, asOf) || f.quick === 'partial' && i.paymentStatus === 'partially_paid' || f.quick === 'paid' && i.paymentStatus === 'paid' || f.quick === 'soon' && i.workflowStatus === 'posted' && payableBalance(i) > 0 && daysBetween(asOf, i.dueDate) >= 0 && daysBetween(asOf, i.dueDate) <= 7))
}
export function supplierInvoiceMatches(i: Pick<SupplierInvoice, 'lines'>) {
  const groups = new Map<string, { id: string; productName: string; quantity: number; orderedQuantity: number; receivedQuantity: number }>()
  for (const line of i.lines) {
    if (!line.purchaseLineId || line.orderedQuantity === null || line.receivedQuantity === null) continue
    const existing = groups.get(line.purchaseLineId)
    if (existing) existing.quantity = Math.round((existing.quantity + line.quantity) * 1000) / 1000
    else groups.set(line.purchaseLineId, { id: line.purchaseLineId, productName: line.productName, quantity: line.quantity, orderedQuantity: line.orderedQuantity, receivedQuantity: line.receivedQuantity })
  }
  return [...groups.values()]
}
export const hasQuantityMismatch = (i: SupplierInvoice) => supplierInvoiceMatches(i).some((line) => line.quantity > line.receivedQuantity || line.quantity > line.orderedQuantity)
