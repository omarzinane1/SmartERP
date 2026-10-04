import { stockQueryNames } from '../../inventory/hooks/useStockData'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useAuthStore } from '../../../store/auth.store'
import { PurchasingNotFoundError } from '../data/purchases.mock'
export const purchasingQueryOptions = { retry: false, networkMode: 'always' as const }
export const validRecordId = (id: string | undefined) => !!id && /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0
export const recordNotFound = (error: unknown) => error instanceof PurchasingNotFoundError || isAxiosError(error) && error.response?.status === 404
export const recordForbidden = (error: unknown) => isAxiosError(error) && error.response?.status === 403
export function usePurchasingScope() {
  const userId = useAuthStore((s) => s.user?.id), companyId = useAuthStore((s) => s.company?.id)
  const client = useQueryClient()
  const scope = `${userId}:${companyId}`
  const key = (name: string) => [name, userId, companyId]
  async function refresh() {
    await Promise.all([...stockQueryNames, 'cash-flow', 'cash-forecast', 'cash-upcoming', 'product', 'product-metrics', 'reports', 'report-analytics', 'forecast', 'forecast-drivers', 'ai-opportunities', 'approvals', 'purchase-orders', 'purchase-order-detail', 'supplier-invoices', 'supplier-invoice-detail', 'supplier-invoice-aging', 'supplier-detail', 'supplier-metrics', 'supplier-price-history', 'suppliers', 'payments', 'payments-summary', 'dashboard'].map((name) => client.invalidateQueries({ queryKey: key(name) })))
  }
  return { scope, key, refresh }
}
