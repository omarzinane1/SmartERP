import { receiptProgress } from '../purchases.utils'
import type { PurchaseOrder } from '../types/purchases.types'
export function ReceiptProgress({ order }: { order: Pick<PurchaseOrder, 'lines'> }) {
  const { ordered, received, percent } = receiptProgress(order)
  return <div className="receipt-progress"><span>{percent} % reçu</span><progress value={received} max={ordered || 1} aria-label="Progression de réception" /><small>{received.toLocaleString('fr-FR')} / {ordered.toLocaleString('fr-FR')} unités reçues</small></div>
}
