import type { Activity, BusinessDocument, PurchasingPermission } from '../../purchases/types/purchases.types'
import type { MoneyLine } from '../../../lib/money'
import type { Payment } from '../../payments/types/payments.types'
export type SupplierInvoiceWorkflowStatus = 'draft' | 'posted' | 'cancelled'
export type SupplierInvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid'
export interface SupplierInvoiceLine extends MoneyLine {
  id: string; productName: string; description: string; purchaseLineId: string | null
  orderedQuantity: number | null; receivedQuantity: number | null
}
export interface SupplierInvoiceInput {
  supplierId: number; supplierReference: string; invoiceDate: string; dueDate: string
  currency: 'MAD'; paymentTerms: string; notes: string; lines: SupplierInvoiceLine[]
}
export interface SupplierInvoice extends SupplierInvoiceInput {
  id: number; reference: string; supplierName: string; buyer: string
  orderId: number | null; orderReference: string | null
  receipts: { id: number; reference: string }[]
  total: number; paidAmount: number; workflowStatus: SupplierInvoiceWorkflowStatus
  paymentStatus: SupplierInvoicePaymentStatus; payments: Payment[]
  documents: BusinessDocument[]; activities: Activity[]
  capabilities: { canEdit: boolean; canPost: boolean; canPay: boolean }
}
export interface SupplierInvoicesData {
  invoices: SupplierInvoice[]; permissions: PurchasingPermission[]; asOf: string
  suppliers: { id: number; name: string }[]; canExport: boolean
}
export interface SupplierInvoiceDetail extends SupplierInvoice { permissions: PurchasingPermission[]; asOf: string }
export interface SupplierInvoiceFilters {
  search: string; supplier: string; buyer: string; order: string; status: string
  payment: string; dateFrom: string; dateTo: string; aging: string; quick: string
}
export interface PayableBucket { key: string; label: string; amount: number; count: number }
export const supplierInvoiceStatusLabels = { draft: 'Brouillon', posted: 'Comptabilisée', cancelled: 'Annulée' }
export const supplierInvoicePaymentLabels = { unpaid: 'Impayée', partially_paid: 'Partiellement payée', paid: 'Payée' }
