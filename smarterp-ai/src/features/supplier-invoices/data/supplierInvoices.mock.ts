import { calculateTotals, sumMoney } from '../../../lib/money'
import { changeSupplierBalance, supplierSnapshot, suppliersMock } from '../../suppliers/data/suppliers.mock'
import { addSupplierPayment, supplierPaymentSnapshot } from '../../payments/data/supplierPayments.mock'
import { recordPaymentSchema } from '../../payments/schemas/payment.schema'
import type { PaymentInput } from '../../payments/types/payments.types'
import { mockDelay, purchaseById, purchaseSnapshot, purchasingDemoDate, purchasingPermissions, PurchasingNotFoundError } from '../../purchases/data/purchases.mock'
import type { PurchaseOrderDetail } from '../../purchases/types/purchases.types'
import { supplierInvoiceSchema } from '../schemas/supplierInvoice.schema'
import { payableBalance } from '../supplierInvoices.utils'
import type { SupplierInvoice, SupplierInvoiceDetail, SupplierInvoiceInput } from '../types/supplierInvoices.types'

const stores = new Map<string, SupplierInvoice[]>()
function initialize(scope: string): SupplierInvoice[] {
  const orders = purchaseSnapshot(scope)
  const payments = supplierPaymentSnapshot(scope)
  return suppliersMock.flatMap((supplier, index) => {
    const id = index === 0 ? 78 : index === 1 ? 64 : 1000 + supplier.id
    const paid = sumMoney(payments.filter((p) => p.invoiceId === id && p.status === 'completed').map((p) => p.amount))
    const balance = index === 0 ? 30000 : supplier.outstandingBalance
    const order = orders.find((o) => index === 0 ? o.id === 321 : o.id === 10000 + supplier.id)!
    const total = sumMoney([balance, paid]) || 1200
    const invoice: SupplierInvoice = { id, reference: `BILL-2026-${String(id).padStart(4, '0')}`, supplierId: supplier.id, supplierName: supplier.name, supplierReference: `FA-${supplier.id}-2026`, buyer: supplier.buyer, invoiceDate: '2026-06-01', dueDate: ['2026-09-30', '2026-10-04', '2026-09-12', '2026-08-15', '2026-07-15', '2026-06-01'][index % 6], currency: 'MAD', paymentTerms: '30 jours fin de mois', notes: '', orderId: order.id, orderReference: order.reference, receipts: order.receipts.map((r) => ({ id: r.id, reference: r.reference })), lines: index === 0 ? order.lines.map((l, n) => ({ ...l, quantity: n === 0 ? 600 : 450, purchaseLineId: l.id, orderedQuantity: l.quantity, receivedQuantity: l.receivedQuantity })) : [{ id: `bill-${id}`, productName: supplier.category, description: 'Fourniture facturée', quantity: 1, unitPrice: total, discountRate: 0, taxRate: 0, purchaseLineId: null, orderedQuantity: null, receivedQuantity: null }], total, paidAmount: paid, workflowStatus: balance || paid ? 'posted' : index % 2 ? 'draft' : 'cancelled', paymentStatus: paid ? balance ? 'partially_paid' : 'paid' : 'unpaid', payments: [], documents: [{ id: `doc-${id}`, name: `${supplier.reference}-facture.pdf`, mime: 'application/pdf', url: null }], activities: [{ id: `bill-created-${id}`, date: '2026-09-01', title: 'Facture fournisseur importée', detail: 'Document de démonstration ; fichier non fourni.' }], capabilities: { canEdit: !balance && !paid && index % 2 === 1, canPost: !balance && !paid && index % 2 === 1, canPay: balance > 0 } }
    if (index === 0) invoice.invoiceDate = '2026-09-01'
    // Atlas owes 48,600 across TWO bills: 30,000 + 18,600. Its first bill is
    // 48,600 total with PAY-2026-0186 (18,600 confirmed), not a pending payment.
    if (index !== 0) return [invoice]
    return [invoice, { ...structuredClone(invoice), id: 79, reference: 'BILL-2026-0079', supplierReference: 'FA-42-COMPLEMENT', orderId: 10042, orderReference: 'PO-2026-H42', receipts: [{ id: 10042, reference: 'REC-2026-H42' }], total: 18600, paidAmount: 0, paymentStatus: 'unpaid' as const, lines: [{ id: 'historical-bill', productName: 'Packaging · historique', description: 'Solde des achats antérieurs', quantity: 1, unitPrice: 18600, discountRate: 0, taxRate: 0, purchaseLineId: null, orderedQuantity: null, receivedQuantity: null }], documents: [] }]
  })
}
function store(scope: string) { if (!stores.has(scope)) stores.set(scope, initialize(scope)); return stores.get(scope)! }
export function supplierInvoiceSnapshot(scope: string): SupplierInvoice[] {
  const suppliers = supplierSnapshot(scope), orders = purchaseSnapshot(scope), payments = supplierPaymentSnapshot(scope)
  return structuredClone(store(scope).map((i) => {
    const related = payments.filter((p) => p.invoiceId === i.id)
    const paidAmount = sumMoney(related.filter((p) => p.status === 'completed').map((p) => p.amount))
    const order = orders.find((o) => o.id === i.orderId)
    return { ...i, supplierName: suppliers.find((s) => s.id === i.supplierId)?.name ?? i.supplierName, paidAmount, payments: related, paymentStatus: paidAmount === 0 ? 'unpaid' : paidAmount >= i.total ? 'paid' : 'partially_paid', receipts: order?.receipts.map((r) => ({ id: r.id, reference: r.reference })) ?? [], lines: i.lines.map((line) => { const source = order?.lines.find((l) => l.id === line.purchaseLineId); return { ...line, orderedQuantity: source?.quantity ?? line.orderedQuantity, receivedQuantity: source?.receivedQuantity ?? line.receivedQuantity } }), capabilities: { canEdit: i.workflowStatus === 'draft', canPost: i.workflowStatus === 'draft', canPay: i.workflowStatus === 'posted' && paidAmount < i.total } }
  }))
}
export function supplierInvoiceById(scope: string, id: number): SupplierInvoiceDetail {
  const invoice = supplierInvoiceSnapshot(scope).find((i) => i.id === id)
  if (!invoice) throw new PurchasingNotFoundError()
  return { ...invoice, permissions: purchasingPermissions, asOf: purchasingDemoDate }
}
export function purchaseDetailMock(scope: string, id: number): PurchaseOrderDetail {
  const order = purchaseById(scope, id)
  const invoices = supplierInvoiceSnapshot(scope).filter((i) => i.orderId === id)
  const posted = invoices.filter((i) => i.workflowStatus === 'posted')
  const billedAmount = sumMoney(posted.map((i) => i.total))
  const paidAmount = sumMoney(posted.map((i) => i.paidAmount))
  const reserved = invoices.filter((i) => i.workflowStatus !== 'cancelled')
  const billable = order.lines.some((l) => l.receivedQuantity > reserved.flatMap((i) => i.lines).filter((x) => x.purchaseLineId === l.id).reduce((sum, x) => sum + x.quantity, 0))
  return { ...order, billedAmount, paidAmount, invoiceIds: invoices.map((i) => i.id), billingStatus: !billedAmount ? 'not_billed' : billedAmount < order.total ? 'partially_billed' : 'billed', capabilities: { ...order.capabilities, canBill: order.capabilities.canBill && billable }, permissions: purchasingPermissions, asOf: purchasingDemoDate, invoices: invoices.map((i) => ({ id: i.id, reference: i.reference, total: i.total, paidAmount: i.paidAmount, workflowStatus: i.workflowStatus })), payments: posted.flatMap((i) => i.payments) }
}
export async function saveSupplierInvoiceMock(scope: string, input: SupplierInvoiceInput, id?: number) {
  await mockDelay()
  const values = supplierInvoiceSchema.parse(input)
  const supplier = supplierSnapshot(scope).find((s) => s.id === values.supplierId && s.status === 'active')
  if (!supplier) throw new Error('Fournisseur indisponible')
  const original = id === undefined ? undefined : store(scope).find((i) => i.id === id)
  if (id !== undefined && (!original || original.workflowStatus !== 'draft')) throw new Error('Facture non modifiable')
  if (original?.orderId && original.supplierId !== values.supplierId) throw new Error('Fournisseur différent de la commande')
  const newId = id ?? Math.max(...store(scope).map((i) => i.id)) + 1
  const invoice: SupplierInvoice = { ...values, id: newId, reference: original?.reference ?? `BILL-DEMO-${newId}`, supplierName: supplier.name, buyer: supplier.buyer, orderId: original?.orderId ?? null, orderReference: original?.orderReference ?? null, receipts: original?.receipts ?? [], total: calculateTotals(values.lines).total, paidAmount: 0, workflowStatus: 'draft', paymentStatus: 'unpaid', payments: [], documents: original?.documents ?? [], activities: [...original?.activities ?? [], { id: crypto.randomUUID(), date: purchasingDemoDate, title: 'Brouillon enregistré', detail: 'Simulation locale' }], capabilities: { canEdit: true, canPost: true, canPay: false } }
  if (original) Object.assign(original, invoice); else store(scope).unshift(invoice)
  return supplierInvoiceById(scope, newId)
}
export async function postSupplierInvoiceMock(scope: string, id: number) {
  await mockDelay()
  const original = store(scope).find((i) => i.id === id)
  if (!original || original.workflowStatus !== 'draft') throw new Error('Validation indisponible')
  supplierInvoiceSchema.parse(original)
  changeSupplierBalance(scope, original.supplierId, original.total)
  original.workflowStatus = 'posted'
  original.activities.unshift({ id: crypto.randomUUID(), date: purchasingDemoDate, title: 'Validation simulée', detail: 'Aucune comptabilisation réelle.' })
  return supplierInvoiceById(scope, id)
}
export async function recordSupplierPaymentMock(scope: string, input: PaymentInput) {
  await mockDelay()
  const invoice = supplierInvoiceById(scope, input.invoiceId)
  if (invoice.workflowStatus !== 'posted') throw new Error('Facture non comptabilisée')
  const values = recordPaymentSchema([{ id: invoice.id, reference: invoice.reference, direction: 'outgoing', partnerId: invoice.supplierId, partnerName: invoice.supplierName, remainingAmount: payableBalance(invoice), issuedDate: invoice.invoiceDate }]).parse(input)
  changeSupplierBalance(scope, invoice.supplierId, -values.amount)
  const payment = addSupplierPayment(scope, { ...values, direction: 'outgoing', partnerType: 'supplier', partnerName: invoice.supplierName, invoiceReference: invoice.reference, invoiceIssuedDate: invoice.invoiceDate, status: 'completed', canCancel: true })
  store(scope).find((i) => i.id === invoice.id)!.activities.unshift({ id: `payment-${payment.id}`, date: values.date, title: 'Décaissement simulé', detail: `${payment.reference} · ${values.amount} MAD. Aucun règlement bancaire.` })
  return payment
}
export async function billPurchaseMock(scope: string, id: number) {
  await mockDelay()
  const order = purchaseDetailMock(scope, id)
  if (order.status !== 'confirmed' || !order.capabilities.canBill) throw new Error('Rien à facturer')
  const reserved = supplierInvoiceSnapshot(scope).filter((i) => i.orderId === id && i.workflowStatus !== 'cancelled').flatMap((i) => i.lines)
  const lines = order.lines.map((l) => ({ ...l, quantity: Math.round((l.receivedQuantity - reserved.filter((x) => x.purchaseLineId === l.id).reduce((sum, x) => sum + x.quantity, 0)) * 1000) / 1000, purchaseLineId: l.id, orderedQuantity: l.quantity, receivedQuantity: l.receivedQuantity })).filter((l) => l.quantity > 0)
  // No asynchronous gap between the reservation check and the insert.
  const invoiceId = Math.max(...store(scope).map((i) => i.id)) + 1
  const input = supplierInvoiceSchema.parse({ supplierId: order.supplierId, supplierReference: `À compléter ${order.reference}`, invoiceDate: purchasingDemoDate, dueDate: '2026-10-30', currency: 'MAD', paymentTerms: '30 jours', notes: 'Brouillon simulé depuis les quantités reçues non encore facturées.', lines })
  store(scope).unshift({ ...input, id: invoiceId, reference: `BILL-DEMO-${invoiceId}`, supplierName: order.supplierName, buyer: order.buyer, orderId: id, orderReference: order.reference, receipts: order.receipts.map((r) => ({ id: r.id, reference: r.reference })), total: calculateTotals(lines).total, paidAmount: 0, workflowStatus: 'draft', paymentStatus: 'unpaid', payments: [], documents: [], activities: [{ id: crypto.randomUUID(), date: purchasingDemoDate, title: 'Brouillon depuis commande', detail: 'Simulation locale, aucun document comptable réel.' }], capabilities: { canEdit: true, canPost: true, canPay: false } })
  return supplierInvoiceById(scope, invoiceId)
}
