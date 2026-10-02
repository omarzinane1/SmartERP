import { Badge } from '../../../components/ui/Badge'
import { formatCurrency, formatDate, formatPercentage } from '../../../lib/format'
import { recordStatusLabels, recordStatusTone } from '../types/customers.types'
import type { CustomerSale } from '../types/customers.types'

export function CustomerSalesTable({ sales, allowed, compact = false, quotes = false, onQuotesChange, onOpen }: {
  sales: CustomerSale[]; allowed: boolean; compact?: boolean; quotes?: boolean
  onQuotesChange?: (quotes: boolean) => void; onOpen: (title: string, content: string) => void
}) {
  if (!allowed) return <div className="customer-restricted">Restricted <span>Accès aux ventes requis.</span></div>
  const rows = sales.filter((sale) => sale.kind === (quotes ? 'quote' : 'order'))
  const visible = compact ? rows.slice(0, 3) : rows
  return <>
    {!compact && <div className="customer-table-toolbar"><h2>{quotes ? 'Devis' : 'Commandes récentes'} <span>{rows.length}</span></h2><div className="customer-table-switch"><button aria-pressed={!quotes} onClick={() => onQuotesChange?.(false)}>Commandes</button><button aria-pressed={quotes} onClick={() => onQuotesChange?.(true)}>Devis</button></div></div>}
    <div className="customer-detail-table-scroll"><table className={`customer-detail-table ${compact ? 'customer-detail-table--compact' : ''}`} aria-label={quotes ? 'Devis du client' : 'Commandes du client'}><thead><tr><th>{quotes ? 'Devis' : 'Commande'}</th>{!compact && <><th>Date</th><th>Commercial</th></>}<th>Montant</th>{!compact && <th>Marge</th>}<th>Statut</th>{!compact && <><th>Paiement</th><th>Actions</th></>}</tr></thead><tbody>
      {visible.map((sale) => <tr key={sale.reference}><td><button className="customer-detail-link" onClick={() => onOpen(sale.reference, `${quotes ? 'Devis' : 'Commande'} du ${formatDate(sale.date)}\nCommercial : ${sale.salesperson}\nMontant : ${formatCurrency(sale.amount)}\nMarge : ${(sale.margin === null ? '—' : formatPercentage(sale.margin))}\nStatut : ${recordStatusLabels[sale.status]}\nPaiement : ${recordStatusLabels[sale.paymentStatus]}`)}>{sale.reference}</button></td>{!compact && <><td>{formatDate(sale.date)}</td><td>{sale.salesperson}</td></>}<td className="customer-number">{formatCurrency(sale.amount)}</td>{!compact && <td>{(sale.margin === null ? '—' : formatPercentage(sale.margin))}</td>}<td><Badge tone={recordStatusTone(sale.status)}>{recordStatusLabels[sale.status]}</Badge></td>{!compact && <><td><Badge tone={recordStatusTone(sale.paymentStatus)}>{recordStatusLabels[sale.paymentStatus]}</Badge></td><td><button className="customer-detail-link" aria-label={`Consulter ${sale.reference}`} onClick={() => onOpen(sale.reference, `Montant : ${formatCurrency(sale.amount)}\nCommercial : ${sale.salesperson}\nStatut : ${recordStatusLabels[sale.status]}\nLe détail des lignes sera disponible avec le module Ventes.`)}>Consulter</button></td></>}</tr>)}
      {!visible.length && <tr><td colSpan={compact ? 3 : 8} className="customer-table-empty">Aucun {quotes ? 'devis' : 'ordre de vente'} disponible.</td></tr>}
    </tbody></table></div>
  </>
}
