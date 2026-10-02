import { useFormContext } from 'react-hook-form'
import { BriefcaseBusiness } from 'lucide-react'
import { Input } from '../../../components/ui/Input'
import type { OnboardingData } from '../types/onboarding.types'

export function BusinessStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OnboardingData>()
  const error = errors.business
  return (
    <div className="onboarding-fields">
      <div className="mb-6 flex items-center gap-3 rounded-md border border-primary-border bg-primary-soft/50 p-4">
        <BriefcaseBusiness
          className="size-5 shrink-0 text-primary-text"
          aria-hidden="true"
        />
        <p className="text-xs leading-5 text-slate-600">
          Quelques informations pour mieux connaître votre entreprise et
          préparer ses opérations au quotidien.
        </p>
      </div>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <div>
          <label htmlFor="industry">
            Secteur d’activité <span>*</span>
          </label>
          <select
            id="industry"
            required
            aria-invalid={!!error?.industry}
            aria-describedby={error?.industry ? 'industry-error' : undefined}
            {...register('business.industry')}
          >
            <option value="">Sélectionner un secteur</option>
            {[
              'Distribution',
              'Commerce',
              'Services',
              'Industrie',
              'Construction',
              'Restaurant',
              'Agence',
              'Technologie',
              'Autre',
            ].map((sector) => (
              <option key={sector}>{sector}</option>
            ))}
          </select>
          {error?.industry && (
            <p id="industry-error" role="alert" className="field-error">
              {error.industry.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="business-type">
            Type d’entreprise <span>*</span>
          </label>
          <select
            id="business-type"
            required
            aria-invalid={!!error?.businessType}
            {...register('business.businessType')}
          >
            <option value="products">Produits</option>
            <option value="services">Services</option>
            <option value="both">Produits &amp; Services</option>
          </select>
          {error?.businessType && (
            <p role="alert" className="field-error">
              {error.businessType.message}
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <label htmlFor="main-activity">
            Activité principale <span>*</span>
          </label>
          <Input
            id="main-activity"
            placeholder="Ex. Distribution de fournitures professionnelles"
            required
            aria-invalid={!!error?.mainActivity}
            aria-describedby={
              error?.mainActivity ? 'activity-error' : undefined
            }
            {...register('business.mainActivity')}
          />
          {error?.mainActivity && (
            <p id="activity-error" role="alert" className="field-error">
              {error.mainActivity.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="business-size">
            Taille de l’entreprise <span>*</span>
          </label>
          <select
            id="business-size"
            required
            aria-invalid={!!error?.size}
            aria-describedby={error?.size ? 'size-error' : undefined}
            {...register('business.size')}
          >
            <option value="">Sélectionner une taille</option>
            <option value="solo">Indépendant</option>
            <option value="micro">Très petite entreprise</option>
            <option value="small">Petite entreprise</option>
            <option value="medium">Moyenne entreprise</option>
            <option value="large">Grande entreprise</option>
          </select>
          {error?.size && (
            <p id="size-error" role="alert" className="field-error">
              {error.size.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="employees">Nombre d’employés</label>
          <Input
            id="employees"
            type="number"
            min="0"
            step="1"
            placeholder="Ex. 25"
            aria-invalid={!!error?.employeeCount}
            aria-describedby={
              error?.employeeCount ? 'employees-error' : undefined
            }
            {...register('business.employeeCount', {
              setValueAs: (value: string) =>
                value === '' ? undefined : Number(value),
            })}
          />
          {error?.employeeCount && (
            <p id="employees-error" role="alert" className="field-error">
              {error.employeeCount.message}
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <label htmlFor="business-description">Description</label>
          <textarea
            id="business-description"
            rows={4}
            placeholder="Présentez votre activité, vos produits ou vos services en quelques mots…"
            {...register('business.description')}
          />
          <p className="field-hint">
            Facultatif. Une courte présentation de votre entreprise.
          </p>
        </div>
      </div>
    </div>
  )
}
