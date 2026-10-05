export function formatNumber(value: number | null, maximumFractionDigits = 0): string {
  if (value === null) return 'Indisponible'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value)
}

export function formatCurrency(value: number | null, currency = 'MAD'): string {
  return value === null ? 'Indisponible' : `${formatNumber(value)} ${currency}`
}

export function formatPercentage(value: number | null): string {
  return value === null ? 'Indisponible' : `${formatNumber(value, 1)} %`
}

export function formatDate(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR').format(date)
}
