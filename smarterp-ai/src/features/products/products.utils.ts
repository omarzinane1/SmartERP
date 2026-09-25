import type { Product, StockHealth } from './types/products.types'
export const productMargin = (purchase: number, selling: number) => selling > 0 ? (selling - purchase) / selling * 100 : null
export function productHealth(product: Product, available: number): StockHealth {
  if (product.type === 'service') return 'not_stocked'
  if (product.status === 'archived') return 'inactive'
  return available <= 0 ? 'out_of_stock' : available < product.minimumStock ? 'low_stock' : product.maximumStock > 0 && available > product.maximumStock ? 'overstock' : 'healthy'
}
