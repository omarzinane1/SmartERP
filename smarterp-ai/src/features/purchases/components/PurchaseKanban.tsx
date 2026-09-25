import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { formatMoney } from '../../../lib/money'
import { formatDate } from '../../../lib/format'
import { isDeliveryOverdue } from '../purchases.utils'
import { purchaseStatusLabels, type PurchaseOrder } from '../types/purchases.types'
import { ReceiptProgress } from './ReceiptProgress'
export function PurchaseKanban({ orders, asOf }: { orders: PurchaseOrder[]; asOf: string }) {
  return <div className="supplier-board purchasing-board">{Object.entries(purchaseStatusLabels).map(([status, label]) => { const rows = orders.filter((o) => o.status === status); return <section className="supplier-column" key={status} aria-label={label}><header>{label}<span>{rows.length}</span></header>{rows.map((o) => <article className="business-card supplier-tile" key={o.id}><h3><Link to={`/purchases/${o.id}`}>{o.reference}</Link></h3><p>{o.supplierName}</p><dl><div><dt>Montant TTC</dt><dd>{formatMoney(o.total)}</dd></div><div><dt>Livraison prévue</dt><dd>{formatDate(o.expectedDate)}</dd></div></dl><ReceiptProgress order={o} /><footer className="mt-4"><span>{o.buyer}</span>{isDeliveryOverdue(o, asOf) && <Badge tone="critical">En retard</Badge>}</footer></article>)}{!rows.length && <p className="p-3 text-xs text-slate-400">Aucune commande</p>}</section> })}</div>
}
