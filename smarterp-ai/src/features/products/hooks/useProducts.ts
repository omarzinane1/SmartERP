import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { stockQueryNames } from '../../inventory/hooks/useStockData'
import * as api from '../api/products.api'
import type { ProductInput } from '../types/products.types'
export function useProducts() {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('products'), env.productsUseMock], queryFn: ({ signal }) => api.getProducts(scope, signal) })
  const save = useMutation({ ...options, mutationFn: ({ input, id }: { input: ProductInput | { status: 'archived' }; id?: number }) => id ? api.updateProduct(scope, id, input) : api.createProduct(scope, input as ProductInput), onSuccess: () => invalidate(stockQueryNames) })
  const upload = useMutation({ ...options, mutationFn: api.importProducts, onSuccess: () => invalidate(stockQueryNames) })
  return { ...query, save, upload, isDemo: env.productsUseMock }
}
export function useProductDetail(id: number, valid: boolean) {
  const { scope, key, invalidate } = useBusinessScope()
  const detail = useQuery({ ...options, queryKey: [...key('product'), env.productsUseMock, id], enabled: valid, queryFn: ({ signal }) => api.getProductById(scope, id, signal) })
  const can = (p: string) => detail.data?.permissions.includes(p) ?? false
  const metrics = useQuery({ ...options, queryKey: [...key('product-metrics'), env.productsUseMock, id], enabled: can('products.view') && can('analytics.view'), queryFn: ({ signal }) => api.getProductMetrics(scope, id, signal) })
  const history = useQuery({ ...options, queryKey: [...key('product-history'), env.productsUseMock, id], enabled: can('products.view') && (can('inventory.view') || can('analytics.view')), queryFn: ({ signal }) => api.getProductHistory(scope, id, signal) })
  const insight = useMutation({ ...options, mutationFn: () => api.getProductAIInsight(scope, id) })
  const save = useMutation({ ...options, mutationFn: (input: ProductInput) => api.updateProduct(scope, id, input), onSuccess: () => invalidate(stockQueryNames) })
  return { detail, metrics, history, insight, save, can, isDemo: env.productsUseMock }
}
