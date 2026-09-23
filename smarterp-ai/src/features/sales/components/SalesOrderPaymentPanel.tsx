import { CreditCard, ReceiptText } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { formatDate } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { salesFinancials } from '../sales.utils'
import { invoiceStatusLabels, paymentStatusLabels, type SalesOrderDetail } from '../types/sales.types'

export function SalesOrderInvoicePanel({ order, canCreate, busy, onCreate }: { order: SalesOrderDetail; canCreate: boolean; busy: boolean; onCreate: () => void }) {
  const { invoiced, unbilled } = salesFinancials(order)
  const labels = { draft: 'Brouillon', posted: 'Émise', cancelled: 'Annulée' }
  return <section id="sales-invoices" tabIndex={-1} className="sales-card" aria-labelledby="sales-invoices-title">
    <header className="sales-card-title"><ReceiptText size={16} aria-hidden="true" /><h2 id="sales-invoices-title">Facturation</h2><span className={`sales-badge sales-badge-${order.invoiceStatus}`}>{invoiceStatusLabels[order.invoiceStatus] ?? order.invoiceStatus}</span></header>
    <dl className="sales-panel-metrics"><div><dt>Commande TTC</dt><dd>{formatMoney(order.totalAmount)}</dd></div><div><dt>Déjà facturé</dt><dd>{formatMoney(invoiced)}</dd></div><div><dt>Reste à facturer</dt><dd>{formatMoney(unbilled)}</dd></div></dl>
    {order.invoices.length ? <div className="sales-table-scroll"><table><thead><tr><th>Facture</th><th>Date / Échéance</th><th>Montant TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{order.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.reference}</strong></td><td>{formatDate(invoice.date)}<small>Éch. {formatDate(invoice.dueDate)}</small></td><td>{formatMoney(invoice.amount)}</td><td>{labels[invoice.status] ?? invoice.status}</td><td><button disabled title="La fiche facture sera disponible dans le module Factures">Fiche à venir</button></td></tr>)}</tbody></table></div> : <p className="sales-empty">Aucune facture associée.</p>}
    {canCreate && <footer className="sales-panel-footer"><Button variant="secondary" className="sales-button" disabled={busy} onClick={onCreate}><ReceiptText size={13} />Créer une facture</Button><span>Éligibilité finale vérifiée lors de la création.</span></footer>}
  </section>
}

export function SalesOrderPaymentPanel({ order }: { order: SalesOrderDetail }) {
  const financials = salesFinancials(order)
  const labels = { pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé' }
  return <section id="sales-payments" tabIndex={-1} className="sales-card" aria-labelledby="sales-payments-title">
    <header className="sales-card-title"><CreditCard size={16} aria-hidden="true" /><h2 id="sales-payments-title">Suivi des paiements</h2><span className={`sales-badge sales-badge-${order.paymentStatus}`}>{paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}</span></header>
    <dl className="sales-panel-metrics"><div><dt>Montant facturé</dt><dd>{formatMoney(financials.invoiced)}</dd></div><div><dt>Montant payé</dt><dd>{formatMoney(financials.paid)}</dd></div><div><dt>Solde restant</dt><dd>{formatMoney(financials.balance)}</dd></div></dl>
    {order.payments.length ? <div className="sales-table-scroll"><table><thead><tr><th>Référence</th><th>Date</th><th>Facture</th><th>Méthode</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{order.payments.map((payment) => <tr key={payment.id}><td><strong>{payment.reference}</strong></td><td>{formatDate(payment.date)}</td><td>{order.invoices.find((invoice) => invoice.id === payment.invoiceId)?.reference ?? `Facture #${payment.invoiceId}`}</td><td>{payment.method}</td><td>{formatMoney(payment.amount)}</td><td>{labels[payment.status] ?? payment.status}</td></tr>)}</tbody></table></div> : <p className="sales-empty">Aucun paiement associé.</p>}
  </section>
}
