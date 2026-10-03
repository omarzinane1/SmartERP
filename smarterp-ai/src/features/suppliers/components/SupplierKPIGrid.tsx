import { Building2, CircleDollarSign, Clock3, ShieldAlert, Wallet } from 'lucide-react'
import { formatMoney } from '../../../lib/money'
import { Badge } from '../../../components/ui/Badge'
import type { Supplier, SupplierSummary } from '../types/suppliers.types'

export function SupplierScoreBadge({ supplier }: { supplier: Pick<Supplier, 'score' | 'scoreSource'> }) {
  const score = supplier.score
  if (score === null) return <span title={supplier.scoreSource}>Non évalué</span>
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Bon' : score >= 60 ? 'À surveiller' : 'Fragile'
  return <span title={`Score fournisseur · ${supplier.scoreSource}`}><Badge tone={score >= 75 ? 'positive' : score >= 60 ? 'warning' : 'critical'}>{score} · {label}</Badge></span>
}
export function SupplierKPIGrid({ summary }: { summary: SupplierSummary }) {
  const cards = [{ label: 'Fournisseurs actifs', value: summary.active, note: 'Statut actif dans le périmètre', icon: Building2, tone: '' }, { label: 'Volume d’achats', value: formatMoney(summary.purchaseVolume), note: 'Commandes confirmées du périmètre', icon: CircleDollarSign, tone: '' }, { label: 'Solde fournisseur', value: formatMoney(summary.outstandingBalance), note: 'Montant restant à payer', icon: Wallet, tone: 'indigo' }, { label: 'Délai moyen fournisseur', value: summary.averageLeadTimeDays === null ? 'Indisponible' : `${summary.averageLeadTimeDays} jours`, note: 'Moyenne des délais disponibles', icon: Clock3, tone: '' }, { label: 'Fournisseurs à risque', value: summary.atRisk ?? 'Non évalué', note: 'Risque élevé, indépendant du score', icon: ShieldAlert, tone: 'orange' }]
  return <section className="business-kpis supplier-kpis" aria-label="Indicateurs des fournisseurs filtrés">{cards.map(({ label, value, note, icon: Icon, tone }) => <article key={label} className={`business-card business-kpi ${tone}`}><div><h2>{label}</h2><Icon size={15} /></div><strong>{value}</strong><small>{note}</small></article>)}</section>
}
