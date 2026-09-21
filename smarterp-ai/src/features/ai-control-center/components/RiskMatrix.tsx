import { Grid2X2 } from 'lucide-react'
import type { AIControlCenterData } from '../types/aiControlCenter.types'

export function RiskMatrix({
  risks,
  onSelect,
}: {
  risks: AIControlCenterData['risks']
  onSelect: (id: string) => void
}) {
  return (
    <section className="dashboard-card p-4" aria-labelledby="risk-matrix-title">
      <h2
        id="risk-matrix-title"
        className="dashboard-title flex items-center gap-2"
      >
        <Grid2X2 className="size-3.5 text-blue-600" />
        Matrice des risques{' '}
        <span className="ml-auto text-[9px] font-normal text-slate-400">
          {risks.length} périmètres
        </span>
      </h2>
      <p className="dashboard-caption">
        Impact / probabilité · Positionnement estimé par l’IA.
      </p>
      <div className="mt-4 flex gap-1">
        <span className="text-[8px] text-slate-400 [writing-mode:vertical-rl] rotate-180">
          Impact →
        </span>
        <div className="relative h-[210px] flex-1 overflow-hidden rounded border border-[#dce3f3] bg-[#f0f4ff]">
          <div className="absolute inset-x-0 top-1/2 border-t border-[#dce3f3]" />
          <div className="absolute inset-y-0 left-1/2 border-l border-[#dce3f3]" />
          <span className="absolute left-2 top-2 text-[7px] text-slate-500">
            MODÉRÉ (SURVEILLER)
          </span>
          <span className="absolute right-2 top-2 text-[7px] text-rose-500">
            CRITIQUE (ACTION IMMÉDIATE)
          </span>
          <span className="absolute bottom-2 left-2 text-[7px] text-slate-500">
            FAIBLE (TOLÉRABLE)
          </span>
          <span className="absolute bottom-2 right-2 text-[7px] text-slate-500">
            OPÉRATIONNEL (PROGRAMMER)
          </span>
          {risks.map((risk) => (
            <button
              type="button"
              key={risk.id}
              onClick={() => onSelect(risk.alertId)}
              aria-label={`${risk.label} : impact ${risk.impact} %, probabilité ${risk.probability} %`}
              title={`${risk.label} · Impact ${risk.impact} % · Probabilité ${risk.probability} %`}
              className={`acc-risk-dot ${
                risk.severity === 'critical'
                  ? 'border-rose-500 bg-rose-100 text-rose-600'
                  : risk.severity === 'high'
                  ? 'border-amber-500 bg-amber-100 text-amber-700'
                  : 'border-blue-500 bg-blue-100 text-blue-600'
              }`}
              style={{
                left: `${risk.probability}%`,
                bottom: `${risk.impact}%`,
              }}
            >
              {risk.shortLabel}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-right text-[8px] text-slate-400">Probabilité →</p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-slate-400">
        <span>
          <i className="mr-1 inline-block size-1.5 rounded-full bg-rose-500" />
          Trésorerie
        </span>
        <span>
          <i className="mr-1 inline-block size-1.5 rounded-full bg-amber-500" />
          Risque commercial
        </span>
        <span>
          <i className="mr-1 inline-block size-1.5 rounded-full bg-blue-500" />
          Fournisseurs / clients
        </span>
      </div>
    </section>
  )
}
