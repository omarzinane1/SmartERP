import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { postIdempotent } from '../../../lib/idempotentApi'
import { getCollection } from '../../../lib/collectionApi'
import { getInvoiceInsightMock, getInvoiceMock, getInvoicesAgingMock, getInvoicesMock, invoiceActionMock, saveInvoiceMock } from '../data/invoices.mock'
import type { AgingBucket, InvoiceAction, InvoiceDetail, InvoiceInput, InvoicePaymentInput, InvoicesData } from '../types/invoices.types'

export const INVOICES_ENDPOINT = '/invoices/'
export class InvoiceNotFoundError extends Error {}
const capabilities = { canEdit: false, canPost: false, canSend: false, canPay: false, canRemind: false }
function fromAPI(invoice: InvoiceDetail): InvoiceDetail { return { ...invoice, capabilities: { ...capabilities, ...invoice.capabilities } } }
export async function getInvoices(scope: string, signal?: AbortSignal): Promise<InvoicesData> {
  if (env.invoicesUseMock) return getInvoicesMock(scope)
  const data = await getCollection<InvoicesData, 'invoices'>(INVOICES_ENDPOINT, 'invoices', signal)
  return { ...data, invoices: data.invoices.map((invoice) => ({ ...invoice, capabilities: { ...capabilities, ...invoice.capabilities } })) }
}
export async function getInvoicesAging(scope: string, signal?: AbortSignal): Promise<AgingBucket[]> {
  if (env.invoicesUseMock) return getInvoicesAgingMock(scope)
  const { data } = await apiClient.get<AgingBucket[]>(`${INVOICES_ENDPOINT}aging/`, { signal }); return data
}
export async function getInvoiceById(scope: string, id: number, signal?: AbortSignal): Promise<InvoiceDetail> {
  if (env.invoicesUseMock) { const invoice = await getInvoiceMock(scope, id); if (!invoice) throw new InvoiceNotFoundError(); return invoice }
  const { data } = await apiClient.get<InvoiceDetail>(`${INVOICES_ENDPOINT}${id}/`, { signal }); return fromAPI(data)
}
function inputDTO(input: InvoiceInput) {
  return { customer_id: input.customerId, billing_address: input.billingAddress, invoice_date: input.invoiceDate, due_date: input.dueDate, salesperson: input.salesperson, currency: input.currency, payment_terms: input.paymentTerms, customer_reference: input.customerReference, notes: input.notes,
    lines: input.lines.map((line) => ({ product_id: line.productId, product_name: line.productName, description: line.description, quantity: line.quantity, unit_price: line.unitPrice, discount_rate: line.discountRate, tax_rate: line.taxRate })) }
}
export async function createInvoice(scope: string, input: InvoiceInput): Promise<InvoiceDetail> {
  if (env.invoicesUseMock) return saveInvoiceMock(scope, input)
  const { data } = await apiClient.post<InvoiceDetail>(INVOICES_ENDPOINT, inputDTO(input)); return fromAPI(data)
}
export async function updateInvoice(scope: string, id: number, input: InvoiceInput): Promise<InvoiceDetail> {
  if (env.invoicesUseMock) return saveInvoiceMock(scope, input, id)
  const { data } = await apiClient.patch<InvoiceDetail>(`${INVOICES_ENDPOINT}${id}/`, inputDTO(input)); return fromAPI(data)
}
async function mutateInvoice(scope: string, id: number, action: InvoiceAction, input?: InvoicePaymentInput): Promise<InvoiceDetail> {
  if (env.invoicesUseMock) return invoiceActionMock(scope, id, action, input)
  return fromAPI(await postIdempotent<InvoiceDetail>(scope, `${INVOICES_ENDPOINT}${id}/${action}/`, input ?? {}))
}
export interface CreditNoteInput { date: string; reason: string; lines?: { line_id: number; quantity: number }[] }
export async function createCreditNote(scope: string, id: number, input: CreditNoteInput) {
  if (env.invoicesUseMock) throw new Error('Les avoirs nécessitent le backend réel.')
  return fromAPI(await postIdempotent<InvoiceDetail>(scope, `${INVOICES_ENDPOINT}${id}/credit-note/`, input))
}
export const postInvoice = (scope: string, id: number) => mutateInvoice(scope, id, 'post')
export const sendInvoice = (scope: string, id: number) => mutateInvoice(scope, id, 'send')
export const recordInvoicePayment = (scope: string, id: number, input: InvoicePaymentInput) => mutateInvoice(scope, id, 'payment', input)
export const remindInvoice = (scope: string, id: number) => mutateInvoice(scope, id, 'remind')
export async function requestInvoiceInsight(scope: string, id: number) {
  if (env.invoicesUseMock) return getInvoiceInsightMock(scope, id)
  throw new Error('Service IA des factures non connecté')
}
