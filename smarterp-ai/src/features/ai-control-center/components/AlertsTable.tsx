import { Bookmark, FilterX, Search } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { cn } from '../../../lib/cn'
import {
  intelligenceLabels,
  severityLabels,
  severityTones,
  statusLabels,
} from '../types/aiControlCenter.types'
import type {
  AIAlert,
  AlertFilters,
  Department,
} from '../types/aiControlCenter.types'

export function AlertsTable({
  alerts,
  allAlerts,
  departments,
  filters,
  onFilter,
  onReset,
  selectedId,
  onSelect,
  asOf,
  onSaveView,
  hasSavedView,
  onLoadView,
}: {
  alerts: AIAlert[]
  allAlerts: AIAlert[]
  departments: Department[]
  filters: AlertFilters
  onFilter: (key: keyof AlertFilters, value: string) => void
  onReset: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  asOf: string
  onSaveView: () => void
  hasSavedView: boolean
  onLoadView: () => void
}) {
  const groups =
    filters.groupBy === 'department'
      ? departments
          .map((name) => ({
            name,
            alerts: alerts.filter((alert) => alert.department === name),
          }))
          .filter((group) => group.alerts.length)
      : [{ name: '', alerts }]
  return (
    <section
      aria-labelledby="alerts-title"
      className="dashboard-card min-w-0 overflow-hidden self-start"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2">
          <h2 id="alerts-title" className="dashboard-title">
            Flux des alertes opérationnelles
          </h2>
          <Badge tone="info">
            {allAlerts.filter((alert) => alert.status !== 'resolved').length}{' '}
            actives
          </Badge>
        </div>
        <span className="text-[9px] text-slate-400">
          Sélection prioritaire · {alerts.length} / {allAlerts.length}
        </span>
      </div>
      <div
        className="flex overflow-x-auto border-y border-slate-100 bg-[var(--surface-1)] px-3"
        aria-label="Départements"
      >
        {['all', ...departments].map((department) => (
          <button
            key={department}
            type="button"
            aria-pressed={filters.department === department}
            onClick={() => onFilter('department', department)}
            className={cn(
              'shrink-0 border-b-2 px-2.5 py-2.5 text-[10px]',
              filters.department === department
                ? 'border-ai-border font-semibold text-ai-text'
                : 'border-transparent text-slate-500 hover:text-ai-text',
            )}
          >
            {department === 'all' ? 'Tous' : department}{' '}
            <span className="text-[9px]">
              (
              {
                allAlerts.filter(
                  (alert) =>
                    department === 'all' || alert.department === department,
                ).length
              }
              )
            </span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <div className="col-span-2">
          <Input
            aria-label="Rechercher une alerte"
            placeholder="Rechercher une alerte, un produit, un client…"
            value={filters.search}
            onChange={(event) => onFilter('search', event.target.value)}
            leadingIcon={<Search className="size-3.5" />}
            className="h-8 rounded pl-9 text-[10px] shadow-none"
          />
        </div>
        <select
          className="acc-select"
          aria-label="Sévérité"
          value={filters.severity}
          onChange={(event) => onFilter('severity', event.target.value)}
        >
          <option value="all">Toutes les sévérités</option>
          {Object.entries(severityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="acc-select"
          aria-label="Statut"
          value={filters.status}
          onChange={(event) => onFilter('status', event.target.value)}
        >
          <option value="all">Tous les statuts</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="acc-select"
          aria-label="Type d’intelligence"
          value={filters.type}
          onChange={(event) => onFilter('type', event.target.value)}
        >
          <option value="all">Tous les types</option>
          {Object.entries(intelligenceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="acc-select"
          aria-label="Grouper les alertes"
          value={filters.groupBy}
          onChange={(event) => onFilter('groupBy', event.target.value)}
        >
          <option value="severity">Tri : criticité décroissante</option>
          <option value="department">Grouper par département</option>
          <option value="date">Tri : plus récentes</option>
        </select>
        <Button variant="secondary" className="acc-button" onClick={onSaveView}>
          <Bookmark className="size-3" />
          Enregistrer la vue
        </Button>
        <div className="flex items-center justify-end gap-2">
          {hasSavedView && (
            <button
              type="button"
              onClick={onLoadView}
              className="text-[10px] text-ai-text"
            >
              Vue enregistrée
            </button>
          )}
          <button
            type="button"
            aria-label="Réinitialiser les filtres"
            title="Réinitialiser les filtres"
            onClick={onReset}
            className="rounded border border-slate-200 p-2 text-slate-500"
          >
            <FilterX className="size-3.5" />
          </button>
        </div>
      </div>
      <div
        className="acc-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Tableau des alertes, défilement horizontal"
      >
        <table className="acc-table">
          <thead>
            <tr>
              {[
                'Sévérité',
                'Dép.',
                'Alerte / périmètre',
                'Métrique',
                'Valeur actuelle',
                'Écart',
                'Impact potentiel',
                'Confiance',
                'Détectée',
                'Statut',
                'Action',
              ].map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.name}>
              {group.name && (
                <tr>
                  <th
                    colSpan={11}
                    scope="rowgroup"
                    className="bg-slate-50 text-left"
                  >
                    {group.name}
                  </th>
                </tr>
              )}
              {group.alerts.map((alert) => {
                const minutes = Math.max(
                  0,
                  Math.floor(
                    (Date.parse(asOf) - Date.parse(alert.detectedAt)) / 60000,
                  ),
                )
                const detected =
                  minutes < 60
                    ? `${minutes} min`
                    : minutes < 1440
                    ? `${Math.floor(minutes / 60)} h`
                    : `${Math.floor(minutes / 1440)} j`
                return (
                  <tr
                    key={alert.id}
                    data-selected={selectedId === alert.id}
                    onClick={() => onSelect(alert.id)}
                    className="cursor-pointer"
                  >
                    <td>
                      <Badge
                        tone={severityTones[alert.severity]}
                        className="whitespace-nowrap text-[8px] uppercase"
                      >
                        • {severityLabels[alert.severity]}
                      </Badge>
                    </td>
                    <td className="text-slate-500">{alert.department}</td>
                    <td>
                      <button
                        type="button"
                        aria-expanded={selectedId === alert.id}
                        aria-controls="alert-detail"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(alert.id)
                        }}
                        className="text-left font-semibold leading-4 text-[color:var(--text-primary)] hover:text-ai-text"
                      >
                        {alert.title}
                      </button>
                      <p className="mt-1 text-[9px] leading-3.5 text-slate-400">
                        {alert.scope}
                      </p>
                      <Badge
                        tone={
                          alert.type === 'fact'
                            ? 'neutral'
                            : alert.type === 'forecast'
                            ? 'warning'
                            : alert.type === 'recommendation'
                            ? 'positive'
                            : 'indigo'
                        }
                        className="mt-1.5 text-[7px]"
                      >
                        {intelligenceLabels[alert.type]}
                      </Badge>
                    </td>
                    <td className="text-slate-500">{alert.metric}</td>
                    <td>
                      <span className="font-mono font-semibold">
                        {alert.currentValue}
                      </span>
                      <p className="mt-1 text-[8px] text-slate-400">
                        {alert.baseline}
                      </p>
                    </td>
                    <td
                      className={
                        alert.severity === 'opportunity'
                          ? 'text-success-text'
                          : 'text-danger-text'
                      }
                    >
                      {alert.deviation}
                    </td>
                    <td
                      className={cn(
                        'font-mono',
                        alert.severity === 'opportunity'
                          ? 'text-success-text'
                          : 'text-danger-text',
                      )}
                    >
                      {alert.impact}
                      <p className="mt-1 font-sans text-[7px] text-slate-400">
                        ESTIMATE
                      </p>
                    </td>
                    <td>
                      <Badge tone="info" className="text-[8px]">
                        {alert.confidence} %
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-slate-400">
                      Il y a {detected}
                    </td>
                    <td>
                      <Badge
                        tone={
                          alert.status === 'resolved'
                            ? 'positive'
                            : alert.status === 'investigating'
                            ? 'info'
                            : 'neutral'
                        }
                        className="text-[8px]"
                      >
                        {statusLabels[alert.status]}
                      </Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Examiner : ${alert.title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(alert.id)
                        }}
                        className={cn(
                          'rounded border px-2 py-1 text-[9px]',
                          selectedId === alert.id
                            ? 'border-ai-border bg-ai-button text-white'
                            : 'border-slate-200 bg-surface text-slate-600',
                        )}
                      >
                        {selectedId === alert.id ? 'Sélectionnée' : 'Examiner'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
      {alerts.length === 0 && (
        <div className="px-6 py-12 text-center" role="status">
          <CircleEmpty />
          <h3 className="mt-3 text-sm font-semibold">
            {allAlerts.length === 0
              ? 'Aucune alerte active.'
              : 'Aucune alerte ne correspond aux filtres.'}
          </h3>
          <p className="mt-2 text-[11px] text-slate-500">
            {allAlerts.length === 0
              ? 'SmartERP AI n’a détecté aucune situation nécessitant votre attention.'
              : 'Essayez une autre recherche ou réinitialisez les filtres.'}
          </p>
          {allAlerts.length > 0 && (
            <Button
              variant="secondary"
              className="acc-button mt-4"
              onClick={onReset}
            >
              Réinitialiser
            </Button>
          )}
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-[var(--surface-1)] px-3 py-2.5 text-[9px] text-slate-400">
        <span>
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-success" />
          Faits, analyses et prévisions identifiés séparément
        </span>
        <span>{alerts.length} alertes affichées</span>
      </footer>
    </section>
  )
}

function CircleEmpty() {
  return <Search className="mx-auto size-7 text-slate-300" aria-hidden="true" />
}
