import { env } from '../../../config/env'
import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, MoreHorizontal, Send } from 'lucide-react'
import { Checkbox } from '../../../components/ui/Checkbox'
import { Dialog } from '../../../components/ui/Dialog'
import { formatDate } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { daysOverdue, invoiceGroupLabel, remainingAmount } from '../utils/invoiceCalculations'
import type { InvoiceGroup, InvoicePermission, InvoiceSummary } from '../types/invoices.types'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'

export interface InvoiceCollectionProps { invoices: InvoiceSummary[]; asOf: string; selected: number[]; permissions: InvoicePermission[]; busy: boolean; onSelect: (id: number) => void; onSend: (invoice: InvoiceSummary) => void; onExport: (invoices: InvoiceSummary[]) => void }
export function InvoiceTable({ invoices, asOf, selected, permissions, busy, group, onSelect, onSelectPage, onSend, onExport }: InvoiceCollectionProps & { group: InvoiceGroup; onSelectPage: () => void }) {
  const [more, setMore] = useState<InvoiceSummary | null>(null)
  const grouped = new Map<string, InvoiceSummary[]>()
  for (const invoice of invoices) { const label = invoiceGroupLabel(invoice, group, asOf); grouped.set(label, [...grouped.get(label) ?? [], invoice]) }
  const allSelected = invoices.length > 0 && invoices.every((invoice) => selected.includes(invoice.id))
  return <><div className="invoice-table-scroll" tabIndex={0} role="region" aria-label="Tableau des factures"><table className="invoice-table"><caption className="sr-only">Factures clients</caption><thead><tr>
    <th><Checkbox aria-label="Sélectionner la page" checked={allSelected} onChange={onSelectPage} /></th><th>Référence</th><th>Client</th><th>Date</th><th>Échéance</th><th className="invoice-money">Montant TTC</th><th className="invoice-money">Payé</th><th className="invoice-money">Solde restant</th><th>Statut</th><th>Retard</th><th>Actions</th>
  </tr></thead><tbody>{[...grouped].map(([label, rows]) => <Fragment key={label}>{group && <tr className="invoice-group-row"><th colSpan={11}>{label} <span>· {rows.length} facture(s) sur cette page</span></th></tr>}{rows.map((invoice) => <tr key={invoice.id} data-selected={selected.includes(invoice.id)}>
    <td><Checkbox aria-label={`Sélectionner ${invoice.reference}`} checked={selected.includes(invoice.id)} onChange={() => onSelect(invoice.id)} /></td><td><Link to={`/invoices/${invoice.id}`} className="invoice-reference">{invoice.reference}</Link></td><td><Link to={`/customers/${invoice.customerId}`}>{invoice.customerName}</Link><small>{invoice.salesperson}</small></td><td>{formatDate(invoice.invoiceDate)}</td><td className={daysOverdue(invoice, asOf) ? 'invoice-late-text' : ''}>{formatDate(invoice.dueDate)}</td>
    <td className="invoice-money">{formatMoney(invoice.totalAmount)}</td><td className="invoice-money invoice-paid-text">{formatMoney(invoice.paidAmount)}</td><td className="invoice-money"><strong>{formatMoney(remainingAmount(invoice))}</strong></td><td><InvoiceStatusBadge invoice={invoice} asOf={asOf} /></td><td>{daysOverdue(invoice, asOf) > 0 ? <span className="invoice-late-text">{daysOverdue(invoice, asOf)} j</span> : '—'}</td>
    <td><div className="invoice-row-actions"><Link to={`/invoices/${invoice.id}`} aria-label={`Ouvrir ${invoice.reference}`}>Ouvrir</Link>{permissions.includes('invoices.send') && invoice.capabilities.canSend && invoice.workflowStatus === 'posted' && <button disabled={busy} aria-label={`Envoyer ${invoice.reference}`} onClick={() => onSend(invoice)}><Send size={12} /></button>}<button aria-label={`Exporter ${invoice.reference}`} disabled={!env.invoicesUseMock && !permissions.includes('reports.export')} onClick={() => onExport([invoice])}><Download size={12} /></button><button aria-label={`Plus d’actions pour ${invoice.reference}`} onClick={() => setMore(invoice)}><MoreHorizontal size={13} /></button></div></td>
  </tr>)}</Fragment>)}</tbody></table></div>
    {more && <Dialog title={`Actions · ${more.reference}`} className="invoice-dialog" onClose={() => setMore(null)}>
      <div className="invoice-more-links">
        <Link to={`/invoices/${more.id}`}>Consulter la facture et ses paiements</Link>
        <Link to={`/customers/${more.customerId}`}>Ouvrir le client · {more.customerName}</Link>
        {more.salesOrderId && <Link to={`/sales/${more.salesOrderId}`}>Ouvrir la commande · {more.salesOrderReference}</Link>}
      </div>
      <footer><button className="invoice-button" onClick={() => setMore(null)} autoFocus>Fermer</button></footer>
    </Dialog>}
  </>
}
