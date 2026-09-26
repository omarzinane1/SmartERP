import type { AuditFilters, AuditLog } from './types/admin.types'
const sensitive = /password|passwd|token|secret|credential|authorization|cookie|api.?key|private.?key|totp.?seed|otp.?seed/i
export function redactAudit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAudit)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, sensitive.test(key) ? '[MASQUÉ]' : redactAudit(v)]))
  return value
}
export function auditDiff(log: Pick<AuditLog, 'before' | 'after' | 'restricted'>) {
  if (log.restricted) return []
  const before = redactAudit(log.before) as Record<string, unknown>, after = redactAudit(log.after) as Record<string, unknown>
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !sensitive.test(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) => ({ key, before: before[key] ?? null, after: after[key] ?? null }))
}
export function filterAudit(rows: AuditLog[], f: AuditFilters, canNetwork: boolean) { return rows.filter((r) => `${r.restricted ? '' : r.reference} ${r.actor} ${r.action}`.toLowerCase().includes(f.search.toLowerCase()) && (!f.dateFrom || r.timestamp.slice(0, 10) >= f.dateFrom) && (!f.dateTo || r.timestamp.slice(0, 10) <= f.dateTo) && (!f.actor || r.actor === f.actor) && (!f.module || r.module === f.module) && (!f.action || r.action === f.action) && (!f.entityType || !r.restricted && r.entityType === f.entityType) && (!f.result || r.result === f.result) && (!canNetwork || !f.ip || !r.restricted && r.ip?.includes(f.ip))) }
export function auditRecordPath(log: AuditLog) { const routes: Record<string, string> = { customer: '/customers', invoice: '/invoices', supplier: '/suppliers', product: '/products', purchase: '/purchases', supplier_invoice: '/supplier-invoices', document: '/documents', warehouse: '/warehouses' }; return log.canOpenRecord && !log.restricted && log.recordId && routes[log.entityType] ? `${routes[log.entityType]}/${log.recordId}` : null }
