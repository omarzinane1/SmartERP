export type SupplierStatus = 'active' | 'inactive' | 'blocked' | 'archived'
export type SupplierRisk = 'low' | 'medium' | 'high'
export type SupplierPermission = 'suppliers.view' | 'suppliers.create' | 'suppliers.edit' | 'suppliers.export'
export interface Supplier {
  id: number
  reference: string
  name: string
  contact: string
  email: string
  phone: string
  category: string
  country: string
  city: string
  buyer: string
  purchaseVolume: number
  outstandingBalance: number
  averageLeadTimeDays: number | null
  score: number | null
  scoreSource: string
  risk: SupplierRisk
  status: SupplierStatus
  createdAt: string
  lastPurchaseAt: string | null
  strategic: boolean
  capabilities: { canEdit: boolean; canArchive: boolean }
}
export type SupplierInput = Pick<Supplier, 'name' | 'contact' | 'email' | 'phone' | 'category' | 'country' | 'city' | 'buyer'>
export interface SupplierFilters {
  search: string; category: string; country: string; risk: string; status: string
  buyer: string; city: string; quick: string; strategic: boolean
}
export interface SupplierQuery extends SupplierFilters { page: number; pageSize: number; sort: string }
export interface SupplierSummary { active: number; purchaseVolume: number; outstandingBalance: number; averageLeadTimeDays: number | null; atRisk: number }
export interface SuppliersData {
  suppliers: Supplier[]; count: number; totalCount: number; summary: SupplierSummary
  permissions: SupplierPermission[]; asOf: string; currentBuyer: string
  facets: { categories: string[]; countries: string[]; buyers: string[] }
}
export type SupplierGroup = '' | 'buyer' | 'category' | 'country' | 'risk' | 'status'
export const supplierStatusLabels = { active: 'Actif', inactive: 'Inactif', blocked: 'Bloqué', archived: 'Archivé' }
export const supplierRiskLabels = { low: 'Faible', medium: 'Moyen', high: 'Élevé' }
