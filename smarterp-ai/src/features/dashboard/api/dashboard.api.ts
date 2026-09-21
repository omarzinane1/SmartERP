import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { dashboardMock } from '../data/dashboard.mock'
import type { DashboardData } from '../types/dashboard.types'

export const DASHBOARD_ENDPOINT = '/dashboard/summary/'

export async function getDashboard(): Promise<DashboardData> {
  if (env.dashboardUseMock) return dashboardMock

  // Adapter la réponse ici si Django utilise un autre contrat de données.
  const { data } = await apiClient.get<DashboardData>(DASHBOARD_ENDPOINT)
  return data
}
