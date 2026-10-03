export type ProductType = 'product' | 'service'
export type StockHealth = 'healthy' | 'low_stock' | 'out_of_stock' | 'overstock' | 'inactive' | 'not_stocked'
export interface ProductInput {
  name: string; sku: string; type: ProductType; category: string; supplierId: number
  purchasePrice: number; sellingPrice: number; unit: string; barcode: string
  minimumStock: number; maximumStock: number; description: string
}
export interface Product extends Omit<ProductInput, 'supplierId'> {
  supplierId: number | null;
  id: number; supplierName: string; averageCost: number; status: 'active' | 'archived'
  capabilities: { canEdit: boolean; canArchive: boolean }
}
export interface CatalogProduct extends Product { onHand: number | null; reserved: number | null; available: number | null; incoming: number | null; stockValue: number | null; stockHealth: StockHealth }
export interface CatalogReference { id: number; name: string; code: string }
export interface ProductsData { categories?: CatalogReference[]; units?: CatalogReference[]; products: CatalogProduct[]; permissions: string[]; asOf: string; suppliers: { id: number; name: string }[] }
export interface ProductDetail extends CatalogProduct {
  categories?: CatalogReference[]; units?: CatalogReference[]
  permissions: string[]; asOf: string
  suppliers: { id: number; name: string }[]
  sales: { id: number; reference: string; date: string; quantity: number; net: number }[]
  purchases: { id: number; reference: string; date: string; quantity: number; unitPrice: number }[]
  warehouses: { id: number; name: string; onHand: number; reserved: number; available: number; incoming: number; value: number }[]
  documents: { id: string; name: string; mime: string; url: string | null }[]
}
export interface ProductMetrics { revenue: number; unitsSold: number; marginAmount: number | null; averageCost: number; stockValue: number | null; available: number | null }
export interface ProductHistory { stock: { date: string; available: number }[]; prices: { date: string; purchase: number; selling: number }[]; source: string }
export interface ProductInsight { facts: string[]; analysis: string; forecast: string | null; recommendations: string[]; source: string }
export const stockHealthLabels: Record<StockHealth, string> = { healthy: 'Sain', low_stock: 'Stock faible', out_of_stock: 'Rupture', overstock: 'Surstock', inactive: 'Inactif', not_stocked: 'Non stocké' }
