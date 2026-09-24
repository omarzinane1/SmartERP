import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { createInvoice, getInvoiceById, getInvoices, InvoiceNotFoundError, postInvoice, recordInvoicePayment, remindInvoice, requestInvoiceInsight, sendInvoice, updateInvoice } from '../api/invoices.api'
import type { InvoiceDetail, InvoiceInput, InvoicePaymentInput } from '../types/invoices.types'

export function useInvoiceDetail(id: string | undefined) {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const scope = `${userId}:${companyId}`
  const numericId = id === undefined ? undefined : Number(id)
  const validId = id === undefined || (/^\d+$/.test(id) && Number.isSafeInteger(numericId) && Number(numericId) > 0)
  const prefix = ['invoice-detail', userId, companyId, env.invoicesUseMock]
  const queryKey = [...prefix, numericId ?? 'new']
  const client = useQueryClient()
  const options = { retry: false, networkMode: 'always' as const }
  const query = useQuery({ ...options, queryKey, enabled: validId, queryFn: async ({ signal }) => {
    if (numericId !== undefined) { const invoice = await getInvoiceById(scope, numericId, signal); return { invoice, permissions: invoice.permissions, asOf: invoice.asOf, salesperson: invoice.salesperson } }
    const list = await getInvoices(scope, signal)
    return { invoice: null, permissions: list.permissions, asOf: list.asOf, salesperson: list.currentSalesperson }
  } })
  async function refresh(invoice: InvoiceDetail) {
    client.setQueryData([...prefix, invoice.id], { invoice, permissions: invoice.permissions, asOf: invoice.asOf, salesperson: invoice.salesperson })
    insight.reset()
    await Promise.all([
      client.invalidateQueries({ queryKey: ['invoices', userId, companyId] }), client.invalidateQueries({ queryKey: ['invoice-aging', userId, companyId] }),
      client.invalidateQueries({ queryKey: ['sales-order', userId, companyId] }), client.invalidateQueries({ queryKey: ['sales-orders', userId, companyId] }),
    ])
  }
  const save = useMutation({ ...options, mutationFn: (input: InvoiceInput) => numericId === undefined ? createInvoice(scope, input) : updateInvoice(scope, numericId, input), onSuccess: refresh })
  const post = useMutation({ ...options, mutationFn: () => postInvoice(scope, numericId!), onSuccess: refresh })
  const send = useMutation({ ...options, mutationFn: () => sendInvoice(scope, numericId!), onSuccess: refresh })
  const payment = useMutation({ ...options, mutationFn: (input: InvoicePaymentInput) => recordInvoicePayment(scope, numericId!, input), onSuccess: refresh })
  const remind = useMutation({ ...options, mutationFn: () => remindInvoice(scope, numericId!), onSuccess: refresh })
  const insight = useMutation({ ...options, mutationFn: () => requestInvoiceInsight(scope, numericId!) })
  const status = isAxiosError(query.error) ? query.error.response?.status : undefined
  return { ...query, save, post, send, payment, remind, insight, isDemo: env.invoicesUseMock, busy: save.isPending || post.isPending || send.isPending || payment.isPending || remind.isPending,
    isNotFound: !validId || status === 404 || query.error instanceof InvoiceNotFoundError,
    isForbidden: status === 403 || (!!query.data && !query.data.permissions.includes('invoices.view')),
  }
}
