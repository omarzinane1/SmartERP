import { supplierPaymentSnapshot, cancelSupplierPayment } from './supplierPayments.mock'
import { supplierInvoiceSnapshot, recordSupplierPaymentMock } from '../../supplier-invoices/data/supplierInvoices.mock'
import { payableBalance } from '../../supplier-invoices/supplierInvoices.utils'
import { sumMoney } from '../../../lib/money'
import { cancelInvoicePaymentMock, invoiceActionMock, invoiceDemoDate, invoiceSnapshot } from '../../invoices/data/invoices.mock'
import { remainingAmount } from '../../invoices/utils/invoiceCalculations'
import { changeSupplierBalance, supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { filterPayments, paymentSummary } from '../payments.utils'
import { recordPaymentSchema } from '../schemas/payment.schema'
import { paymentMethodLabels, type Payment, type PaymentInput, type PaymentInvoiceOption, type PaymentMethod, type PaymentPermission, type PaymentQuery, type PaymentsData } from '../types/payments.types'

export const paymentsDemoDate = invoiceDemoDate
export const paymentPermissions: PaymentPermission[] = ['payments.view', 'payments.create', 'payments.cancel', 'payments.export']
function method(value: string): PaymentMethod {
  return (Object.entries(paymentMethodLabels).find(([, label]) => label === value)?.[0] as PaymentMethod | undefined) ?? 'other'
}
export function paymentSnapshot(scope: string): Payment[] {
  supplierInvoiceSnapshot(scope)
  const incoming = invoiceSnapshot(scope).flatMap((invoice) => invoice.payments.map((payment): Payment => ({
    id: payment.id, reference: payment.reference, direction: 'incoming', partnerType: 'customer', partnerId: invoice.customerId, partnerName: invoice.customerName,
    invoiceId: invoice.id, invoiceReference: invoice.reference, invoiceIssuedDate: invoice.issuedAt,
    date: payment.date, amount: payment.amount, method: method(payment.method), status: payment.status === 'confirmed' ? 'completed' : payment.status,
    referenceExternal: payment.referenceExternal ?? '', note: payment.note ?? '', canCancel: invoice.workflowStatus === 'posted' && payment.status !== 'cancelled',
  })))
  const suppliers = supplierSnapshot(scope)
  return structuredClone([...incoming, ...supplierPaymentSnapshot(scope).map((payment) => ({ ...payment, partnerName: suppliers.find((row) => row.id === payment.partnerId)?.name ?? payment.partnerName }))])
}
export function openPaymentInvoices(scope: string): PaymentInvoiceOption[] {
  const incoming = invoiceSnapshot(scope).filter((invoice) => invoice.workflowStatus === 'posted' && invoice.capabilities.canPay && remainingAmount(invoice) > 0).map((invoice): PaymentInvoiceOption => ({ id: invoice.id, reference: invoice.reference, direction: 'incoming', partnerId: invoice.customerId, partnerName: invoice.customerName, remainingAmount: remainingAmount(invoice), issuedDate: invoice.issuedAt }))
  const bills = supplierInvoiceSnapshot(scope).filter((invoice) => invoice.workflowStatus === 'posted' && payableBalance(invoice) > 0).map((invoice): PaymentInvoiceOption => ({ id: invoice.id, reference: invoice.reference, direction: 'outgoing', partnerId: invoice.supplierId, partnerName: invoice.supplierName, remainingAmount: payableBalance(invoice), issuedDate: invoice.invoiceDate }))
  return [...incoming, ...bills]
}
export async function getPaymentsMock(scope: string, query: PaymentQuery): Promise<PaymentsData> {
  const all = paymentSnapshot(scope)
  const filtered = filterPayments(all, query, paymentsDemoDate).sort((a, b) => (query.sort === 'amount_desc' ? b.amount - a.amount : query.sort === 'date_asc' ? a.date.localeCompare(b.date) : query.sort === 'reference' ? a.reference.localeCompare(b.reference) : b.date.localeCompare(a.date)) || b.id - a.id)
  const partners = [...new Map(all.map((payment) => [`${payment.partnerType}:${payment.partnerId}`, { id: payment.partnerId, name: payment.partnerName, type: payment.partnerType }])).values()]
  return { payments: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), count: filtered.length, totalCount: all.length, permissions: paymentPermissions, asOf: paymentsDemoDate, openInvoices: openPaymentInvoices(scope), partners }
}
export async function getPaymentsSummaryMock(scope: string, query: PaymentQuery) { return paymentSummary(filterPayments(paymentSnapshot(scope), query, paymentsDemoDate)) }
export async function createPaymentMock(scope: string, input: PaymentInput) {
  const values = recordPaymentSchema(openPaymentInvoices(scope)).parse(input)
  if (values.direction === 'incoming') {
    const invoice = await invoiceActionMock(scope, values.invoiceId, 'payment', { date: values.date, amount: values.amount, method: paymentMethodLabels[values.method], reference: values.referenceExternal, note: values.note })
    return paymentSnapshot(scope).find((payment) => payment.id === invoice.payments.at(-1)!.id)!
  }
  return recordSupplierPaymentMock(scope, values)
}
export async function cancelPaymentMock(scope: string, id: number) {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const payment = paymentSnapshot(scope).find((row) => row.id === id)
  if (!payment?.canCancel || payment.status === 'cancelled' || payment.status === 'failed') throw new Error('Paiement non annulable')
  if (payment.direction === 'incoming') await cancelInvoicePaymentMock(scope, id)
  else {
    if (payment.status === 'completed') changeSupplierBalance(scope, payment.partnerId, payment.amount)
    cancelSupplierPayment(scope, id)
  }
  return paymentSnapshot(scope).find((row) => row.id === id)!
}
export const totalConfirmedPayments = (rows: Payment[]) => sumMoney(rows.filter((row) => row.status === 'completed').map((row) => row.amount))
