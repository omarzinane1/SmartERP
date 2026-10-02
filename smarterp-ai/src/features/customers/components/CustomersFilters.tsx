import { Bookmark, Filter, Layers3, RotateCcw, X } from 'lucide-react'
import { Checkbox } from '../../../components/ui/Checkbox'
import { statusLabels } from '../types/customers.types'
import type {
  CustomerFilters,
  CustomerGroup,
  CustomerStatus,
} from '../types/customers.types'

export function CustomersFilters({
  filters,
  cities,
  salespeople,
  onChange,
  onReset,
  onFavorite,
  onSave,
  hasSavedView,
  count,
}: {
  filters: CustomerFilters
  cities: string[]
  salespeople: string[]
  onChange: (update: Partial<CustomerFilters>) => void
  onReset: () => void
  onFavorite: (name: string) => void
  onSave: () => void
  hasSavedView: boolean
  count: number
}) {
  const chips = [
    ...(filters.status !== 'all'
      ? [
          {
            label: statusLabels[filters.status],
            clear: () => onChange({ status: 'all' }),
          },
        ]
      : []),
    ...(filters.city !== 'all'
      ? [
          {
            label: `Ville : ${filters.city}`,
            clear: () => onChange({ city: 'all' }),
          },
        ]
      : []),
    ...(filters.salesperson !== 'all'
      ? [
          {
            label: filters.salesperson,
            clear: () => onChange({ salesperson: 'all' }),
          },
        ]
      : []),
    ...(filters.outstanding
      ? [
          {
            label: 'Encours > 0 MAD',
            clear: () => onChange({ outstanding: false }),
          },
        ]
      : []),
    ...(filters.overdue
      ? [
          {
            label: 'Factures en retard',
            clear: () => onChange({ overdue: false }),
          },
        ]
      : []),
  ]
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <details className="customers-menu relative">
        <summary className="customers-menu-trigger">
          <Filter className="size-3" />
          Filtres
          {chips.length > 0 && (
            <span className="text-primary-text">({chips.length})</span>
          )}
        </summary>
        <div className="customers-menu-panel w-64 space-y-3 p-3">
          <label className="customers-filter-label">
            Statut
            <select
              aria-label="Filtrer par statut"
              className="customers-select mt-1 w-full"
              value={filters.status}
              onChange={(event) =>
                onChange({
                  status: event.target.value as CustomerStatus | 'all',
                })
              }
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="customers-filter-label">
            Ville
            <select
              aria-label="Filtrer par ville"
              className="customers-select mt-1 w-full"
              value={filters.city}
              onChange={(event) => onChange({ city: event.target.value })}
            >
              <option value="all">Toutes les villes</option>
              {cities.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </label>
          <label className="customers-filter-label">
            Commercial
            <select
              aria-label="Filtrer par commercial"
              className="customers-select mt-1 w-full"
              value={filters.salesperson}
              onChange={(event) =>
                onChange({ salesperson: event.target.value })
              }
            >
              <option value="all">Tous les commerciaux</option>
              {salespeople.map((person) => (
                <option key={person}>{person}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[10px]">
            <Checkbox
              checked={filters.outstanding}
              onChange={(event) =>
                onChange({ outstanding: event.target.checked })
              }
              className="size-3.5"
            />
            Avec encours client
          </label>
          <label className="flex items-center gap-2 text-[10px]">
            <Checkbox
              checked={filters.overdue}
              onChange={(event) => onChange({ overdue: event.target.checked })}
              className="size-3.5"
            />
            Avec factures en retard
          </label>
        </div>
      </details>
      <label className="flex items-center gap-1 text-slate-500">
        <Layers3 className="size-3" />
        <select
          className="customers-select"
          aria-label="Grouper les clients"
          value={filters.groupBy}
          onChange={(event) =>
            onChange({ groupBy: event.target.value as CustomerGroup })
          }
        >
          <option value="none">Grouper par</option>
          <option value="salesperson">Commercial</option>
          <option value="city">Ville</option>
          <option value="status">Statut</option>
          <option value="type">Type</option>
        </select>
      </label>
      <label className="flex items-center gap-1 text-slate-500">
        <Bookmark className="size-3" />
        <select
          className="customers-select"
          aria-label="Favoris"
          value=""
          onChange={(event) => onFavorite(event.target.value)}
        >
          <option value="">Favoris</option>
          <option value="mine">Mes clients</option>
          <option value="top">Top clients</option>
          <option value="overdue">Clients en retard</option>
          <option value="casablanca">Clients Casablanca</option>
          {hasSavedView && <option value="saved">Ma vue enregistrée</option>}
        </select>
      </label>
      <button
        type="button"
        onClick={onSave}
        title="Enregistrer la vue pour cette session"
        aria-label="Enregistrer la vue"
        className="rounded border border-slate-200 p-1.5 text-slate-400 hover:text-primary-text"
      >
        <Bookmark className="size-3.5" />
      </button>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={chip.clear}
            aria-label={`Retirer le filtre ${chip.label}`}
            className="flex items-center gap-1 rounded border border-primary-border bg-primary-soft px-2 py-1 text-[9px] text-primary-text"
          >
            {chip.label}
            <X className="size-2.5" />
          </button>
        ))}
      </div>
      <span className="text-[9px] text-slate-400" aria-live="polite">
        {count} résultats
      </span>
      <button
        type="button"
        onClick={onReset}
        aria-label="Réinitialiser les filtres"
        title="Réinitialiser les filtres"
        className="rounded p-1.5 text-slate-400 hover:bg-slate-100"
      >
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  )
}
