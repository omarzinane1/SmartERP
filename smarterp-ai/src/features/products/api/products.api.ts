import { getCollection } from '../../../lib/collectionApi'
import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { catalogSnapshot } from '../../inventory/data/inventory.mock'
import { supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { saveProductMock, stockDemoDate, stockDemoPermissions } from '../data/products.mock'
import { productDetailMock, productHistoryMock, productInsightMock, productMetricsMock } from '../data/productDetail.mock'
import type { ProductDetail, ProductHistory, ProductInput, ProductInsight, ProductMetrics, ProductsData } from '../types/products.types'
export const getProducts = async (scope: string, signal?: AbortSignal): Promise<ProductsData> => env.productsUseMock ? { products: catalogSnapshot(scope), permissions: stockDemoPermissions, asOf: stockDemoDate, suppliers: supplierSnapshot(scope).filter((s) => s.status === 'active').map(({ id, name }) => ({ id, name })) } : getCollection<ProductsData, 'products'>('/products/', 'products', signal)
export const getProductById = async (scope: string, id: number, signal?: AbortSignal): Promise<ProductDetail> => env.productsUseMock ? productDetailMock(scope, id) : (await apiClient.get(`/products/${id}/`, { signal })).data
export const getProductMetrics = async (scope: string, id: number, signal?: AbortSignal): Promise<ProductMetrics> => env.productsUseMock ? productMetricsMock(scope, id) : (await apiClient.get(`/products/${id}/metrics/`, { signal })).data
export const getProductHistory = async (scope: string, id: number, signal?: AbortSignal): Promise<ProductHistory> => env.productsUseMock ? productHistoryMock(scope, id) : (await apiClient.get(`/products/${id}/history/`, { signal })).data
export const getProductAIInsight = async (scope: string, id: number): Promise<ProductInsight> => env.productsUseMock ? productInsightMock(scope, id) : (await apiClient.get(`/ai/products/${id}/insight/`)).data
const dto = (v: ProductInput) => ({ name: v.name, sku: v.sku, type: v.type, category: v.category, supplier_id: v.supplierId, purchase_price: v.purchasePrice, selling_price: v.sellingPrice, unit: v.unit, barcode: v.barcode, minimum_stock: v.minimumStock, maximum_stock: v.maximumStock, description: v.description })
export const createProduct = async (scope: string, v: ProductInput) => env.productsUseMock ? saveProductMock(scope, v) : (await apiClient.post('/products/', dto(v))).data
export const updateProduct = async (scope: string, id: number, v: ProductInput | { status: 'archived' }) => env.productsUseMock ? saveProductMock(scope, v, id) : (await apiClient.patch(`/products/${id}/`, 'status' in v ? v : dto(v))).data
export async function importProducts(file: File) { if (env.productsUseMock) throw new Error('Import disponible après connexion au serveur. Aucun produit importé.'); const data = new FormData(); data.append('file', file); return (await apiClient.post('/products/import/', data)).data }
