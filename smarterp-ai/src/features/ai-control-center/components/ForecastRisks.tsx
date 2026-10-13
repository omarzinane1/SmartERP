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
        Prévisions et risques
        <Badge tone="info" className="ml-auto text-[8px]">
          Statistiques
        </Badge>
      </h2>
      <p className="dashboard-caption">
        Modèles comparés sur une période de validation distincte.
      </p>
      {forecasts.length === 0 && <p className="dashboard-caption mt-4">Aucune prévision accessible. Lancez une analyse avec les droits de prévision et de recalcul.</p>}
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
                {forecast.stale ? 'À actualiser' : forecast.result?.status === 'INSUFFICIENT_DATA' ? 'Historique insuffisant' : forecast.result?.risk ? 'Flux prévu négatif' : 'Prévision'}
              </Badge>
            </div>
            <p className="mt-1 text-[7px] font-medium tracking-wide text-ai-text">
              {forecast.source} {forecast.generatedAt ? `· ${new Date(forecast.generatedAt).toLocaleString('fr-FR')}` : ''}
            </p>
            {expanded && (
              <div className="mt-2 border-t border-slate-200 pt-2 text-[9px] leading-4 text-slate-500">
                Source : {forecast.assumptions}
                {forecast.result && <>
                  <p>Modèle : {forecast.result.model ?? 'Non calculé'} · version {forecast.result.version}</p>
                  {forecast.result.trainingStart && <p>Historique : {forecast.result.trainingStart} → {forecast.result.trainingEnd}</p>}
                  {forecast.result.validation && <p>Validation : {forecast.result.validation.start} → {forecast.result.validation.end}</p>}
                  {forecast.result.metrics && <p>MAE : {forecast.result.metrics.mae} · RMSE : {forecast.result.metrics.rmse}</p>}
                  {forecast.result.candidates.map((candidate) => <p key={candidate.model}>{candidate.model} : MAE {candidate.mae}, RMSE {candidate.rmse}</p>)}
                  <p>Intervalle de confiance : non disponible.</p>
                  <details><summary>Historique ({forecast.result.history.length} jours)</summary><table className="w-full text-left"><thead><tr><th>Date</th><th>Valeur</th></tr></thead><tbody>{forecast.result.history.map((point) => <tr key={point.date}><td>{point.date}</td><td>{point.value}</td></tr>)}</tbody></table></details>
                  {forecast.result.forecast.length > 0 && <details><summary>Valeurs prévues ({forecast.result.forecast.length} jours)</summary><table className="w-full text-left"><thead><tr><th>Date</th><th>Prévision</th></tr></thead><tbody>{forecast.result.forecast.map((point) => <tr key={point.date}><td>{point.date}</td><td>{point.value}</td></tr>)}</tbody></table></details>}
                </>}
              </div>
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
