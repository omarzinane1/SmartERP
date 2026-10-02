// These codes match the persisted onboarding module catalog.
export function moduleForPath(path: string): string | null {
  if (/^\/customers(?:\/|$)/.test(path)) return 'customers'
  if (/^\/(quotes|sales)(?:\/|$)/.test(path)) return 'sales'
  if (/^\/invoices(?:\/|$)/.test(path)) return 'invoices'
  if (/^\/suppliers(?:\/|$)/.test(path)) return 'suppliers'
  if (/^\/(purchases|supplier-invoices)(?:\/|$)/.test(path)) return 'purchases'
  if (/^\/products(?:\/|$)/.test(path)) return 'products'
  if (/^\/inventory(?:\/|$)/.test(path)) return 'inventory'
  if (/^\/warehouses(?:\/|$)/.test(path)) return 'warehouses'
  if (/^\/payments(?:\/|$)/.test(path)) return 'payments'
  if (/^\/expenses(?:\/|$)/.test(path)) return 'expenses'
  if (/^\/finance(?:\/|$)/.test(path)) return 'treasury'
  if (/^\/reports(?:\/|$)/.test(path)) return 'reports'
  if (/^\/documents(?:\/|$)/.test(path)) return 'documents'
  if (/^\/ai\/assistant(?:\/|$)/.test(path)) return 'ai_assistant'
  if (/^\/ai\/forecasting(?:\/|$)/.test(path)) return 'forecasting'
  if (/^\/ai\/(control-center|opportunities)(?:\/|$)/.test(path)) return 'ai_control_center'
  return null
}
