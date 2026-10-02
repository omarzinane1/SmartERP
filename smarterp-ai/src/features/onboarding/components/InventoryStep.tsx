import { useFormContext, useWatch } from 'react-hook-form'
import { PackageCheck } from 'lucide-react'
import { Input } from '../../../components/ui/Input'
import { Checkbox } from '../../../components/ui/Checkbox'
import type { OnboardingData } from '../types/onboarding.types'

export function InventoryStep() {
  const {
    register,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<OnboardingData>()
  const enabled = useWatch({ control, name: 'inventory.enabled' })
  const error = errors.inventory
  return (
    <div className="onboarding-fields">
      <label className="mb-6 flex! cursor-pointer items-center gap-4 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-5">
        <PackageCheck
          className="size-6 shrink-0 text-primary-text"
          aria-hidden="true"
        />
        <span className="flex-1 text-slate-700!">
          Activer la gestion du stock
          <span className="mt-1 block text-[11px] font-normal leading-5 text-slate-500!">
            Suivez vos produits, vos mouvements et vos dépôts.
          </span>
        </span>
        <Checkbox
          role="switch"
          className="onboarding-switch"
          {...register('inventory.enabled', {
            onChange: (event: { target: { checked: boolean } }) => {
              if (!event.target.checked)
                setValue(
                  'modules',
                  getValues('modules').filter(
                    (id) => id !== 'inventory' && id !== 'warehouses',
                  ),
                  { shouldDirty: true },
                )
            },
          })}
        />
      </label>
      {enabled ? (
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <div>
            <label htmlFor="warehouse-name">
              Nom du dépôt principal <span>*</span>
            </label>
            <Input
              id="warehouse-name"
              placeholder="Dépôt principal Casablanca"
              required
              aria-invalid={!!error?.warehouseName}
              aria-describedby={
                error?.warehouseName ? 'warehouse-name-error' : undefined
              }
              {...register('inventory.warehouseName')}
            />
            {error?.warehouseName && (
              <p id="warehouse-name-error" role="alert" className="field-error">
                {error.warehouseName.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="warehouse-code">
              Code dépôt <span>*</span>
            </label>
            <Input
              id="warehouse-code"
              placeholder="CAS-01"
              required
              aria-invalid={!!error?.warehouseCode}
              aria-describedby={
                error?.warehouseCode ? 'warehouse-code-error' : undefined
              }
              {...register('inventory.warehouseCode')}
            />
            {error?.warehouseCode && (
              <p id="warehouse-code-error" role="alert" className="field-error">
                {error.warehouseCode.message}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="warehouse-address">Adresse du dépôt</label>
            <Input
              id="warehouse-address"
              placeholder="Adresse du dépôt principal"
              {...register('inventory.warehouseAddress')}
            />
          </div>
          <div>
            <label htmlFor="valuation-method">Méthode de valorisation</label>
            <select
              id="valuation-method"
              {...register('inventory.valuationMethod')}
            >
              <option value="weighted_average">
                Coût moyen pondéré (CUMP)
              </option>
              <option value="fifo">Premier entré, premier sorti (FIFO)</option>
              <option value="standard">Coût standard</option>
            </select>
          </div>
          <div>
            <label htmlFor="default-unit">Unité par défaut</label>
            <select id="default-unit" {...register('inventory.defaultUnit')}>
              <option value="unit">Unité / pièce</option>
              <option value="kg">Kilogramme</option>
              <option value="litre">Litre</option>
              <option value="metre">Mètre</option>
              <option value="box">Carton</option>
            </select>
          </div>
          <label className="flex! cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-4">
            <Checkbox {...register('inventory.multiWarehouse')} />
            <span className="text-slate-700!">Gestion multi-dépôts</span>
          </label>
          <label className="flex! cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-4">
            <Checkbox {...register('inventory.lowStockAlerts')} />
            <span className="text-slate-700!">Alertes stock faible</span>
          </label>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">
            Votre activité, sans gestion de stock
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">
            Aucun dépôt ne sera créé. Les modules Stock et Dépôts sont
            désactivés ; vos autres modules restent disponibles.
          </p>
        </div>
      )}
    </div>
  )
}
