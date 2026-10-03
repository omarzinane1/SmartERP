import type { MoneyLine } from '../../../lib/money'
import type { Supplier } from '../../suppliers/types/suppliers.types'

// Only permissions specified by the existing product contract. Send/export/post
// use explicit server capabilities until dedicated permission names are agreed.
export type PurchasingPermission = 'suppliers.view' | 'suppliers.edit' | 'purchases.view' | 'purchases.create' | 'purchases.edit' | 'purchases.confirm' | 'receipts.create' | 'supplier_invoices.view' | 'supplier_invoices.create' | 'supplier_invoices.edit' | 'payments.view' | 'payments.create' | 'finance.view' | 'ai.use'
export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'cancelled'
export type ReceiptStatus = 'not_received' | 'partially_received' | 'received'
export type BillingStatus = 'not_billed' | 'partially_billed' | 'billed'
export interface PurchaseLine extends MoneyLine {
  id: string; productName: string; description: string; receivedQuantity: number
  previousPrice: number | null; averagePrice: number | null
}
export interface Activity { id: string; date: string; title: string; detail: string }
export interface BusinessDocument { id: string; name: string; mime: string; url: string | null; size?: number; uploadedAt?: string }
export interface Receipt {
  id: number; reference: string; date: string; warehouse: string
  lines: { lineId: string; quantity: number }[]
}
export interface PurchaseInput {
  supplierId: number; date: string; expectedDate: string; buyer: string
  warehouse: string; notes: string; lines: PurchaseLine[]
}
export interface PurchaseOrder extends PurchaseInput {
  id: number; reference: string; supplierName: string; total: number
  status: PurchaseOrderStatus; receiptStatus: ReceiptStatus; billingStatus: BillingStatus
  receipts: Receipt[]; invoiceIds: number[]; billedAmount: number; paidAmount: number
  documents: BusinessDocument[]; activities: Activity[]
  capabilities: { canEdit: boolean; canSend: boolean; canConfirm: boolean; canReceive: boolean; canBill: boolean; canCancel?: boolean }
}
export interface PurchaseOrdersData {
  orders: PurchaseOrder[]; permissions: PurchasingPermission[]; asOf: string
  warehouses?: { id: number; name: string }[]
  currentBuyer: string; suppliers: Pick<Supplier, 'id' | 'name'>[]; canExport: boolean
}
export interface PurchaseOrderDetail extends PurchaseOrder {
  permissions: PurchasingPermission[]; asOf: string
  invoices: { id: number; reference: string; total: number; paidAmount: number; workflowStatus: string }[]
  payments: { id: number; reference: string; date: string; amount: number; status: string }[]
}
export interface ReceiptInput { date: string; warehouse: string; lines: { lineId: string; quantity: number }[] }
export interface PurchaseFilters {
  search: string; supplier: string; buyer: string; status: string; receipt: string
  dateFrom: string; dateTo: string; expectedFrom: string; expectedTo: string; quick: string
}
export type PurchaseGroup = '' | 'supplierName' | 'buyer' | 'status' | 'receiptStatus' | 'month'
export const purchaseStatusLabels = { draft: 'Brouillon', sent: 'Envoyée', confirmed: 'Confirmée', cancelled: 'Annulée' }
export const receiptStatusLabels = { not_received: 'Non reçue', partially_received: 'Partiellement reçue', received: 'Reçue' }
export const billingStatusLabels = { not_billed: 'Non facturée', partially_billed: 'Partiellement facturée', billed: 'Facturée' }
