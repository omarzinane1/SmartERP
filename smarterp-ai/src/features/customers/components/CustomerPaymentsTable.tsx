import { Badge } from '../../../components/ui/Badge'
import { formatCurrency, formatDate } from '../../../lib/format'
import { recordStatusLabels, recordStatusTone } from '../types/customers.types'
import type { CustomerPayment } from '../types/customers.types'

const methods = { 'Bank Transfer': 'Virement bancaire', Cash: 'Espèces', Card: 'Carte', Cheque: 'Chèque' }

export function CustomerPaymentsTable({ payments, allowed }: { payments: CustomerPayment[]; allowed: boolean }) {
  if (!allowed) return <div className="customer-restricted">Restricted <span>Accès aux paiements requis.</span></div>
  return <><div className="customer-table-toolbar"><h2>Paiements <span>{payments.length}</span></h2><span>Règlements reçus</span></div><div className="customer-detail-table-scroll"><table className="customer-detail-table" aria-label="Paiements du client"><thead><tr><th>Référence</th><th>Date</th><th>Facture</th><th>Méthode</th><th>Montant</th><th>Statut</th><th>Reçu par</th></tr></thead><tbody>
    {payments.map((payment) => <tr key={payment.reference}><td className="font-medium text-blue-700">{payment.reference}</td><td>{formatDate(payment.date)}</td><td>{payment.invoice}</td><td>{methods[payment.method]}</td><td className="customer-number">{formatCurrency(payment.amount)}</td><td><Badge tone={recordStatusTone(payment.status)}>{recordStatusLabels[payment.status]}</Badge></td><td>{payment.receivedBy}</td></tr>)}
    {!payments.length && <tr><td colSpan={7} className="customer-table-empty">Aucun paiement disponible.</td></tr>}
  </tbody></table></div></>
}
