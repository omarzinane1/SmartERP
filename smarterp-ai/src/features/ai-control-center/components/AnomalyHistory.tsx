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
  { key: 'critical', label: 'Critiques', color: '#f43f68' },
  { key: 'high', label: 'Élevées', color: '#fbbf24' },
  { key: 'medium', label: 'Moyennes', color: '#60a5fa' },
  { key: 'resolved', label: 'Résolues', color: '#34cda0' },
]

export function AnomalyHistory({
  data,
  resolutionRate,
  responseMinutes,
}: {
  data: AIControlCenterData['anomalyHistory']
  resolutionRate: number
  responseMinutes: number
}) {
  return (
    <section
      className="dashboard-card min-w-0 p-4"
      aria-labelledby="anomaly-title"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 id="anomaly-title" className="dashboard-title">
            Évolution des anomalies détectées (30 derniers jours)
          </h2>
          <p className="dashboard-caption">
            Volume journalier selon la sévérité et le rythme de résolution.
          </p>
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
            <CartesianGrid vertical={false} stroke="#edf1f8" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: '#94a3b8' }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 5,
                border: '1px solid #e2e8f0',
              }}
              cursor={{ fill: '#f1f5f9' }}
              labelFormatter={(value) => `Septembre · ${value}`}
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
          <strong className="text-slate-600">{resolutionRate} %</strong>
        </span>
        <span>
          Temps moyen de prise en charge :{' '}
          <strong className="text-slate-600">{responseMinutes} min</strong>
        </span>
      </div>
      <details className="mt-3 text-[9px] text-slate-500">
        <summary className="cursor-pointer text-blue-600">
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
