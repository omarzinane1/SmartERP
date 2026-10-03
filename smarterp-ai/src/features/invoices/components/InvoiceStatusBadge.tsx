import { Badge } from '../../../components/ui/Badge'
import { daysOverdue } from '../utils/invoiceCalculations'
import { paymentLabels, workflowLabels, type InvoiceSummary } from '../types/invoices.types'

export function InvoiceStatusBadge({ invoice, asOf }: { invoice: InvoiceSummary; asOf: string }) {
  const late = daysOverdue(invoice, asOf)
  return <span className="invoice-statuses">{invoice.workflowStatus !== 'posted' ? <Badge tone={invoice.workflowStatus === 'cancelled' ? 'critical' : 'neutral'}>{workflowLabels[invoice.workflowStatus] ?? invoice.workflowStatus}</Badge>
    : <><Badge tone={invoice.paymentStatus === 'paid' ? 'positive' : invoice.paymentStatus === 'partially_paid' ? 'indigo' : 'info'}>{(invoice.creditTotal ?? 0) > 0 && invoice.paymentStatus === 'paid' ? 'Soldée avec avoir' : paymentLabels[invoice.paymentStatus] ?? invoice.paymentStatus}</Badge>{late > 0 && <Badge tone="warning">En retard</Badge>}</>}</span>
}
export function InvoiceWorkflowStatusBar({ invoice }: { invoice: InvoiceSummary | null }) {
  const status = invoice?.workflowStatus ?? 'draft'
  return <section className="invoice-workflow" aria-label="Workflow de facturation"><span>Cycle de facturation</span><ol><li aria-current={status === 'draft' ? 'step' : undefined}>1 <span>Brouillon</span></li><li aria-hidden="true">→</li><li aria-current={status === 'posted' ? 'step' : undefined}>2 <span>Validée</span></li></ol>{status === 'cancelled' && <Badge tone="critical">Annulée</Badge>}{invoice?.workflowStatus === 'posted' && <div>Paiement <Badge tone={invoice.paymentStatus === 'paid' ? 'positive' : 'info'}>{(invoice.creditTotal ?? 0) > 0 && invoice.paymentStatus === 'paid' ? 'Soldée avec avoir' : paymentLabels[invoice.paymentStatus]}</Badge></div>}</section>
}
