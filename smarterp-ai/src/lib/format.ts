export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value)
}

export function formatCurrency(value: number, currency = 'MAD'): string {
  return `${formatNumber(value)} ${currency}`
}

export function formatPercentage(value: number): string {
  return `${formatNumber(value, 1)} %`
}

export function formatDate(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR').format(date)
}
