import type { MoneyLine, MoneyTotals } from '../../../lib/money'

export type SalesOrderStatus = 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled'
export type SalesPermission = 'sales.view' | 'sales.edit' | 'sales.margin.view' | 'delivery.create' | 'invoices.create' | 'ai.use'
export interface SalesOrderLine extends MoneyLine {
  id: number; productId: number; productReference: string; productName: string; description: string
  deliveredQuantity: number; unitCost: number | null; totalExcludingTax: number
}
export interface SalesDelivery {
  id: number; reference: string; date: string; status: 'planned' | 'delivered' | 'cancelled'
  warehouse: string; lines: { lineId: number; quantity: number }[]
}
export interface SalesInvoice {
  id: number; reference: string; date: string; dueDate: string; amount: number
  status: 'draft' | 'posted' | 'cancelled'
}
export interface SalesPayment {
  id: number; reference: string; date: string; invoiceId: number; method: string; amount: number
  status: 'pending' | 'confirmed' | 'cancelled'
  referenceExternal?: string; note?: string
}
export interface SalesActivity {
  id: string; type: 'created' | 'confirmed' | 'delivery' | 'invoice' | 'payment' | 'note' | 'cancelled'
  description: string; date: string; user: string; documentReference?: string
}
export interface SalesOrderSummary {
  id: number; reference: string; customerId: number; customerName: string
  salesperson: string; createdAt: string; totalAmount: number; orderStatus: SalesOrderStatus
}
export interface SalesOrderDetail extends SalesOrderSummary {
  confirmedAt: string | null; quoteId: number | null; quoteReference: string | null
  customerReference: string; currency: 'MAD'; paymentTerms: string
  customer: { reference: string; contactName: string; phone: string; email: string; billingAddress: string; deliveryAddress: string }
  lines: SalesOrderLine[]; totals: MoneyTotals
  deliveryStatus: 'none' | 'partial' | 'delivered'
  invoiceStatus: 'none' | 'partial' | 'invoiced'
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  deliveries: SalesDelivery[]; invoices: SalesInvoice[]; payments: SalesPayment[]; activities: SalesActivity[]
  documents: { id: number; name: string; type: string }[]
  permissions: SalesPermission[]
  capabilities: { canConfirm: boolean; canCancel: boolean; canDeliver: boolean; canInvoice: boolean; invoiceableAmount: number }
  warehouses: string[]; asOf: string
}
export interface SalesOrdersData { orders: SalesOrderSummary[]; permissions: SalesPermission[]; asOf: string }
export interface SalesDeliveryInput { warehouse: string; lines: { lineId: number; quantity: number }[] }
export interface SalesInvoiceInput { amount: number }
export interface SalesActionResult { simulated: boolean; order?: SalesOrderDetail; reference?: string }
export interface SalesAIInsight { facts: string[]; analysis: string; risks: string[]; recommendations: string[] }
export const orderStatusLabels: Record<string, string> = { draft: 'Brouillon', confirmed: 'Confirmée', processing: 'En préparation', completed: 'Terminée', cancelled: 'Annulée' }
export const deliveryStatusLabels = { none: 'Non livrée', partial: 'Partiellement livrée', delivered: 'Totalement livrée' }
export const invoiceStatusLabels = { none: 'Non facturée', partial: 'Partiellement facturée', invoiced: 'Facturée' }
export const paymentStatusLabels = { unpaid: 'Non payé', partial: 'Partiellement payé', paid: 'Payé' }
