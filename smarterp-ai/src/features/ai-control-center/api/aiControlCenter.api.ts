import { apiClient } from '../../../lib/axios'
import { postIdempotent } from '../../../lib/idempotentApi'
import type { AIControlCenterData, AIAlert, AlertFilters, IntelligenceRun } from '../types/aiControlCenter.types'

export const AI_CONTROL_CENTER_ENDPOINT = '/ai/control-center/'

export async function getAIControlCenter(
  signal?: AbortSignal,
): Promise<AIControlCenterData> {
  const { data } = await apiClient.get<AIControlCenterData>(
    AI_CONTROL_CENTER_ENDPOINT,
    { signal },
  )
  return data
}

export async function getAlerts(filters: AlertFilters, page: number, signal?: AbortSignal) {
  const params = Object.fromEntries(Object.entries(filters).filter(([key, value]) => key !== 'groupBy' && value !== 'all' && value !== ''))
  const { data } = await apiClient.get<{ alerts: AIAlert[]; count: number; next: string | null; previous: string | null }>('/ai/alerts/', { params: { ...params, ordering: filters.groupBy, page, page_size: 50 }, signal })
  return data
}

export async function getAlert(id: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<AIAlert>(`/ai/alerts/${id}/`, { signal })
  return data
}

export const refreshIntelligence = (scope: string) => postIdempotent<IntelligenceRun>(scope, '/ai/control-center/refresh/')
export const changeAlert = (scope: string, id: string, action: 'acknowledge' | 'resolve' | 'dismiss') => postIdempotent<AIAlert>(scope, `/ai/alerts/${id}/${action}/`)
