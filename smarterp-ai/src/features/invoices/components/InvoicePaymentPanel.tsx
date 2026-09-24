import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreditCard } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { formatDate } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { remainingAmount } from '../utils/invoiceCalculations'
import { paymentSchema } from '../schemas/invoice.schema'
import { paymentLabels, type InvoiceDetail, type InvoicePaymentInput } from '../types/invoices.types'

export function InvoicePaymentPanel({ invoice, canPay, busy, onPay }: { invoice: InvoiceDetail; canPay: boolean; busy: boolean; onPay: () => void }) {
  const labels = { pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé' }
  return <section id="invoice-payments" tabIndex={-1} className="invoice-card" aria-labelledby="invoice-payments-title"><header className="invoice-section-title"><CreditCard size={15} /><h2 id="invoice-payments-title">Paiements</h2><span>{paymentLabels[invoice.paymentStatus]}</span></header><dl className="invoice-payment-metrics"><div><dt>Total facture</dt><dd>{formatMoney(invoice.totalAmount)}</dd></div><div><dt>Total payé</dt><dd>{formatMoney(invoice.paidAmount)}</dd></div><div><dt>Solde restant</dt><dd>{formatMoney(remainingAmount(invoice))}</dd></div></dl>{invoice.payments.length ? <div className="invoice-table-scroll"><table className="invoice-related-table"><thead><tr><th>Référence</th><th>Date</th><th>Méthode</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{invoice.payments.map((payment) => <tr key={payment.id}><td>{payment.reference}</td><td>{formatDate(payment.date)}</td><td>{payment.method}</td><td>{formatMoney(payment.amount)}</td><td>{labels[payment.status] ?? payment.status}</td></tr>)}</tbody></table></div> : <p className="invoice-empty">Aucun paiement affecté à cette facture.</p>}{canPay && <footer className="invoice-panel-footer"><Button variant="secondary" className="invoice-button" disabled={busy} onClick={onPay}><CreditCard size={13} />Enregistrer paiement</Button></footer>}</section>
}
export function InvoicePaymentDialog({ invoice, busy, isDemo, error, onClose, onSubmit }: { invoice: InvoiceDetail; busy: boolean; isDemo: boolean; error: string | null; onClose: () => void; onSubmit: (input: InvoicePaymentInput) => void }) {
  const form = useForm<InvoicePaymentInput>({ resolver: zodResolver(paymentSchema(remainingAmount(invoice))), defaultValues: { date: invoice.asOf, amount: remainingAmount(invoice), method: 'Virement bancaire', reference: '', note: '' } })
  return <Dialog title={`Enregistrer un paiement · ${invoice.reference}`} className="invoice-dialog" busy={busy} onClose={onClose}><p>Solde disponible : <strong>{formatMoney(remainingAmount(invoice))}</strong></p>{isDemo && <p className="invoice-demo-note">Paiement simulé en mémoire. Aucun règlement réel ni écriture comptable persistée.</p>}<form noValidate onSubmit={form.handleSubmit(onSubmit)}><fieldset disabled={busy} className="invoice-payment-fields">
    <label>Date du paiement<input type="date" {...form.register('date')} aria-invalid={!!form.formState.errors.date} /><span className="invoice-field-error">{form.formState.errors.date?.message}</span></label>
    <label>Montant (MAD)<input type="number" step="0.01" {...form.register('amount', { valueAsNumber: true })} aria-invalid={!!form.formState.errors.amount} /><span className="invoice-field-error">{form.formState.errors.amount?.message}</span></label>
    <label>Méthode<select {...form.register('method')}>{['Virement bancaire', 'Espèces', 'Carte', 'Chèque'].map((method) => <option key={method}>{method}</option>)}</select></label>
    <label>Référence du paiement<input {...form.register('reference')} /><span className="invoice-field-error">{form.formState.errors.reference?.message}</span></label>
    <label>Note<textarea rows={2} {...form.register('note')} /><span className="invoice-field-error">{form.formState.errors.note?.message}</span></label>
  </fieldset>{error && <p role="alert" className="invoice-error">{error}</p>}<footer><Button className="invoice-button" variant="secondary" disabled={busy} onClick={onClose} autoFocus>Annuler</Button><Button type="submit" className="invoice-button invoice-primary" disabled={busy}>{busy ? 'Enregistrement du paiement…' : isDemo ? 'Simuler le paiement' : 'Confirmer le paiement'}</Button></footer></form></Dialog>
}
