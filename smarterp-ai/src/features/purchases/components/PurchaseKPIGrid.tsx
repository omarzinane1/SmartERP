import { formatMoney } from '../../../lib/money'
import { purchaseSummary } from '../purchases.utils'
import type { PurchaseOrder } from '../types/purchases.types'
export function PurchaseKPIGrid({ orders, asOf }: { orders: PurchaseOrder[]; asOf: string }) {
  const k = purchaseSummary(orders, asOf)
  return <section className="business-kpis supplier-kpis" aria-label="Indicateurs achats">{[['Achats du mois', formatMoney(k.month), 'Commandes confirmées'], ['Commandes ouvertes', k.open, 'Brouillons, envoyées et réceptions ouvertes'], ['Réceptions attendues', k.expected, 'Commandes confirmées non reçues'], ['Retards fournisseurs', k.overdue, 'Livraison prévue dépassée'], ['Valeur en attente réception', formatMoney(k.remaining), 'Quantités restantes · TTC']].map(([label, value, note]) => <article className="business-card business-kpi" key={label}><div><h2>{label}</h2></div><strong>{value}</strong><small>{note} · résultats filtrés</small></article>)}</section>
}
