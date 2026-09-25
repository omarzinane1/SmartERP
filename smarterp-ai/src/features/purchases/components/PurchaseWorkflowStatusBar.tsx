import { Badge } from '../../../components/ui/Badge'
import { billingStatusLabels, purchaseStatusLabels, receiptStatusLabels, type PurchaseOrder } from '../types/purchases.types'
export function PurchaseWorkflowStatusBar({ order, showBilling }: { order: PurchaseOrder; showBilling: boolean }) {
  return <div className="business-card purchasing-workflow" aria-label="États de la commande"><span>Commande <Badge tone={order.status === 'confirmed' ? 'positive' : 'neutral'}>{purchaseStatusLabels[order.status]}</Badge></span><span>Réception <Badge tone={order.receiptStatus === 'received' ? 'positive' : 'warning'}>{receiptStatusLabels[order.receiptStatus]}</Badge></span>{showBilling && <span>Facturation <Badge tone={order.billingStatus === 'billed' ? 'positive' : 'info'}>{billingStatusLabels[order.billingStatus]}</Badge></span>}<small className="ml-auto text-slate-400">Brouillon → Envoyée → Confirmée</small></div>
}
