import { sumMoney } from '../../../lib/money'
import { filterSuppliers, supplierSummary } from '../suppliers.utils'
import type { Supplier, SupplierInput, SupplierPermission, SupplierQuery, SuppliersData } from '../types/suppliers.types'

export const suppliersDemoDate = '2026-09-30'
export const supplierPermissions: SupplierPermission[] = ['suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.export']
const names = ['Atlas Packaging', 'LogiTrans Maroc', 'Marrakech Industrial Parts', 'North Africa Components']
const categories = ['Packaging', 'Transport', 'Pièces industrielles', 'Composants', 'Matières premières', 'Services', 'Maintenance']
export const suppliersMock: Supplier[] = Array.from({ length: 48 }, (_, index) => {
  const id = [42, 18, 57, 71][index] ?? 100 + index
  const status = index < 4 || index % 9 < 6 ? 'active' : index % 9 === 6 ? 'inactive' : index % 9 === 7 ? 'blocked' : 'archived'
  return {
    id, reference: `SUP-${String(id).padStart(5, '0')}`, name: names[index] ?? `${['Maghreb', 'Euro', 'Atlas', 'Sino'][index % 4]} ${categories[index % 7]} ${index + 1}`,
    contact: ['Karim Amrani', 'Nadia Alaoui', 'Youssef Bennani'][index % 3], email: `contact${id}@example.com`, phone: `+212 522 ${String(100000 + id)}`,
    category: categories[index % 7], country: index < 4 ? 'Maroc' : ['Maroc', 'France', 'Espagne', 'Chine'][index % 4], city: ['Casablanca', 'Casablanca', 'Marrakech', 'Tanger'][index] ?? ['Casablanca', 'Lyon', 'Valence', 'Shenzhen'][index % 4],
    buyer: index % 2 ? 'Salma Idrissi' : 'Amine Berrada', purchaseVolume: [684200, 428000, 318400, 186800][index] ?? 18000 + index * 1230,
    outstandingBalance: [48600, 72800, 96200, 34600][index] ?? (index % 4 === 0 ? 0 : 1500 + index * 410),
    averageLeadTimeDays: [18, 24, 41, 58][index] ?? (index % 11 === 0 ? null : 12 + index % 35),
    score: [91, 82, 63, 44][index] ?? (index % 11 === 0 ? null : 65 + index % 31), scoreSource: 'Données statiques de démonstration',
    risk: index === 3 || index > 3 && index % 6 === 0 ? 'high' : index === 2 || index % 5 === 0 && index > 3 ? 'medium' : 'low', status,
    createdAt: index > 38 ? '2026-09-15' : '2025-04-12', lastPurchaseAt: index % 11 === 0 && index > 3 ? null : '2026-09-18', strategic: index < 4 || index % 9 === 0,
    capabilities: { canEdit: status !== 'archived', canArchive: status !== 'archived' },
  }
})
const stores = new Map<string, Supplier[]>()
function store(scope: string) { if (!stores.has(scope)) stores.set(scope, structuredClone(suppliersMock)); return stores.get(scope)! }
export function supplierSnapshot(scope: string) { return structuredClone(store(scope)) }
export function changeSupplierBalance(scope: string, id: number, change: number) {
  const supplier = store(scope).find((row) => row.id === id)
  if (!supplier || sumMoney([supplier.outstandingBalance, change]) < 0) throw new Error('Solde fournisseur invalide')
  supplier.outstandingBalance = sumMoney([supplier.outstandingBalance, change])
}
export async function getSuppliersMock(scope: string, query: SupplierQuery): Promise<SuppliersData> {
  const all = store(scope)
  const filtered = filterSuppliers(all, query, suppliersDemoDate).sort((a, b) => query.sort === 'balance_desc' ? b.outstandingBalance - a.outstandingBalance : query.sort === 'purchase_desc' ? b.purchaseVolume - a.purchaseVolume : query.sort === 'score_desc' ? (b.score ?? -1) - (a.score ?? -1) : a.name.localeCompare(b.name, 'fr'))
  return structuredClone({ suppliers: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), count: filtered.length, totalCount: all.length, summary: supplierSummary(filtered), permissions: supplierPermissions, asOf: suppliersDemoDate, currentBuyer: 'Amine Berrada', facets: { categories: [...new Set(all.map((row) => row.category))].sort(), countries: [...new Set(all.map((row) => row.country))].sort(), buyers: [...new Set(all.map((row) => row.buyer))].sort() } })
}
export async function saveSupplierMock(scope: string, input: SupplierInput | { status: 'archived' }, id?: number) {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const rows = store(scope)
  const original = rows.find((row) => row.id === id)
  if (id !== undefined && (!original || !original.capabilities.canEdit)) throw new Error('Fournisseur non modifiable')
  if ('status' in input) {
    if (!original?.capabilities.canArchive) throw new Error('Archive indisponible')
    original.status = 'archived'; original.capabilities = { canEdit: false, canArchive: false }
    return structuredClone(original)
  }
  if (original) { Object.assign(original, input); return structuredClone(original) }
  const newId = Math.max(...rows.map((row) => row.id)) + 1
  const supplier: Supplier = { ...input, id: newId, reference: `SUP-${String(newId).padStart(5, '0')}`, purchaseVolume: 0, outstandingBalance: 0, averageLeadTimeDays: null, score: null, scoreSource: 'Aucune évaluation disponible', risk: 'low', status: 'active', createdAt: suppliersDemoDate, lastPurchaseAt: null, strategic: false, capabilities: { canEdit: true, canArchive: true } }
  rows.unshift(supplier)
  return structuredClone(supplier)
}
