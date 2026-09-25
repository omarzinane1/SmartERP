import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { confirmPurchaseOrder, createSupplierInvoiceFromPurchase, getPurchaseOrderById, receivePurchaseOrder, sendPurchaseOrder, updatePurchaseOrder } from '../api/purchases.api'
import type { PurchaseInput, ReceiptInput } from '../types/purchases.types'
import { purchasingQueryOptions as options, recordForbidden, recordNotFound, usePurchasingScope, validRecordId } from './usePurchasingScope'
export function usePurchaseOrderDetail(id: string | undefined) {
  const { scope, key, refresh } = usePurchasingScope()
  const valid = validRecordId(id), numeric = Number(id)
  const query = useQuery({ ...options, queryKey: [...key('purchase-order-detail'), env.purchasesUseMock, numeric], enabled: valid, queryFn: ({ signal }) => getPurchaseOrderById(scope, numeric, signal) })
  const save = useMutation({ ...options, mutationFn: (input: PurchaseInput) => updatePurchaseOrder(scope, numeric, input), onSuccess: refresh })
  const action = useMutation({ ...options, mutationFn: (action: 'send' | 'confirm') => action === 'send' ? sendPurchaseOrder(scope, numeric) : confirmPurchaseOrder(scope, numeric), onSuccess: refresh })
  const receive = useMutation({ ...options, mutationFn: (input: ReceiptInput) => receivePurchaseOrder(scope, numeric, input), onSuccess: refresh })
  const bill = useMutation({ ...options, mutationFn: () => createSupplierInvoiceFromPurchase(scope, numeric), onSuccess: refresh })
  return { ...query, save, action, receive, bill, isDemo: env.purchasesUseMock, busy: save.isPending || action.isPending || receive.isPending || bill.isPending, isNotFound: !valid || recordNotFound(query.error), isForbidden: recordForbidden(query.error) || !!query.data && !query.data.permissions?.includes('purchases.view') }
}
