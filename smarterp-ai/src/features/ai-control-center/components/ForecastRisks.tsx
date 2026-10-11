import { useState } from 'react'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { severityTones } from '../types/aiControlCenter.types'
import type { AIControlCenterData } from '../types/aiControlCenter.types'

export function ForecastRisks({
  forecasts,
}: {
  forecasts: AIControlCenterData['forecasts']
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="dashboard-card p-4" aria-labelledby="forecast-title">
      <h2
        id="forecast-title"
        className="dashboard-title flex items-center gap-2"
      >
        <TrendingUp className="size-3.5 text-ai-text" />
        Indicateurs de risque
        <Badge tone="info" className="ml-auto text-[8px]">
          Situation observée
        </Badge>
      </h2>
      <p className="dashboard-caption">
        Règles ERP · aucune prévision ML disponible.
      </p>
      {forecasts.length === 0 && <p className="dashboard-caption mt-4">Aucun risque observé disponible.</p>}
      <div className="mt-4 space-y-2">
        {forecasts.map((forecast) => (
          <article
            key={forecast.id}
            className="rounded border border-slate-200 bg-[var(--surface-1)] p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold">
                  {forecast.title} · {forecast.horizon}
                </p>
                <p className="mt-1 text-[9px] leading-4 text-slate-500">
                  {forecast.detail}
                </p>
              </div>
              <Badge
                tone={severityTones[forecast.severity]}
                className="shrink-0 text-[8px]"
              >
                {forecast.confidence === null ? 'Observé' : `${forecast.confidence} %`}
              </Badge>
            </div>
            <p className="mt-1 text-[7px] font-medium tracking-wide text-ai-text">
              {forecast.source === 'RULE_BASED' ? 'RULE_BASED' : 'FORECAST'}
            </p>
            {expanded && (
              <p className="mt-2 border-t border-slate-200 pt-2 text-[9px] leading-4 text-slate-500">
                Source : {forecast.assumptions}
              </p>
            )}
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded border border-ai-border bg-ai-soft/40 py-2 text-[10px] font-medium text-ai-text"
      >
        {expanded
          ? 'Masquer les explications'
          : `Voir les explications (${forecasts.length})`}
        <ChevronDown className={`size-3 ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </section>
  )
}
