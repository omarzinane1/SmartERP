import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog } from '../../../components/ui/Dialog'
import { Button } from '../../../components/ui/Button'
import { formatMoney } from '../../../lib/money'
import { recordPaymentSchema } from '../schemas/payment.schema'
import { paymentMethodLabels, type PaymentInput, type PaymentInvoiceOption } from '../types/payments.types'

export function RecordPaymentModal({ invoices, partners: partnerOptions, initialInvoice, asOf, isDemo, busy, error, onClose, onSubmit }: { invoices: PaymentInvoiceOption[]; partners?: { id: number; name: string; type: 'customer' | 'supplier' }[]; initialInvoice?: PaymentInvoiceOption; asOf: string; isDemo: boolean; busy: boolean; error: string | null; onClose: () => void; onSubmit: (input: PaymentInput) => void }) {
  const form = useForm<PaymentInput>({ resolver: zodResolver(recordPaymentSchema(invoices, !isDemo && !initialInvoice)), defaultValues: { direction: initialInvoice?.direction ?? 'incoming', partnerId: initialInvoice?.partnerId ?? 0, invoiceId: initialInvoice?.id ?? 0, date: asOf, amount: initialInvoice?.remainingAmount ?? 0, method: 'bank_transfer', referenceExternal: '', note: '' } })
  const [direction, partnerId, invoiceId] = useWatch({ control: form.control, name: ['direction', 'partnerId', 'invoiceId'] })
  const partners = !isDemo && partnerOptions ? partnerOptions.filter((p) => p.type === (direction === 'incoming' ? 'customer' : 'supplier')).map((p): [number, string] => [p.id, p.name]) : [...new Map(invoices.filter((invoice) => invoice.direction === direction).map((invoice) => [invoice.partnerId, invoice.partnerName])).entries()]
  const available = invoices.filter((invoice) => invoice.direction === direction && invoice.partnerId === partnerId)
  const selected = available.find((invoice) => invoice.id === invoiceId)
  const errors = form.formState.errors
  return <Dialog title="Enregistrer un paiement" className="business-dialog" busy={busy} onClose={onClose}>
    <p>{isDemo || initialInvoice ? 'Choisissez une facture ouverte du tiers.' : 'Choisissez une facture client ou enregistrez un paiement non affecté. Les décaissements fournisseurs restent non affectés jusqu’au module Factures fournisseurs.'}</p>
    {isDemo && <p className="business-info">Simulation en mémoire. Aucun paiement bancaire ni écriture comptable réelle.</p>}
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}><fieldset disabled={busy} className="business-form-grid">
      <label className="wide">Type de paiement<select aria-label="Type de paiement" {...form.register('direction')} onChange={(event) => { form.setValue('direction', event.target.value as PaymentInput['direction']); form.setValue('partnerId', 0); form.setValue('invoiceId', 0); form.setValue('amount', 0); form.clearErrors() }}><option value="incoming">Encaissement client</option><option value="outgoing">Décaissement fournisseur</option></select></label>
      <label className="wide">Tiers *<select aria-label="Tiers *" {...form.register('partnerId', { valueAsNumber: true })} onChange={(event) => { form.setValue('partnerId', Number(event.target.value)); form.setValue('invoiceId', 0); form.setValue('amount', 0) }}><option value="0">Sélectionnez un tiers</option>{partners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><small>{errors.partnerId?.message}</small></label>
      <label className="wide">Facture liée<select aria-label="Facture liée *" {...form.register('invoiceId', { valueAsNumber: true })} onChange={(event) => { const id = Number(event.target.value); form.setValue('invoiceId', id); form.setValue('amount', available.find((invoice) => invoice.id === id)?.remainingAmount ?? 0) }}><option value="0">{!isDemo && !initialInvoice ? 'Paiement non affecté' : 'Sélectionnez une facture ouverte'}</option>{available.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.reference} · {formatMoney(invoice.remainingAmount)}</option>)}</select><small>{errors.invoiceId?.message}</small></label>
      <label>Date *<input type="date" {...form.register('date')} /><small>{errors.date?.message}</small></label><label>Montant (MAD) *<input aria-label="Montant (MAD) *" type="number" min="0.01" step="0.01" {...form.register('amount', { valueAsNumber: true })} /><small>{errors.amount?.message}</small></label>
      <label>Méthode de paiement *<select {...form.register('method')}>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Référence externe<input {...form.register('referenceExternal')} /><small>{errors.referenceExternal?.message}</small></label>
      <label className="wide">Note<textarea rows={2} {...form.register('note')} /><small>{errors.note?.message}</small></label>
    </fieldset>{selected && <p className="business-info">Solde disponible : {formatMoney(selected.remainingAmount)}. Le serveur vérifiera de nouveau ce montant.</p>}{!partners.length && <p>Aucun tiers disponible pour ce sens de paiement.</p>}{error && <p role="alert" className="business-error">{error}</p>}
      <footer><Button variant="secondary" className="business-button" disabled={busy} onClick={onClose}>Retour</Button><Button type="submit" className="business-button" disabled={busy || !partners.length}>{busy ? 'Enregistrement…' : isDemo ? 'Simuler le paiement' : 'Confirmer le paiement'}</Button></footer>
    </form>
  </Dialog>
}

