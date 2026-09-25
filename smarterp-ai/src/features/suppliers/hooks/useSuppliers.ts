import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { createSupplier, getSuppliers, updateSupplier } from '../api/suppliers.api'
import type { SupplierInput, SupplierQuery } from '../types/suppliers.types'

export function useSuppliers(filters: SupplierQuery) {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const scope = `${userId}:${companyId}`
  const client = useQueryClient()
  const options = { retry: false, networkMode: 'always' as const }
  const query = useQuery({ ...options,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === userId && previousQuery.queryKey[2] === companyId ? previous : undefined,
    queryKey: ['suppliers', userId, companyId, env.suppliersUseMock, filters], queryFn: ({ signal }) => getSuppliers(scope, filters, signal),
  })
  async function refresh() { await Promise.all(['suppliers', 'payments'].map((key) => client.invalidateQueries({ queryKey: [key, userId, companyId] }))) }
  const save = useMutation({ ...options, mutationFn: ({ id, input }: { id?: number; input: SupplierInput }) => id === undefined ? createSupplier(scope, input) : updateSupplier(scope, id, input), onSuccess: refresh })
  const archive = useMutation({ ...options, mutationFn: (id: number) => updateSupplier(scope, id, { status: 'archived' }), onSuccess: refresh })
  async function exportRows() {
    const result = await getSuppliers(scope, { ...filters, page: 1, pageSize: Math.max(1, query.data?.count ?? 0) })
    if (!result.permissions.includes('suppliers.export') || result.suppliers.length !== result.count) throw new Error('Export complet indisponible')
    return result.suppliers
  }
  return { ...query, save, archive, exportRows, scope, isDemo: env.suppliersUseMock, isForbidden: isAxiosError(query.error) && query.error.response?.status === 403 || !!query.data && !query.data.permissions.includes('suppliers.view') }
}

