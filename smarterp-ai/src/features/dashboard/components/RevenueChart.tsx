import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Lightbulb } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { cn } from '../../../lib/cn'
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from '../../../lib/format'
import type { DashboardData, RevenuePoint } from '../types/dashboard.types'

const metrics = {
  revenue: { label: 'Chiffre d’affaires', previous: 'previousRevenue' },
  orders: { label: 'Commandes', previous: 'previousOrders' },
  margin: { label: 'Marge', previous: 'previousMargin' },
} as const

export function RevenueChart({
  points,
  currency,
  period,
}: {
  points: RevenuePoint[]
  currency: string
  period: DashboardData['period']
}) {
  const [metric, setMetric] = useState<keyof typeof metrics>('revenue')
  const selected = metrics[metric]
  const lastPoint = points.at(-1)
  const formatValue = (value: number | null) =>
    metric === 'revenue'
      ? formatCurrency(value, currency)
      : metric === 'margin'
        ? formatPercentage(value)
        : formatNumber(value)

  return (
    <section
      aria-labelledby="revenue-chart-title"
      className="dashboard-card min-w-0 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="revenue-chart-title" className="dashboard-title">
            Évolution du chiffre d’affaires
          </h2>
          <p className="dashboard-caption">
            Périodes de même durée · Année N et année N−1
          </p>
        </div>
        <div
          className="flex rounded border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
          role="group"
          aria-label="Indicateur du graphique"
        >
          {(Object.keys(metrics) as Array<keyof typeof metrics>).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
              className={cn(
                'rounded px-2 py-1 text-[9px] font-medium',
                metric === key
                  ? 'bg-surface text-[color:var(--text-primary)] shadow-sm'
                  : 'text-slate-500 hover:bg-surface/50',
              )}
            >
              {metrics[key].label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="mt-5 h-[220px] min-w-0"
        role="img"
        aria-label={`${selected.label} : comparaison des mois affichés avec l’année précédente`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 640, height: 220 }}
        >
          <BarChart
            data={points}
            margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
            barGap={3}
            barCategoryGap="24%"
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              interval={0}
              tickMargin={9}
            />
            <YAxis hide domain={metric === 'margin' ? [0, 40] : [0, 'auto']} />
            <Tooltip
              cursor={{ fill: 'var(--chart-purple)' }}
              contentStyle={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 11,
              }}
              formatter={(value, name) => [
                formatValue(Number(value)),
                String(name),
              ]}
            />
            <Bar
              dataKey={selected.previous}
              name={`Année précédente (${period.previousYear})`}
              fill="var(--chart-purple)"
              radius={[2, 2, 0, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            />
            <Bar
              dataKey={metric}
              name={`Année courante (${period.currentYear})`}
              fill="var(--chart-aubergine)"
              radius={[2, 2, 0, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-2 border-t border-[var(--border)] pt-3 text-[9px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-primary" />
          {period.currentYear} ·{' '}
          {lastPoint ? formatValue(lastPoint[metric]) : '—'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-[var(--primary-soft)]" />
          {period.previousYear} ·{' '}
          {lastPoint ? formatValue(lastPoint[selected.previous]) : '—'}
        </span>
        <Badge tone="info">Données constatées</Badge>
      </div>
    </section>
  )
}

export function RevenueBreakdown({
  data,
  currency,
}: {
  data: DashboardData['revenueBreakdown']
  currency: string
}) {
  return (
    <section
      aria-labelledby="revenue-breakdown-title"
      className="dashboard-card flex min-w-0 flex-col p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="revenue-breakdown-title" className="dashboard-title">
            Revenus vs dépenses
          </h2>
          <p className="dashboard-caption">
            Indicateurs HT de la période
          </p>
        </div>
        <Badge tone="positive" className="shrink-0">
          Marge {formatPercentage(data.margin)}
        </Badge>
      </div>
      <dl className="mt-7 space-y-4 text-[10px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-slate-500">
            <span className="size-1.5 rounded-full bg-primary" />
            Chiffre d’affaires net des avoirs
          </dt>
          <dd className="font-mono font-semibold text-navy-950">
            {formatCurrency(data.revenue, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-slate-500">
            <span className="size-1.5 rounded-full bg-slate-400" />
            Dépenses approuvées HT
          </dt>
          <dd className="font-mono font-semibold text-navy-950">
            {formatCurrency(data.expenses, currency)}
          </dd>
        </div>
      </dl>
      <div
        className="my-3 h-5"
        role="img"
        aria-label={`Dépenses : ${formatCurrency(data.expenses, currency)} ; bénéfice brut : ${formatCurrency(data.grossProfit, currency)}`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 320, height: 20 }}
        >
          <BarChart
            layout="vertical"
            data={[data]}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis type="category" hide />
            <Bar
              dataKey="expenses"
              stackId="total"
              fill="var(--chart-aubergine)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="grossProfit"
              stackId="total"
              fill="var(--chart-green)"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-3 text-[11px] font-semibold">
        <span>Bénéfice brut</span>
        <span className="font-mono text-success-text">
          {formatCurrency(data.grossProfit, currency)}
        </span>
      </div>
      <div className="mt-auto pt-5">
        <div className="flex gap-2 rounded bg-[var(--surface-2)] p-3">
          <Lightbulb
            className="mt-0.5 size-4 shrink-0 text-primary-text"
            aria-hidden="true"
          />
          <div>
            <p className="text-[8px] font-semibold tracking-wide text-primary-text uppercase">
              Source et limites
            </p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              {data.suggestion}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
