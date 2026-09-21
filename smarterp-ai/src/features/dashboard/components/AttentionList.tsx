import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../lib/cn'
import { formatCurrency } from '../../../lib/format'
import type { DashboardAlert, InformationKind } from '../types/dashboard.types'

const severityLabels = {
  critical: 'Critique',
  high: 'Élevée',
  warning: 'Vigilance',
  opportunity: 'Opportunité',
} as const
const kindLabels: Record<InformationKind, string> = {
  fact: 'Fait',
  analysis: 'Analyse IA',
  forecast: 'Prévision',
  recommendation: 'Recommandation',
}

export function AttentionList({
  alerts,
  currency,
}: {
  alerts: DashboardAlert[]
  currency: string
}) {
  const [filter, setFilter] = useState('all')
  const visible =
    filter === 'all'
      ? alerts
      : alerts.filter((alert) => alert.severity === filter)
  return (
    <section aria-labelledby="attention-title" className="dashboard-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f6] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <BellRing className="size-4 text-rose-500" aria-hidden="true" />
          <h2 id="attention-title" className="dashboard-title">
            Nécessite votre attention
          </h2>
          <Badge tone="critical">{alerts.length} alertes actives</Badge>
        </div>
        <label className="flex items-center gap-2 text-[9px] text-slate-400">
          Filtrer par criticité
          <select
            aria-label="Filtrer les alertes par criticité"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded border border-[#e4e9f2] bg-[#f8faff] px-2 py-1 text-[10px] text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes ({alerts.length})</option>
            {Object.entries(severityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul aria-live="polite" className="divide-y divide-[#edf0f6]">
        {visible.map((alert) => (
          <li
            key={alert.id}
            className="grid items-center gap-3 py-4 lg:grid-cols-[116px_minmax(0,1fr)_125px_140px]"
          >
            <div className="flex flex-wrap gap-1.5">
              <Badge
                tone={
                  alert.severity === 'critical'
                    ? 'critical'
                    : alert.severity === 'opportunity'
                      ? 'indigo'
                      : 'warning'
                }
                className="text-[8px] tracking-wide uppercase"
              >
                {severityLabels[alert.severity]}
              </Badge>
              <Badge className="text-[8px]">{alert.category}</Badge>
            </div>
            <div className="min-w-0">
              <h3 className="text-[11px] font-semibold text-[#354c70]">
                {alert.title}
              </h3>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                {alert.description}
              </p>
              <span
                className={cn(
                  'mt-1 inline-block text-[8px] font-medium',
                  alert.kind === 'fact' ? 'text-slate-400' : 'text-indigo-500',
                )}
              >
                {kindLabels[alert.kind]}
              </span>
            </div>
            <p
              className={cn(
                'font-mono text-[9px] font-medium lg:text-right',
                alert.severity === 'critical'
                  ? 'text-rose-600'
                  : alert.severity === 'opportunity'
                    ? 'text-indigo-600'
                    : 'text-amber-700',
              )}
            >
              {alert.severity === 'opportunity' ? 'Potentiel' : 'Impact'} :
              <br className="hidden lg:block" />{' '}
              {formatCurrency(alert.impact, currency)}
            </p>
            <Button
              variant={
                alert.severity === 'critical' ||
                alert.severity === 'opportunity'
                  ? 'primary'
                  : 'secondary'
              }
              className={cn(
                'min-h-7 justify-self-start rounded px-2.5 text-[9px] lg:justify-self-end',
                alert.severity === 'opportunity' &&
                  'bg-blue-600 hover:bg-blue-700',
              )}
              onClick={() =>
                toast.info(
                  `Le module ${alert.category} sera disponible prochainement.`,
                )
              }
            >
              {alert.action}
            </Button>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="py-8 text-center text-xs text-slate-400">
          Aucune alerte pour cette criticité.
        </p>
      )}
    </section>
  )
}
