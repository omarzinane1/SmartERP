import { formatMoney } from '../../../lib/money'
import { payableAging } from '../supplierInvoices.utils'
import type { SupplierInvoice } from '../types/supplierInvoices.types'
export function PayableAging({ invoices, asOf, selected, onSelect }: { invoices: SupplierInvoice[]; asOf: string; selected: string; onSelect: (v: string) => void }) {
  return <section aria-label="Ancienneté des dettes fournisseurs"><h2 className="mb-3">Ancienneté des dettes</h2><div className="payable-aging">{payableAging(invoices, asOf).map((bucket) => <button className="business-card" key={bucket.key} aria-pressed={selected === bucket.key} onClick={() => onSelect(selected === bucket.key ? '' : bucket.key)}><span>{bucket.label}</span><strong>{formatMoney(bucket.amount)}</strong><small>{bucket.count} facture(s) · solde uniquement</small></button>)}</div></section>
}
