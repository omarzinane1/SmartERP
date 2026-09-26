import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { productSchema } from '../schemas/product.schema'
import type { Product, ProductInput } from '../types/products.types'
export const stockDemoDate = '2026-09-30'
export const stockDemoPermissions = ['products.view', 'products.create', 'products.edit', 'products.export', 'inventory.view', 'inventory.analytics.view', 'inventory.movements.view', 'inventory.movements.create', 'inventory.export', 'inventory.transfers.view', 'inventory.transfers.create', 'inventory.transfers.approve', 'warehouses.view', 'warehouses.create', 'analytics.view', 'ai.use', 'purchases.view', 'purchases.create', 'sales.view', 'suppliers.view']
export const productsMock: Product[] = Array.from({ length: 36 }, (_, n) => {
  const id = [104, 205, 301, 302, 501, 502][n] ?? 600 + n
  const type = n === 2 || n === 3 || n % 11 === 0 && n > 0 ? 'service' : 'product'
  return { id, name: ['Premium Cable', 'Station de travail', 'Installation sur site', 'Formation équipe', 'Premium Packaging Box', 'Film de protection'][n] ?? `${['Connecteur', 'Routeur', 'Support', 'Carton'][n % 4]} Pro ${n + 1}`, sku: `${type === 'service' ? 'SRV' : 'PRD'}-${String(id).padStart(5, '0')}`, type, category: n < 2 ? 'Électronique' : type === 'service' ? 'Services' : ['Électronique', 'Accessoires', 'Packaging'][n % 3], supplierId: n === 4 || n === 5 ? 42 : n % 2 ? 57 : 71, supplierName: '', purchasePrice: [800, 7000, 800, 500, 45, 30][n] ?? 25 + n * 8, sellingPrice: [1200, 8500, 1500, 900, 70, 45][n] ?? (n === 8 ? 0 : n % 7 === 0 ? 25 + n * 8 + 2 : 40 + n * 13), averageCost: [780, 6800, 800, 500, 43.64, 29.5][n] ?? 24 + n * 8, unit: type === 'service' ? 'Prestation' : 'Unité', barcode: type === 'service' ? '' : `611000${String(id).padStart(7, '0')}`, minimumStock: 20, maximumStock: 300, status: n === 35 ? 'archived' : 'active', description: 'Catalogue de démonstration SmartERP AI.', capabilities: { canEdit: n !== 35, canArchive: n !== 35 } }
})
const stores = new Map<string, Product[]>()
function store(scope: string) { if (!stores.has(scope)) stores.set(scope, structuredClone(productsMock)); return stores.get(scope)! }
export function productSnapshot(scope: string) { const suppliers = supplierSnapshot(scope); return structuredClone(store(scope).map((p) => ({ ...p, supplierName: suppliers.find((s) => s.id === p.supplierId)?.name ?? 'Fournisseur indisponible' }))) }
export function productById(scope: string, id: number) { const product = productSnapshot(scope).find((p) => p.id === id); if (!product) throw new BusinessNotFoundError(); return product }
export async function saveProductMock(scope: string, input: ProductInput | { status: 'archived' }, id?: number) {
  await new Promise((r) => setTimeout(r, 250))
  const original = store(scope).find((p) => p.id === id)
  if (id !== undefined && (!original || !original.capabilities.canEdit)) throw new Error('Produit non modifiable')
  if ('status' in input && !('name' in input)) { if (!original) throw new BusinessNotFoundError(); original.status = 'archived'; original.capabilities = { canEdit: false, canArchive: false }; return structuredClone(original) }
  const values = productSchema.parse(input)
  if (store(scope).some((p) => p.sku.toLowerCase() === values.sku.toLowerCase() && p.id !== id)) throw new Error('SKU déjà utilisé')
  if (!supplierSnapshot(scope).some((s) => s.id === values.supplierId)) throw new Error('Fournisseur invalide')
  if (original && original.type !== values.type) throw new Error('Le type est immuable après création pour préserver le stock historique.')
  const product: Product = { ...values, id: id ?? Math.max(...store(scope).map((p) => p.id)) + 1, averageCost: original?.averageCost ?? values.purchasePrice, supplierName: '', status: 'active', capabilities: { canEdit: true, canArchive: true } }
  if (original) Object.assign(original, product); else store(scope).push(product)
  return productById(scope, product.id)
}
