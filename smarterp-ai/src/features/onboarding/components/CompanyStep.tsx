import { useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Building2, Trash2, Upload } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type { OnboardingData } from '../types/onboarding.types'

export function CompanyStep() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<OnboardingData>()
  const logo = useWatch({ control, name: 'company.logo' })
  const fileInput = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState('')
  const error = errors.company

  function selectLogo(file: File | undefined) {
    if (!file) return
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setLogoError('Choisissez une image PNG, JPG ou WebP de 2 Mo maximum.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setValue('company.logo', reader.result, { shouldDirty: true })
        setLogoError('')
      }
    }
    reader.onerror = () =>
      setLogoError('Impossible de lire cette image. Veuillez réessayer.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="onboarding-fields">
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-surface text-[color:var(--text-primary)]">
          {logo ? (
            <img
              src={logo}
              alt="Logo de la société"
              className="size-full object-contain p-1"
            />
          ) : (
            <Building2
              aria-hidden="true"
              className="size-8"
              strokeWidth={1.4}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-navy-950">
            Logo de votre société
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Sur vos factures, devis et documents commerciaux.
          </p>
          <p className="text-[10px] text-slate-400">
            PNG, JPG ou WebP · 2 Mo max. · 400 × 400 px recommandé
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Importer le logo de la société"
          className="sr-only"
          onChange={(event) => {
            selectLogo(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="min-h-8 rounded-md px-3 text-[11px]"
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            {logo ? 'Changer le logo' : 'Importer un logo'}
          </Button>
          {logo && (
            <Button
              variant="secondary"
              className="min-h-8 rounded-md px-2"
              aria-label="Supprimer le logo"
              onClick={() => {
                setValue('company.logo', '', { shouldDirty: true })
                setLogoError('')
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {logoError && (
        <p role="alert" className="mb-4 text-xs text-danger-text">
          {logoError}
        </p>
      )}
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <div>
          <label htmlFor="company-name">
            Nom de la société <span>*</span>
          </label>
          <Input
            id="company-name"
            placeholder="Atlas Distribution SARL"
            autoComplete="organization"
            required
            aria-invalid={!!error?.name}
            aria-describedby={error?.name ? 'company-name-error' : undefined}
            {...register('company.name')}
          />
          <p className="field-hint">
            Le nom affiché dans votre espace de travail.
          </p>
          {error?.name && (
            <p id="company-name-error" role="alert" className="field-error">
              {error.name.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="legal-name">
            Raison sociale <span>*</span>
          </label>
          <Input
            id="legal-name"
            placeholder="Atlas Distribution SARL d’importation et négoce"
            required
            aria-invalid={!!error?.legalName}
            aria-describedby={error?.legalName ? 'legal-name-error' : undefined}
            {...register('company.legalName')}
          />
          <p className="field-hint">
            La dénomination légale de votre entreprise.
          </p>
          {error?.legalName && (
            <p id="legal-name-error" role="alert" className="field-error">
              {error.legalName.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="tax-id">ICE / Identifiant fiscal</label>
          <Input
            id="tax-id"
            placeholder="Ex. 002391290000018"
            {...register('company.taxId')}
          />
          <p className="field-hint">
            L’identifiant figurant sur vos documents officiels.
          </p>
        </div>
        <div>
          <label htmlFor="company-email">
            Email professionnel <span>*</span>
          </label>
          <Input
            id="company-email"
            type="email"
            placeholder="contact@atlasdistribution.ma"
            autoComplete="email"
            required
            aria-invalid={!!error?.email}
            aria-describedby={error?.email ? 'company-email-error' : undefined}
            {...register('company.email')}
          />
          <p className="field-hint">L’adresse de contact de votre société.</p>
          {error?.email && (
            <p id="company-email-error" role="alert" className="field-error">
              {error.email.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="company-phone">Téléphone</label>
          <Input
            id="company-phone"
            type="tel"
            placeholder="+212 522 48 90 00"
            autoComplete="tel"
            {...register('company.phone')}
          />
        </div>
        <div>
          <label htmlFor="company-website">Site web</label>
          <Input
            id="company-website"
            type="url"
            placeholder="https://atlasdistribution.ma"
            autoComplete="url"
            aria-invalid={!!error?.website}
            aria-describedby={error?.website ? 'website-error' : undefined}
            {...register('company.website')}
          />
          {error?.website && (
            <p id="website-error" role="alert" className="field-error">
              {error.website.message}
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <label htmlFor="company-address">
            Adresse de la société <span>*</span>
          </label>
          <Input
            id="company-address"
            placeholder="Zone industrielle Sidi Maârouf, boulevard Al Qods, lot 42"
            autoComplete="street-address"
            required
            aria-invalid={!!error?.address}
            aria-describedby={error?.address ? 'address-error' : undefined}
            {...register('company.address')}
          />
          <p className="field-hint">
            Adresse principale et siège administratif.
          </p>
          {error?.address && (
            <p id="address-error" role="alert" className="field-error">
              {error.address.message}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
          <div>
            <label htmlFor="company-city">
              Ville <span>*</span>
            </label>
            <Input
              id="company-city"
              placeholder="Casablanca"
              autoComplete="address-level2"
              required
              aria-invalid={!!error?.city}
              aria-describedby={error?.city ? 'city-error' : undefined}
              {...register('company.city')}
            />
            {error?.city && (
              <p id="city-error" role="alert" className="field-error">
                {error.city.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="postal-code">Code postal</label>
            <Input
              id="postal-code"
              placeholder="20280"
              autoComplete="postal-code"
              {...register('company.postalCode')}
            />
          </div>
          <div>
            <label htmlFor="company-country">
              Pays <span>*</span>
            </label>
            <select
              id="company-country"
              autoComplete="country"
              required
              aria-invalid={!!error?.country}
              aria-describedby={error?.country ? 'country-error' : undefined}
              {...register('company.country')}
            >
              <option value="">Sélectionner un pays</option>
              <option value="MA">Maroc</option>
              <option value="FR">France</option>
              <option value="BE">Belgique</option>
              <option value="CH">Suisse</option>
              <option value="CA">Canada</option>
              <option value="DZ">Algérie</option>
              <option value="TN">Tunisie</option>
              <option value="SN">Sénégal</option>
              <option value="CI">Côte d’Ivoire</option>
              <option value="AE">Émirats arabes unis</option>
              <option value="US">États-Unis</option>
            </select>
            {error?.country && (
              <p id="country-error" role="alert" className="field-error">
                {error.country.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
