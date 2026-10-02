import { Link } from 'react-router-dom'
import {
  CalendarDays,
  ChevronDown,
  Download,
  MapPin,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { useAuthStore } from '../../../store/auth.store'
import { KpiGrid } from '../components/KpiGrid'
import { ExecutiveSummary } from '../components/ExecutiveSummary'
import { RevenueBreakdown, RevenueChart } from '../components/RevenueChart'
import { CashFlowChart, ReceivablesCard } from '../components/CashFlowChart'
import { InventoryHealth } from '../components/InventoryHealth'
import { AttentionList } from '../components/AttentionList'
import { DashboardTables } from '../components/DashboardTables'
import { useDashboard } from '../hooks/useDashboard'

export function DashboardPage() {
  const { data, isPending, isError, refetch, isFetching, isDemo } =
    useDashboard()
  const user = useAuthStore((state) => state.user)
  const company = useAuthStore((state) => state.company)

  if (isPending)
    return (
      <main className="dashboard-page" aria-busy="true">
        <h1 className="text-xl font-semibold text-navy-950">Tableau de bord</h1>
        <p
          role="status"
          className="my-5 flex items-center gap-2 text-xs text-slate-500"
        >
          <Spinner />
          Chargement du tableau de bord…
        </p>
        <div
          aria-hidden="true"
          className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="dashboard-card h-32 p-4">
              <div className="h-2 w-2/3 rounded bg-slate-100" />
              <div className="mt-5 h-6 w-3/4 rounded bg-slate-100" />
              <div className="mt-3 h-2 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="dashboard-card mt-5 h-64 bg-surface" />
      </main>
    )

  if (isError || !data)
    return (
      <main className="dashboard-page">
        <h1 className="mb-6 text-xl font-semibold text-navy-950">
          Tableau de bord
        </h1>
        <Alert variant="error">Impossible de charger le tableau de bord.</Alert>
        <Button
          className="mt-4 min-h-9 text-xs"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? (
            <Spinner />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden="true" />
          )}
          Réessayer
        </Button>
      </main>
    )

  function exportIndicators() {
    if (!data) return
    // L’export contient uniquement les indicateurs actuellement affichés.
    const quote = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`
    const rows = [
      ['Indicateur', 'Valeur', 'Unité', 'Période', 'Source'],
      ...data.kpis.map((kpi) => [
        kpi.title,
        kpi.value,
        kpi.format === 'currency'
          ? data.currency
          : kpi.format === 'percentage'
            ? '%'
            : '',
        data.period.label,
        isDemo ? 'Démonstration' : 'API',
      ]),
    ]
    const blob = new Blob(
      ['\uFEFF' + rows.map((row) => row.map(quote).join(';')).join('\r\n')],
      { type: 'text/csv;charset=utf-8;' },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `indicateurs-${isDemo ? 'demo-' : ''}${data.period.asOf.slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Les indicateurs ont été exportés au format CSV.')
  }

  return (
    <main className="dashboard-page">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-semibold tracking-tight text-navy-950">
              Tableau de bord
            </h1>
            <Badge tone="info">{data.period.quarter}</Badge>
          </div>
          <p className="mt-1.5 max-w-lg text-[11px] leading-5 text-slate-500">
            Bonjour {user?.name.split(' ')[0] || ''}{' '}
            <span aria-hidden="true">👋</span> Voici ce qui se passe dans{' '}
            <span className="font-medium text-slate-600">
              {company?.name || 'votre société'}
            </span>{' '}
            aujourd’hui.
          </p>
          {isDemo && (
            <p className="mt-2 text-[9px] text-slate-400">
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary" />
              Données de démonstration · {data.period.label}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled
              className="min-h-8 rounded px-2.5 text-[10px] disabled:cursor-default disabled:opacity-100"
              title="Le filtre de période sera connecté à l’API."
            >
              <CalendarDays
                className="size-3.5 text-slate-400"
                aria-hidden="true"
              />
              {data.period.label}
              <ChevronDown
                className="size-3 text-slate-400"
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="secondary"
              disabled
              className="min-h-8 rounded px-2.5 text-[10px] disabled:cursor-default disabled:opacity-100"
              title="Le filtre de dépôt sera connecté à l’API."
            >
              <MapPin className="size-3.5 text-slate-400" aria-hidden="true" />
              {data.branch}
            </Button>
            <Button
              variant="secondary"
              className="min-h-8 rounded px-2.5 text-[10px]"
              onClick={exportIndicators}
              aria-label="Exporter les indicateurs en CSV"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Exporter
            </Button>
          </div>
          <Link
            to="/ai/control-center"
            className="inline-flex min-h-8 items-center gap-2 rounded border border-primary-border bg-primary px-3 text-[10px] font-medium text-white hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-focus focus-visible:ring-offset-2"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Demander à SmartERP AI
          </Link>
        </div>
      </header>
      <div className="space-y-5">
        <KpiGrid kpis={data.kpis} currency={data.currency} />
        <ExecutiveSummary summary={data.summary} period={data.period} />
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <RevenueChart
            points={data.revenue}
            currency={data.currency}
            period={data.period}
          />
          <RevenueBreakdown
            data={data.revenueBreakdown}
            currency={data.currency}
          />
        </div>
        <div className="grid min-w-0 gap-5 xl:grid-cols-3">
          <CashFlowChart data={data.cashFlow} currency={data.currency} />
          <ReceivablesCard data={data.receivables} currency={data.currency} />
          <InventoryHealth data={data.inventory} currency={data.currency} />
        </div>
        <AttentionList alerts={data.alerts} currency={data.currency} />
        <DashboardTables data={data} />
      </div>
      <footer className="mt-5 flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-4 text-[9px] text-slate-400">
        <span>SmartERP AI · Votre activité, en perspective.</span>
        <span>
          {isDemo
            ? 'Vue de démonstration'
            : `Données au ${new Date(data.period.asOf).toLocaleDateString('fr-FR')}`}
        </span>
      </footer>
    </main>
  )
}
