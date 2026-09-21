import {
  CalendarDays,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type {
  AIControlCenterData,
  AlertFilters,
  Department,
} from '../types/aiControlCenter.types'

export function PageHeader({
  period,
  isDemo,
  isFetching,
  filters,
  departments,
  refreshedAt,
  onFilter,
  onRefresh,
  onExport,
}: {
  period: AIControlCenterData['period']
  isDemo: boolean
  isFetching: boolean
  filters: AlertFilters
  departments: Department[]
  refreshedAt: string | null
  onFilter: (key: keyof AlertFilters, value: string) => void
  onRefresh: () => Promise<void>
  onExport: () => void
}) {
  const analysisAge = Math.max(
    0,
    Math.round(
      (Date.parse(period.asOf) - Date.parse(period.generatedAt)) / 60000,
    ),
  )
  return (
    <header className="dashboard-card mb-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] font-semibold tracking-tight text-navy-950">
              AI Control Center
            </h1>
            <Badge tone="info">
              <span className="size-1.5 rounded-full bg-blue-500" />
              {isDemo ? 'Modèle privé local · Démo' : 'Analyse ERP'}
            </Badge>
          </div>
          <p className="mt-1.5 max-w-xl text-[11px] leading-5 text-slate-500">
            Surveillance intelligente de la performance, des risques et des
            opportunités de votre entreprise.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="acc-button"
            disabled={isFetching}
            onClick={() => void onRefresh()}
            aria-label="Actualiser l’analyse"
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`}
            />
            Actualiser
          </Button>
          <Button variant="secondary" className="acc-button" onClick={onExport}>
            <Download className="size-3.5" />
            Exporter
          </Button>
          <Button
            className="acc-button bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              const summary = document.getElementById('ai-summary')
              summary?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              summary?.focus({ preventScroll: true })
            }}
          >
            <Sparkles className="size-3.5" />
            Demander à l’IA
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-slate-400">
            <CalendarDays className="size-3.5" />
            <select
              className="acc-select"
              aria-label="Période des alertes"
              value={filters.days}
              onChange={(event) => onFilter('days', event.target.value)}
            >
              <option value="30">30 derniers jours</option>
              <option value="7">7 derniers jours</option>
              <option value="1">Dernières 24 heures</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-slate-400">
            <SlidersHorizontal className="size-3.5" />
            <select
              className="acc-select"
              aria-label="Département des alertes"
              value={filters.department}
              onChange={(event) => onFilter('department', event.target.value)}
            >
              <option value="all">Tous les départements</option>
              {departments.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-[9px] text-slate-400">
          Dernière analyse :{' '}
          <span className="font-medium text-slate-600">
            il y a {analysisAge} minutes
          </span>
          {refreshedAt && ` · Rechargé à ${refreshedAt}`}
        </p>
      </div>
      <p className="mt-2 text-[9px] text-slate-400">
        {isDemo ? 'Données de démonstration' : 'Données ERP'} · {period.label}.
        Les filtres s’appliquent au flux d’alertes ; les indicateurs présentent
        la vue globale de cette période.
      </p>
    </header>
  )
}
