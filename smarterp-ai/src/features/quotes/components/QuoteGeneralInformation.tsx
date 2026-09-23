import { useFormContext } from 'react-hook-form'
import { Building2, SlidersHorizontal } from 'lucide-react'
import { Input } from '../../../components/ui/Input'
import { CustomerSelector } from './CustomerSelector'
import type { QuoteDetail, QuoteInput } from '../types/quotes.types'

export function QuoteGeneralInformation({ quote, editable, busy, onCustomerChange }: {
  quote: QuoteDetail | null; editable: boolean; busy: boolean
  onCustomerChange: (customer: { id: number; name: string; email: string } | null) => void
}) {
  const { register, formState: { errors } } = useFormContext<QuoteInput>()
  return <section className="dashboard-card quote-general" aria-label="Informations générales">
    <div className="quote-section-title"><SlidersHorizontal className="size-4" /><h2>Informations générales</h2><span>Client et conditions de l’offre</span></div>
    <fieldset disabled={!editable || busy} className="quote-general-grid">
      <div className="quote-general-customer">
        {editable ? <CustomerSelector disabled={busy} onChange={onCustomerChange} /> : <div className="quote-customer-card"><Building2 className="size-5 text-blue-500" /><div>
          <strong>{quote?.customerName}</strong><p>CUS-{String(quote?.customerId).padStart(6, '0')}</p><p>{quote?.customerEmail}</p>
        </div></div>}
        <label htmlFor="quote-address" className="mt-4">Adresse de facturation</label>
        <textarea id="quote-address" rows={3} {...register('billingAddress')} aria-invalid={!!errors.billingAddress} />
        <p className="quote-field-error">{errors.billingAddress?.message}</p>
        <label htmlFor="quote-subject" className="mt-3">Objet du devis</label>
        <Input id="quote-subject" placeholder="Ex. Fourniture et installation d’équipements" {...register('subject')} aria-invalid={!!errors.subject} />
        <p className="quote-field-error">{errors.subject?.message}</p>
      </div>
      <div className="quote-fields-grid">
        <div className="col-span-2"><label htmlFor="quote-salesperson">Commercial responsable *</label><Input id="quote-salesperson" {...register('salesperson')} aria-invalid={!!errors.salesperson} aria-describedby="quote-salesperson-error" /><p id="quote-salesperson-error" className="quote-field-error">{errors.salesperson?.message}</p></div>
        <div><label htmlFor="quote-issue-date">Date du devis *</label><Input id="quote-issue-date" type="date" {...register('issueDate')} aria-invalid={!!errors.issueDate} aria-describedby="quote-issue-error" /><p id="quote-issue-error" className="quote-field-error">{errors.issueDate?.message}</p></div>
        <div><label htmlFor="quote-expiration">Date d’expiration *</label><Input id="quote-expiration" type="date" {...register('expiresAt')} aria-invalid={!!errors.expiresAt} aria-describedby="quote-expiration-error" /><p id="quote-expiration-error" className="quote-field-error">{errors.expiresAt?.message}</p></div>
        <div><label htmlFor="quote-currency">Devise</label><select id="quote-currency" {...register('currency')}><option value="MAD">MAD — Dirham marocain</option></select></div>
        <div><label htmlFor="quote-customer-reference">Référence client</label><Input id="quote-customer-reference" placeholder="Ex. Bon de consultation" {...register('customerReference')} aria-invalid={!!errors.customerReference} /><p className="quote-field-error">{errors.customerReference?.message}</p></div>
        <div className="col-span-2"><label htmlFor="quote-payment-terms">Conditions de paiement</label><Input id="quote-payment-terms" placeholder="Ex. 30 jours fin de mois" {...register('paymentTerms')} aria-invalid={!!errors.paymentTerms} /><p className="quote-field-error">{errors.paymentTerms?.message}</p></div>
      </div>
    </fieldset>
  </section>
}
