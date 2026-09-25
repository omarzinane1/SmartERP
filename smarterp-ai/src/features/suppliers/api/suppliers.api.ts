import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { getSuppliersMock, saveSupplierMock } from '../data/suppliers.mock'
import type { Supplier, SupplierInput, SupplierQuery, SuppliersData } from '../types/suppliers.types'

export const SUPPLIERS_ENDPOINT = '/suppliers/'
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
