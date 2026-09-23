export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
export type QuotePermission = 'quotes.view' | 'quotes.create' | 'quotes.edit' | 'quotes.send' | 'quotes.export' | 'quotes.accept' | 'quotes.convert'
export interface Quote {
  id: number
  reference: string
  customerId: number
  customerName: string
  customerEmail: string
  salesperson: string
  createdAt: string
  expiresAt: string
  totalAmount: number
  status: QuoteStatus
}
export interface QuotesData {
  quotes: Quote[]
  permissions: QuotePermission[]
  currentSalesperson: string
  asOf: string
  products?: QuoteProduct[]
}
export interface QuoteFilters {
  search: string
  status: QuoteStatus | 'all'
  customer: string
  salesperson: string
  period: 'month' | 'previous_month' | 'all'
  expiring: boolean
  followUp: boolean
}
export type QuoteGroup = 'none' | 'status' | 'customerName' | 'salesperson' | 'month'
export type QuoteView = 'list' | 'kanban'
export type QuoteSortKey = 'reference' | 'customerName' | 'createdAt' | 'expiresAt' | 'salesperson' | 'totalAmount' | 'status'
export interface QuoteSort { key: QuoteSortKey; direction: 'asc' | 'desc' }
export interface QuoteLine {
  id: string
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  discountRate: number
  taxRate: number
}
export interface QuoteProduct {
  id: number
  reference: string
  name: string
  kind: 'product' | 'service'
  description: string
  unitPrice: number
  taxRate: number
}
export interface QuoteInput {
  customerId: number
  billingAddress: string
  salesperson: string
  issueDate: string
  expiresAt: string
  currency: 'MAD'
  paymentTerms: string
  customerReference: string
  subject: string
  deliveryTerms: string
  commercialTerms: string
  internalNotes: string
  customerNotes: string
  lines: QuoteLine[]
}
export interface QuoteActivity {
  id: string
  date: string
  user: string
  description: string
}
export type QuoteConversionTarget = 'sales_order' | 'invoice'
export interface QuoteConversion {
  id: number
  reference: string
  target: QuoteConversionTarget
}
export interface QuoteDetail extends Quote, QuoteInput {
  permissions: QuotePermission[]
  activities: QuoteActivity[]
  asOf: string
  products: QuoteProduct[]
  canAccept: boolean
  conversionTargets: QuoteConversionTarget[]
  convertedTo: QuoteConversion | null
}
export interface QuoteEditorData {
  quote: QuoteDetail | null
  permissions: QuotePermission[]
  asOf: string
  products: QuoteProduct[]
  salesperson: string
}
export type QuoteAction = 'open' | 'send' | 'duplicate' | 'pdf'
export interface QuoteActionsProps {
  permissions: QuotePermission[]
  busy: boolean
  onAction: (action: QuoteAction, quote: Quote) => void
}
export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: 'Brouillon', sent: 'Envoyé', viewed: 'Vu', accepted: 'Accepté', rejected: 'Refusé', expired: 'Expiré',
}
export const quoteStatuses = Object.keys(quoteStatusLabels) as QuoteStatus[]
export const defaultQuoteFilters: QuoteFilters = {
  search: '', status: 'all', customer: 'all', salesperson: 'all', period: 'month', expiring: false, followUp: false,
}
