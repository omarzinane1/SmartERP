import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { cn } from '../../../lib/cn'
import { formatNumber, formatPercentage } from '../../../lib/format'
import type { DashboardKpi } from '../types/dashboard.types'

interface KpiCardProps extends DashboardKpi {
  currency: string
  icon: LucideIcon
}

export function KpiCard({
  title,
  value,
  format,
  change,
  trend,
  status,
  subtitle,
  currency,
  icon: Icon,
}: KpiCardProps) {
  return (
    <article
      className={cn(
        'dashboard-card flex min-h-[126px] flex-col justify-between p-4',
        status === 'critical' && 'border-rose-200',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          className={cn(
            'text-[9px] font-semibold tracking-[0.06em] uppercase',
            status === 'critical' ? 'text-rose-500' : 'text-slate-500',
          )}
        >
          {title}
        </h2>
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            status === 'critical'
              ? 'text-rose-500'
              : status === 'warning'
                ? 'text-amber-500'
                : 'text-slate-400',
          )}
          aria-hidden="true"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
        <p
          className={cn(
            'text-[26px] leading-none font-semibold tracking-[-0.045em] tabular-nums',
            status === 'critical' ? 'text-rose-600' : 'text-navy-950',
          )}
        >
          {format === 'percentage'
            ? formatPercentage(value)
            : formatNumber(value)}
        </p>
        {format === 'currency' && (
          <span className="text-[10px] text-slate-400">{currency}</span>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <Badge tone={status}>
          {trend === 'up' && (
            <ArrowUpRight className="size-2.5" aria-hidden="true" />
          )}
          {trend === 'down' && (
            <ArrowDownRight className="size-2.5" aria-hidden="true" />
          )}
          {change}
        </Badge>
        <p className="text-[9px] leading-4 text-slate-500">{subtitle}</p>
      </div>
    </article>
  )
}
