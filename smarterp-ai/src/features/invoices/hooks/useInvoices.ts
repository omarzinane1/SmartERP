import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { getInvoices, remindInvoice, sendInvoice } from '../api/invoices.api'
import { calculateAging } from '../utils/invoiceCalculations'

export function useInvoices() {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const scope = `${userId}:${companyId}`
  const queryKey = ['invoices', userId, companyId, env.invoicesUseMock]
  const client = useQueryClient()
  const options = { retry: false, networkMode: 'always' as const }
  const query = useQuery({ ...options, queryKey, queryFn: ({ signal }) => getInvoices(scope, signal) })
  async function refresh() { await Promise.all([client.invalidateQueries({ queryKey }), client.invalidateQueries({ queryKey: ['invoice-detail', userId, companyId] }), client.invalidateQueries({ queryKey: ['invoice-aging', userId, companyId] })]) }
  const send = useMutation({ ...options, mutationFn: (id: number) => sendInvoice(scope, id), onSuccess: refresh })
  const remind = useMutation({ ...options, mutationFn: (id: number) => remindInvoice(scope, id), onSuccess: refresh })
  return { ...query, send, remind, isDemo: env.invoicesUseMock,
    aging: query.data ? calculateAging(query.data.invoices, query.data.asOf) : [],
    isForbidden: (isAxiosError(query.error) && query.error.response?.status === 403) || (!!query.data && !query.data.permissions.includes('invoices.view')),
  }
}
