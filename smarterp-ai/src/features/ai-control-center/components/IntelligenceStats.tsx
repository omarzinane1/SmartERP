import { BellRing, CircleCheck, Radar, Rocket, TrendingUp } from 'lucide-react'
import type { AIControlCenterData } from '../types/aiControlCenter.types'

const cards = [
  {
    key: 'critical',
    title: 'Alertes critiques',
    caption: 'Intervention requise',
    icon: Radar,
    style: 'border-rose-100 text-rose-600',
    iconStyle: 'bg-rose-50',
  },
  {
    key: 'warnings',
    title: 'Avertissements',
    caption: 'À surveiller sous 48 h',
    icon: BellRing,
    style: 'border-amber-100 text-amber-600',
    iconStyle: 'bg-amber-50',
  },
  {
    key: 'forecasts',
    title: 'Risques prévisionnels',
    caption: 'Horizon 7–30 jours',
    icon: TrendingUp,
    style: 'border-indigo-100 text-blue-600',
    iconStyle: 'bg-blue-50',
  },
  {
    key: 'opportunities',
    title: 'Opportunités',
    caption: 'Croissance & marge détectées',
    icon: Rocket,
    style: 'border-emerald-100 text-emerald-600',
    iconStyle: 'bg-emerald-50',
  },
  {
    key: 'resolved',
    title: 'Problèmes résolus',
    caption: 'Traités ce mois-ci',
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
          className={`flex items-center justify-between gap-2 rounded-md border bg-white px-4 py-3 ${style}`}
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
