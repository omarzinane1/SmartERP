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
        <TrendingUp className="size-3.5 text-blue-600" />
        Risques prévisionnels
        <Badge tone="info" className="ml-auto text-[8px]">
          7–30 jours
        </Badge>
      </h2>
      <p className="dashboard-caption">
        Projections indicatives · aucune certitude de réalisation.
      </p>
      <div className="mt-4 space-y-2">
        {forecasts.map((forecast) => (
          <article
            key={forecast.id}
            className="rounded border border-slate-200 bg-[#f9faff] p-2.5"
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
                {forecast.confidence} %
              </Badge>
            </div>
            <p className="mt-1 text-[7px] font-medium tracking-wide text-indigo-500">
              FORECAST
            </p>
            {expanded && (
              <p className="mt-2 border-t border-slate-200 pt-2 text-[9px] leading-4 text-slate-500">
                Hypothèse : {forecast.assumptions}
              </p>
            )}
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded border border-blue-100 bg-blue-50/40 py-2 text-[10px] font-medium text-blue-600"
      >
        {expanded
          ? 'Masquer les hypothèses'
          : `Explorer les simulations (${forecasts.length})`}
        <ChevronDown className={`size-3 ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </section>
  )
}
