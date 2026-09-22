import { Activity, FileText, Files, Mail, MessageSquare, Phone, ShoppingCart, Sparkles, Wallet } from 'lucide-react'
import type { CustomerActivity, CustomerPermission } from '../types/customers.types'

const icons = { sale: ShoppingCart, quote: FileText, invoice: FileText, payment: Wallet, call: Phone, email: Mail, document: Files, note: MessageSquare, ai: Sparkles }

export function CustomerActivityTimeline({ activities, permissions, compact = false }: { activities: CustomerActivity[]; permissions: CustomerPermission[]; compact?: boolean }) {
  const visible = compact ? activities.slice(0, 4) : activities
  return <section className={`customer-activity ${compact ? 'customer-activity--compact' : ''}`}><div className="customer-section-heading"><h2><Activity size={13} />{compact ? 'Fil d’activité récent' : 'Historique d’activité'}</h2><span>{compact ? 'CRM' : `${activities.length} événements`}</span></div><ol>
    {visible.map((activity) => {
      const allowed = activity.permissions.every((permission) => permissions.includes(permission))
      const Icon = allowed ? icons[activity.type] : Activity
      return <li key={activity.id}><div className={`customer-activity-icon customer-activity-icon--${allowed ? activity.type : 'restricted'}`}><Icon size={12} /></div><div><div className="customer-activity-title"><strong>{allowed ? activity.title : 'Restricted'}</strong><time dateTime={activity.createdAt}>{new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', ...(!compact ? { hour: '2-digit', minute: '2-digit' } as const : {}), timeZone: 'Africa/Casablanca' }).format(new Date(activity.createdAt))}</time></div>{allowed ? <><p>{activity.description}</p><small>{activity.user} · <span>{activity.record}</span></small></> : <p>Accès à cet événement limité.</p>}</div></li>
    })}
  </ol>{!visible.length && <p className="customer-table-empty">Aucune activité disponible.</p>}</section>
}
