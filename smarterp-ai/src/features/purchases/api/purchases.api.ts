import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { getCollection } from '../../../lib/collectionApi'
import { postIdempotent } from '../../../lib/idempotentApi'
import { supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { billPurchaseMock, purchaseDetailMock } from '../../supplier-invoices/data/supplierInvoices.mock'
import { mockDelay, purchaseActionMock, purchaseSnapshot, purchasingDemoDate, purchasingPermissions, savePurchaseMock } from '../data/purchases.mock'
import type { PurchaseInput, PurchaseOrderDetail, PurchaseOrdersData, ReceiptInput } from '../types/purchases.types'
import type { SupplierInvoiceDetail } from '../../supplier-invoices/types/supplierInvoices.types'

export const PURCHASE_ORDERS_ENDPOINT = '/purchase-orders/'
const inputDTO = (v: PurchaseInput) => ({ supplier_id: v.supplierId, date: v.date, expected_date: v.expectedDate, buyer: v.buyer, warehouse: v.warehouse, notes: v.notes, lines: v.lines.map((l) => ({ product_name: l.productName, description: l.description, quantity: l.quantity, unit_price: l.unitPrice, discount_rate: l.discountRate, tax_rate: l.taxRate })) })
export async function getPurchaseOrders(scope: string, signal?: AbortSignal): Promise<PurchaseOrdersData> {
  if (env.purchasesUseMock) { await mockDelay(); return { orders: purchaseSnapshot(scope).map((o) => purchaseDetailMock(scope, o.id)), permissions: purchasingPermissions, asOf: purchasingDemoDate, currentBuyer: 'Amine Berrada', suppliers: supplierSnapshot(scope).filter((s) => s.status === 'active').map(({ id, name }) => ({ id, name })), canExport: true } }
  return getCollection<PurchaseOrdersData, 'orders'>(PURCHASE_ORDERS_ENDPOINT, 'orders', signal)
}
export async function getPurchaseOrderById(scope: string, id: number, signal?: AbortSignal): Promise<PurchaseOrderDetail> {
  if (env.purchasesUseMock) { await mockDelay(); return purchaseDetailMock(scope, id) }
  return (await apiClient.get<PurchaseOrderDetail>(`${PURCHASE_ORDERS_ENDPOINT}${id}/`, { signal })).data
}
export async function createPurchaseOrder(scope: string, input: PurchaseInput): Promise<PurchaseOrderDetail> {
  if (env.purchasesUseMock) return purchaseDetailMock(scope, (await savePurchaseMock(scope, input)).id)
  return (await apiClient.post<PurchaseOrderDetail>(PURCHASE_ORDERS_ENDPOINT, inputDTO(input))).data
}
export async function updatePurchaseOrder(scope: string, id: number, input: PurchaseInput): Promise<PurchaseOrderDetail> {
  if (env.purchasesUseMock) return purchaseDetailMock(scope, (await savePurchaseMock(scope, input, id)).id)
  return (await apiClient.patch<PurchaseOrderDetail>(`${PURCHASE_ORDERS_ENDPOINT}${id}/`, inputDTO(input))).data
}
export async function sendPurchaseOrder(scope: string, id: number): Promise<PurchaseOrderDetail> {
  if (env.purchasesUseMock) { await purchaseActionMock(scope, id, 'send'); return purchaseDetailMock(scope, id) }
  return (await apiClient.post<PurchaseOrderDetail>(`${PURCHASE_ORDERS_ENDPOINT}${id}/send/`)).data
}
export async function confirmPurchaseOrder(scope: string, id: number): Promise<PurchaseOrderDetail> {
  if (env.purchasesUseMock) { await purchaseActionMock(scope, id, 'confirm'); return purchaseDetailMock(scope, id) }
  return (await apiClient.post<PurchaseOrderDetail>(`${PURCHASE_ORDERS_ENDPOINT}${id}/confirm/`)).data
}
export async function receivePurchaseOrder(scope: string, id: number, input: ReceiptInput): Promise<PurchaseOrderDetail> {
  if (env.purchasesUseMock) { await purchaseActionMock(scope, id, 'receive', input); return purchaseDetailMock(scope, id) }
  return postIdempotent<PurchaseOrderDetail>(scope, `${PURCHASE_ORDERS_ENDPOINT}${id}/receive/`, { date: input.date, warehouse: input.warehouse, lines: input.lines.filter((l) => l.quantity > 0).map((l) => ({ line_id: l.lineId, quantity: l.quantity })) })
}
export async function cancelPurchaseOrder(scope: string, id: number): Promise<PurchaseOrderDetail> {
  void scope
  if (env.purchasesUseMock) throw new Error('Annulation non disponible dans la démonstration.')
  return (await apiClient.post<PurchaseOrderDetail>(`${PURCHASE_ORDERS_ENDPOINT}${id}/cancel/`, {})).data
}
export async function createSupplierInvoiceFromPurchase(scope: string, id: number): Promise<SupplierInvoiceDetail> {
  if (env.purchasesUseMock && env.supplierInvoicesUseMock) return billPurchaseMock(scope, id)
  if (env.purchasesUseMock) throw new Error('Activez le même mode pour les commandes et factures fournisseurs.')
  return (await apiClient.post<SupplierInvoiceDetail>(`${PURCHASE_ORDERS_ENDPOINT}${id}/bill/`)).data
}
