import { ArrowDownLeft, ArrowUpRight, Clock3, Hourglass } from 'lucide-react'
import { formatMoney } from '../../../lib/money'
import type { PaymentSummary } from '../types/payments.types'

export function PaymentKPIGrid({ summary }: { summary: PaymentSummary }) {
  const cards = [
    { label: 'Reçus', value: formatMoney(summary.received), note: 'Encaissements confirmés', icon: ArrowDownLeft, tone: 'green' },
    { label: 'Envoyés', value: formatMoney(summary.sent), note: 'Décaissements confirmés', icon: ArrowUpRight, tone: '' },
    { label: 'En attente', value: formatMoney(summary.pending), note: 'Entrants et sortants en traitement', icon: Hourglass, tone: 'orange' },
    { label: 'Délai moyen d’encaissement', value: summary.averageCollectionDays === null ? 'Indisponible' : `${summary.averageCollectionDays} jours`, note: `${summary.datedReceipts} encaissement(s) avec dates exploitables`, icon: Clock3, tone: 'indigo' },
  ]
  return <section className="business-kpis" aria-label="Indicateurs des paiements filtrés">{cards.map(({ label, value, note, icon: Icon, tone }) => <article key={label} className={`business-card business-kpi ${tone}`}><div><h2>{label}</h2><Icon size={16} /></div><strong>{value}</strong><small>{note}</small></article>)}</section>
}
