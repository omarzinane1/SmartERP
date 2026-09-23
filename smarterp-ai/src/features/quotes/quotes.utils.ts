import { quoteStatusLabels, type Quote, type QuoteFilters, type QuoteSort } from './types/quotes.types'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const totalQuotes = (quotes: Quote[]) => quotes.reduce((sum, quote) => sum + quote.totalAmount, 0)
export const canSendQuote = (quote: Quote, asOf: string) => ['draft', 'sent', 'viewed'].includes(quote.status) && quote.expiresAt >= asOf
export function daysUntilExpiration(quote: Quote, asOf: string) {
  return Math.round((Date.parse(quote.expiresAt) - Date.parse(asOf)) / 86_400_000)
}
export function isExpiringQuote(quote: Quote, asOf: string) {
  const days = daysUntilExpiration(quote, asOf)
  return canSendQuote(quote, asOf) && days >= 0 && days <= 7
}
export function filterQuotes(quotes: Quote[], filters: QuoteFilters, asOf: string) {
  const previous = new Date(`${asOf.slice(0, 7)}-01T12:00:00Z`)
  previous.setUTCMonth(previous.getUTCMonth() - 1)
  const month = filters.period === 'month' ? asOf.slice(0, 7) : previous.toISOString().slice(0, 7)
  return quotes.filter((quote) =>
    (filters.period === 'all' || quote.createdAt.startsWith(month)) &&
    (filters.status === 'all' || quote.status === filters.status) &&
    (filters.customer === 'all' || String(quote.customerId) === filters.customer) &&
    (filters.salesperson === 'all' || quote.salesperson === filters.salesperson) &&
    (!filters.expiring || isExpiringQuote(quote, asOf)) &&
    (!filters.followUp || (['sent', 'viewed'].includes(quote.status) && canSendQuote(quote, asOf))) &&
    normalize(`${quote.reference} ${quote.customerName} ${quote.salesperson}`).includes(normalize(filters.search.trim())),
  )
}
export function sortQuotes(quotes: Quote[], sort: QuoteSort) {
  return [...quotes].sort((a, b) => {
    const left = sort.key === 'status' ? quoteStatusLabels[a.status] : a[sort.key]
    const right = sort.key === 'status' ? quoteStatusLabels[b.status] : b[sort.key]
    const comparison = typeof left === 'number' && typeof right === 'number'
      ? left - right : String(left).localeCompare(String(right), 'fr', { numeric: true })
    return (comparison || a.id - b.id) * (sort.direction === 'asc' ? 1 : -1)
  })
}
export function exportQuotes(quotes: Quote[], isDemo: boolean) {
  const escape = (value: string | number) => {
    const text = String(value)
    const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = [
    ['Référence', 'Client', 'Date', 'Expiration', 'Commercial', 'Montant TTC MAD', 'Statut', 'Source'],
    ...quotes.map((quote) => [quote.reference, quote.customerName, quote.createdAt, quote.expiresAt,
      quote.salesperson, quote.totalAmount, quoteStatusLabels[quote.status], isDemo ? 'Démonstration' : 'API']),
  ]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((row) => row.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `devis${isDemo ? '-demo' : ''}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
