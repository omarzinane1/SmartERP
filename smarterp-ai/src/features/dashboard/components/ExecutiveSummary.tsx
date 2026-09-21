import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Lightbulb,
  ListChecks,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import type { DashboardData } from '../types/dashboard.types'

export function ExecutiveSummary({
  summary,
  period,
}: {
  summary: DashboardData['summary']
  period: DashboardData['period']
}) {
  const minutesAgo = Math.max(
    0,
    Math.round(
      (new Date(period.asOf).getTime() -
        new Date(summary.generatedAt).getTime()) /
        60000,
    ),
  )
  return (
    <section
      aria-labelledby="executive-summary-title"
      className="rounded-lg border border-indigo-100 bg-[#f3f5ff] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#325df1] text-white">
            <Lightbulb className="size-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="executive-summary-title"
                className="text-sm font-semibold text-navy-950"
              >
                Résumé exécutif
              </h2>
              <Badge tone="indigo">
                <Sparkles className="size-2.5" aria-hidden="true" />
                SmartERP AI · Analyse IA
              </Badge>
              <Badge tone="positive">
                Santé : {summary.score}/100 · {summary.status}
              </Badge>
            </div>
            <p className="mt-1.5 text-[9px] leading-4 text-slate-500">
              Généré{' '}
              {minutesAgo === 0 ? 'à l’instant' : `il y a ${minutesAgo} min`} au{' '}
              {new Date(period.asOf).toLocaleDateString('fr-FR')} ·{' '}
              {period.label} · Confiance {summary.confidence} %
            </p>
          </div>
        </div>
        <Link
          to="/ai/control-center"
          className="inline-flex min-h-7 items-center gap-1.5 rounded bg-blue-600 px-2.5 text-[9px] font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Ouvrir AI Control Center
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 rounded-md border border-indigo-100 bg-white/60 px-4 py-3 text-[11px] leading-6 text-[#485974]">
        <span className="font-semibold text-blue-600">
          Synthèse automatique :{' '}
        </span>
        {summary.text}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-md border-l-2 border-rose-400 bg-white p-3.5">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-600 uppercase">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Risques ({summary.risks.length})
          </h3>
          <ul className="mt-2 space-y-2 pl-3 text-[10px] leading-4 text-slate-500 marker:text-rose-400 list-disc">
            {summary.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border-l-2 border-blue-500 bg-white p-3.5">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 uppercase">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            Opportunités
          </h3>
          <ul className="mt-2 space-y-2 pl-3 text-[10px] leading-4 text-slate-500 marker:text-blue-400 list-disc">
            {summary.opportunities.map((opportunity) => (
              <li key={opportunity}>{opportunity}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border-l-2 border-indigo-500 bg-white p-3.5">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 uppercase">
            <ListChecks className="size-3.5" aria-hidden="true" />
            Recommandations
          </h3>
          <ul className="mt-2 space-y-2 pl-3 text-[10px] leading-4 text-slate-500 marker:text-indigo-400 list-disc">
            {summary.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
