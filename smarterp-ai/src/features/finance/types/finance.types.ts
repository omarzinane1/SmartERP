export interface CashDue { id: number; reference: string; partnerName: string; dueDate: string; amount: number; path: string }
export interface CashUpcoming { customers: CashDue[]; suppliers: CashDue[] }
export interface CashFlowData { permissions: string[]; asOf: string; opening: number | null; openingDate: string | null; cash: number | null; netCashFlow?: number; fromDate?: string; toDate?: string; incoming: number; outgoing: number; receivable: number; payable: number; history: { date: string; actual: number }[]; receivableAging: { key: string; label: string; amount: number; count: number }[]; payableAging: { key: string; label: string; amount: number; count: number }[]; source: string }
export interface CashForecast { horizon: number; generatedAt: string; confidence: number | null; lowConfidence: boolean; projected: number | null; series: { date: string; forecast: number }[]; assumptions: string }
export interface CashInsight { facts: string[]; forecast: string | null; analysis: string; risk: string; recommendations: string[]; source: string; horizon: number; generatedAt: string; confidence: number | null }

export interface FinancePeriod { from_date?: string; to_date?: string }
export interface FinanceKPIs { revenue: number; expenses: { total: number; subtotal: number; count: number }; inventoryValue: number | null; grossMargin: number | null; limitations: string }
