import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { cancelPaymentMock, createPaymentMock, getPaymentsMock, getPaymentsSummaryMock } from '../data/payments.mock'
import type { Payment, PaymentInput, PaymentQuery, PaymentsData, PaymentSummary } from '../types/payments.types'

export const PAYMENTS_ENDPOINT = '/payments/'
function params(query: PaymentQuery) { const { pageSize, dateFrom, dateTo, minAmount, maxAmount, partnerType, partnerId, ...rest } = query; return { ...rest, page_size: pageSize, date_from: dateFrom, date_to: dateTo, min_amount: minAmount, max_amount: maxAmount, partner_type: partnerType, partner_id: partnerId } }
export async function getPayments(scope: string, query: PaymentQuery, signal?: AbortSignal): Promise<PaymentsData> {
  if (env.paymentsUseMock) return getPaymentsMock(scope, query)
  const { data } = await apiClient.get<PaymentsData>(PAYMENTS_ENDPOINT, { params: params(query), signal })
  return { ...data, payments: data.payments.map((row) => ({ ...row, canCancel: row.canCancel === true })) }
}
export async function getPaymentsSummary(scope: string, query: PaymentQuery, signal?: AbortSignal): Promise<PaymentSummary> {
  if (env.paymentsUseMock) return getPaymentsSummaryMock(scope, query)
  const { page: _page, page_size: _size, sort: _sort, ...filters } = params(query)
  void _page; void _size; void _sort
  const { data } = await apiClient.get<PaymentSummary>(`${PAYMENTS_ENDPOINT}summary/`, { params: filters, signal }); return data
}
export async function createPayment(scope: string, input: PaymentInput): Promise<Payment> {
  if (env.paymentsUseMock) return createPaymentMock(scope, input)
  const { data } = await apiClient.post<Payment>(PAYMENTS_ENDPOINT, { direction: input.direction, partner_id: input.partnerId, invoice_id: input.invoiceId, date: input.date, amount: input.amount, method: input.method, reference_external: input.referenceExternal, note: input.note }); return data
}
export async function cancelPayment(scope: string, id: number): Promise<Payment> {
  if (env.paymentsUseMock) return cancelPaymentMock(scope, id)
  const { data } = await apiClient.post<Payment>(`${PAYMENTS_ENDPOINT}${id}/cancel/`); return data
}
