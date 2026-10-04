import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { sumMoney } from '../../../lib/money'
import { catalogSnapshot, movementSnapshot, stockSnapshot } from '../../inventory/data/inventory.mock'
import { salesSnapshot } from '../../sales/data/sales.mock'
import { purchaseSnapshot } from '../../purchases/data/purchases.mock'
import { stockDemoDate, stockDemoPermissions } from './products.mock'
import type { ProductDetail, ProductHistory, ProductInsight, ProductMetrics } from '../types/products.types'
export async function productDetailMock(scope: string, id: number): Promise<ProductDetail> {
  const p = catalogSnapshot(scope).find((p) => p.id === id)
  if (!p) throw new BusinessNotFoundError()
  const salesData = { orders: salesSnapshot(scope).map((o) => ({ ...o, status: o.orderStatus, date: o.createdAt })) }
  return { ...p, permissions: stockDemoPermissions, asOf: stockDemoDate, suppliers: p.supplierId === null ? [] : [{ id: p.supplierId, name: p.supplierName }], sales: salesData.orders.filter((o) => o.status !== 'draft' && o.status !== 'cancelled').flatMap((o) => o.lines.filter((l) => l.productId === id).map((l) => ({ id: o.id, reference: o.reference, date: o.date, quantity: l.quantity, net: Math.round(l.quantity * l.unitPrice * (1 - l.discountRate / 100) * 100) / 100 }))), purchases: purchaseSnapshot(scope).filter((o) => o.status === 'confirmed').flatMap((o) => o.lines.filter((l) => l.productName.toLowerCase() === p.name.toLowerCase()).map((l) => ({ id: o.id, reference: o.reference, date: o.date, quantity: l.quantity, unitPrice: l.unitPrice }))), warehouses: stockSnapshot(scope).filter((r) => r.productId === id).map((r) => ({ id: r.warehouseId, name: r.warehouseName, onHand: r.onHand, reserved: r.reserved, available: r.available, incoming: r.incoming, value: r.value })), documents: [] }
}
export async function productMetricsMock(scope: string, id: number): Promise<ProductMetrics> {
  const p = await productDetailMock(scope, id), revenue = sumMoney(p.sales.map((s) => s.net)), unitsSold = p.sales.reduce((s, l) => s + l.quantity, 0)
  return { revenue, unitsSold, marginAmount: Math.round((revenue - unitsSold * p.averageCost) * 100) / 100, averageCost: p.averageCost, stockValue: p.stockValue, available: p.available }
}
export async function productHistoryMock(scope: string, id: number): Promise<ProductHistory> {
  const p = await productDetailMock(scope, id), movements = movementSnapshot(scope).filter((m) => m.productId === id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  let available = p.available ?? 0
  const reversed = [...movements].reverse().map((m) => { const point = { date: m.date, available }; available -= m.quantity; return point }).reverse()
  const days = new Map(reversed.map((p) => [p.date, p]))
  return { stock: p.type === 'service' ? [] : [...days.values()], prices: [{ date: stockDemoDate, purchase: p.purchasePrice, selling: p.sellingPrice }], source: 'Historique local des mouvements ; réservations actuelles constantes. Un seul relevé de prix disponible.' }
}
export async function productInsightMock(scope: string, id: number): Promise<ProductInsight> {
  const p = await productDetailMock(scope, id)
  return { facts: [`Prix achat courant : ${p.purchasePrice} MAD. Coût moyen : ${p.averageCost} MAD.`, p.available === null ? 'Service non stocké.' : `Disponible : ${p.available} ${p.unit}. Minimum : ${p.minimumStock}.`], analysis: p.stockHealth === 'out_of_stock' || p.stockHealth === 'low_stock' ? 'Le disponible est inférieur au seuil configuré.' : p.stockHealth === 'overstock' ? 'Le stock excède le maximum configuré.' : 'Aucun seuil critique global franchi.', forecast: null, recommendations: ['Vérifier la demande et les commandes ouvertes avant de modifier le réapprovisionnement.'], source: 'Démonstration : interprétation déterministe des données ERP, sans appel à un modèle IA. Prévision indisponible.' }
}
