import { useFormContext, useWatch } from 'react-hook-form'
import { FileText } from 'lucide-react'
import { Input } from '../../../components/ui/Input'
import { Checkbox } from '../../../components/ui/Checkbox'
import type { OnboardingData } from '../types/onboarding.types'

export function InvoicingStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<OnboardingData>()
  const values = useWatch({ control, name: 'invoicing' })
  const error = errors.invoicing
  const year = new Date().getFullYear()
  const preview = (prefix: string, start: number) =>
    `${prefix}${year}-${String(Number.isFinite(start) ? start : 1).padStart(4, '0')}`
  return (
    <div className="onboarding-fields">
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ['Facture', preview(values.invoicePrefix, values.invoiceStart)],
          ['Devis', preview(values.quotePrefix, values.quoteStart)],
          ['Commande fournisseur', preview(values.purchaseOrderPrefix, 1)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-md border border-[#e4e9f2] bg-[#f8f9fd] p-4"
          >
            <p className="flex items-center gap-2 text-[10px] text-slate-500">
              <FileText className="size-3.5" aria-hidden="true" />
              {label}
            </p>
            <p className="mt-2 truncate font-mono text-xs font-semibold text-navy-950">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <div>
          <label htmlFor="invoice-prefix">
            Préfixe facture <span>*</span>
          </label>
          <Input
            id="invoice-prefix"
            required
            aria-invalid={!!error?.invoicePrefix}
            aria-describedby={
              error?.invoicePrefix ? 'invoice-prefix-error' : undefined
            }
            {...register('invoicing.invoicePrefix')}
          />
          {error?.invoicePrefix && (
            <p id="invoice-prefix-error" role="alert" className="field-error">
              {error.invoicePrefix.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="invoice-start">
            Numéro de départ facture <span>*</span>
          </label>
          <Input
            id="invoice-start"
            type="number"
            min="1"
            step="1"
            required
            aria-invalid={!!error?.invoiceStart}
            aria-describedby={
              error?.invoiceStart ? 'invoice-start-error' : undefined
            }
            {...register('invoicing.invoiceStart', { valueAsNumber: true })}
          />
          {error?.invoiceStart && (
            <p id="invoice-start-error" role="alert" className="field-error">
              {error.invoiceStart.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="quote-prefix">
            Préfixe devis <span>*</span>
          </label>
          <Input
            id="quote-prefix"
            required
            aria-invalid={!!error?.quotePrefix}
            aria-describedby={
              error?.quotePrefix ? 'quote-prefix-error' : undefined
            }
            {...register('invoicing.quotePrefix')}
          />
          {error?.quotePrefix && (
            <p id="quote-prefix-error" role="alert" className="field-error">
              {error.quotePrefix.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="quote-start">
            Numéro de départ devis <span>*</span>
          </label>
          <Input
            id="quote-start"
            type="number"
            min="1"
            step="1"
            required
            aria-invalid={!!error?.quoteStart}
            aria-describedby={
              error?.quoteStart ? 'quote-start-error' : undefined
            }
            {...register('invoicing.quoteStart', { valueAsNumber: true })}
          />
          {error?.quoteStart && (
            <p id="quote-start-error" role="alert" className="field-error">
              {error.quoteStart.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="purchase-prefix">
            Préfixe commande fournisseur <span>*</span>
          </label>
          <Input
            id="purchase-prefix"
            required
            aria-invalid={!!error?.purchaseOrderPrefix}
            aria-describedby={
              error?.purchaseOrderPrefix ? 'purchase-prefix-error' : undefined
            }
            {...register('invoicing.purchaseOrderPrefix')}
          />
          {error?.purchaseOrderPrefix && (
            <p id="purchase-prefix-error" role="alert" className="field-error">
              {error.purchaseOrderPrefix.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="invoice-language">
            Langue facture <span>*</span>
          </label>
          <select
            id="invoice-language"
            required
            {...register('invoicing.language')}
          >
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
            <option value="ar">Arabe</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="invoice-payment">
            Conditions de paiement <span>*</span>
          </label>
          <Input
            id="invoice-payment"
            required
            aria-invalid={!!error?.paymentTerms}
            aria-describedby={
              error?.paymentTerms ? 'invoice-payment-error' : undefined
            }
            {...register('invoicing.paymentTerms')}
          />
          {error?.paymentTerms && (
            <p id="invoice-payment-error" role="alert" className="field-error">
              {error.paymentTerms.message}
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <label htmlFor="invoice-footer">Pied de page facture</label>
          <textarea
            id="invoice-footer"
            rows={3}
            {...register('invoicing.footer')}
          />
        </div>
        <label className="flex! cursor-pointer items-center gap-3 md:col-span-2">
          <Checkbox {...register('invoicing.showVat')} />
          <span className="text-slate-700!">
            Afficher la TVA sur les factures
          </span>
        </label>
      </div>
    </div>
  )
}
