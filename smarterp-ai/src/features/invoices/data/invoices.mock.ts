import { customerInvoicesMock, customerPaymentsMock, getCustomerDetailMock } from '../../customers/data/customers.mock'
import { salesMock, syncSalesInvoiceMock } from '../../sales/data/sales.mock'
import { calculateTotals, formatMoney, sumMoney } from '../../../lib/money'
import { invoiceSchema, paymentSchema } from '../schemas/invoice.schema'
import { calculateAging, daysOverdue, remainingAmount } from '../utils/invoiceCalculations'
import type { InvoiceAction, InvoiceAIInsight, InvoiceDetail, InvoiceInput, InvoicePaymentInput, InvoicePermission, InvoiceSummary, InvoiceWorkflowStatus } from '../types/invoices.types'

export const invoiceDemoDate = '2026-09-30'
export const invoiceDemoPermissions: InvoicePermission[] = ['invoices.view', 'invoices.create', 'invoices.edit', 'invoices.post', 'invoices.send', 'finance.view', 'payments.create', 'ai.use']
function fixture(id: number, customerId: number, amount: number, paid: number, date: string, due: string, workflow: InvoiceWorkflowStatus = 'posted'): InvoiceDetail {
  const customer = getCustomerDetailMock(customerId)!
  const lines = [{ id: `${id}-line`, productId: null, productName: 'Fournitures et prestations', description: 'Lot de démonstration — TVA 0 % explicite', quantity: 1, unitPrice: amount, discountRate: 0, taxRate: 0 }]
  return { id, reference: `INV-2026-${String(id).padStart(4, '0')}`, customerId, customerName: customer.name, customerEmail: customer.email, salesperson: customer.salesperson,
    billingAddress: `${customer.address}, ${customer.city}, ${customer.country}`, invoiceDate: date, issuedAt: workflow === 'posted' ? date : null, dueDate: due, currency: 'MAD', paymentTerms: customer.paymentTerms ?? '', customerReference: '', notes: '',
    totalAmount: amount, paidAmount: paid, workflowStatus: workflow, paymentStatus: paid >= amount && amount > 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid',
    salesOrderId: null, salesOrderReference: null, lines, totals: calculateTotals(lines), deliveries: [], creditNotes: [],
    payments: paid ? [{ id: id * 100, reference: `PAY-DEMO-${id}`, date: invoiceDemoDate, amount: paid, method: 'Virement bancaire', status: 'confirmed' }] : [],
    documents: [{ id, name: `Facture ${String(id).padStart(4, '0')}` }],
    activities: [{ id: `${id}-created`, type: 'created', date: `${date}T09:00:00+01:00`, user: customer.salesperson, description: 'Facture créée — historique de démonstration.' },
      ...(workflow === 'posted' ? [{ id: `${id}-posted`, type: 'posted' as const, date: `${date}T10:00:00+01:00`, user: 'Équipe comptable', description: 'Facture comptabilisée — exemple historique.' }] : [])],
    capabilities: { canEdit: workflow === 'draft', canPost: workflow === 'draft', canSend: workflow === 'posted', canPay: workflow === 'posted' && amount > paid, canRemind: false }, permissions: [...invoiceDemoPermissions], asOf: invoiceDemoDate,
  }
}
// Réutilisation des instantanés existants : pas de seconde valeur pour INV-2026-0412.
const customerInvoices = customerInvoicesMock.map((invoice) => {
  const id = Number(invoice.reference.split('-').at(-1))
  const result = fixture(id, 124, invoice.amount, invoice.paid, invoice.date, invoice.dueDate)
  result.payments = customerPaymentsMock.filter((payment) => payment.invoice === invoice.reference).map((payment, index) => ({ id: id * 100 + index, reference: payment.reference, date: payment.date, method: ({ 'Bank Transfer': 'Virement bancaire', Cash: 'Espèces', Card: 'Carte', Cheque: 'Chèque' })[payment.method], amount: payment.amount, status: payment.status === 'Received' ? 'confirmed' as const : payment.status === 'Pending' ? 'pending' as const : 'cancelled' as const }))
  return result
})
const orderInvoices = salesMock.flatMap((order) => order.invoices.map((invoice) => {
  const result = fixture(invoice.id, order.customerId, invoice.amount, sumMoney(order.payments.filter((payment) => payment.invoiceId === invoice.id && payment.status === 'confirmed').map((payment) => payment.amount)), invoice.date, invoice.dueDate)
  return { ...result, reference: invoice.reference, salesOrderId: order.id, salesOrderReference: order.reference, deliveries: structuredClone(order.deliveries), payments: order.payments.filter((payment) => payment.invoiceId === invoice.id).map((payment) => ({ ...payment })) }
}))
const additional = Array.from({ length: 28 }, (_, index) => {
  const workflow = index % 7 === 0 ? 'draft' : index % 7 === 6 ? 'cancelled' : 'posted'
  const amount = 2400 + index * 175
  const due = ['2026-10-04', '2026-09-30', '2026-09-15', '2026-08-15', '2026-07-15', '2026-06-15', '2026-10-20'][index % 7]
  const date = due < '2026-09-01' ? due.slice(0, 8) + '01' : '2026-09-01'
  return fixture(600 + index, [85, 117, 94, 72, 156][index % 5], amount, workflow !== 'posted' ? 0 : index % 4 === 0 ? amount : index % 4 === 1 ? Math.round(amount / 2) : 0, date, due, workflow)
})
export const invoicesMock: InvoiceDetail[] = [...customerInvoices, fixture(413, 124, 24600, 11800, '2026-09-01', '2026-09-15'), ...orderInvoices, ...additional]
const sessions = new Map<string, InvoiceDetail[]>()
function session(scope: string) { if (!sessions.has(scope)) sessions.set(scope, structuredClone(invoicesMock)); return sessions.get(scope)! }
export function invoiceSummary(invoice: InvoiceDetail): InvoiceSummary {
  const { id, reference, customerId, customerName, salesperson, invoiceDate, issuedAt, dueDate, totalAmount, paidAmount, workflowStatus, paymentStatus, salesOrderId, salesOrderReference, capabilities } = invoice
  return { id, reference, customerId, customerName, salesperson, invoiceDate, issuedAt, dueDate, totalAmount, paidAmount, workflowStatus, paymentStatus, salesOrderId, salesOrderReference, capabilities }
}
export async function getInvoicesMock(scope: string) { return structuredClone({ invoices: session(scope).map(invoiceSummary), permissions: invoiceDemoPermissions, asOf: invoiceDemoDate, currentSalesperson: 'Sara El Mansouri' }) }
export async function getInvoiceMock(scope: string, id: number) { return structuredClone(session(scope).find((invoice) => invoice.id === id) ?? null) }
export async function getInvoicesAgingMock(scope: string) { return calculateAging(session(scope), invoiceDemoDate) }
function activity(invoice: InvoiceDetail, type: InvoiceDetail['activities'][number]['type'], description: string, reference?: string) {
  invoice.activities.push({ id: crypto.randomUUID(), type, description, date: `${invoiceDemoDate}T${new Date().toISOString().slice(11)}`, user: invoice.salesperson, reference })
}
export async function saveInvoiceMock(scope: string, input: InvoiceInput, id?: number) {
  await new Promise((resolve) => setTimeout(resolve, 400))
  const values = invoiceSchema.parse(input)
  const customer = getCustomerDetailMock(values.customerId)
  if (!customer) throw new Error('Client introuvable')
  const all = session(scope)
  const original = id === undefined ? null : all.find((invoice) => invoice.id === id)
  if (id !== undefined && (!original || original.workflowStatus !== 'draft' || !original.capabilities.canEdit || !original.permissions.includes('invoices.edit'))) throw new Error('Facture non modifiable')
  const newId = original?.id ?? Math.max(...all.map((invoice) => invoice.id)) + 1
  const totals = calculateTotals(values.lines)
  const saved = { ...(original ?? fixture(newId, customer.id, totals.total, 0, values.invoiceDate, values.dueDate, 'draft')), ...values, customerName: customer.name, customerEmail: customer.email, totals, totalAmount: totals.total }
  if (!original) saved.activities = []
  activity(saved, original ? 'edited' : 'created', original ? 'Brouillon modifié dans la démonstration locale.' : 'Brouillon créé dans la démonstration locale.')
  if (original) all[all.indexOf(original)] = saved; else all.unshift(saved)
  return structuredClone(saved)
}
export async function invoiceActionMock(scope: string, id: number, action: InvoiceAction, input?: InvoicePaymentInput): Promise<InvoiceDetail> {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const invoice = session(scope).find((item) => item.id === id)
  if (!invoice) throw new Error('Facture introuvable')
  if (action === 'post') {
    if (!invoice.permissions.includes('invoices.post') || !invoice.capabilities.canPost || invoice.workflowStatus !== 'draft') throw new Error('Validation indisponible')
    invoiceSchema.parse(invoice)
    invoice.workflowStatus = 'posted'; invoice.issuedAt = invoiceDemoDate
    invoice.capabilities = { ...invoice.capabilities, canEdit: false, canPost: false, canSend: true, canPay: remainingAmount(invoice) > 0 }
    activity(invoice, 'posted', 'Validation simulée localement. Aucune comptabilisation réelle.')
  } else if (action === 'payment') {
    if (!invoice.permissions.includes('payments.create') || !invoice.capabilities.canPay || invoice.workflowStatus !== 'posted') throw new Error('Paiement indisponible')
    const payment = paymentSchema(remainingAmount(invoice)).parse(input)
    const id = Math.max(0, ...session(scope).flatMap((item) => item.payments.map((entry) => entry.id))) + 1
    const reference = `PAY-DEMO-${id}`
    invoice.payments.push({ id, reference, amount: payment.amount, date: payment.date, method: payment.method, status: 'confirmed' })
    invoice.paidAmount = sumMoney(invoice.payments.filter((entry) => entry.status === 'confirmed').map((entry) => entry.amount))
    invoice.paymentStatus = remainingAmount(invoice) === 0 ? 'paid' : 'partially_paid'; invoice.capabilities.canPay = remainingAmount(invoice) > 0
    activity(invoice, 'payment', `Paiement simulé localement : ${formatMoney(payment.amount)}.${payment.reference ? ` Référence saisie : ${payment.reference}.` : ''}${payment.note ? ` Note : ${payment.note}` : ''}`, reference)
    if (invoice.salesOrderId) syncSalesInvoiceMock(scope, invoice.salesOrderId, invoice.id, invoice.payments.map((entry) => ({ ...entry, invoiceId: invoice.id })))
  } else if (action === 'send') {
    if (!invoice.permissions.includes('invoices.send') || !invoice.capabilities.canSend || invoice.workflowStatus !== 'posted') throw new Error('Envoi indisponible')
    activity(invoice, 'sent', 'Envoi simulé. Aucun e-mail envoyé.')
  } else {
    if (!invoice.permissions.includes('invoices.remind') || !invoice.capabilities.canRemind) throw new Error('Permission de relance non définie')
    activity(invoice, 'reminder', 'Relance simulée. Aucun e-mail envoyé.')
  }
  return structuredClone(invoice)
}
export async function getInvoiceInsightMock(scope: string, id: number): Promise<InvoiceAIInsight> {
  await new Promise((resolve) => setTimeout(resolve, 650))
  const invoice = session(scope).find((item) => item.id === id)
  if (!invoice || !invoice.permissions.includes('ai.use')) throw new Error('Analyse indisponible')
  const days = daysOverdue(invoice, invoice.asOf)
  return { facts: [`TTC : ${formatMoney(invoice.totalAmount)}.`, `Payé : ${formatMoney(invoice.paidAmount)}.`, `Solde : ${formatMoney(remainingAmount(invoice))}.`, `Échéance : ${invoice.dueDate} ; ${days} jour(s) de retard.`], analysis: days ? 'Le solde reste ouvert après échéance. Un paiement partiel réduit l’exposition sans clôturer la facture.' : 'Les données disponibles ne montrent pas de créance échue ouverte pour cette facture.', risk: days ? 'Retard constaté ; niveau de risque futur non évalué.' : 'Aucun risque futur chiffré à partir de ces seules données.', forecast: 'Aucune date future de paiement prédite. Analyse de démonstration, sans modèle connecté.', recommendations: days ? ['Vérifier le rapprochement des paiements.', 'Préparer un contact client avec un utilisateur habilité.'] : ['Vérifier les pièces et les échéances avant la prochaine action.'] }
}
