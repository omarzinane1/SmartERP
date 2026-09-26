import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { confirmSalesOrder, createSalesOrderDelivery, createSalesOrderInvoice, getSalesOrderById, requestSalesOrderInsight, SalesOrderNotFoundError } from '../api/sales.api'
import type { SalesActionResult, SalesDeliveryInput, SalesInvoiceInput, SalesOrdersData } from '../types/sales.types'

export function useSalesOrderDetail(id: string | undefined) {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const scope = `${userId}:${companyId}`
  const orderId = Number(id)
  const validId = /^\d+$/.test(id ?? '') && Number.isSafeInteger(orderId) && orderId > 0
  const key = ['sales-order', userId, companyId, env.salesUseMock, orderId]
  const listKey = ['sales-orders', userId, companyId, env.salesUseMock]
  const client = useQueryClient()
  const options = { networkMode: 'always' as const, retry: false }
  const query = useQuery({ ...options, queryKey: key, enabled: validId, queryFn: ({ signal }) => getSalesOrderById(scope, orderId, signal) })
  async function refresh(result: SalesActionResult) {
    if (result.order) {
      client.setQueryData(key, result.order)
      client.setQueryData<SalesOrdersData>(listKey, (current) => current && ({ ...current, orders: current.orders.map((order) => order.id === result.order!.id ? result.order! : order) }))
    }
    await Promise.all([...['product', 'product-metrics', 'reports', 'report-analytics', 'forecast', 'forecast-drivers', 'ai-opportunities', 'approvals'].map((name) => client.invalidateQueries({ queryKey: [name, userId, companyId] })), client.invalidateQueries({ queryKey: key }), client.invalidateQueries({ queryKey: listKey })])
    insight.reset()
  }
  const confirm = useMutation({ ...options, mutationFn: () => confirmSalesOrder(scope, orderId), onSuccess: refresh })
  const delivery = useMutation({ ...options, mutationFn: (input: SalesDeliveryInput) => createSalesOrderDelivery(orderId, input), onSuccess: refresh })
  const invoice = useMutation({ ...options, mutationFn: (input: SalesInvoiceInput) => createSalesOrderInvoice(orderId, input), onSuccess: refresh })
  const insight = useMutation({ ...options, mutationFn: () => requestSalesOrderInsight(scope, orderId) })
  const status = isAxiosError(query.error) ? query.error.response?.status : undefined
  return { ...query, confirm, delivery, invoice, insight, isDemo: env.salesUseMock,
    isNotFound: !validId || status === 404 || query.error instanceof SalesOrderNotFoundError,
    isForbidden: status === 403 || (!!query.data && !query.data.permissions.includes('sales.view')),
    busy: confirm.isPending || delivery.isPending || invoice.isPending,
  }
}
