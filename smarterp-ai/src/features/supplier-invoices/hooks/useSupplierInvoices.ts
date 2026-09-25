import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { createSupplierInvoice, getSupplierInvoices } from '../api/supplierInvoices.api'
import type { SupplierInvoiceInput } from '../types/supplierInvoices.types'
import { purchasingQueryOptions as options, recordForbidden, usePurchasingScope } from '../../purchases/hooks/usePurchasingScope'
export function useSupplierInvoices() {
  const { scope, key, refresh } = usePurchasingScope()
  const query = useQuery({ ...options, queryKey: [...key('supplier-invoices'), env.supplierInvoicesUseMock], queryFn: ({ signal }) => getSupplierInvoices(scope, signal) })
  const create = useMutation({ ...options, mutationFn: (input: SupplierInvoiceInput) => createSupplierInvoice(scope, input), onSuccess: refresh })
  return { ...query, create, isDemo: env.supplierInvoicesUseMock, isForbidden: recordForbidden(query.error) || !!query.data && !query.data.permissions?.includes('supplier_invoices.view') }
}
