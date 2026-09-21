import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Landmark } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { formatCurrency, formatNumber } from '../../../lib/format'
import type { DashboardData } from '../types/dashboard.types'

export function CashFlowChart({
  data,
  currency,
}: {
  data: DashboardData['cashFlow']
  currency: string
}) {
  return (
    <section
      aria-labelledby="cash-flow-title"
      className="dashboard-card min-w-0 p-4"
    >
      <div className="flex justify-between gap-2">
        <div>
          <h2 id="cash-flow-title" className="dashboard-title">
            Trésorerie &amp; Cash Flow
          </h2>
          <p className="dashboard-caption">
            Historique et projection à 30 jours
          </p>
        </div>
        <Landmark className="size-4 text-blue-500" aria-hidden="true" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-blue-50 p-2.5">
          <p className="text-[8px] text-slate-500 uppercase">Cash actuel</p>
          <p className="mt-1 font-mono text-[10px] font-semibold text-blue-700">
            {formatNumber(data.current)}
          </p>
        </div>
        <div className="rounded bg-emerald-50 p-2.5">
          <p className="text-[8px] text-emerald-600 uppercase">
            Entrées prévues
          </p>
          <p className="mt-1 font-mono text-[10px] font-semibold text-emerald-700">
            +{formatNumber(data.inflows)}
          </p>
        </div>
        <div className="rounded bg-rose-50 p-2.5">
          <p className="text-[8px] text-rose-500 uppercase">Sorties prévues</p>
          <p className="mt-1 font-mono text-[10px] font-semibold text-rose-600">
            −{formatNumber(data.outflows)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <Badge tone="indigo">Prévision à J+30</Badge>
        <span className="font-mono font-semibold text-emerald-600">
          {formatCurrency(data.projected, currency)}
        </span>
      </div>
      <div
        className="mt-2 h-[114px]"
        role="img"
        aria-label="Trésorerie constatée en ligne continue ; prévision à trente jours en pointillés"
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 330, height: 114 }}
        >
          <LineChart
            data={data.points}
            margin={{ top: 10, left: 3, right: 8, bottom: 0 }}
            accessibilityLayer
          >
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 8, fill: '#8b9ab1' }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis hide domain={['dataMin - 30000', 'dataMax + 10000']} />
            <Tooltip
              contentStyle={{
                border: '1px solid #e3e9f3',
                borderRadius: 6,
                fontSize: 10,
              }}
              formatter={(value, name) => [
                formatCurrency(Number(value), currency),
                String(name),
              ]}
            />
            <Line
              name="Réalisé"
              type="monotone"
              dataKey="actual"
              stroke="#1760e8"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name="Prévision"
              type="monotone"
              dataKey="forecast"
              stroke="#818cf8"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f6] pt-3 text-[9px]">
        <div className="flex gap-3 text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-4 bg-blue-600" />
            Réalisé
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 border-t-2 border-dashed border-indigo-400" />
            Prévision
          </span>
        </div>
        <span className="text-emerald-600">{data.status}</span>
      </div>
    </section>
  )
}

export function ReceivablesCard({
  data,
  currency,
}: {
  data: DashboardData['receivables']
  currency: string
}) {
  return (
    <section
      aria-labelledby="receivables-title"
      className="dashboard-card min-w-0 p-4"
    >
      <h2 id="receivables-title" className="dashboard-title">
        Créances par ancienneté
      </h2>
      <p className="dashboard-caption">
        Total : {formatCurrency(data.total, currency)}
      </p>
      <div className="mt-4 space-y-3">
        {data.buckets.map((bucket) => (
          <div key={bucket.label}>
            <div className="mb-1 flex justify-between gap-2 text-[9px]">
              <span className="text-slate-500">{bucket.label}</span>
              <span
                className="font-mono font-medium"
                style={{ color: bucket.color }}
              >
                {formatCurrency(bucket.amount, currency)}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: bucket.color,
                  width: `${data.total > 0 ? (bucket.amount / data.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 flex flex-wrap justify-between gap-1 border-t border-[#edf0f6] pt-3 text-[9px] text-slate-500">
        <span>
          Délai moyen :{' '}
          <strong className="font-semibold text-slate-600">
            {data.dso} jours
          </strong>
        </span>
        <span className="text-rose-500">
          {data.overdueCount} factures à relancer
        </span>
      </p>
    </section>
  )
}
