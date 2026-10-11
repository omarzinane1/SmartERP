import {
  BrainCircuit,
  ClipboardList,
  ListChecks,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import type { AIControlCenterData } from '../types/aiControlCenter.types'

export function IntelligenceSummary({
  summary,
  period,
}: Pick<AIControlCenterData, 'summary' | 'period'>) {
  const minutes = Math.max(
    0,
    Math.round(
      (Date.parse(period.asOf) - Date.parse(period.generatedAt)) / 60000,
    ),
  )
  const columns = [
    {
      title: 'Priorités',
      items: summary.priorities,
      icon: TriangleAlert,
      color: 'text-danger-text',
      label: summary.confidence === null ? 'RULE_BASED' : 'AI ANALYSIS',
    },
    {
      title: 'Impact estimé',
      items: summary.impacts,
      icon: ClipboardList,
      color: 'text-ai-text',
      label: summary.confidence === null ? 'Non disponible' : 'FORECAST / ESTIMATE',
    },
    {
      title: 'Actions recommandées',
      items: summary.recommendations,
      icon: ListChecks,
      color: 'text-success-text',
      label: 'RECOMMENDATION',
    },
  ]
  return (
    <section
      id="ai-summary"
      tabIndex={-1}
      aria-labelledby="ai-summary-title"
      className="dashboard-card scroll-mt-20 border-l-[3px] border-l-ai-border p-4 outline-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-ai-button p-1.5 text-white">
            <BrainCircuit className="size-4" />
          </span>
          <h2 id="ai-summary-title" className="dashboard-title uppercase">
            Synthèse exécutive IA
          </h2>
          <Badge tone="info">
            {summary.confidence === null ? 'RULE_BASED · Observations ERP' : `AI ANALYSIS · Confiance ${summary.confidence} %`}
          </Badge>
        </div>
        <span className="text-[9px] text-slate-400">
          SmartERP AI · {period.label} · Généré il y a {minutes} min
        </span>
      </div>
      <p className="my-3 text-[11px] leading-[1.8] text-slate-600">
        {summary.text}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {columns.map(({ title, items, icon: Icon, color, label }) => (
          <div
            key={title}
            className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"
          >
            <h3
              className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase ${color}`}
            >
              <Icon className="size-3.5" />
              {title}
            </h3>
            <ul className="mt-2 space-y-1 text-[10px] leading-4">
              {items.map((item) => (
                <li key={item} className="flex gap-1.5">
                  <span className={color}>•</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className={`mt-2 text-[8px] tracking-wide ${color}`}>{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-1 text-[9px] text-slate-400">
        <span>Sources : {summary.sources.join(' · ')}</span>
        <span>Modèle : {summary.model}</span>
      </div>
    </section>
  )
}
