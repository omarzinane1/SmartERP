import { sumMoney } from '../../lib/money'
import { paymentDirectionLabels, paymentMethodLabels, paymentStatusLabels, type Payment, type PaymentFilters, type PaymentGroup, type PaymentSummary } from './types/payments.types'

export const paymentDefaultFilters: PaymentFilters = { search: '', direction: '', partnerType: '', partnerId: '', invoice: '', method: '', status: '', period: 'month', dateFrom: '', dateTo: '', minAmount: '', maxAmount: '' }
export function paymentPeriod(period: string, asOf: string) {
  const date = new Date(`${asOf}T12:00:00Z`)
  if (period === 'today') return [asOf, asOf]
  if (period === 'month') return [asOf.slice(0, 8) + '01', asOf]
  if (period === 'week') { date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return [date.toISOString().slice(0, 10), asOf] }
  return ['', '']
}
export function filterPayments(rows: Payment[], filters: PaymentFilters, asOf: string) {
  const [from, to] = filters.period === 'custom' ? [filters.dateFrom, filters.dateTo] : paymentPeriod(filters.period, asOf)
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return rows.filter((row) => (!filters.search || normalize(`${row.reference} ${row.partnerName} ${row.invoiceReference ?? ''} ${row.referenceExternal}`).includes(normalize(filters.search))) &&
    (!filters.direction || row.direction === filters.direction) && (!filters.partnerType || row.partnerType === filters.partnerType) &&
    (!filters.partnerId || `${row.partnerType}:${row.partnerId}` === filters.partnerId) && (!filters.invoice || (row.invoiceReference ?? '').includes(filters.invoice)) &&
    (!filters.method || row.method === filters.method) && (!filters.status || row.status === filters.status) &&
    (!from || row.date >= from) && (!to || row.date <= to) && (!filters.minAmount || row.amount >= Number(filters.minAmount)) && (!filters.maxAmount || row.amount <= Number(filters.maxAmount)))
}
export function paymentSummary(rows: Payment[]): PaymentSummary {
  const receipts = rows.filter((row) => row.direction === 'incoming' && row.status === 'completed')
  const delays = receipts.flatMap((row) => {
    if (!row.invoiceIssuedDate) return []
    const days = Math.round((Date.parse(`${row.date}T12:00:00Z`) - Date.parse(`${row.invoiceIssuedDate}T12:00:00Z`)) / 86400000)
    return Number.isFinite(days) && days >= 0 ? [days] : []
  })
  return { received: sumMoney(receipts.map((row) => row.amount)), sent: sumMoney(rows.filter((row) => row.direction === 'outgoing' && row.status === 'completed').map((row) => row.amount)), pending: sumMoney(rows.filter((row) => row.status === 'pending').map((row) => row.amount)), averageCollectionDays: delays.length ? Math.round(delays.reduce((sum, days) => sum + days, 0) / delays.length) : null, datedReceipts: delays.length }
}
export function paymentGroupLabel(payment: Payment, group: PaymentGroup) {
  return group === 'direction' ? paymentDirectionLabels[payment.direction] : group === 'method' ? paymentMethodLabels[payment.method] : group === 'status' ? paymentStatusLabels[payment.status] : group === 'month' ? payment.date.slice(0, 7) : group === 'customer' || group === 'supplier' ? payment.partnerType === group ? payment.partnerName : group === 'customer' ? 'Autres tiers · fournisseurs' : 'Autres tiers · clients' : ''
}
