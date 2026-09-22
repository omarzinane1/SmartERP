import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { CustomerNotFoundError, getCustomerById, getCustomerSummary, getCustomerActivity, requestCustomerAIInsight } from '../api/customers.api'

export function useCustomerDetail(id: string | undefined) {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const customerId = Number(id)
  const validId = /^\d+$/.test(id ?? '') && Number.isSafeInteger(customerId) && customerId > 0
  const key = ['customer-detail', userId, companyId, env.customersUseMock, customerId]
  const options = { retry: false, networkMode: 'always' as const }
  const customer = useQuery({ ...options, queryKey: key, queryFn: ({ signal }) => getCustomerById(customerId, signal), enabled: validId })
  const permissions = customer.data?.permissions ?? []
  const canView = permissions.includes('customers.view')
  const canSales = canView && permissions.includes('sales.view')
  const canInvoices = canView && permissions.includes('invoices.view')
  const canPayments = canView && permissions.includes('payments.view')
  const canAI = canSales && canInvoices && canPayments && permissions.includes('ai.use')
  const summary = useQuery({ ...options, queryKey: [...key, 'summary'], queryFn: ({ signal }) => getCustomerSummary(customerId, signal), enabled: canView })
  const activity = useQuery({ ...options, queryKey: [...key, 'activity'], queryFn: ({ signal }) => getCustomerActivity(customerId, signal), enabled: canView })
  const ai = useQuery({ ...options, queryKey: [...key, 'ai'], queryFn: ({ signal }) => requestCustomerAIInsight(customerId, signal), enabled: canAI })
  const status = isAxiosError(customer.error) ? customer.error.response?.status : undefined
  return {
    customer, summary, activity, ai,
    isDemo: env.customersUseMock,
    isNotFound: !validId || status === 404 || customer.error instanceof CustomerNotFoundError,
    isForbidden: status === 403 || (!!customer.data && !canView),
    canSales, canInvoices, canPayments, canAI,
  }
}
