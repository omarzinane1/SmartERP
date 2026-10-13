import { BellRing, CircleCheck, Radar, Rocket, TrendingUp } from 'lucide-react'
import type { AIControlCenterData } from '../types/aiControlCenter.types'

const cards = [
  {
    key: 'critical',
    title: 'Alertes critiques',
    caption: 'Intervention requise',
    icon: Radar,
    style: 'border-danger-border text-danger-text',
    iconStyle: 'bg-danger-bg',
  },
  {
    key: 'warnings',
    title: 'Avertissements',
    caption: 'Signaux encore ouverts',
    icon: BellRing,
    style: 'border-warning-border text-warning-text',
    iconStyle: 'bg-warning-bg',
  },
  {
    key: 'forecasts',
    title: 'Prévisions disponibles',
    caption: 'Calculs réussis de moins de 24 h',
    icon: TrendingUp,
    style: 'border-ai-border text-ai-text',
    iconStyle: 'bg-ai-soft',
  },
  {
    key: 'opportunities',
    title: 'Opportunités',
    caption: 'Pistes ouvertes et à jour',
    icon: Rocket,
    style: 'border-success-border text-success-text',
    iconStyle: 'bg-success-bg',
  },
  {
    key: 'resolved',
    title: 'Problèmes résolus',
    caption: 'Résolutions enregistrées',
    icon: CircleCheck,
    style: 'border-slate-200 text-slate-600',
    iconStyle: 'bg-slate-100',
  },
] as const

export function IntelligenceStats({
  stats,
}: {
  stats: AIControlCenterData['stats']
}) {
  return (
    <section
      aria-label="Statistiques d’intelligence"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(({ key, title, caption, icon: Icon, style, iconStyle }) => (
        <article
          key={key}
          className={`flex items-center justify-between gap-2 rounded-md border bg-surface px-4 py-3 ${style}`}
        >
          <div>
            <h2 className="text-[9px] font-medium uppercase tracking-wide text-slate-500">
              {title}
            </h2>
            <p className="mt-1 text-[27px] font-semibold leading-tight">
              {stats[key]}
            </p>
            <p className="mt-1 text-[9px]">{caption}</p>
          </div>
          <span
            className={`grid size-9 shrink-0 place-items-center rounded ${iconStyle}`}
          >
            <Icon className="size-5" />
          </span>
        </article>
      ))}
    </section>
  )
}
