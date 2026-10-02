import { ArrowUpRight, Rocket } from 'lucide-react'
import type {
  AIControlCenterData,
  SuggestedAction,
} from '../types/aiControlCenter.types'

export function Opportunities({
  opportunities,
  onReview,
}: {
  opportunities: AIControlCenterData['opportunities']
  onReview: (action: SuggestedAction) => void
}) {
  return (
    <section
      className="dashboard-card p-4"
      aria-labelledby="opportunities-title"
    >
      <h2
        id="opportunities-title"
        className="dashboard-title flex items-center gap-2"
      >
        <Rocket className="size-3.5 text-success-text" />
        Opportunités de croissance
      </h2>
      <p className="dashboard-caption">
        Génération de valeur et optimisation de la marge.
      </p>
      <div className="mt-4 space-y-2">
        {opportunities.map((opportunity) => (
          <article
            key={opportunity.id}
            className="rounded border border-success-border bg-success-bg/20 p-3"
          >
            <div className="flex justify-between gap-2">
              <h3 className="text-[11px] font-semibold text-success-text">
                {opportunity.company}
              </h3>
              <span className="text-[8px] text-slate-400">
                {opportunity.confidence} %
              </span>
            </div>
            <p className="mt-1 text-[9px] text-slate-500">
              {opportunity.title} · {opportunity.detail}
            </p>
            <p className="mt-2 text-[10px] font-semibold text-success-text">
              {opportunity.potential}
              <span className="ml-1 text-[7px] font-normal">ESTIMATE</span>
            </p>
            <button
              type="button"
              onClick={() => onReview(opportunity.action)}
              className="mt-2 flex items-center gap-1 text-[9px] font-medium text-success-text"
            >
              Examiner la recommandation
              <ArrowUpRight className="size-3" />
            </button>
          </article>
        ))}
      </div>
      <p className="mt-3 text-[8px] text-success-text">
        RECOMMENDATION · À valider avec votre équipe.
      </p>
    </section>
  )
}
