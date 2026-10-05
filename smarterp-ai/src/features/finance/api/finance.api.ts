import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { cashFlowMock, cashForecastMock, cashInsightMock, cashUpcomingMock } from '../data/finance.mock'
import type { CashFlowData, CashForecast, CashInsight, CashUpcoming, FinancePeriod, FinanceKPIs } from '../types/finance.types'
export const getCashFlow = async (scope: string, signal?: AbortSignal, params?: FinancePeriod): Promise<CashFlowData> => env.financeUseMock ? cashFlowMock(scope) : (await apiClient.get('/finance/cash-flow/', { signal, params })).data
export const getCashForecast = async (scope: string, horizon: number, signal?: AbortSignal): Promise<CashForecast> => env.financeUseMock ? cashForecastMock(scope, horizon) : (await apiClient.get('/finance/forecast/', { params: { horizon }, signal })).data
export const getUpcomingPayments = async (scope: string, signal?: AbortSignal): Promise<CashUpcoming> => env.financeUseMock ? cashUpcomingMock(scope) : (await apiClient.get('/finance/upcoming-payments/', { signal })).data
export const getCashAIInsight = async (scope: string, horizon: number): Promise<CashInsight> => env.financeUseMock ? cashInsightMock(scope, horizon) : (await apiClient.get('/ai/finance/cash-insight/', { params: { horizon } })).data

export const getFinanceKPIs = async (params?: FinancePeriod, signal?: AbortSignal): Promise<FinanceKPIs> => (await apiClient.get('/finance/kpis/', { params, signal })).data
