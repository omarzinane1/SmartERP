import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { confirmPurchaseOrder, createPurchaseOrder, getPurchaseOrders, sendPurchaseOrder } from '../api/purchases.api'
import type { PurchaseInput } from '../types/purchases.types'
import { purchasingQueryOptions as options, recordForbidden, usePurchasingScope } from './usePurchasingScope'
export function usePurchaseOrders() {
  const { scope, key, refresh } = usePurchasingScope()
  const query = useQuery({ ...options, queryKey: [...key('purchase-orders'), env.purchasesUseMock], queryFn: ({ signal }) => getPurchaseOrders(scope, signal) })
  const create = useMutation({ ...options, mutationFn: (input: PurchaseInput) => createPurchaseOrder(scope, input), onSuccess: refresh })
  const action = useMutation({ ...options, mutationFn: ({ id, action }: { id: number; action: 'send' | 'confirm' }) => action === 'send' ? sendPurchaseOrder(scope, id) : confirmPurchaseOrder(scope, id), onSuccess: refresh })
  return { ...query, create, action, isDemo: env.purchasesUseMock, isForbidden: recordForbidden(query.error) || !!query.data && !query.data.permissions?.includes('purchases.view') }
}
