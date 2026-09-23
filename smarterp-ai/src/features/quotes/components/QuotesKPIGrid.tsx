import { CalendarDays, CheckCheck, CircleDollarSign, Clock3, TrendingUp } from 'lucide-react'
import { formatNumber, formatPercentage } from '../../../lib/format'
import { formatQuoteMoney as formatCurrency } from '../utils/quoteCalculations'
import { isExpiringQuote, totalQuotes } from '../quotes.utils'
import type { Quote } from '../types/quotes.types'

export function QuotesKPIGrid({ quotes, asOf, period }: { quotes: Quote[]; asOf: string; period: string }) {
  const accepted = quotes.filter((quote) => quote.status === 'accepted')
  const nonDraft = quotes.filter((quote) => quote.status !== 'draft').length
  const expiring = quotes.filter((quote) => isExpiringQuote(quote, asOf))
  // Conversion = acceptés / devis ayant quitté Brouillon, avec les mêmes filtres que la liste.
  const conversion = nonDraft ? accepted.length / nonDraft * 100 : 0
  const cards = [
    { label: period === 'month' ? 'Devis ce mois' : 'Devis sur la période', value: formatNumber(quotes.length), detail: 'Selon les filtres sélectionnés', icon: CalendarDays, color: 'slate' },
    { label: 'Montant total des devis', value: formatNumber(totalQuotes(quotes), 2), unit: 'MAD', detail: `${quotes.length} devis · Montants TTC`, icon: CircleDollarSign, color: 'slate' },
    { label: 'Devis acceptés', value: formatNumber(accepted.length), detail: `${formatCurrency(totalQuotes(accepted))} acceptés`, icon: CheckCheck, color: 'green' },
    { label: 'Taux de conversion', value: formatPercentage(conversion), detail: `${accepted.length} acceptés / ${nonDraft} hors brouillon`, icon: TrendingUp, color: 'blue' },
    { label: 'Expirant sous 7 jours', value: formatNumber(expiring.length), detail: `Valeur engagée : ${formatCurrency(totalQuotes(expiring))}`, icon: Clock3, color: 'orange' },
  ]
  return <section aria-label="Indicateurs devis" className="quotes-kpis">
    {cards.map(({ label, value, unit, detail, icon: Icon, color }) => <article key={label} className={`dashboard-card quotes-kpi quotes-kpi-${color}`}>
      <div className="flex items-center justify-between gap-2"><h2>{label}</h2><Icon className="size-3.5 shrink-0 opacity-70" /></div>
      <p className="quotes-kpi-value">{value} {unit && <span>{unit}</span>}</p>
      <p className="quotes-kpi-detail">{detail}</p>
      {color === 'green' && <div className="quotes-kpi-meter"><span style={{ width: `${quotes.length ? accepted.length / quotes.length * 100 : 0}%` }} /></div>}
      {color === 'blue' && <div className="quotes-kpi-meter"><span style={{ width: `${conversion}%` }} /></div>}
    </article>)}
  </section>
}
