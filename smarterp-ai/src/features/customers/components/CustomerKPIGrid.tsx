import { formatCurrency, formatNumber, formatPercentage } from '../../../lib/format'
import type { CustomerSummary } from '../types/customers.types'

export function CustomerKPIGrid({ summary, canSales, canInvoices, canPayments, loading }: {
  summary?: CustomerSummary; canSales: boolean; canInvoices: boolean; canPayments: boolean; loading: boolean
}) {
  const money = (value: number | null | undefined) => value == null ? '—' : formatCurrency(value)
  const metrics = [
    { label: 'Chiffre d’affaires (YTD)', value: money(summary?.revenue), caption: summary?.revenueGrowth == null ? 'Année en cours' : `+${formatPercentage(summary.revenueGrowth)} vs N−1`, allowed: canSales, tone: 'green' },
    { label: 'Panier moyen', value: money(summary?.averageOrderValue), caption: 'Par commande facturée', allowed: canSales, tone: '' },
    { label: 'Encours client', value: money(summary?.outstanding), caption: summary?.overdue == null ? 'Solde ouvert' : `${money(summary.overdue)} en retard`, allowed: canInvoices, tone: 'amber' },
    { label: 'Délai moyen (DSO)', value: summary?.paymentDelay == null ? '—' : `${formatNumber(summary.paymentDelay)} jours`, caption: summary?.previousPaymentDelay == null ? 'Historique des règlements' : `Précédent : ${summary.previousPaymentDelay} jours`, allowed: canPayments, tone: 'rose' },
    { label: 'Rentabilité · Marge brute', value: summary?.profitability == null ? '—' : formatPercentage(summary.profitability), caption: 'Sur les ventes annuelles', allowed: canSales, tone: 'green' },
    { label: 'Commandes totales', value: summary?.totalOrders == null ? '—' : formatNumber(summary.totalOrders), caption: 'Année en cours', allowed: canSales, tone: '' },
  ]
  return <section aria-label="Indicateurs du client" className="customer-kpi-grid" aria-busy={loading}>{metrics.map((metric) => <article key={metric.label} className={`customer-kpi customer-kpi--${metric.tone}`}><h2>{metric.label}</h2><strong>{!metric.allowed ? 'Restricted' : loading ? <span className="customer-detail-skeleton-line" /> : metric.value}</strong><p>{metric.allowed ? metric.caption : 'Accès limité'}</p></article>)}</section>
}
