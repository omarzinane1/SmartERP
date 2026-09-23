import { CheckCircle2, CirclePlus, CreditCard, FileText, History, MessageSquare, Truck, XCircle } from 'lucide-react'
import type { SalesActivity } from '../types/sales.types'

const icons = { created: CirclePlus, confirmed: CheckCircle2, delivery: Truck, invoice: FileText, payment: CreditCard, note: MessageSquare, cancelled: XCircle }
const labels = { created: 'Création', confirmed: 'Confirmation', delivery: 'Livraison', invoice: 'Facturation', payment: 'Paiement', note: 'Note interne', cancelled: 'Annulation' }
export function SalesOrderActivityTimeline({ activities }: { activities: SalesActivity[] }) {
  return <section className="sales-card" aria-labelledby="sales-activity-title"><header className="sales-card-title"><History size={16} aria-hidden="true" /><h2 id="sales-activity-title">Activités de la commande</h2><span>{activities.length} événements</span></header>
    {activities.length ? <ol className="sales-timeline">{[...activities].sort((a, b) => a.date.localeCompare(b.date)).map((activity) => {
      const Icon = icons[activity.type] ?? History
      return <li key={activity.id}><span className="sales-timeline-icon"><Icon size={13} aria-hidden="true" /></span><strong>{labels[activity.type] ?? activity.type}</strong><p>{activity.description}</p>{activity.documentReference && <span className="sales-document-ref">{activity.documentReference}</span>}<small><time dateTime={activity.date}>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.date))}</time> · {activity.user}</small></li>
    })}</ol> : <p className="sales-empty">Aucune activité enregistrée.</p>}
  </section>
}
