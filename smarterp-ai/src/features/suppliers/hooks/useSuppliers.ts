import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { createSupplier, getSuppliers, updateSupplier } from '../api/suppliers.api'
import type { SuppliersData, SupplierInput, SupplierQuery } from '../types/suppliers.types'

export function useSuppliers(filters: SupplierQuery) {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const scope = `${userId}:${companyId}`
  const client = useQueryClient()
  const options = { retry: false, networkMode: 'always' as const }
  const query = useQuery<SuppliersData>({ ...options,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === userId && previousQuery?.queryKey[2] === companyId ? previous : undefined,
    queryKey: ['suppliers', userId, companyId, env.suppliersUseMock, filters], queryFn: ({ signal }) => getSuppliers(scope, filters, signal),
  })
  async function refresh() { await Promise.all(['report-analytics', 'ai-opportunities', 'products', 'product', 'cash-flow', 'cash-upcoming', 'suppliers', 'supplier-detail', 'supplier-metrics', 'purchase-orders', 'purchase-order-detail', 'supplier-invoices', 'supplier-invoice-detail', 'payments'].map((key) => client.invalidateQueries({ queryKey: [key, userId, companyId] }))) }
  const save = useMutation({ ...options, mutationFn: ({ id, input }: { id?: number; input: SupplierInput }) => id === undefined ? createSupplier(scope, input) : updateSupplier(scope, id, input), onSuccess: refresh })
  const archive = useMutation({ ...options, mutationFn: (id: number) => updateSupplier(scope, id, { status: 'archived' }), onSuccess: refresh })
  async function exportRows() {
    const result = await getSuppliers(scope, { ...filters, page: 1, pageSize: 100 })
    if (!result.permissions.includes('suppliers.export')) throw new Error('Export non autorisé')
    const rows = [...result.suppliers]
    for (let page = 2; rows.length < result.count; page++) {
      const next = await getSuppliers(scope, { ...filters, page, pageSize: 100 })
      if (!next.suppliers.length || next.count !== result.count) throw new Error('La liste a changé. Relancez l’export.')
      rows.push(...next.suppliers)
    }
    return rows
  }
  return { ...query, save, archive, exportRows, scope, isDemo: env.suppliersUseMock, isForbidden: isAxiosError(query.error) && query.error.response?.status === 403 || !!query.data && !query.data.permissions.includes('suppliers.view') }
}

