import { useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { getDashboard } from '../api/dashboard.api'

export function useDashboard() {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const query = useQuery({
    queryKey: ['dashboard', userId, companyId, env.dashboardUseMock],
    queryFn: getDashboard,
    retry: false,
    networkMode: 'always',
  })

  return { ...query, isDemo: env.dashboardUseMock }
}
