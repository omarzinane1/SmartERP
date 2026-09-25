import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { cashFlowMock, cashForecastMock, cashInsightMock, cashUpcomingMock } from '../data/finance.mock'
import type { CashFlowData, CashForecast, CashInsight, CashUpcoming } from '../types/finance.types'
export const getCashFlow = async (scope: string, signal?: AbortSignal): Promise<CashFlowData> => env.financeUseMock ? cashFlowMock(scope) : (await apiClient.get('/finance/cash-flow/', { signal })).data
export const getCashForecast = async (scope: string, horizon: number, signal?: AbortSignal): Promise<CashForecast> => env.financeUseMock ? cashForecastMock(scope, horizon) : (await apiClient.get('/finance/forecast/', { params: { horizon }, signal })).data
export const getUpcomingPayments = async (scope: string, signal?: AbortSignal): Promise<CashUpcoming> => env.financeUseMock ? cashUpcomingMock(scope) : (await apiClient.get('/finance/upcoming-payments/', { signal })).data
export const getCashAIInsight = async (scope: string, horizon: number): Promise<CashInsight> => env.financeUseMock ? cashInsightMock(scope, horizon) : (await apiClient.get('/ai/finance/cash-insight/', { params: { horizon } })).data
