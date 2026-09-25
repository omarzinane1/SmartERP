import { supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import type { Payment } from '../types/payments.types'

// Ledger shared by Payments and supplier invoices; no invoice totals stored here.
const stores = new Map<string, Payment[]>()
function store(scope: string) {
  if (!stores.has(scope)) stores.set(scope, supplierSnapshot(scope).slice(0, 28).map((supplier, index): Payment => ({
    id: 2_000_000 + index, reference: index === 0 ? 'PAY-2026-0186' : index === 1 ? 'PAY-2026-0179' : `PAY-FOUR-${index + 1}`,
    direction: 'outgoing', partnerType: 'supplier', partnerId: supplier.id, partnerName: supplier.name,
    invoiceId: index === 0 ? 78 : index === 1 ? 64 : 1000 + supplier.id,
    invoiceReference: `BILL-2026-${String(index === 0 ? 78 : index === 1 ? 64 : 1000 + supplier.id).padStart(4, '0')}`,
    invoiceIssuedDate: '2026-09-01', date: index === 0 ? '2026-09-23' : index === 1 ? '2026-09-18' : `2026-${index % 8 === 0 ? '08' : '09'}-${String(2 + index % 27).padStart(2, '0')}`,
    amount: index === 0 ? 18600 : index === 1 ? 9400 : 300 + index * 110,
    method: (['bank_transfer', 'cheque', 'cash', 'card', 'other'] as const)[index % 5],
    status: index === 0 || index === 1 || index % 5 < 3 && index % 5 > 0 ? 'completed' : index % 5 === 0 ? 'pending' : index % 5 === 3 ? 'cancelled' : 'failed',
    referenceExternal: `FOUR-${supplier.reference}`, note: 'Historique de démonstration', canCancel: index < 2 || index % 5 < 3,
  })))
  return stores.get(scope)!
}
export const supplierPaymentSnapshot = (scope: string) => structuredClone(store(scope))
export function addSupplierPayment(scope: string, payment: Omit<Payment, 'id' | 'reference'>) {
  const id = Math.max(2_000_000, ...store(scope).map((p) => p.id)) + 1
  const row = { ...payment, id, reference: `PAY-DEMO-${id}` }; store(scope).unshift(row); return structuredClone(row)
}
export function cancelSupplierPayment(scope: string, id: number) {
  const row = store(scope).find((p) => p.id === id)
  if (!row || !row.canCancel || !['completed', 'pending'].includes(row.status)) throw new Error('Paiement non annulable')
  row.status = 'cancelled'; row.canCancel = false
  return structuredClone(row)
}
