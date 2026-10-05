import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import * as api from '../api/finance.api'
export function useCashFlow(horizon: number, period?: import('../types/finance.types').FinancePeriod) {
  const { scope, key } = useBusinessScope()
  const flow = useQuery({ ...options, queryKey: [...key('cash-flow'), env.financeUseMock, period], queryFn: ({ signal }) => api.getCashFlow(scope, signal, period) })
  const can = (p: string) => flow.data?.permissions.includes(p) ?? false, enabled = can('finance.view') && can('cashflow.view')
  const forecast = useQuery({ ...options, queryKey: [...key('cash-forecast'), env.financeUseMock, horizon], enabled: enabled && env.financeUseMock, queryFn: ({ signal }) => api.getCashForecast(scope, horizon, signal) })
  const upcoming = useQuery({ ...options, queryKey: [...key('cash-upcoming'), env.financeUseMock], enabled, queryFn: ({ signal }) => api.getUpcomingPayments(scope, signal) })
  const insight = useMutation({ ...options, mutationFn: () => api.getCashAIInsight(scope, horizon) })
  const kpis = useQuery({ ...options, queryKey: [...key('finance-kpis'), period], enabled: enabled && !env.financeUseMock, queryFn: ({ signal }) => api.getFinanceKPIs(period, signal) })
  return { kpis, flow, forecast, upcoming, insight, can, isDemo: env.financeUseMock }
}
