import { sumMoney, formatMoney } from '../../../lib/money'
import { supplierSnapshot } from './suppliers.mock'
import { purchaseSnapshot, purchasingDemoDate, purchasingPermissions, PurchasingNotFoundError } from '../../purchases/data/purchases.mock'
import { purchaseDetailMock, supplierInvoiceSnapshot } from '../../supplier-invoices/data/supplierInvoices.mock'
import { supplierPaymentSnapshot } from '../../payments/data/supplierPayments.mock'
import { payableBalance } from '../../supplier-invoices/supplierInvoices.utils'
import type { PurchasingInsight, SupplierDetail, SupplierMetrics, SupplierPriceHistory } from '../types/supplierDetail.types'
export function supplierDetailMock(scope: string, id: number): SupplierDetail {
  const supplier = supplierSnapshot(scope).find((s) => s.id === id)
  if (!supplier) throw new PurchasingNotFoundError()
  const orders = purchaseSnapshot(scope).filter((o) => o.supplierId === id).map((o) => purchaseDetailMock(scope, o.id))
  const invoices = supplierInvoiceSnapshot(scope).filter((i) => i.supplierId === id)
  return { ...supplier, permissions: purchasingPermissions, asOf: purchasingDemoDate, orders, invoices, payments: supplierPaymentSnapshot(scope).filter((p) => p.partnerId === id), documents: invoices.flatMap((i) => i.documents), contracts: id === 42 ? [{ id: 'atlas-2026', name: 'Accord de fourniture Packaging 2026', expiresAt: '2026-12-31', status: 'Actif · démonstration' }] : [], activities: [{ id: 'supplier-created', date: supplier.createdAt, title: 'Fournisseur créé', detail: 'Référentiel de démonstration' }, ...orders.flatMap((o) => o.activities), ...invoices.flatMap((i) => i.activities)].sort((a, b) => b.date.localeCompare(a.date)) }
}
export function supplierPriceHistoryMock(scope: string, id: number): SupplierPriceHistory {
  const detail = supplierDetailMock(scope, id)
  return { product: id === 42 ? 'Premium Packaging Box' : 'Fourniture principale', source: 'Historique tarifaire de démonstration', points: detail.orders.length && id === 42 ? [40.5, 41, 42, 42.94, 43.2, 43.3, 43.8, 42.6, 45].map((price, n) => ({ date: `2026-${String(n + 1).padStart(2, '0')}-01`, price })) : [] }
}
export function supplierMetricsMock(scope: string, id: number): SupplierMetrics {
  const detail = supplierDetailMock(scope, id), history = supplierPriceHistoryMock(scope, id).points.slice(-6)
  return { purchaseVolume: sumMoney(detail.orders.filter((o) => o.status === 'confirmed').map((o) => o.total)), outstandingBalance: sumMoney(detail.invoices.filter((i) => i.workflowStatus === 'posted').map(payableBalance)), averageLeadTimeDays: detail.averageLeadTimeDays, onTimeDelivery: id === 42 ? 92 : detail.averageLeadTimeDays === null ? null : 85, priceChange: history.length > 1 ? (history.at(-1)!.price / history[0].price - 1) * 100 : null, score: detail.score }
}
export function supplierInsightMock(scope: string, id: number): PurchasingInsight {
  const m = supplierMetricsMock(scope, id)
  return { facts: [`Volume achats : ${formatMoney(m.purchaseVolume)}`, `Solde : ${formatMoney(m.outstandingBalance)}`, `Délai moyen : ${m.averageLeadTimeDays ?? 'non disponible'} jours`, `Livraisons à l’heure : ${m.onTimeDelivery ?? 'non disponible'} %`, `Variation prix 6 mois : ${m.priceChange?.toFixed(1) ?? 'non disponible'} %`], analysis: 'Les données de démonstration indiquent une progression des prix. La régularité des livraisons doit être confirmée sur les réceptions réelles.', risk: 'Hausse tarifaire · à examiner', opportunity: 'Étudier un engagement de volume avec stabilisation tarifaire.', recommendations: ['Comparer avec un second fournisseur.', 'Renégocier les tarifs et vérifier les engagements de livraison.'], source: 'Analyse simulée, sans appel à un modèle IA. Aucune valeur comptable officielle.' }
}
