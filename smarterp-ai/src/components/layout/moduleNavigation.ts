// Shared by navigation and the shell. Availability is supplied by the session/modules API.
export function moduleForPath(path: string): string | null {
  if (/^\/customers(?:\/|$)/.test(path)) return 'crm'
  if (/^\/(quotes|sales|invoices)(?:\/|$)/.test(path)) return 'sales'
  if (/^\/(suppliers|purchases|supplier-invoices)(?:\/|$)/.test(path)) return 'purchasing'
  if (/^\/(products|inventory|warehouses)(?:\/|$)/.test(path)) return 'inventory'
  if (/^\/(payments|expenses|finance)(?:\/|$)/.test(path)) return 'finance'
  if (/^\/documents(?:\/|$)/.test(path)) return 'documents'
  if (/^\/ai(?:\/|$)/.test(path)) return 'ai'
  return null
}
