import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import type { AIControlCenterData } from '../types/aiControlCenter.types'

const series = [
  { key: 'critical', label: 'Critiques', color: 'var(--chart-red)' },
  { key: 'high', label: 'Élevées', color: 'var(--chart-amber-soft)' },
  { key: 'medium', label: 'Moyennes', color: 'var(--chart-purple)' },
  { key: 'resolved', label: 'Résolues', color: 'var(--chart-green)' },
]

export function AnomalyHistory({
  data,
  resolutionRate,
  responseMinutes,
  analysis,
}: {
  data: AIControlCenterData['anomalyHistory']
  resolutionRate: number | null
  responseMinutes: number | null
  analysis?: AIControlCenterData['anomalyAnalysis']
}) {
  return (
    <section
      className="dashboard-card min-w-0 p-4"
      aria-labelledby="anomaly-title"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 id="anomaly-title" className="dashboard-title">
            Historique des signaux détectés (30 derniers jours)
          </h2>
          <p className="dashboard-caption">
            Règles ERP, anomalies statistiques et résolutions enregistrées chaque jour.
          </p>
          {analysis?.status === 'INSUFFICIENT_DATA' && <p className="dashboard-caption">Pics de dépenses : historique insuffisant ({analysis.observations} journées actives ; minimum {analysis.minimum} sur au moins 28 jours).</p>}
        </div>
        <div className="flex items-start gap-3 text-[8px] text-slate-500">
          {series.map((item) => (
            <span key={item.key}>
              <i
                className="mr-1 inline-block size-2 rounded-[1px]"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div
        className="mt-5 h-[175px] w-full min-w-0"
        role="img"
        aria-label="Histogramme des anomalies par sévérité sur le mois ; données détaillées disponibles sous le graphique."
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            barCategoryGap="9%"
            margin={{ top: 5, bottom: 0, left: 0, right: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 5,
                border: '1px solid var(--border)',
              }}
              cursor={{ fill: 'var(--chart-purple)' }}
              labelFormatter={(value) => `${value}`}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId="anomalies"
                fill={item.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-[9px] text-slate-400">
        <span>
          Taux de résolution mensuel :{' '}
          <strong className="text-slate-600">{resolutionRate === null ? 'Non disponible' : `${resolutionRate} %`}</strong>
        </span>
        <span>
          Temps moyen de prise en charge :{' '}
          <strong className="text-slate-600">{responseMinutes === null ? 'Non disponible' : `${responseMinutes} min`}</strong>
        </span>
      </div>
      <details className="mt-3 text-[9px] text-slate-500">
        <summary className="cursor-pointer text-ai-text">
          Voir les données du graphique
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Jour</th>
                {series.map((item) => (
                  <th key={item.key}>{item.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.day}>
                  <th className="py-1 font-normal">{point.day}</th>
                  <td>{point.critical}</td>
                  <td>{point.high}</td>
                  <td>{point.medium}</td>
                  <td>{point.resolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
