import { customersMock, getCustomerDetailMock } from '../../customers/data/customers.mock'
import { quoteSchema, toQuoteInput } from '../schemas/quote.schema'
import { calculateQuoteTotals } from '../utils/quoteCalculations'
import type { Quote, QuoteDetail, QuoteInput, QuoteProduct, QuotesData, QuoteStatus } from '../types/quotes.types'

// Instantané déterministe : 68 devis en septembre et 12 en août 2026.
export const quotesDemoDate = '2026-09-23'
const customers = [124, 85, 117, 94, 72, 184, 156, 63].map((id) => customersMock.customers.find((customer) => customer.id === id)!)
const salespeople = ['Sara El Mansouri', 'Youssef Karim', 'Amine Berrada']
// Catalogue de démonstration uniquement. Les taux sont propres à chaque exemple.
export const quoteProductsMock: QuoteProduct[] = [
  { id: 104, reference: 'PRD-104', name: 'Premium Cable', kind: 'product', description: 'Câble réseau premium — fourniture et conditionnement', unitPrice: 1200, taxRate: 20 },
  { id: 205, reference: 'PRD-205', name: 'Station de travail', kind: 'product', description: 'Station de travail professionnelle', unitPrice: 8500, taxRate: 20 },
  { id: 301, reference: 'SRV-301', name: 'Installation sur site', kind: 'service', description: 'Installation et mise en service', unitPrice: 1500, taxRate: 10 },
  { id: 302, reference: 'SRV-302', name: 'Formation équipe', kind: 'service', description: 'Session de formation — exemple de taux nul', unitPrice: 900, taxRate: 0 },
]
const states: QuoteStatus[] = ['accepted', 'viewed', 'sent', 'draft', 'expired', 'rejected', 'sent', 'draft']
const day = (value: number) => String(value).padStart(2, '0')
export const quotesMock: QuotesData = {
  asOf: quotesDemoDate,
  currentSalesperson: salespeople[0],
  permissions: ['quotes.view', 'quotes.create', 'quotes.edit', 'quotes.send', 'quotes.export', 'quotes.accept', 'quotes.convert'],
  products: quoteProductsMock,
  quotes: Array.from({ length: 80 }, (_, index): Quote => {
    const customer = customers[index % customers.length]
    const status = states[index % states.length]
    const month = index < 68 ? '09' : '08'
    const createdDay = 23 - Math.floor((index % 68) / 3)
    return {
      id: 268 - index,
      reference: `QT-2026-${String(268 - index).padStart(4, '0')}`,
      customerId: customer.id, customerName: customer.name, customerEmail: customer.email,
      salesperson: salespeople[index % 3],
      createdAt: `2026-${month}-${day(createdDay)}`,
      expiresAt: month === '08' ? '2026-09-05'
        : status === 'expired' ? '2026-09-22'
        : `2026-${index % 3 === 0 ? '10-03' : `09-${day(24 + index % 7)}`}`,
      totalAmount: [400400, 72400, 38900, 24800, 30000, 18200, 86500, 12700][index % 8] + Math.floor(index / 8) * 120,
      status: month === '08' && ['sent', 'viewed', 'draft'].includes(status) ? 'expired' : status,
    }
  }),
}

function makeDetail(quote: Quote): QuoteDetail {
  const customer = getCustomerDetailMock(quote.customerId)
  return {
    ...quote, issueDate: quote.createdAt, currency: 'MAD',
    billingAddress: [customer?.address, customer?.city, customer?.country].filter(Boolean).join(', '),
    paymentTerms: customer?.paymentTerms ?? '', customerReference: '', subject: 'Proposition commerciale',
    deliveryTerms: 'À convenir à la confirmation', commercialTerms: 'Offre valable jusqu’à la date d’expiration indiquée.',
    internalNotes: '', customerNotes: 'Nous vous remercions de votre confiance.',
    // Reprise du montant historique sans changer le total de la liste. Taux nul explicite.
    lines: [{ id: `line-${quote.id}-1`, productId: null, description: 'Fournitures et prestations — lot de démonstration (TVA 0 %)', quantity: 1, unitPrice: quote.totalAmount, discountRate: 0, taxRate: 0 }],
    permissions: [...quotesMock.permissions], products: quoteProductsMock, asOf: quotesDemoDate,
    activities: [{ id: `created-${quote.id}`, date: `${quote.createdAt}T09:00:00+01:00`, user: quote.salesperson, description: 'Devis créé — historique de démonstration.' }],
    canAccept: ['sent', 'viewed'].includes(quote.status), conversionTargets: ['sales_order'], convertedTo: null,
  }
}
// Une seule collection de détails par utilisateur/société ; la liste en est une projection.
const sessions = new Map<string, QuoteDetail[]>()
function session(scope: string) {
  if (!sessions.has(scope)) sessions.set(scope, quotesMock.quotes.map(makeDetail))
  return sessions.get(scope)!
}
function summary(quote: QuoteDetail): Quote {
  return { id: quote.id, reference: quote.reference, customerId: quote.customerId, customerName: quote.customerName,
    customerEmail: quote.customerEmail, salesperson: quote.salesperson, createdAt: quote.createdAt,
    expiresAt: quote.expiresAt, status: quote.status, totalAmount: quote.totalAmount }
}
function activity(quote: QuoteDetail, description: string) {
  quote.activities.unshift({ id: crypto.randomUUID(), date: `${quotesDemoDate}T${new Date().toISOString().slice(11)}`, user: quote.salesperson, description })
}
export async function getQuotesMock(scope: string) {
  return structuredClone({ ...quotesMock, quotes: session(scope).map(summary) })
}
export async function getQuoteByIdMock(scope: string, id: number) {
  return structuredClone(session(scope).find((quote) => quote.id === id) ?? null)
}
export async function saveQuoteMock(scope: string, input: QuoteInput, id?: number) {
  await new Promise((resolve) => setTimeout(resolve, 450))
  const values = quoteSchema.parse(input)
  const customer = customersMock.customers.find((item) => item.id === values.customerId)
  if (!customer) throw new Error('Client introuvable')
  const quotes = session(scope)
  const original = id === undefined ? null : quotes.find((quote) => quote.id === id)
  if (id !== undefined && (!original || original.status !== 'draft')) throw new Error('Devis non modifiable')
  const newId = original?.id ?? Math.max(0, ...quotes.map((quote) => quote.id)) + 1
  const base: Quote = {
    id: newId, reference: original?.reference ?? `QT-2026-${String(newId).padStart(4, '0')}`,
    createdAt: original?.createdAt ?? quotesDemoDate, expiresAt: values.expiresAt, status: 'draft',
    customerId: customer.id, customerName: customer.name, customerEmail: customer.email,
    salesperson: values.salesperson, totalAmount: calculateQuoteTotals(values.lines).total,
  }
  const saved: QuoteDetail = { ...(original ?? makeDetail(base)), ...base, ...values, canAccept: false }
  if (!original) saved.activities = []
  activity(saved, original ? 'Devis modifié dans la démonstration.' : 'Devis créé dans la démonstration.')
  if (original) quotes[quotes.indexOf(original)] = saved
  else quotes.unshift(saved)
  return structuredClone(saved)
}
export async function sendQuoteMock(scope: string, id: number) {
  await new Promise((resolve) => setTimeout(resolve, 650))
  const quote = session(scope).find((item) => item.id === id)
  if (!quote || !['draft', 'sent', 'viewed'].includes(quote.status) || quote.expiresAt < quotesDemoDate)
    throw new Error('Devis non envoyable')
  // Une relance conserve le statut Vu ; seul un brouillon passe à Envoyé.
  if (quote.status === 'draft') quote.status = 'sent'
  quote.canAccept = true
  activity(quote, 'Envoi simulé. Aucun e-mail envoyé.')
  return summary(quote)
}
export async function duplicateQuoteMock(scope: string, id: number) {
  await new Promise((resolve) => setTimeout(resolve, 250))
  const data = session(scope)
  const original = data.find((quote) => quote.id === id)
  if (!original) throw new Error('Devis introuvable')
  const newId = Math.max(...data.map((quote) => quote.id), 0) + 1
  const copy: QuoteDetail = {
    ...structuredClone(original), ...toQuoteInput(original), id: newId, reference: `QT-2026-${String(newId).padStart(4, '0')}`,
    status: 'draft', createdAt: quotesDemoDate, expiresAt: '2026-10-23',
    issueDate: quotesDemoDate, activities: [], canAccept: false, convertedTo: null,
    lines: original.lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
  }
  activity(copy, `Copie de ${original.reference} créée dans la démonstration.`)
  data.unshift(copy)
  return summary(copy)
}
