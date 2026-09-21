import { useFormContext } from 'react-hook-form'
import { Landmark } from 'lucide-react'
import { Input } from '../../../components/ui/Input'
import type { OnboardingData } from '../types/onboarding.types'

export function FinanceStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OnboardingData>()
  const error = errors.finance
  return (
    <div className="onboarding-fields">
      <div className="mb-6 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <Landmark
          className="size-5 shrink-0 text-slate-500"
          aria-hidden="true"
        />
        <p className="text-xs leading-5 text-slate-600">
          Les valeurs proposées sont modifiables. Choisissez les paramètres
          correspondant à votre société.
        </p>
      </div>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <div>
          <label htmlFor="currency">
            Devise <span>*</span>
          </label>
          <select
            id="currency"
            required
            aria-invalid={!!error?.currency}
            aria-describedby={error?.currency ? 'currency-error' : undefined}
            {...register('finance.currency')}
          >
            <option value="">Sélectionner une devise</option>
            <option value="MAD">MAD — Dirham marocain</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollar américain</option>
            <option value="GBP">GBP — Livre sterling</option>
            <option value="CHF">CHF — Franc suisse</option>
            <option value="CAD">CAD — Dollar canadien</option>
            <option value="DZD">DZD — Dinar algérien</option>
            <option value="TND">TND — Dinar tunisien</option>
            <option value="XOF">XOF — Franc CFA</option>
            <option value="AED">AED — Dirham des Émirats</option>
          </select>
          {error?.currency && (
            <p id="currency-error" role="alert" className="field-error">
              {error.currency.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="tax-system">
            Système fiscal <span>*</span>
          </label>
          <select id="tax-system" required {...register('finance.taxSystem')}>
            <option value="standard">Régime standard</option>
            <option value="simplified">Régime simplifié</option>
            <option value="exempt">Exonéré de TVA</option>
          </select>
        </div>
        <div>
          <label htmlFor="vat-rate">
            TVA par défaut (%) <span>*</span>
          </label>
          <Input
            id="vat-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            required
            aria-invalid={!!error?.vatRate}
            aria-describedby={error?.vatRate ? 'vat-error' : undefined}
            {...register('finance.vatRate', { valueAsNumber: true })}
          />
          {error?.vatRate && (
            <p id="vat-error" role="alert" className="field-error">
              {error.vatRate.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="finance-payment">
            Conditions de paiement <span>*</span>
          </label>
          <select
            id="finance-payment"
            required
            {...register('finance.paymentTerms')}
          >
            <option value="0">À réception</option>
            <option value="15">15 jours</option>
            <option value="30">30 jours</option>
            <option value="45">45 jours</option>
            <option value="60">60 jours</option>
            <option value="90">90 jours</option>
          </select>
        </div>
        <div>
          <label htmlFor="fiscal-start">
            Début exercice fiscal <span>*</span>
          </label>
          <Input
            id="fiscal-start"
            type="date"
            required
            aria-invalid={!!error?.fiscalYearStart}
            aria-describedby={
              error?.fiscalYearStart ? 'fiscal-start-error' : undefined
            }
            {...register('finance.fiscalYearStart')}
          />
          {error?.fiscalYearStart && (
            <p id="fiscal-start-error" role="alert" className="field-error">
              {error.fiscalYearStart.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="fiscal-end">
            Fin exercice fiscal <span>*</span>
          </label>
          <Input
            id="fiscal-end"
            type="date"
            required
            aria-invalid={!!error?.fiscalYearEnd}
            aria-describedby={
              error?.fiscalYearEnd ? 'fiscal-end-error' : undefined
            }
            {...register('finance.fiscalYearEnd')}
          />
          {error?.fiscalYearEnd && (
            <p id="fiscal-end-error" role="alert" className="field-error">
              {error.fiscalYearEnd.message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
