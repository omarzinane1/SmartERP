export type PaymentDirection = 'incoming' | 'outgoing'
export type PaymentStatus = 'pending' | 'completed' | 'cancelled' | 'failed'
export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'cheque' | 'other'
export type PaymentPermission = 'payments.view' | 'payments.create' | 'payments.cancel' | 'payments.export'
export interface Payment {
  id: number; reference: string; direction: PaymentDirection
  partnerType: 'customer' | 'supplier'; partnerId: number; partnerName: string
  invoiceId: number | null; invoiceReference: string | null; invoiceIssuedDate: string | null
  date: string; amount: number; method: PaymentMethod; status: PaymentStatus
  referenceExternal: string; note: string; canCancel: boolean
}
export interface PaymentInvoiceOption {
  id: number; reference: string; direction: PaymentDirection
  partnerId: number; partnerName: string; remainingAmount: number; issuedDate: string | null
}
export interface PaymentInput {
  direction: PaymentDirection; partnerId: number; invoiceId: number
  date: string; amount: number; method: PaymentMethod; referenceExternal: string; note: string
}
export interface PaymentFilters {
  search: string; direction: string; partnerType: string; partnerId: string; invoice: string
  method: string; status: string; period: string; dateFrom: string; dateTo: string
  minAmount: string; maxAmount: string
}
export interface PaymentQuery extends PaymentFilters { page: number; pageSize: number; sort: string }
export interface PaymentSummary { received: number; sent: number; pending: number; averageCollectionDays: number | null; datedReceipts: number }
export interface PaymentsData {
  payments: Payment[]; count: number; totalCount: number; permissions: PaymentPermission[]; asOf: string
  openInvoices: PaymentInvoiceOption[]
  partners: { id: number; name: string; type: 'customer' | 'supplier' }[]
}
export type PaymentGroup = '' | 'direction' | 'method' | 'status' | 'customer' | 'supplier' | 'month'
export const paymentMethodLabels = { bank_transfer: 'Virement bancaire', cash: 'Espèces', card: 'Carte', cheque: 'Chèque', other: 'Autre' }
export const paymentStatusLabels = { pending: 'En attente', completed: 'Confirmé', cancelled: 'Annulé', failed: 'Échoué' }
export const paymentDirectionLabels = { incoming: 'Encaissement', outgoing: 'Décaissement' }
