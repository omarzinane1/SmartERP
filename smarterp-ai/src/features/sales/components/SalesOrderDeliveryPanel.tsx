import { Truck } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { formatDate, formatNumber } from '../../../lib/format'
import { remainingQuantity } from '../sales.utils'
import { deliveryStatusLabels, type SalesOrderDetail } from '../types/sales.types'

export function SalesOrderDeliveryPanel({ order, canCreate, busy, onCreate }: { order: SalesOrderDetail; canCreate: boolean; busy: boolean; onCreate: () => void }) {
  const ordered = order.lines.reduce((sum, line) => sum + line.quantity, 0)
  const delivered = order.lines.reduce((sum, line) => sum + line.deliveredQuantity, 0)
  const remaining = order.lines.reduce((sum, line) => sum + remainingQuantity(line), 0)
  const labels = { planned: 'Planifiée', delivered: 'Livrée', cancelled: 'Annulée' }
  return <section id="sales-deliveries" tabIndex={-1} className="sales-card" aria-labelledby="sales-deliveries-title">
    <header className="sales-card-title"><Truck size={16} aria-hidden="true" /><h2 id="sales-deliveries-title">Suivi de livraison</h2><span className={`sales-badge sales-badge-${order.deliveryStatus}`}>{deliveryStatusLabels[order.deliveryStatus] ?? order.deliveryStatus}</span></header>
    <div className="sales-panel-body"><div className="sales-progress-label"><strong>{formatNumber(delivered, 3)} / {formatNumber(ordered, 3)} unités livrées</strong><span>{formatNumber(remaining, 3)} restantes</span></div>
      <progress className="sales-progress" value={delivered} max={ordered || 1} aria-label="Progression de livraison" />
    </div>
    {order.deliveries.length ? <div className="sales-table-scroll"><table><thead><tr><th>Référence</th><th>Date</th><th>Statut</th><th>Quantités</th><th>Entrepôt</th><th>Actions</th></tr></thead><tbody>
      {order.deliveries.map((delivery) => <tr key={delivery.id}><td><strong>{delivery.reference}</strong></td><td>{formatDate(delivery.date)}</td><td>{labels[delivery.status] ?? delivery.status}</td><td>{formatNumber(delivery.lines.reduce((sum, line) => sum + line.quantity, 0), 3)}</td><td>{delivery.warehouse}</td><td><button disabled title="La fiche livraison sera disponible dans le module Logistique">Fiche à venir</button></td></tr>)}
    </tbody></table></div> : <p className="sales-empty">Aucune livraison associée.</p>}
    {canCreate && <footer className="sales-panel-footer"><Button variant="secondary" className="sales-button" disabled={busy} onClick={onCreate}><Truck size={13} />Créer une livraison</Button></footer>}
  </section>
}
