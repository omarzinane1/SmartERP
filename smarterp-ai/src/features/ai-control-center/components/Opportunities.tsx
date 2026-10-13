import { ArrowUpRight, Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AIControlCenterData } from '../types/aiControlCenter.types'
import { opportunityPriorities, opportunityValue, opportunityValueLabel } from '../../ai/opportunityPresentation'

export function Opportunities({ opportunities }: { opportunities: AIControlCenterData['opportunities'] }) {
  return <section className="dashboard-card p-4" aria-labelledby="opportunities-title">
    <h2 id="opportunities-title" className="dashboard-title flex items-center gap-2"><Rocket className="size-3.5 text-success-text" />Opportunités de croissance</h2>
    <p className="dashboard-caption">Pistes commerciales et opérationnelles à examiner.</p>
    <div className="mt-4 space-y-2">
      {!opportunities.length && <p className="dashboard-caption">Aucune opportunité ouverte dans votre périmètre.</p>}
      {opportunities.map((o) => <article key={o.id} className="rounded border border-success-border bg-success-bg/20 p-3">
        <div className="flex justify-between gap-2"><h3 className="text-[11px] font-semibold text-success-text">{o.entity.name}</h3><span className="text-[8px] text-slate-400">{opportunityPriorities[o.priority]}</span></div>
        <p className="mt-1 text-[9px] text-slate-500">{o.title} · {o.reason}</p>
        <p className="mt-2 text-[10px] font-semibold text-success-text">{opportunityValue(o)}<span className="ml-1 text-[7px] font-normal">{opportunityValueLabel(o)}</span></p>
        <Link to={`/ai/opportunities?opportunity=${o.id}`} className="mt-2 flex items-center gap-1 text-[9px] font-medium text-success-text">Examiner la recommandation<ArrowUpRight className="size-3" /></Link>
      </article>)}
    </div>
    <Link to="/ai/opportunities" className="mt-3 text-[8px] text-success-text">Voir toutes les opportunités</Link>
  </section>
}
