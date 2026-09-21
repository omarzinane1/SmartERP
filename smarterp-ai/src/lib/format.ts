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
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T12:00:00`))
}
