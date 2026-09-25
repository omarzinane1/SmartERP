import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Eye } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { formatDate } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { paymentGroupLabel } from '../payments.utils'
import { paymentDirectionLabels, paymentMethodLabels, paymentStatusLabels, type Payment, type PaymentGroup, type PaymentPermission } from '../types/payments.types'

export function PaymentStatusBadge({ status }: { status: Payment['status'] }) {
  return <Badge tone={status === 'completed' ? 'positive' : status === 'pending' ? 'warning' : status === 'failed' ? 'critical' : 'neutral'}>{paymentStatusLabels[status]}</Badge>
}
export function PaymentTable({ payments, group, permissions, busy, onOpen, onCancel }: { payments: Payment[]; group: PaymentGroup; permissions: PaymentPermission[]; busy: boolean; onOpen: (payment: Payment) => void; onCancel: (payment: Payment) => void }) {
  const groups = new Map<string, Payment[]>()
  for (const payment of payments) { const key = paymentGroupLabel(payment, group); groups.set(key, [...groups.get(key) ?? [], payment]) }
  return <div className="business-table-scroll" tabIndex={0} role="region" aria-label="Tableau des paiements"><table className="business-table payment-table"><thead><tr><th>Référence</th><th>Date</th><th>Type</th><th>Tiers</th><th>Facture</th><th>Méthode</th><th className="money">Montant</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
    {[...groups].map(([label, rows]) => <Fragment key={label}>{group && <tr className="group"><th colSpan={9}>{label} · {rows.length} sur cette page</th></tr>}{rows.map((payment) => <tr key={payment.id}>
      <td><button onClick={() => onOpen(payment)} className="text-blue-700 font-medium">{payment.reference}</button>{payment.referenceExternal && <small>{payment.referenceExternal}</small>}</td><td>{formatDate(payment.date)}</td><td><Badge tone={payment.direction === 'incoming' ? 'positive' : 'info'}>{paymentDirectionLabels[payment.direction]}</Badge></td>
      <td><Link to={`/${payment.partnerType === 'customer' ? 'customers' : 'suppliers'}/${payment.partnerId}`}>{payment.partnerName}</Link><small>{payment.partnerType === 'customer' ? 'Client' : 'Fournisseur'}</small></td>
      <td>{payment.invoiceId ? <Link to={`/${payment.partnerType === 'customer' ? 'invoices' : 'supplier-invoices'}/${payment.invoiceId}`}>{payment.invoiceReference}</Link> : <span title="Fiche facture fournisseur à venir">{payment.invoiceReference ?? 'Non affecté'}</span>}</td>
      <td>{paymentMethodLabels[payment.method]}</td><td className="money"><strong>{formatMoney(payment.amount)}</strong></td><td><PaymentStatusBadge status={payment.status} /></td>
      <td><div className="business-actions"><button aria-label={`Ouvrir ${payment.reference}`} onClick={() => onOpen(payment)}><Eye size={14} /></button>{permissions.includes('payments.cancel') && payment.canCancel && !['cancelled', 'failed'].includes(payment.status) && <button className="danger" disabled={busy} aria-label={`Annuler paiement ${payment.reference}`} onClick={() => onCancel(payment)}><Ban size={13} /></button>}</div></td>
    </tr>)}</Fragment>)}
  </tbody></table></div>
}
