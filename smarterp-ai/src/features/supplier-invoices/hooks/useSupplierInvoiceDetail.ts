import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { getSupplierInvoiceById, postSupplierInvoice, recordSupplierInvoicePayment, updateSupplierInvoice } from '../api/supplierInvoices.api'
import type { SupplierInvoiceInput } from '../types/supplierInvoices.types'
import type { PaymentInput } from '../../payments/types/payments.types'
import { purchasingQueryOptions as options, recordForbidden, recordNotFound, usePurchasingScope, validRecordId } from '../../purchases/hooks/usePurchasingScope'
export function useSupplierInvoiceDetail(id: string | undefined) {
  const { scope, key, refresh } = usePurchasingScope()
  const numeric = Number(id), valid = validRecordId(id)
  const query = useQuery({ ...options, queryKey: [...key('supplier-invoice-detail'), env.supplierInvoicesUseMock, numeric], enabled: valid, queryFn: ({ signal }) => getSupplierInvoiceById(scope, numeric, signal) })
  const save = useMutation({ ...options, mutationFn: (input: SupplierInvoiceInput) => updateSupplierInvoice(scope, numeric, input), onSuccess: refresh })
  const post = useMutation({ ...options, mutationFn: () => postSupplierInvoice(scope, numeric), onSuccess: refresh })
  const payment = useMutation({ ...options, mutationFn: (input: PaymentInput) => recordSupplierInvoicePayment(scope, numeric, input), onSuccess: refresh })
  return { ...query, save, post, payment, isDemo: env.supplierInvoicesUseMock, busy: save.isPending || post.isPending || payment.isPending, isNotFound: !valid || recordNotFound(query.error), isForbidden: recordForbidden(query.error) || !!query.data && !query.data.permissions?.includes('supplier_invoices.view') }
}
