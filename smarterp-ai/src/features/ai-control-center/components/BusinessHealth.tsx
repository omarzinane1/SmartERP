import {
  ArrowUp,
  CircleCheck,
  CircleAlert,
  Hexagon,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import type { AIControlCenterData } from '../types/aiControlCenter.types'

export function BusinessHealth({
  health,
}: {
  health: AIControlCenterData['health']
}) {
  const status =
    health.score <= 40
      ? 'Critique'
      : health.score <= 70
      ? 'À risque'
      : 'Sain / Healthy'
  const tone =
    health.score <= 40
      ? 'critical'
      : health.score <= 70
      ? 'warning'
      : 'positive'
  return (
    <section aria-label="Santé de l’entreprise" className="acc-health-grid">
      <article className="dashboard-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="dashboard-title flex items-center gap-2">
            <Hexagon className="size-4 text-blue-600" />
            Business Health Score
          </h2>
          <Badge tone={tone}>{status}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[30px] font-semibold leading-none tracking-tight text-navy-950">
            {health.score}
            <span className="ml-1 text-xs font-normal text-slate-400">
              /100
            </span>
          </p>
          <span
            className={`flex items-center gap-1 text-[10px] ${
              health.trend < 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            <ArrowUp
              className={`size-3 ${health.trend < 0 ? 'rotate-180' : ''}`}
            />
            {health.trend > 0 ? '+' : ''}
            {health.trend} pts vs période précédente
          </span>
        </div>
        <div className="mt-4 flex justify-between text-[8px] text-slate-400">
          <span>Critique (0–40)</span>
          <span>Risque (41–70)</span>
          <span>Stable (71–85)</span>
          <span>Optimal</span>
        </div>
        <div
          className="relative mt-1.5 flex h-1.5 gap-0.5"
          aria-label={`Score de santé : ${health.score} sur 100`}
        >
          <span className="w-[40%] rounded-l bg-rose-200" />
          <span className="w-[30%] bg-amber-200" />
          <span className="w-[15%] bg-blue-500" />
          <span className="w-[15%] rounded-r bg-emerald-200" />
          <span
            className="absolute -top-1 h-3.5 w-0.5 bg-navy-950"
            style={{ left: `${health.score}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-slate-400">
          <span>
            Confiance :{' '}
            <strong className="text-slate-600">{health.confidence} %</strong>
          </span>
          <span className="text-blue-600">
            {health.departments.length} flux analysés
          </span>
        </div>
      </article>
      {health.departments.map((department) => {
        const Icon =
          department.tone === 'critical'
            ? CircleAlert
            : department.tone === 'warning'
            ? TriangleAlert
            : CircleCheck
        return (
          <article
            key={department.name}
            className="dashboard-card flex flex-col justify-between gap-4 p-3"
          >
            <div className="flex items-center justify-between gap-1">
              <h3 className="text-[10px] font-semibold">{department.name}</h3>
              <Icon
                className={`size-3 ${
                  department.tone === 'critical'
                    ? 'text-rose-500'
                    : department.tone === 'warning'
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }`}
              />
            </div>
            <div>
              <p className="text-xl font-semibold leading-none text-navy-950">
                {department.score}
                <span className="text-[9px] font-normal text-slate-400">
                  /100
                </span>
              </p>
              <p
                className={`mt-2 text-[8px] ${
                  department.trend < 0 ? 'text-rose-500' : 'text-emerald-600'
                }`}
              >
                {department.trend > 0 ? '+' : ''}
                {department.trend} pts · {department.alerts} alerte
                {department.alerts !== 1 ? 's' : ''}
              </p>
            </div>
            <Badge tone={department.tone} className="w-fit text-[8px]">
              {department.status}
            </Badge>
          </article>
        )
      })}
    </section>
  )
}
