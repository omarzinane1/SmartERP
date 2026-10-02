import { Badge } from '../../../components/ui/Badge'
import { formatCurrency, formatDate } from '../../../lib/format'
import { recordStatusLabels, recordStatusTone } from '../types/customers.types'
import type { CustomerInvoice } from '../types/customers.types'

export function CustomerInvoicesTable({ invoices, allowed, compact = false, onOpen }: {
  invoices: CustomerInvoice[]; allowed: boolean; compact?: boolean; onOpen: (title: string, content: string) => void
}) {
  if (!allowed) return <div className="customer-restricted">Restricted <span>Accès aux factures requis.</span></div>
  const visible = compact ? invoices.slice(0, 3) : invoices
  const inspect = (invoice: CustomerInvoice) => onOpen(invoice.reference, `Émise le ${formatDate(invoice.date)} · Échéance : ${formatDate(invoice.dueDate)}\nMontant : ${formatCurrency(invoice.amount)}\nPayé : ${formatCurrency(invoice.paid)}\nEncours : ${formatCurrency(invoice.outstanding)}\nStatut : ${recordStatusLabels[invoice.status]}`)
  return <>
    {!compact && <div className="customer-table-toolbar"><h2>Factures <span>{invoices.length}</span></h2><span>Montants en MAD</span></div>}
    <div className="customer-detail-table-scroll"><table className={`customer-detail-table ${compact ? 'customer-detail-table--compact' : ''}`} aria-label="Factures du client"><thead><tr><th>Facture</th>{!compact && <><th>Date</th><th>Échéance</th></>}<th>Montant</th>{!compact && <><th>Payé</th><th>Encours</th></>}<th>Statut</th>{!compact && <th>Actions</th>}</tr></thead><tbody>
      {visible.map((invoice) => <tr key={invoice.reference}><td><button className="customer-detail-link" onClick={() => inspect(invoice)}>{invoice.reference}</button></td>{!compact && <><td>{formatDate(invoice.date)}</td><td className={invoice.status === 'Overdue' ? 'text-danger-text' : ''}>{formatDate(invoice.dueDate)}</td></>}<td className="customer-number">{formatCurrency(invoice.amount)}</td>{!compact && <><td className="customer-number">{formatCurrency(invoice.paid)}</td><td className={`customer-number ${invoice.status === 'Overdue' ? 'text-danger-text' : ''}`}>{formatCurrency(invoice.outstanding)}</td></>}<td><Badge tone={recordStatusTone(invoice.status)}>{recordStatusLabels[invoice.status]}</Badge></td>{!compact && <td><button className="customer-detail-link" aria-label={`Consulter ${invoice.reference}`} onClick={() => inspect(invoice)}>Consulter</button></td>}</tr>)}
      {!visible.length && <tr><td colSpan={compact ? 3 : 8} className="customer-table-empty">Aucune facture disponible.</td></tr>}
    </tbody></table></div>
  </>
}
