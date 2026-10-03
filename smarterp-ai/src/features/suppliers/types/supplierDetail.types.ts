import type { Supplier } from './suppliers.types'
import type { Activity, BusinessDocument, PurchaseOrder, PurchasingPermission } from '../../purchases/types/purchases.types'
import type { SupplierInvoice } from '../../supplier-invoices/types/supplierInvoices.types'
import type { Payment } from '../../payments/types/payments.types'
export interface SupplierDetail extends Supplier {
  permissions: PurchasingPermission[]; asOf: string; orders: PurchaseOrder[]
  invoices: SupplierInvoice[]; payments: Payment[]; documents: BusinessDocument[]
  contracts: { id: string; name: string; expiresAt: string; status: string }[]
  activities: Activity[]
}
export interface SupplierMetrics { purchaseVolume: number | null; outstandingBalance: number | null; averageLeadTimeDays: number | null; onTimeDelivery: number | null; priceChange: number | null; score: number | null }
export interface SupplierPriceHistory { product: string; points: { date: string; price: number }[]; source: string }
export interface PurchasingInsight { facts: string[]; analysis: string; risk: string; opportunity?: string; recommendations: string[]; source: string }
