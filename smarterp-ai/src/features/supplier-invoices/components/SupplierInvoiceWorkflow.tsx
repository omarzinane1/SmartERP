import { Badge } from '../../../components/ui/Badge'
import { isPayableOverdue } from '../supplierInvoices.utils'
import { supplierInvoiceStatusLabels, supplierInvoicePaymentLabels, type SupplierInvoice } from '../types/supplierInvoices.types'
export function SupplierInvoiceWorkflow({ invoice, asOf }: { invoice: SupplierInvoice; asOf: string }) {
  return <div className="business-card purchasing-workflow" aria-label="États de la facture fournisseur"><span>Comptabilité <Badge tone={invoice.workflowStatus === 'posted' ? 'info' : 'neutral'}>{supplierInvoiceStatusLabels[invoice.workflowStatus]}</Badge></span><span>Paiement <Badge tone={invoice.paymentStatus === 'paid' ? 'positive' : 'warning'}>{supplierInvoicePaymentLabels[invoice.paymentStatus]}</Badge></span>{isPayableOverdue(invoice, asOf) && <Badge tone="critical">En retard</Badge>}<small className="ml-auto text-slate-400">Brouillon → Comptabilisée</small></div>
}
