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
  value: number
  format: 'currency' | 'percentage' | 'number'
  change: string
  trend: 'up' | 'down' | 'stable'
  status: DashboardStatus
  subtitle: string
}

export interface RevenuePoint {
  month: string
  revenue: number
  previousRevenue: number
  orders: number
  previousOrders: number
  margin: number
  previousMargin: number
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
  revenue: number
  orders: number
  outstanding: number
  trend: number
}

export interface DashboardProduct {
  id: string
  name: string
  revenue: number
  units: number
  margin: number
  stock: number
  stockLabel: string
  status: DashboardStatus
  trend: number
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
    score: number
    status: string
    confidence: number
    generatedAt: string
    text: string
    risks: string[]
    opportunities: string[]
    recommendations: string[]
  }
  revenue: RevenuePoint[]
  revenueBreakdown: {
    revenue: number
    expenses: number
    grossProfit: number
    margin: number
    suggestion: string
  }
  cashFlow: {
    current: number
    inflows: number
    outflows: number
    projected: number
    points: CashFlowPoint[]
    status: string
  }
  receivables: {
    total: number
    dso: number
    overdueCount: number
    buckets: { label: string; amount: number; color: string }[]
  }
  inventory: {
    value: number
    turnover: number
    dormantValue: number
    segments: { label: string; count: number; color: string }[]
  }
  alerts: DashboardAlert[]
  topCustomers: DashboardCustomer[]
  topCustomersShare: number
  topProducts: DashboardProduct[]
  recentInvoices: DashboardInvoice[]
}
