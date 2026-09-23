import { customerSalesMock, getCustomerDetailMock } from '../../customers/data/customers.mock'
import { calculateLineAmounts, calculateTotals, formatMoney } from '../../../lib/money'
import { remainingQuantity, salesFinancials } from '../sales.utils'
import type { SalesAIInsight, SalesOrderDetail, SalesOrderLine, SalesOrderStatus, SalesPermission } from '../types/sales.types'

export const salesDemoDate = '2026-09-30'
const permissions: SalesPermission[] = ['sales.view', 'sales.edit', 'sales.margin.view', 'delivery.create', 'invoices.create', 'ai.use']
const statuses: SalesOrderStatus[] = ['processing', 'draft', 'confirmed', 'completed', 'cancelled', 'processing', 'processing']

export const salesMock: SalesOrderDetail[] = statuses.map((status, index) => {
  const id = 1048 + index
  const customer = getCustomerDetailMock([124, 85, 117, 94, 72, 156, 124][index])!
  const sourceQuote = index === 6
  const historical = customerSalesMock.find((sale) => sale.reference === `SO-2026-${id}`)
  const createdDate = historical?.date ?? (sourceQuote ? '2026-09-23' : '2026-09-19')
  const confirmedDate = historical?.date ?? (sourceQuote ? '2026-09-23' : '2026-09-20')
  const deliveryDate = historical?.date ?? (sourceQuote ? '2026-09-23' : '2026-09-21')
  const paymentDate = historical?.date ?? (sourceQuote ? '2026-09-23' : '2026-09-22')
  const full = index === 3
  const partial = index === 0 || index === 5 || sourceQuote
  const lines: SalesOrderLine[] = [
    { id: 1, productId: 104, productReference: 'PRD-104', productName: 'Premium Cable', description: 'Câble réseau premium', quantity: 10, deliveredQuantity: full ? 10 : partial ? 6 : 0, unitPrice: 1200, discountRate: 5, taxRate: 20, unitCost: 800, totalExcludingTax: 0 },
    { id: 2, productId: 205, productReference: 'PRD-205', productName: 'Station de travail', description: 'Station de travail professionnelle', quantity: sourceQuote ? 35 : 2, deliveredQuantity: full ? 2 : sourceQuote ? 20 : 0, unitPrice: 8500, discountRate: 0, taxRate: 20, unitCost: 7000, totalExcludingTax: 0 },
    { id: 3, productId: 301, productReference: 'SRV-301', productName: 'Installation et assistance', description: index === 0 ? 'Installation et assistance — taux nul de démonstration' : 'Installation, configuration et accompagnement', quantity: 1, deliveredQuantity: full ? 1 : 0, unitPrice: sourceQuote ? 27018.18 : index === 0 ? (historical?.amount ?? 42500) - 34080 : 1500, discountRate: 0, taxRate: index === 0 ? 0 : 10, unitCost: sourceQuote ? 12000 : index === 0 ? 3332.16 : index === 5 ? null : 800, totalExcludingTax: 0 },
  ].map((line) => ({ ...line, totalExcludingTax: calculateLineAmounts(line).net }))
  const totals = calculateTotals(lines)
  const billed = full ? totals.total : partial ? Math.round(totals.total * 60) / 100 : 0
  const paid = full ? billed : index === 0 ? 12400 : partial ? 3000 : 0
  const deliveries = full || partial ? [{ id: id * 10, reference: `DEL-2026-${id}`, date: deliveryDate, status: 'delivered' as const,
    warehouse: 'Casablanca Principal', lines: lines.filter((line) => line.deliveredQuantity > 0).map((line) => ({ lineId: line.id, quantity: line.deliveredQuantity })) }] : []
  const invoices = billed ? [{ id: id * 10, reference: `INV-2026-${id}`, date: deliveryDate, dueDate: '2026-10-30', amount: billed, status: 'posted' as const }] : []
  const payments = paid ? [{ id: id * 10, reference: `PAY-2026-${id}`, date: paymentDate, invoiceId: invoices[0].id, method: 'Virement bancaire', amount: paid, status: 'confirmed' as const }] : []
  const order: SalesOrderDetail = {
    id, reference: `SO-2026-${id}`, customerId: customer.id, customerName: customer.name, salesperson: customer.salesperson,
    createdAt: createdDate, confirmedAt: ['draft', 'cancelled'].includes(status) ? null : confirmedDate,
    quoteId: sourceQuote ? 268 : null, quoteReference: sourceQuote ? 'QT-2026-0268' : null,
    customerReference: `BC-CLIENT-${id}`, currency: 'MAD', paymentTerms: customer.paymentTerms || '30 jours',
    customer: { reference: customer.reference, contactName: customer.primaryContact?.name ?? customer.name, phone: customer.primaryContact?.phone ?? customer.phone,
      email: customer.email, billingAddress: `${customer.address}, ${customer.city}, ${customer.country}`, deliveryAddress: `${customer.address}, ${customer.city}, ${customer.country}` },
    orderStatus: status, deliveryStatus: full ? 'delivered' : partial ? 'partial' : 'none', invoiceStatus: full ? 'invoiced' : partial ? 'partial' : 'none', paymentStatus: full ? 'paid' : paid ? 'partial' : 'unpaid',
    totalAmount: totals.total, lines, totals, deliveries, invoices, payments, permissions: [...permissions],
    capabilities: { canConfirm: status === 'draft', canCancel: ['draft', 'confirmed'].includes(status), canDeliver: ['confirmed', 'processing'].includes(status),
      canInvoice: ['confirmed', 'processing'].includes(status), invoiceableAmount: status === 'confirmed' ? totals.total : partial ? Math.round((totals.total - billed) * 100) / 100 : 0 },
    warehouses: ['Casablanca Principal', 'Dépôt Marrakech'], asOf: salesDemoDate,
    documents: [{ id: 1, name: `Bon de commande ${id}`, type: 'Commande client' }, { id: 2, name: 'Conditions commerciales', type: 'Document commercial' }],
    activities: [{ id: `${id}-created`, type: 'created', description: 'Commande créée — historique de démonstration.', date: `${createdDate}T09:42:00+01:00`, user: customer.salesperson }],
  }
  if (order.confirmedAt) order.activities.push({ id: `${id}-confirmed`, type: 'confirmed', description: 'Commande confirmée — exemple historique.', date: `${confirmedDate}T10:00:00+01:00`, user: customer.salesperson })
  if (deliveries.length) order.activities.push({ id: `${id}-delivery`, type: 'delivery', description: full ? 'Livraison complète enregistrée — exemple.' : 'Livraison partielle enregistrée — exemple.', date: `${deliveryDate}T11:00:00+01:00`, user: 'Équipe logistique', documentReference: deliveries[0].reference })
  if (invoices.length) order.activities.push({ id: `${id}-invoice`, type: 'invoice', description: 'Facture émise — exemple historique.', date: `${deliveryDate}T14:00:00+01:00`, user: 'Équipe comptable', documentReference: invoices[0].reference })
  if (payments.length) order.activities.push({ id: `${id}-payment`, type: 'payment', description: 'Paiement reçu — exemple historique.', date: `${paymentDate}T15:00:00+01:00`, user: 'Équipe comptable', documentReference: payments[0].reference })
  if (status === 'cancelled') order.activities.push({ id: `${id}-cancelled`, type: 'cancelled', description: 'Commande annulée — exemple historique.', date: '2026-09-20T10:00:00+01:00', user: customer.salesperson })
  return order
})

const sessions = new Map<string, SalesOrderDetail[]>()
function session(scope: string) {
  if (!sessions.has(scope)) sessions.set(scope, structuredClone(salesMock))
  return sessions.get(scope)!
}
export async function getSalesOrdersMock(scope: string) {
  const orders = session(scope).map(({ id, reference, customerId, customerName, salesperson, createdAt, totalAmount, orderStatus }) => ({ id, reference, customerId, customerName, salesperson, createdAt, totalAmount, orderStatus }))
  return { orders, permissions: [...permissions], asOf: salesDemoDate }
}
export async function getSalesOrderMock(scope: string, id: number) {
  return structuredClone(session(scope).find((order) => order.id === id) ?? null)
}
export async function confirmSalesOrderMock(scope: string, id: number) {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const order = session(scope).find((item) => item.id === id)
  if (!order || order.orderStatus !== 'draft' || !order.capabilities.canConfirm) throw new Error('Commande non confirmable')
  order.orderStatus = 'confirmed'; order.confirmedAt = salesDemoDate
  order.capabilities = { ...order.capabilities, canConfirm: false, canDeliver: true, canInvoice: true, invoiceableAmount: order.totalAmount }
  order.activities.push({ id: `${id}-confirmation-demo`, type: 'confirmed', description: 'Confirmation simulée localement. Aucune validation réelle par Django.', date: `${salesDemoDate}T12:00:00+01:00`, user: order.salesperson })
  return { simulated: true, order: structuredClone(order) }
}
export async function getSalesInsightMock(scope: string, id: number): Promise<SalesAIInsight> {
  await new Promise((resolve) => setTimeout(resolve, 650))
  const order = session(scope).find((item) => item.id === id)
  if (!order || !order.permissions.includes('ai.use')) throw new Error('Analyse indisponible')
  const remaining = order.lines.reduce((sum, line) => sum + remainingQuantity(line), 0)
  const financials = salesFinancials(order)
  return {
    facts: [`${remaining} unités restent à livrer.`, `${formatMoney(financials.balance)} restent dus sur les factures émises.`],
    analysis: remaining ? 'La livraison reste à compléter. Cet exemple invite à vérifier la disponibilité et le planning avant de poursuivre.' : 'Les quantités commandées sont livrées. Cet exemple invite à vérifier la clôture administrative.',
    risks: remaining ? ['Risque potentiel de retard si les quantités restantes ne sont pas planifiées. Aucun retard n’est établi sans date de livraison promise.'] : ['Aucun risque logistique déduit des quantités disponibles.'],
    recommendations: remaining ? ['Vérifier les stocks et les disponibilités avant de préparer une livraison.', 'Contrôler les conditions de facturation applicables.'] : ['Rapprocher les factures et paiements avant de clôturer le dossier.'],
  }
}
