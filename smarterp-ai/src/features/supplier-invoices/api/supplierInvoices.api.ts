import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { mockDelay, purchasingDemoDate, purchasingPermissions } from '../../purchases/data/purchases.mock'
import { postSupplierInvoiceMock, recordSupplierPaymentMock, saveSupplierInvoiceMock, supplierInvoiceById, supplierInvoiceSnapshot } from '../data/supplierInvoices.mock'
import { payableAging } from '../supplierInvoices.utils'
import type { PayableBucket, SupplierInvoiceDetail, SupplierInvoiceInput, SupplierInvoicesData } from '../types/supplierInvoices.types'
import type { PaymentInput } from '../../payments/types/payments.types'
export const SUPPLIER_INVOICES_ENDPOINT = '/supplier-invoices/'
const inputDTO = (v: SupplierInvoiceInput) => ({ supplier_id: v.supplierId, supplier_reference: v.supplierReference, invoice_date: v.invoiceDate, due_date: v.dueDate, currency: v.currency, payment_terms: v.paymentTerms, notes: v.notes, lines: v.lines.map((l) => ({ id: l.id, product_name: l.productName, description: l.description, purchase_line_id: l.purchaseLineId, quantity: l.quantity, unit_price: l.unitPrice, discount_rate: l.discountRate, tax_rate: l.taxRate })) })
export async function getSupplierInvoices(scope: string, signal?: AbortSignal): Promise<SupplierInvoicesData> {
  if (env.supplierInvoicesUseMock) { await mockDelay(); return { invoices: supplierInvoiceSnapshot(scope), permissions: purchasingPermissions, asOf: purchasingDemoDate, suppliers: supplierSnapshot(scope).filter((s) => s.status === 'active').map(({ id, name }) => ({ id, name })), canExport: true } }
  return (await apiClient.get<SupplierInvoicesData>(SUPPLIER_INVOICES_ENDPOINT, { signal })).data
}
export async function getSupplierInvoiceById(scope: string, id: number, signal?: AbortSignal): Promise<SupplierInvoiceDetail> {
  if (env.supplierInvoicesUseMock) { await mockDelay(); return supplierInvoiceById(scope, id) }
  return (await apiClient.get<SupplierInvoiceDetail>(`${SUPPLIER_INVOICES_ENDPOINT}${id}/`, { signal })).data
}
export async function getSupplierInvoiceAging(scope: string, signal?: AbortSignal): Promise<PayableBucket[]> {
  if (env.supplierInvoicesUseMock) return payableAging(supplierInvoiceSnapshot(scope), purchasingDemoDate)
  return (await apiClient.get<PayableBucket[]>(`${SUPPLIER_INVOICES_ENDPOINT}aging/`, { signal })).data
}
export async function createSupplierInvoice(scope: string, input: SupplierInvoiceInput): Promise<SupplierInvoiceDetail> {
  if (env.supplierInvoicesUseMock) return saveSupplierInvoiceMock(scope, input)
  return (await apiClient.post<SupplierInvoiceDetail>(SUPPLIER_INVOICES_ENDPOINT, inputDTO(input))).data
}
export async function updateSupplierInvoice(scope: string, id: number, input: SupplierInvoiceInput): Promise<SupplierInvoiceDetail> {
  if (env.supplierInvoicesUseMock) return saveSupplierInvoiceMock(scope, input, id)
  return (await apiClient.patch<SupplierInvoiceDetail>(`${SUPPLIER_INVOICES_ENDPOINT}${id}/`, inputDTO(input))).data
}
export async function postSupplierInvoice(scope: string, id: number): Promise<SupplierInvoiceDetail> {
  if (env.supplierInvoicesUseMock) return postSupplierInvoiceMock(scope, id)
  return (await apiClient.post<SupplierInvoiceDetail>(`${SUPPLIER_INVOICES_ENDPOINT}${id}/post/`)).data
}
export async function recordSupplierInvoicePayment(scope: string, id: number, input: PaymentInput): Promise<SupplierInvoiceDetail> {
  if (input.direction !== 'outgoing' || input.invoiceId !== id) throw new Error('Décaissement fournisseur requis')
  if (env.supplierInvoicesUseMock && env.paymentsUseMock) { await recordSupplierPaymentMock(scope, input); return supplierInvoiceById(scope, id) }
  if (env.supplierInvoicesUseMock) throw new Error('Les factures et paiements doivent utiliser le même mode.')
  return (await apiClient.post<SupplierInvoiceDetail>(`${SUPPLIER_INVOICES_ENDPOINT}${id}/payment/`, { date: input.date, amount: input.amount, method: input.method, reference: input.referenceExternal, note: input.note })).data
}
