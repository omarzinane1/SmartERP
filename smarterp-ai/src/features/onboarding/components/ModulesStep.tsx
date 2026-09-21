import { useFormContext, useWatch } from 'react-hook-form'
import {
  ShoppingBag,
  Users,
  Truck,
  ShoppingCart,
  Package,
  Boxes,
  Warehouse,
  FileText,
  CreditCard,
  Receipt,
  Landmark,
  ChartNoAxesCombined,
  Folder,
  Sparkles,
  Bot,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { Checkbox } from '../../../components/ui/Checkbox'
import { cn } from '../../../lib/cn'
import {
  moduleNames,
  type ModuleId,
  type OnboardingData,
} from '../types/onboarding.types'

const modules: { id: ModuleId; icon: LucideIcon; description: string }[] = [
  { id: 'sales', icon: ShoppingBag, description: 'Devis et commandes clients' },
  { id: 'customers', icon: Users, description: 'Contacts et relation client' },
  { id: 'suppliers', icon: Truck, description: 'Votre réseau de partenaires' },
  {
    id: 'purchases',
    icon: ShoppingCart,
    description: 'Commandes et approvisionnements',
  },
  {
    id: 'products',
    icon: Package,
    description: 'Catalogue de produits et services',
  },
  {
    id: 'inventory',
    icon: Boxes,
    description: 'Quantités et mouvements de stock',
  },
  {
    id: 'warehouses',
    icon: Warehouse,
    description: 'Organisation de vos dépôts',
  },
  { id: 'invoices', icon: FileText, description: 'Facturation et avoirs' },
  {
    id: 'payments',
    icon: CreditCard,
    description: 'Encaissements et règlements',
  },
  {
    id: 'expenses',
    icon: Receipt,
    description: 'Dépenses et frais professionnels',
  },
  {
    id: 'treasury',
    icon: Landmark,
    description: 'Soldes et flux de trésorerie',
  },
  {
    id: 'reports',
    icon: ChartNoAxesCombined,
    description: 'Indicateurs et tableaux de bord',
  },
  {
    id: 'documents',
    icon: Folder,
    description: 'Tous vos documents au même endroit',
  },
  {
    id: 'ai_assistant',
    icon: Sparkles,
    description: 'Un assistant pour vos tâches métier',
  },
  {
    id: 'ai_control_center',
    icon: Bot,
    description: 'Supervision de vos outils IA',
  },
  {
    id: 'forecasting',
    icon: TrendingUp,
    description: 'Prévisions et tendances d’activité',
  },
]

export function ModulesStep() {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<OnboardingData>()
  const selected = useWatch({ control, name: 'modules' })
  const inventoryEnabled = useWatch({ control, name: 'inventory.enabled' })
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Un espace adapté à votre façon de travailler.
        </p>
        <span
          className="rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
          aria-live="polite"
        >
          {selected.length} modules actifs
        </span>
      </div>
      {!inventoryEnabled && (
        <p className="mb-4 text-xs leading-5 text-slate-500">
          Pour activer Stock ou Dépôts, activez d’abord la gestion du stock à
          l’étape 4.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ id, icon: Icon, description }) => {
          const active = selected.includes(id)
          const ai = [
            'ai_assistant',
            'ai_control_center',
            'forecasting',
          ].includes(id)
          const unavailable =
            !inventoryEnabled && (id === 'inventory' || id === 'warehouses')
          return (
            <label
              key={id}
              className={cn(
                'flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3.5',
                unavailable
                  ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                  : active
                    ? ai
                      ? 'border-indigo-200 bg-indigo-50/40'
                      : 'border-blue-200 bg-blue-50/30'
                    : 'border-slate-200 bg-white',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-8 shrink-0 place-items-center rounded-md',
                  ai
                    ? 'bg-indigo-100/70 text-indigo-600'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-navy-950">
                  {moduleNames[id]}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                  {description}
                </span>
                <span
                  className={cn(
                    'mt-2 block text-[10px]',
                    active
                      ? ai
                        ? 'text-indigo-600'
                        : 'text-blue-600'
                      : 'text-slate-400',
                  )}
                >
                  {active ? 'Actif' : 'Inactif'}
                </span>
              </span>
              <Checkbox
                className="onboarding-switch mt-0.5"
                role="switch"
                aria-label={moduleNames[id]}
                checked={active}
                disabled={unavailable}
                onChange={(event) =>
                  setValue(
                    'modules',
                    event.target.checked
                      ? [...selected, id]
                      : selected.filter((value) => value !== id),
                    { shouldDirty: true, shouldValidate: true },
                  )
                }
              />
            </label>
          )
        })}
      </div>
      {errors.modules && (
        <p role="alert" className="mt-4 text-xs text-red-600">
          {errors.modules.message}
        </p>
      )}
    </div>
  )
}
