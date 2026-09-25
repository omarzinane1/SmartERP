import { formatMoney } from '../../../lib/money'
import { payableSummary } from '../supplierInvoices.utils'
import type { SupplierInvoice } from '../types/supplierInvoices.types'
export function SupplierInvoiceKPIGrid({ invoices, asOf }: { invoices: SupplierInvoice[]; asOf: string }) {
  const k = payableSummary(invoices, asOf)
  return <section className="business-kpis" aria-label="Indicateurs factures fournisseurs">{[['Dettes fournisseurs', k.balance, 'Solde des factures comptabilisées'], ['Échéance prochainement', k.soon, 'Solde dû sous 7 jours, aujourd’hui inclus'], ['En retard', k.overdue, 'Solde dont l’échéance est dépassée'], ['Payé', k.paid, 'Décaissements confirmés ce mois']].map(([label, value, note]) => <article key={label} className="business-card business-kpi"><div><h2>{label}</h2></div><strong>{formatMoney(Number(value))}</strong><small>{note} · résultats filtrés</small></article>)}</section>
}
