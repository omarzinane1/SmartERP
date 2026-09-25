import { sumMoney } from '../../../lib/money'
import { cancelInvoicePaymentMock, invoiceActionMock, invoiceDemoDate, invoiceSnapshot } from '../../invoices/data/invoices.mock'
import { remainingAmount } from '../../invoices/utils/invoiceCalculations'
import { changeSupplierBalance, supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { filterPayments, paymentSummary } from '../payments.utils'
import { recordPaymentSchema } from '../schemas/payment.schema'
import { paymentMethodLabels, type Payment, type PaymentInput, type PaymentInvoiceOption, type PaymentMethod, type PaymentPermission, type PaymentQuery, type PaymentsData } from '../types/payments.types'

export const paymentsDemoDate = invoiceDemoDate
export const paymentPermissions: PaymentPermission[] = ['payments.view', 'payments.create', 'payments.cancel', 'payments.export']
const stores = new Map<string, Payment[]>()
function outgoing(scope: string) {
  if (!stores.has(scope)) stores.set(scope, supplierSnapshot(scope).slice(0, 28).map((supplier, index): Payment => ({
    id: 2_000_000 + index, reference: index === 0 ? 'PAY-2026-0186' : index === 1 ? 'PAY-2026-0179' : `PAY-FOUR-${index + 1}`,
    direction: 'outgoing', partnerType: 'supplier', partnerId: supplier.id, partnerName: supplier.name,
    invoiceId: index === 0 ? 78 : index === 1 ? 64 : 1000 + supplier.id,
    invoiceReference: `BILL-2026-${String(index === 0 ? 78 : index === 1 ? 64 : 1000 + supplier.id).padStart(4, '0')}`,
    invoiceIssuedDate: '2026-09-01', date: index === 0 ? '2026-09-23' : index === 1 ? '2026-09-18' : `2026-${index % 8 === 0 ? '08' : '09'}-${String(2 + index % 27).padStart(2, '0')}`,
    amount: index === 0 ? 18600 : index === 1 ? 9400 : 300 + index * 110,
    method: (['bank_transfer', 'cheque', 'cash', 'card', 'other'] as const)[index % 5],
    status: index === 0 || index % 5 === 0 ? 'pending' : index === 1 || index % 5 < 3 ? 'completed' : index % 5 === 3 ? 'cancelled' : 'failed',
    referenceExternal: `FOUR-${supplier.reference}`, note: 'Historique de démonstration', canCancel: index === 0 || index === 1 || index % 5 < 3,
  })))
  return stores.get(scope)!
}
function method(value: string): PaymentMethod {
  return (Object.entries(paymentMethodLabels).find(([, label]) => label === value)?.[0] as PaymentMethod | undefined) ?? 'other'
}
export function paymentSnapshot(scope: string): Payment[] {
  const incoming = invoiceSnapshot(scope).flatMap((invoice) => invoice.payments.map((payment): Payment => ({
    id: payment.id, reference: payment.reference, direction: 'incoming', partnerType: 'customer', partnerId: invoice.customerId, partnerName: invoice.customerName,
    invoiceId: invoice.id, invoiceReference: invoice.reference, invoiceIssuedDate: invoice.issuedAt,
    date: payment.date, amount: payment.amount, method: method(payment.method), status: payment.status === 'confirmed' ? 'completed' : payment.status,
    referenceExternal: payment.referenceExternal ?? '', note: payment.note ?? '', canCancel: invoice.workflowStatus === 'posted' && payment.status !== 'cancelled',
  })))
  const suppliers = supplierSnapshot(scope)
  return structuredClone([...incoming, ...outgoing(scope).map((payment) => ({ ...payment, partnerName: suppliers.find((row) => row.id === payment.partnerId)?.name ?? payment.partnerName }))])
}
export function openPaymentInvoices(scope: string): PaymentInvoiceOption[] {
  const incoming = invoiceSnapshot(scope).filter((invoice) => invoice.workflowStatus === 'posted' && invoice.capabilities.canPay && remainingAmount(invoice) > 0).map((invoice): PaymentInvoiceOption => ({ id: invoice.id, reference: invoice.reference, direction: 'incoming', partnerId: invoice.customerId, partnerName: invoice.customerName, remainingAmount: remainingAmount(invoice), issuedDate: invoice.issuedAt }))
  // Une facture fournisseur de démonstration par tiers. Son solde est celui du tiers;
  // les règlements historiques confirmés sont déjà déduits de l'instantané initial.
  const bills = supplierSnapshot(scope).filter((supplier) => supplier.status === 'active' && supplier.outstandingBalance > 0).map((supplier): PaymentInvoiceOption => {
    const id = supplier.id === 42 ? 78 : supplier.id === 18 ? 64 : 1000 + supplier.id
    return { id, reference: `BILL-2026-${String(id).padStart(4, '0')}`, direction: 'outgoing', partnerId: supplier.id, partnerName: supplier.name, remainingAmount: supplier.outstandingBalance, issuedDate: '2026-09-01' }
  })
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
  await new Promise((resolve) => setTimeout(resolve, 400))
  recordPaymentSchema(openPaymentInvoices(scope)).parse(values)
  const invoice = openPaymentInvoices(scope).find((row) => row.direction === 'outgoing' && row.id === values.invoiceId)!
  const id = Math.max(2_000_000, ...outgoing(scope).map((row) => row.id)) + 1
  const payment: Payment = { ...values, id, reference: `PAY-DEMO-${id}`, partnerType: 'supplier', partnerName: invoice.partnerName, invoiceReference: invoice.reference, invoiceIssuedDate: invoice.issuedDate, status: 'completed', canCancel: true }
  changeSupplierBalance(scope, values.partnerId, -values.amount)
  outgoing(scope).unshift(payment)
  return structuredClone(payment)
}
export async function cancelPaymentMock(scope: string, id: number) {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const payment = paymentSnapshot(scope).find((row) => row.id === id)
  if (!payment?.canCancel || payment.status === 'cancelled' || payment.status === 'failed') throw new Error('Paiement non annulable')
  if (payment.direction === 'incoming') await cancelInvoicePaymentMock(scope, id)
  else {
    if (payment.status === 'completed') changeSupplierBalance(scope, payment.partnerId, payment.amount)
    const original = outgoing(scope).find((row) => row.id === id)!
    original.status = 'cancelled'; original.canCancel = false
  }
  return paymentSnapshot(scope).find((row) => row.id === id)!
}
export const totalConfirmedPayments = (rows: Payment[]) => sumMoney(rows.filter((row) => row.status === 'completed').map((row) => row.amount))
