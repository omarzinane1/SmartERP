import type { MoneyLine, MoneyTotals } from '../../../lib/money'
import type { SalesDelivery, SalesPayment } from '../../sales/types/sales.types'

export type InvoiceWorkflowStatus = 'draft' | 'posted' | 'cancelled'
export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid'
export type InvoicePermission = 'reports.export' | 'documents.view' | 'documents.upload' | 'invoices.view' | 'invoices.create' | 'invoices.edit' | 'invoices.post' | 'invoices.send' | 'finance.view' | 'payments.create' | 'ai.use' | 'invoices.remind' | 'invoices.credit_note'
export interface InvoiceLine extends MoneyLine { id: string; productId: number | null; productName: string; description: string }
export interface InvoiceInput {
  customerId: number; billingAddress: string; invoiceDate: string; dueDate: string; salesperson: string
  currency: 'MAD'; paymentTerms: string; customerReference: string; notes: string; lines: InvoiceLine[]
}
export interface InvoiceSummary {
  id: number; reference: string; customerId: number; customerName: string; salesperson: string
  invoiceDate: string; issuedAt: string | null; dueDate: string; totalAmount: number; paidAmount: number
  creditTotal?: number; balanceDue?: number
  workflowStatus: InvoiceWorkflowStatus; paymentStatus: InvoicePaymentStatus
  salesOrderId: number | null; salesOrderReference: string | null
  capabilities: { canEdit: boolean; canPost: boolean; canSend: boolean; canPay: boolean; canRemind: boolean; canCredit?: boolean }
}
export interface InvoiceDetail extends InvoiceSummary, InvoiceInput {
  customerEmail: string; totals: MoneyTotals; payments: Omit<SalesPayment, 'invoiceId'>[]; deliveries: SalesDelivery[]
  creditNotes: { id: number; reference: string; amount: number }[]; documents: { id: number; name: string }[]
  activities: { id: string; type: 'created' | 'edited' | 'posted' | 'sent' | 'payment' | 'reminder' | 'cancelled'; date: string; user: string; description: string; reference?: string }[]
  permissions: InvoicePermission[]; asOf: string
}
export interface InvoicesData { invoices: InvoiceSummary[]; permissions: InvoicePermission[]; asOf: string; currentSalesperson: string }
export interface InvoicePaymentInput { date: string; amount: number; method: string; reference: string; note: string }
export interface InvoiceAIInsight { facts: string[]; analysis: string; risk: string; forecast: string; recommendations: string[] }
export type InvoiceAction = 'post' | 'send' | 'payment' | 'remind'
export type AgingKey = 'current' | '1-30' | '31-60' | '61-90' | '90+'
export interface AgingBucket { key: AgingKey; label: string; count: number; amount: number }
export type InvoicePresentation = 'draft' | 'unpaid' | 'partially_paid' | 'overdue' | 'paid' | 'cancelled'
export interface InvoiceFilters {
  search: string; quick: string; customerId: string; salesperson: string; workflow: string; payment: string
  dateFrom: string; dateTo: string; dueFrom: string; dueTo: string; minAmount: string; maxAmount: string; aging: string
}
export type InvoiceGroup = '' | 'status' | 'customer' | 'salesperson' | 'month' | 'due' | 'aging'
export const workflowLabels = { draft: 'Brouillon', posted: 'Validée', cancelled: 'Annulée' }
export const paymentLabels = { unpaid: 'Impayée', partially_paid: 'Partiellement payée', paid: 'Payée' }
export const presentationLabels = { draft: 'Brouillon', unpaid: 'Impayée', partially_paid: 'Partiellement payée', overdue: 'En retard', paid: 'Payée', cancelled: 'Annulée' }
