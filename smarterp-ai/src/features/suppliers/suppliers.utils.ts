import { sumMoney } from '../../lib/money'
import { supplierRiskLabels, supplierStatusLabels, type Supplier, type SupplierFilters, type SupplierGroup, type SupplierSummary } from './types/suppliers.types'

export const supplierDefaultFilters: SupplierFilters = { search: '', category: '', country: '', risk: '', status: '', buyer: '', city: '', quick: '', strategic: false }
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function filterSuppliers(rows: Supplier[], filters: SupplierFilters, asOf: string) {
  const monthAgo = new Date(`${asOf}T12:00:00Z`); monthAgo.setUTCDate(monthAgo.getUTCDate() - 30)
  return rows.filter((row) =>
    (!filters.search || normalized(`${row.name} ${row.reference} ${row.contact} ${row.email} ${row.phone} ${row.city}`).includes(normalized(filters.search))) &&
    (!filters.category || row.category === filters.category) && (!filters.country || row.country === filters.country) &&
    (!filters.risk || row.risk === filters.risk) && (!filters.status || row.status === filters.status) &&
    (!filters.buyer || row.buyer === filters.buyer) && (!filters.city || row.city === filters.city) && (!filters.strategic || row.strategic) &&
    (!filters.quick || (filters.quick === 'active' && row.status === 'active') || (filters.quick === 'risk' && row.risk === 'high') ||
      (filters.quick === 'balance' && row.outstandingBalance !== null && row.outstandingBalance >= 50000) || (filters.quick === 'delay' && row.averageLeadTimeDays !== null && row.averageLeadTimeDays > 30) ||
      (filters.quick === 'new' && row.createdAt >= monthAgo.toISOString().slice(0, 10) && row.createdAt <= asOf)))
}
export function supplierSummary(rows: Supplier[]): SupplierSummary {
  const delays = rows.flatMap((row) => row.averageLeadTimeDays === null ? [] : [row.averageLeadTimeDays])
  return { active: rows.filter((row) => row.status === 'active').length, purchaseVolume: rows.some((row) => row.purchaseVolume === null) ? null : sumMoney(rows.map((row) => row.purchaseVolume ?? 0)), outstandingBalance: rows.some((row) => row.outstandingBalance === null) ? null : sumMoney(rows.map((row) => row.outstandingBalance ?? 0)), averageLeadTimeDays: delays.length ? Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length) : null, atRisk: rows.filter((row) => row.risk === 'high').length }
}
export function supplierGroupLabel(supplier: Supplier, group: SupplierGroup) {
  return group === 'risk' ? (supplier.risk ? supplierRiskLabels[supplier.risk] : 'Non évalué') : group === 'status' ? supplierStatusLabels[supplier.status] : group ? supplier[group] : 'Tous les fournisseurs'
}
