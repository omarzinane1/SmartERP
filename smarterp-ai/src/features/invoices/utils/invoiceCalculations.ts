import { calculateTotals, sumMoney } from '../../../lib/money'
import type { AgingBucket, AgingKey, InvoiceFilters, InvoiceGroup, InvoiceLine, InvoicePresentation, InvoiceSummary } from '../types/invoices.types'
import { presentationLabels } from '../types/invoices.types'

export const calculateInvoiceTotals = (lines: InvoiceLine[]) => calculateTotals(lines)
export const remainingAmount = (invoice: Pick<InvoiceSummary, 'totalAmount' | 'paidAmount' | 'creditTotal' | 'balanceDue'>) => Math.max(0, invoice.balanceDue ?? sumMoney([invoice.totalAmount, -invoice.paidAmount, -(invoice.creditTotal ?? 0)]))
export const daysOverdue = (invoice: InvoiceSummary, asOf: string) => invoice.workflowStatus === 'posted' && remainingAmount(invoice) > 0
  ? Math.max(0, Math.round((Date.parse(`${asOf}T12:00:00Z`) - Date.parse(`${invoice.dueDate}T12:00:00Z`)) / 86400000)) : 0
export function agingKey(invoice: InvoiceSummary, asOf: string): AgingKey | null {
  if (invoice.workflowStatus !== 'posted' || remainingAmount(invoice) <= 0) return null
  const days = daysOverdue(invoice, asOf)
  return days === 0 ? 'current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+'
}
export function calculateAging(invoices: InvoiceSummary[], asOf: string): AgingBucket[] {
  const buckets: AgingBucket[] = [{ key: 'current', label: 'Non échues', count: 0, amount: 0 }, { key: '1-30', label: '1–30 jours', count: 0, amount: 0 }, { key: '31-60', label: '31–60 jours', count: 0, amount: 0 }, { key: '61-90', label: '61–90 jours', count: 0, amount: 0 }, { key: '90+', label: '90+ jours', count: 0, amount: 0 }]
  for (const invoice of invoices) {
    const bucket = buckets.find((item) => item.key === agingKey(invoice, asOf))
    if (bucket) { bucket.count++; bucket.amount = sumMoney([bucket.amount, remainingAmount(invoice)]) }
  }
  return buckets
}
export function invoiceKPIs(invoices: InvoiceSummary[], asOf: string) {
  const issued = invoices.filter((invoice) => invoice.workflowStatus === 'posted')
  const late = issued.filter((invoice) => daysOverdue(invoice, asOf) > 0)
  return { invoiced: sumMoney(issued.map((invoice) => sumMoney([invoice.totalAmount, -(invoice.creditTotal ?? 0)]))), paid: sumMoney(issued.map((invoice) => invoice.paidAmount)), remaining: sumMoney(issued.map(remainingAmount)), overdue: sumMoney(late.map(remainingAmount)), overdueCount: late.length }
}
export function presentation(invoice: InvoiceSummary, asOf: string): InvoicePresentation {
  if (invoice.workflowStatus !== 'posted') return invoice.workflowStatus
  if (daysOverdue(invoice, asOf) > 0) return 'overdue'
  return invoice.paymentStatus
}
export const defaultInvoiceFilters: InvoiceFilters = { search: '', quick: 'all', customerId: '', salesperson: '', workflow: '', payment: '', dateFrom: '', dateTo: '', dueFrom: '', dueTo: '', minAmount: '', maxAmount: '', aging: '' }
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function filterInvoices(invoices: InvoiceSummary[], filters: InvoiceFilters, asOf: string) {
  return invoices.filter((invoice) => {
    const issued = invoice.workflowStatus === 'posted'
    const until = Math.round((Date.parse(`${invoice.dueDate}T12:00:00Z`) - Date.parse(`${asOf}T12:00:00Z`)) / 86400000)
    return (!filters.search || normalize(`${invoice.reference} ${invoice.customerName} ${invoice.salesOrderReference ?? ''}`).includes(normalize(filters.search)))
      && (!filters.customerId || String(invoice.customerId) === filters.customerId)
      && (!filters.salesperson || invoice.salesperson === filters.salesperson)
      && (!filters.workflow || invoice.workflowStatus === filters.workflow) && (!filters.payment || invoice.paymentStatus === filters.payment)
      && (!filters.dateFrom || invoice.invoiceDate >= filters.dateFrom) && (!filters.dateTo || invoice.invoiceDate <= filters.dateTo)
      && (!filters.dueFrom || invoice.dueDate >= filters.dueFrom) && (!filters.dueTo || invoice.dueDate <= filters.dueTo)
      && (!filters.minAmount || invoice.totalAmount >= Number(filters.minAmount)) && (!filters.maxAmount || invoice.totalAmount <= Number(filters.maxAmount))
      && (!filters.aging || agingKey(invoice, asOf) === filters.aging)
      && (filters.quick === 'all' || (filters.quick === 'draft' && invoice.workflowStatus === 'draft')
        || (filters.quick === 'unpaid' && issued && invoice.paymentStatus === 'unpaid')
        || (filters.quick === 'partial' && issued && invoice.paymentStatus === 'partially_paid')
        || (filters.quick === 'paid' && issued && invoice.paymentStatus === 'paid')
        || (filters.quick === 'overdue' && daysOverdue(invoice, asOf) > 0)
        || (filters.quick === 'soon' && issued && remainingAmount(invoice) > 0 && until >= 0 && until <= 7))
  })
}
export function invoiceGroupLabel(invoice: InvoiceSummary, group: InvoiceGroup, asOf: string) {
  return group === 'status' ? presentationLabels[presentation(invoice, asOf)] : group === 'customer' ? invoice.customerName : group === 'salesperson' ? invoice.salesperson : group === 'month' ? invoice.invoiceDate.slice(0, 7) : group === 'due' ? invoice.dueDate : group === 'aging' ? agingKey(invoice, asOf) ?? 'Hors créances ouvertes' : ''
}
export function exportInvoices(invoices: InvoiceSummary[], asOf: string, isDemo: boolean) {
  const escape = (value: string | number) => {
    const text = String(value)
    return `"${(/^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
  }
  const rows: (string | number)[][] = [['Référence', 'Client', 'Date', 'Échéance', 'TTC MAD', 'Payé MAD', 'Solde MAD', 'Workflow', 'Paiement', 'Jours de retard', 'Source'], ...invoices.map((invoice) => [invoice.reference, invoice.customerName, invoice.invoiceDate, invoice.dueDate, invoice.totalAmount, invoice.paidAmount, remainingAmount(invoice), invoice.workflowStatus, invoice.paymentStatus, daysOverdue(invoice, asOf), isDemo ? 'Démonstration' : 'Serveur'])]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((row) => row.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `factures${isDemo ? '-demo' : ''}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
