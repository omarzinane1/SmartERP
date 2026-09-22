import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { getCustomers } from '../api/customers.api'

export function useCustomers() {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const query = useQuery({
    queryKey: ['customers', userId, companyId, env.customersUseMock],
    queryFn: ({ signal }) => getCustomers(signal),
    retry: false,
    networkMode: 'always',
  })
  return {
    ...query,
    isDemo: env.customersUseMock,
    isForbidden:
      isAxiosError(query.error) && query.error.response?.status === 403,
  }
}
