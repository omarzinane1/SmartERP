import { Link } from 'react-router-dom'
import { Checkbox } from '../../../components/ui/Checkbox'
import { formatDate } from '../../../lib/format'
import { formatMoney, sumMoney } from '../../../lib/money'
import { daysOverdue, presentation, remainingAmount } from '../utils/invoiceCalculations'
import { presentationLabels, type InvoicePresentation } from '../types/invoices.types'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'
import type { InvoiceCollectionProps } from './InvoiceTable'

export function InvoiceKanban({ invoices, asOf, selected, permissions, busy, onSelect, onSend, onExport }: InvoiceCollectionProps) {
  const columns: InvoicePresentation[] = ['draft', 'unpaid', 'partially_paid', 'overdue', 'paid', 'cancelled']
  return <div className="invoice-kanban-scroll" tabIndex={0} role="region" aria-label="Kanban des factures"><div className="invoice-kanban">{columns.map((status) => {
    const rows = invoices.filter((invoice) => presentation(invoice, asOf) === status)
    return <section key={status} className={`invoice-kanban-column invoice-column-${status}`} aria-label={presentationLabels[status]}><header><h2>{presentationLabels[status]}<span>{rows.length}</span></h2><p>{formatMoney(sumMoney(rows.map(remainingAmount)))} <span>{['draft', 'cancelled'].includes(status) ? 'hors créances émises' : 'à recevoir'}</span></p></header>
      {rows.map((invoice) => <article key={invoice.id} className="invoice-kanban-card"><header><Checkbox aria-label={`Sélectionner ${invoice.reference}`} checked={selected.includes(invoice.id)} onChange={() => onSelect(invoice.id)} /><Link className="invoice-reference" to={`/invoices/${invoice.id}`}>{invoice.reference}</Link></header><Link className="invoice-kanban-customer" to={`/customers/${invoice.customerId}`}>{invoice.customerName}</Link><InvoiceStatusBadge invoice={invoice} asOf={asOf} /><dl><div><dt>TTC</dt><dd>{formatMoney(invoice.totalAmount)}</dd></div><div><dt>Payé</dt><dd>{formatMoney(invoice.paidAmount)}</dd></div><div><dt>Solde</dt><dd>{formatMoney(remainingAmount(invoice))}</dd></div></dl><p className={daysOverdue(invoice, asOf) ? 'invoice-late-text' : ''}>Échéance : {formatDate(invoice.dueDate)}{daysOverdue(invoice, asOf) > 0 && ` · ${daysOverdue(invoice, asOf)} j de retard`}</p>
        <footer><Link to={`/invoices/${invoice.id}`}>Ouvrir</Link>{permissions.includes('invoices.send') && invoice.capabilities.canSend && invoice.workflowStatus === 'posted' && <button disabled={busy} onClick={() => onSend(invoice)}>Envoyer</button>}<button onClick={() => onExport([invoice])}>CSV</button></footer></article>)}
      {!rows.length && <p className="invoice-kanban-empty">Aucune facture</p>}
    </section>
  })}</div></div>
}
