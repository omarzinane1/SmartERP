import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { getSalesOrders } from '../api/sales.api'

export function useSalesOrders() {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const query = useQuery({ queryKey: ['sales-orders', userId, companyId, env.salesUseMock],
    queryFn: ({ signal }) => getSalesOrders(`${userId}:${companyId}`, signal), retry: false, networkMode: 'always',
  })
  return { ...query, isDemo: env.salesUseMock, isForbidden: isAxiosError(query.error) && query.error.response?.status === 403 }
}
