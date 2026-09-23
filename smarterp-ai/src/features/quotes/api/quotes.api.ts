import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { duplicateQuoteMock, getQuoteByIdMock, getQuotesMock, saveQuoteMock, sendQuoteMock } from '../data/quotes.mock'
import type { Quote, QuoteActivity, QuoteConversion, QuoteConversionTarget, QuoteDetail, QuoteEditorData, QuoteInput, QuotePermission, QuoteProduct, QuotesData, QuoteStatus } from '../types/quotes.types'

export const QUOTES_ENDPOINT = '/quotes/'
export interface QuotesParams {
  search?: string
  status?: QuoteStatus
  customer?: number
  salesperson?: string
  created_after?: string
  created_before?: string
  page?: number
  page_size?: number
}
// Le contrat Django reste isolé ici. Les composants utilisent exclusivement Quote.
interface QuoteDTO {
  id: number; reference: string; customer_id: number; customer_name: string; customer_email: string
  salesperson: string; created_at: string; expires_at: string; total_amount: number | string; status: QuoteStatus
}
interface QuotesResponse {
  results: QuoteDTO[]
  next?: string | null
  permissions: QuotePermission[]
  current_salesperson: string
  as_of: string
  products?: QuoteProduct[]
}
function fromDTO(quote: QuoteDTO): Quote {
  return {
    id: quote.id, reference: quote.reference, customerId: quote.customer_id,
    customerName: quote.customer_name, customerEmail: quote.customer_email, salesperson: quote.salesperson,
    createdAt: quote.created_at.slice(0, 10), expiresAt: quote.expires_at.slice(0, 10),
    totalAmount: Number(quote.total_amount), status: quote.status,
  }
}
export async function getQuotes(scope: string, params: QuotesParams = {}, signal?: AbortSignal): Promise<QuotesData> {
  if (env.quotesUseMock) return getQuotesMock(scope)
  const { data } = await apiClient.get<QuotesResponse>(QUOTES_ENDPOINT, { params, signal })
  const quotes = data.results.map(fromDTO)
  // La première version filtre et calcule les KPI sur la collection complète.
  // Lire toutes les pages DRF évite des indicateurs calculés sur une seule page.
  const endpoint = new URL(`${env.apiBaseUrl}${QUOTES_ENDPOINT}`, window.location.origin)
  const visited = new Set<string>()
  let next = data.next
  while (next) {
    const url = new URL(next, endpoint)
    if (url.origin !== endpoint.origin || url.pathname !== endpoint.pathname || visited.has(url.href))
      throw new Error('Pagination de devis invalide')
    visited.add(url.href)
    const response = await apiClient.get<QuotesResponse>(`${QUOTES_ENDPOINT}${url.search}`, { signal })
    quotes.push(...response.data.results.map(fromDTO))
    next = response.data.next
  }
  return { quotes, permissions: data.permissions, currentSalesperson: data.current_salesperson, asOf: data.as_of.slice(0, 10), products: data.products ?? [] }
}
export async function sendQuote(scope: string, id: number): Promise<Quote> {
  if (env.quotesUseMock) return sendQuoteMock(scope, id)
  const { data } = await apiClient.post<QuoteDTO>(`${QUOTES_ENDPOINT}${id}/send/`)
  return fromDTO(data)
}
export async function duplicateQuote(scope: string, id: number): Promise<Quote> {
  if (env.quotesUseMock) return duplicateQuoteMock(scope, id)
  const { data } = await apiClient.post<QuoteDTO>(`${QUOTES_ENDPOINT}${id}/duplicate/`)
  return fromDTO(data)
}
interface QuoteDetailDTO extends QuoteDTO {
  issue_date: string; billing_address: string; currency: 'MAD'; payment_terms: string
  customer_reference: string; subject: string; delivery_terms: string; commercial_terms: string
  internal_notes: string; customer_notes: string
  lines: { id: string | number; product_id: number | null; description: string; quantity: number | string; unit_price: number | string; discount_rate: number | string; tax_rate: number | string }[]
  permissions: QuotePermission[]; activities: QuoteActivity[]; as_of: string
  products?: QuoteProduct[]; can_accept?: boolean; conversion_targets?: QuoteConversionTarget[]; converted_to?: QuoteConversion | null
}
function detailFromDTO(data: QuoteDetailDTO): QuoteDetail {
  return {
    ...fromDTO(data), issueDate: data.issue_date.slice(0, 10), billingAddress: data.billing_address,
    currency: data.currency, paymentTerms: data.payment_terms, customerReference: data.customer_reference,
    subject: data.subject, deliveryTerms: data.delivery_terms, commercialTerms: data.commercial_terms,
    internalNotes: data.internal_notes, customerNotes: data.customer_notes,
    lines: data.lines.map((line) => ({ id: String(line.id), productId: line.product_id, description: line.description,
      quantity: Number(line.quantity), unitPrice: Number(line.unit_price), discountRate: Number(line.discount_rate), taxRate: Number(line.tax_rate) })),
    permissions: data.permissions, activities: data.activities, asOf: data.as_of.slice(0, 10), products: data.products ?? [],
    canAccept: data.can_accept ?? false, conversionTargets: data.conversion_targets ?? [], convertedTo: data.converted_to ?? null,
  }
}
function inputToDTO(input: QuoteInput) {
  return {
    customer_id: input.customerId, billing_address: input.billingAddress, salesperson: input.salesperson,
    issue_date: input.issueDate, expires_at: input.expiresAt, currency: input.currency,
    payment_terms: input.paymentTerms, customer_reference: input.customerReference, subject: input.subject,
    delivery_terms: input.deliveryTerms, commercial_terms: input.commercialTerms,
    internal_notes: input.internalNotes, customer_notes: input.customerNotes,
    // Les IDs de ligne sont des clés locales ; Django gère les identifiants persistés.
    lines: input.lines.map((line) => ({ product_id: line.productId, description: line.description,
      quantity: line.quantity, unit_price: line.unitPrice, discount_rate: line.discountRate, tax_rate: line.taxRate })),
  }
}
export class QuoteNotFoundError extends Error {}
export async function getQuoteById(scope: string, id: number, signal?: AbortSignal): Promise<QuoteDetail> {
  if (env.quotesUseMock) {
    const quote = await getQuoteByIdMock(scope, id)
    if (!quote) throw new QuoteNotFoundError('Devis introuvable')
    return quote
  }
  const { data } = await apiClient.get<QuoteDetailDTO>(`${QUOTES_ENDPOINT}${id}/`, { signal })
  return detailFromDTO(data)
}
export async function getQuoteEditorData(scope: string, id?: number, signal?: AbortSignal): Promise<QuoteEditorData> {
  if (id !== undefined) {
    const quote = await getQuoteById(scope, id, signal)
    return { quote, permissions: quote.permissions, asOf: quote.asOf, products: quote.products, salesperson: quote.salesperson }
  }
  // Réutilise le contrat de liste pour les permissions et paramètres initiaux.
  const data = await getQuotes(scope, {}, signal)
  return { quote: null, permissions: data.permissions, asOf: data.asOf, products: data.products ?? [], salesperson: data.currentSalesperson }
}
export async function createQuote(scope: string, input: QuoteInput): Promise<QuoteDetail> {
  if (env.quotesUseMock) return saveQuoteMock(scope, input)
  const { data } = await apiClient.post<QuoteDetailDTO>(QUOTES_ENDPOINT, inputToDTO(input))
  return detailFromDTO(data)
}
export async function updateQuote(scope: string, id: number, input: QuoteInput): Promise<QuoteDetail> {
  if (env.quotesUseMock) return saveQuoteMock(scope, input, id)
  const { data } = await apiClient.patch<QuoteDetailDTO>(`${QUOTES_ENDPOINT}${id}/`, inputToDTO(input))
  return detailFromDTO(data)
}
export async function acceptQuote(id: number): Promise<QuoteDetail> {
  if (env.quotesUseMock) throw new Error('Acceptation disponible avec Django')
  // Contrat proposé, à confirmer côté Django ; distinct de la conversion.
  const { data } = await apiClient.post<QuoteDetailDTO>(`${QUOTES_ENDPOINT}${id}/accept/`)
  return detailFromDTO(data)
}
export async function convertQuote(id: number, target: QuoteConversionTarget): Promise<QuoteConversion> {
  if (env.quotesUseMock) throw new Error('Conversion disponible avec Django')
  const { data } = await apiClient.post<QuoteConversion>(`${QUOTES_ENDPOINT}${id}/convert/`, { target })
  return data
}
// Aucun endpoint PDF n'est supposé disponible : le téléchargement reste désactivé.
