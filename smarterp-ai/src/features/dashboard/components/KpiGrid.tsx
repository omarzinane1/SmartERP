import {
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  CircleAlert,
  Receipt,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { KpiCard } from './KpiCard'
import type { DashboardKpi } from '../types/dashboard.types'

const icons = {
  revenue: ChartNoAxesCombined,
  profit: Banknote,
  margin: CircleAlert,
  cash: Wallet,
  receivables: Receipt,
  overdue: TriangleAlert,
  inventory: Boxes,
  customers: Users,
}

export function KpiGrid({
  kpis,
  currency,
}: {
  kpis: DashboardKpi[]
  currency: string
}) {
  return (
    <section
      aria-label="Indicateurs clés"
      className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4"
    >
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.id}
          {...kpi}
          currency={currency}
          icon={icons[kpi.id]}
        />
      ))}
    </section>
  )
}
