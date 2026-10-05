export type DashboardStatus = 'positive' | 'warning' | 'critical' | 'neutral'
export type InformationKind =
  | 'fact'
  | 'analysis'
  | 'forecast'
  | 'recommendation'

export interface DashboardKpi {
  id:
    | 'revenue'
    | 'profit'
    | 'margin'
    | 'cash'
    | 'receivables'
    | 'overdue'
    | 'inventory'
    | 'customers'
  title: string
  value: number | null
  format: 'currency' | 'percentage' | 'number'
  change: string
  trend: 'up' | 'down' | 'stable'
  status: DashboardStatus
  subtitle: string
}

export interface RevenuePoint {
  month: string
  revenue: number | null
  previousRevenue: number
  orders: number | null
  previousOrders: number | null
  margin: number | null
  previousMargin: number | null
}

export interface CashFlowPoint {
  date: string
  actual?: number
  forecast?: number
}

export interface DashboardAlert {
  id: string
  severity: 'critical' | 'high' | 'warning' | 'opportunity'
  category: string
  title: string
  description: string
  impact: number
  kind: InformationKind
  action: string
}

export interface DashboardCustomer {
  id: string
  name: string
  revenue: number | null
  orders: number | null
  outstanding: number
  trend: number | null
}

export interface DashboardProduct {
  id: string
  name: string
  revenue: number | null
  units: number
  margin: number | null
  stock: number | null
  stockLabel: string
  status: DashboardStatus
  trend: number | null
}

export interface DashboardInvoice {
  id: string
  customer: string
  date: string
  dueDate: string
  amount: number
  status: 'paid' | 'partial' | 'sent' | 'overdue'
  overdueDays?: number
}

export interface DashboardData {
  permissions?: string[]
  currency: string
  period: {
    label: string
    quarter: string
    currentYear: number
    previousYear: number
    asOf: string
  }
  branch: string
  kpis: DashboardKpi[]
  summary: {
    score: number | null
    status: string
    confidence: number | null
    generatedAt: string
    text: string
    risks: string[]
    opportunities: string[]
    recommendations: string[]
  }
  revenue: RevenuePoint[]
  revenueBreakdown: {
    revenue: number | null
    expenses: number | null
    grossProfit: number | null
    margin: number | null
    suggestion: string
  }
  cashFlow: {
    current: number | null
    inflows: number | null
    outflows: number | null
    projected: number | null
    points: CashFlowPoint[]
    status: string
  }
  receivables: {
    total: number | null
    dso: number | null
    overdueCount: number | null
    buckets: { label: string; amount: number; color: string }[]
  }
  inventory: {
    value: number | null
    turnover: number | null
    dormantValue: number | null
    segments: { label: string; count: number; color: string }[]
  }
  alerts: DashboardAlert[]
  topCustomers: DashboardCustomer[]
  topCustomersShare: number | null
  topProducts: DashboardProduct[]
  recentInvoices: DashboardInvoice[]
}
