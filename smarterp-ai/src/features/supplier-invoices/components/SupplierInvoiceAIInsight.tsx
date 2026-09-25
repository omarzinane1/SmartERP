import { useState } from 'react'
import { formatMoney } from '../../../lib/money'
import { PurchasingInsightPanel } from '../../purchases/components/PurchasingShared'
import { hasQuantityMismatch, payableBalance } from '../supplierInvoices.utils'
import type { SupplierInvoice } from '../types/supplierInvoices.types'
import type { PurchasingInsight } from '../../suppliers/types/supplierDetail.types'
export function SupplierInvoiceAIInsight({ invoice, demo }: { invoice: SupplierInvoice; demo: boolean }) {
  const [insight, setInsight] = useState<PurchasingInsight>(), [busy, setBusy] = useState(false)
  async function analyze() {
    if (busy || !demo) return
    setBusy(true)
    await new Promise((resolve) => setTimeout(resolve, 400))
    const mismatch = hasQuantityMismatch(invoice)
    const matched = invoice.lines.some((l) => l.purchaseLineId && l.receivedQuantity !== null)
    setInsight({ facts: [`Facture : ${formatMoney(invoice.total)}`, `Solde : ${formatMoney(payableBalance(invoice))}`, `Échéance : ${invoice.dueDate}`, `Commande : ${invoice.orderReference ?? 'aucune'}`], analysis: !matched ? 'Les informations de réception ne permettent pas de conclure sur le rapprochement.' : mismatch ? 'Des quantités facturées dépassent les quantités réceptionnées. Vérifiez les pièces de réception.' : 'Les quantités de cette facture ne dépassent pas les quantités réceptionnées. La comparaison tarifaire doit être vérifiée séparément.', risk: mismatch ? 'Écart de quantité · à vérifier' : 'Aucune conclusion automatique sur le risque financier.', recommendations: ['Vérifier les tarifs et les documents source avant validation.', 'Confirmer les écarts avec le fournisseur.'], source: 'Analyse de démonstration, sans modèle IA. Aucune valeur comptable officielle.' })
    setBusy(false)
  }
  if (!demo) return <section className="business-card purchasing-panel purchasing-insight"><h2>Demander à l’IA</h2><p>Analyse indisponible : aucun endpoint IA de facture fournisseur n’est défini.</p></section>
  return <PurchasingInsightPanel insight={insight} busy={busy} error={false} onAnalyze={() => void analyze()} label="Demander à l’IA" />
}
