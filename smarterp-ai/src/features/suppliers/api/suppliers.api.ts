import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { getSuppliersMock, saveSupplierMock } from '../data/suppliers.mock'
import type { Supplier, SupplierInput, SupplierQuery, SuppliersData } from '../types/suppliers.types'
import type { PurchasingInsight, SupplierDetail, SupplierMetrics, SupplierPriceHistory } from '../types/supplierDetail.types'
import { supplierDetailMock, supplierInsightMock, supplierMetricsMock, supplierPriceHistoryMock } from '../data/supplierDetail.mock'
import { mockDelay } from '../../purchases/data/purchases.mock'

export const SUPPLIERS_ENDPOINT = '/suppliers/'
export async function getSupplierById(scope: string, id: number, signal?: AbortSignal): Promise<SupplierDetail> {
  if (env.suppliersUseMock) { await mockDelay(); return supplierDetailMock(scope, id) }
  return (await apiClient.get<SupplierDetail>(`${SUPPLIERS_ENDPOINT}${id}/`, { signal })).data
}
export async function getSupplierMetrics(scope: string, id: number, signal?: AbortSignal): Promise<SupplierMetrics> {
  if (env.suppliersUseMock) return supplierMetricsMock(scope, id)
  return (await apiClient.get<SupplierMetrics>(`${SUPPLIERS_ENDPOINT}${id}/metrics/`, { signal })).data
}
export async function getSupplierPriceHistory(scope: string, id: number, signal?: AbortSignal): Promise<SupplierPriceHistory> {
  if (env.suppliersUseMock) return supplierPriceHistoryMock(scope, id)
  return (await apiClient.get<SupplierPriceHistory>(`${SUPPLIERS_ENDPOINT}${id}/price-history/`, { signal })).data
}
export async function getSupplierAIInsight(scope: string, id: number): Promise<PurchasingInsight> {
  if (env.suppliersUseMock) { await mockDelay(); return supplierInsightMock(scope, id) }
  return (await apiClient.get<PurchasingInsight>(`/ai/suppliers/${id}/insight/`)).data
}
export async function getSuppliers(scope: string, query: SupplierQuery, signal?: AbortSignal): Promise<SuppliersData> {
  if (env.suppliersUseMock) return getSuppliersMock(scope, query)
  const { pageSize, ...filters } = query
  const { data } = await apiClient.get<SuppliersData>(SUPPLIERS_ENDPOINT, { params: { ...filters, page_size: pageSize }, signal })
  return { ...data, suppliers: data.suppliers.map((row) => ({ ...row, capabilities: { canEdit: row.capabilities?.canEdit === true, canArchive: row.capabilities?.canArchive === true } })) }
}
export async function createSupplier(scope: string, input: SupplierInput): Promise<Supplier> {
  if (env.suppliersUseMock) return saveSupplierMock(scope, input)
  const { data } = await apiClient.post<Supplier>(SUPPLIERS_ENDPOINT, input); return data
}
export async function updateSupplier(scope: string, id: number, input: SupplierInput | { status: 'archived' }): Promise<Supplier> {
  if (env.suppliersUseMock) return saveSupplierMock(scope, input, id)
  // Le serveur doit annoncer canArchive uniquement s'il accepte status via PATCH.
  const { data } = await apiClient.patch<Supplier>(`${SUPPLIERS_ENDPOINT}${id}/`, input); return data
}
