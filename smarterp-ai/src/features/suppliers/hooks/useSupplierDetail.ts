import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { getSupplierAIInsight, getSupplierById, getSupplierMetrics, getSupplierPriceHistory, updateSupplier } from '../api/suppliers.api'
import type { SupplierInput } from '../types/suppliers.types'
import { purchasingQueryOptions as options, recordForbidden, recordNotFound, usePurchasingScope, validRecordId } from '../../purchases/hooks/usePurchasingScope'
export function useSupplierDetail(id: string | undefined) {
  const { scope, key, refresh } = usePurchasingScope()
  const numeric = Number(id), valid = validRecordId(id)
  const query = useQuery({ ...options, queryKey: [...key('supplier-detail'), env.suppliersUseMock, numeric], enabled: valid, queryFn: ({ signal }) => getSupplierById(scope, numeric, signal) })
  const readable = !!query.data?.permissions?.includes('suppliers.view') && !recordForbidden(query.error)
  const metrics = useQuery({ ...options, queryKey: [...key('supplier-metrics'), env.suppliersUseMock, numeric], enabled: readable, queryFn: ({ signal }) => getSupplierMetrics(scope, numeric, signal) })
  const history = useQuery({ ...options, queryKey: [...key('supplier-price-history'), env.suppliersUseMock, numeric], enabled: readable && !!query.data?.permissions.includes('purchases.view'), queryFn: ({ signal }) => getSupplierPriceHistory(scope, numeric, signal) })
  const insight = useMutation({ ...options, mutationFn: () => getSupplierAIInsight(scope, numeric) })
  const save = useMutation({ ...options, mutationFn: (input: SupplierInput) => updateSupplier(scope, numeric, input), onSuccess: async () => { insight.reset(); await refresh() } })
  return { ...query, metrics, history, insight, save, isDemo: env.suppliersUseMock, isNotFound: !valid || recordNotFound(query.error), isForbidden: recordForbidden(query.error) || !!query.data && !query.data.permissions?.includes('suppliers.view') }
}
