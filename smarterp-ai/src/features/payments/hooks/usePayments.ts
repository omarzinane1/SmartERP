import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { cancelPayment, createPayment, getPayments, getPaymentsSummary } from '../api/payments.api'
import type { PaymentsData, PaymentInput, PaymentQuery } from '../types/payments.types'

export function usePayments(filters: PaymentQuery) {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const scope = `${userId}:${companyId}`
  const client = useQueryClient()
  const options = { retry: false, networkMode: 'always' as const }
  const query = useQuery<PaymentsData>({ ...options,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === userId && previousQuery?.queryKey[2] === companyId ? previous : undefined,
    queryKey: ['payments', userId, companyId, env.paymentsUseMock, filters], queryFn: ({ signal }) => getPayments(scope, filters, signal),
  })
  const summary = useQuery({ ...options, queryKey: ['payments-summary', userId, companyId, env.paymentsUseMock, filters], enabled: !!query.data?.permissions.includes('payments.view'), queryFn: ({ signal }) => getPaymentsSummary(scope, filters, signal) })
  async function refresh() {
    await Promise.all(['cash-flow', 'cash-forecast', 'cash-upcoming', 'product', 'product-metrics', 'product-history', 'products', 'reports', 'supplier-detail', 'supplier-metrics', 'supplier-invoices', 'supplier-invoice-detail', 'supplier-invoice-aging', 'purchase-orders', 'purchase-order-detail', 'payments', 'payments-summary', 'invoices', 'invoice-detail', 'invoice-aging', 'sales-order', 'sales-orders', 'suppliers', 'customers', 'customer-detail', 'dashboard'].map((key) => client.invalidateQueries({ queryKey: [key, userId, companyId] })))
  }
  const create = useMutation({ ...options, mutationFn: (input: PaymentInput) => createPayment(scope, input), onSuccess: refresh })
  const cancel = useMutation({ ...options, mutationFn: (id: number) => cancelPayment(scope, id), onSuccess: refresh })
  async function exportRows() {
    const result = await getPayments(scope, { ...filters, page: 1, pageSize: Math.max(1, query.data?.count ?? 0) })
    if (!result.permissions.includes('payments.export') || result.payments.length !== result.count) throw new Error('Export complet indisponible')
    return result.payments
  }
  return { ...query, summary, create, cancel, exportRows, isDemo: env.paymentsUseMock, scope, isForbidden: isAxiosError(query.error) && query.error.response?.status === 403 || !!query.data && !query.data.permissions.includes('payments.view') }
}

