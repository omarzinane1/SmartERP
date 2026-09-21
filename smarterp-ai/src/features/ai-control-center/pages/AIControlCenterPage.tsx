import { useCallback, useState } from 'react'
import '../ai-control-center.css'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { useAIControlCenter } from '../hooks/useAIControlCenter'
import { PageHeader } from '../components/PageHeader'
import { BusinessHealth } from '../components/BusinessHealth'
import { IntelligenceStats } from '../components/IntelligenceStats'
import { IntelligenceSummary } from '../components/IntelligenceSummary'
import { AlertsTable } from '../components/AlertsTable'
import { AlertDetailDrawer } from '../components/AlertDetailDrawer'
import { RiskMatrix } from '../components/RiskMatrix'
import { ForecastRisks } from '../components/ForecastRisks'
import { Opportunities } from '../components/Opportunities'
import {
  ActionReview,
  RecommendedActions,
} from '../components/RecommendedActions'
import { AnomalyHistory } from '../components/AnomalyHistory'
import {
  intelligenceLabels,
  severityLabels,
  statusLabels,
} from '../types/aiControlCenter.types'
import type {
  AIAlert,
  AlertFilters,
  Severity,
  SuggestedAction,
} from '../types/aiControlCenter.types'

const defaultFilters: AlertFilters = {
  search: '',
  department: 'all',
  severity: 'all',
  status: 'all',
  type: 'all',
  days: '30',
  groupBy: 'severity',
}
const severityOrder: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  opportunity: 4,
}
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function AIControlCenterPage() {
  const { data, isPending, isError, isFetching, refetch, isDemo } =
    useAIControlCenter()
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(
    'margin',
  )
  const [filters, setFilters] = useState<AlertFilters>(defaultFilters)
  const [savedView, setSavedView] = useState<AlertFilters | null>(null)
  const [localChanges, setLocalChanges] = useState<
    Record<string, Partial<AIAlert>>
  >({})
  const [reviewAction, setReviewAction] = useState<SuggestedAction | null>(null)
  const [draftIds, setDraftIds] = useState<string[]>([])
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const closeDrawer = useCallback(() => setSelectedAlertId(null), [])

  if (isPending)
    return (
      <main className="dashboard-page acc-page" aria-busy="true">
        <h1 className="text-2xl font-semibold text-navy-950">
          AI Control Center
        </h1>
        <p
          role="status"
          className="my-5 flex items-center gap-2 text-xs text-slate-500"
        >
          <Spinner />
          Chargement de l’AI Control Center…
        </p>
        <div
          className="grid animate-pulse gap-3 sm:grid-cols-3"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="dashboard-card h-28 bg-slate-100/60" />
          ))}
        </div>
        <div
          className="dashboard-card mt-4 h-64 animate-pulse bg-slate-100/60"
          aria-hidden="true"
        />
      </main>
    )
  if (isError || !data)
    return (
      <main className="dashboard-page acc-page">
        <h1 className="mb-5 text-2xl font-semibold text-navy-950">
          AI Control Center
        </h1>
        <Alert variant="error">
          Impossible de charger l’AI Control Center.
        </Alert>
        <Button
          className="acc-button mt-4"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className="size-3.5" />
          Réessayer
        </Button>
      </main>
    )

  const alerts = data.alerts.map((alert) => ({
    ...alert,
    ...localChanges[alert.id],
  }))
  const departments = data.health.departments.map(
    (department) => department.name,
  )
  const visibleAlerts = alerts
    .filter((alert) => {
      const age = Date.parse(data.period.asOf) - Date.parse(alert.detectedAt)
      return (
        (filters.department === 'all' ||
          alert.department === filters.department) &&
        (filters.severity === 'all' || alert.severity === filters.severity) &&
        (filters.status === 'all' || alert.status === filters.status) &&
        (filters.type === 'all' || alert.type === filters.type) &&
        age >= 0 &&
        age <= Number(filters.days) * 86400000 &&
        normalize(
          `${alert.title} ${alert.scope} ${alert.department} ${alert.metric}`,
        ).includes(normalize(filters.search.trim()))
      )
    })
    .sort((a, b) =>
      filters.groupBy === 'date'
        ? Date.parse(b.detectedAt) - Date.parse(a.detectedAt)
        : severityOrder[a.severity] - severityOrder[b.severity],
    )
  const selectedAlert = visibleAlerts.find(
    (alert) => alert.id === selectedAlertId,
  )
  const resolvedLocally = alerts.filter(
    (alert) =>
      alert.status === 'resolved' &&
      data.alerts.find((original) => original.id === alert.id)?.status !==
        'resolved',
  )
  const stats = {
    ...data.stats,
    resolved: data.stats.resolved + resolvedLocally.length,
    critical: Math.max(
      0,
      data.stats.critical -
        resolvedLocally.filter((alert) => alert.severity === 'critical').length,
    ),
    warnings: Math.max(
      0,
      data.stats.warnings -
        resolvedLocally.filter(
          (alert) => alert.severity === 'high' || alert.severity === 'medium',
        ).length,
    ),
  }

  function changeFilter(key: keyof AlertFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
  }
  function selectRisk(alertId: string) {
    setFilters(defaultFilters)
    setSelectedAlertId(alertId)
    requestAnimationFrame(() =>
      document
        .getElementById('alert-detail')
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    )
  }
  function updateSelectedAlert(change: Partial<AIAlert>) {
    if (!isDemo || !selectedAlert) return
    setLocalChanges((current) => ({
      ...current,
      [selectedAlert.id]: { ...current[selectedAlert.id], ...change },
    }))
    toast.success('Alerte mise à jour dans cette session de démonstration.')
  }
  async function refreshAnalysis() {
    const result = await refetch()
    if (result.isSuccess) {
      setRefreshedAt(
        new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
      toast.success(
        isDemo
          ? 'Instantané de démonstration rechargé.'
          : 'Analyse actualisée depuis le serveur.',
      )
    }
  }
  function exportAlerts() {
    const quote = (value: string | number) => {
      const text = String(value)
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
      return `"${safe.replace(/"/g, '""')}"`
    }
    const rows = [
      [
        'Sévérité',
        'Département',
        'Alerte',
        'Type',
        'Métrique',
        'Valeur',
        'Écart',
        'Impact estimé',
        'Confiance',
        'Détectée',
        'Statut',
        'Source',
      ],
      ...visibleAlerts.map((alert) => [
        severityLabels[alert.severity],
        alert.department,
        alert.title,
        intelligenceLabels[alert.type],
        alert.metric,
        alert.currentValue,
        alert.deviation,
        alert.impact,
        `${alert.confidence} %`,
        alert.detectedAt,
        statusLabels[alert.status],
        isDemo ? 'Démonstration' : 'API',
      ]),
    ]
    const url = URL.createObjectURL(
      new Blob(
        ['\uFEFF' + rows.map((row) => row.map(quote).join(';')).join('\r\n')],
        { type: 'text/csv;charset=utf-8;' },
      ),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `ai-alertes${isDemo ? '-demo' : ''}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${visibleAlerts.length} alertes exportées au format CSV.`)
  }

  return (
    <main className="dashboard-page acc-page">
      <PageHeader
        period={data.period}
        isDemo={isDemo}
        isFetching={isFetching}
        filters={filters}
        departments={departments}
        refreshedAt={refreshedAt}
        onFilter={changeFilter}
        onRefresh={refreshAnalysis}
        onExport={exportAlerts}
      />

      <div className="space-y-4">
        <BusinessHealth health={data.health} />
        <IntelligenceStats stats={stats} />
        <IntelligenceSummary summary={data.summary} period={data.period} />
        <div className={selectedAlert ? 'acc-alert-layout' : 'min-w-0'}>
          <AlertsTable
            alerts={visibleAlerts}
            allAlerts={alerts}
            departments={departments}
            filters={filters}
            onFilter={changeFilter}
            onReset={() => setFilters(defaultFilters)}
            selectedId={selectedAlert?.id ?? null}
            onSelect={setSelectedAlertId}
            asOf={data.period.asOf}
            onSaveView={() => {
              setSavedView({ ...filters })
              toast.success('Vue enregistrée pour cette session.')
            }}
            hasSavedView={savedView !== null}
            onLoadView={() => {
              if (savedView) setFilters({ ...savedView })
            }}
          />
          {selectedAlert && (
            <AlertDetailDrawer
              key={selectedAlert.id}
              alert={selectedAlert}
              assignees={data.assignees}
              isDemo={isDemo}
              asOf={data.period.asOf}
              onClose={closeDrawer}
              onAssign={(assignee) =>
                updateSelectedAlert({ assignee, status: 'investigating' })
              }
              onResolve={() => updateSelectedAlert({ status: 'resolved' })}
              onReview={setReviewAction}
            />
          )}
        </div>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
          <RiskMatrix risks={data.risks} onSelect={selectRisk} />
          <ForecastRisks forecasts={data.forecasts} />
          <Opportunities
            opportunities={data.opportunities}
            onReview={setReviewAction}
          />
        </div>
        <RecommendedActions actions={data.actions} onReview={setReviewAction} />
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <AnomalyHistory
            data={data.anomalyHistory}
            resolutionRate={data.resolutionRate}
            responseMinutes={data.responseMinutes}
          />
          <RecommendedActions
            actions={data.governance}
            onReview={setReviewAction}
            governance
          />
        </div>
      </div>
      <footer className="mt-5 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-[9px] text-slate-400">
        <span>SmartERP AI · Comprendre. Anticiper. Décider.</span>
        <span>
          {isDemo
            ? 'Démonstration · aucune opération ERP exécutée'
            : 'Analyse connectée à votre ERP'}
        </span>
      </footer>
      {reviewAction && (
        <ActionReview
          action={reviewAction}
          isDemo={isDemo}
          saved={draftIds.includes(reviewAction.id)}
          onClose={() => setReviewAction(null)}
          onSave={() => setDraftIds((current) => [...current, reviewAction.id])}
        />
      )}
    </main>
  )
}
