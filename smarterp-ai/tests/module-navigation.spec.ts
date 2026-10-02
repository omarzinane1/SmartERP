import { expect, test } from './fixtures'
import { moduleForPath } from '../src/components/layout/moduleNavigation'
import { moduleNames } from '../src/features/onboarding/types/onboarding.types'

test('navigation uses the exact onboarding module codes', () => {
  const routes = {
    '/customers/1': 'customers', '/quotes': 'sales', '/sales/2': 'sales',
    '/invoices': 'invoices', '/suppliers': 'suppliers', '/purchases': 'purchases',
    '/supplier-invoices': 'purchases', '/products': 'products', '/inventory': 'inventory',
    '/warehouses': 'warehouses', '/payments': 'payments', '/expenses': 'expenses',
    '/finance/cash-flow': 'treasury', '/reports/sales': 'reports', '/documents': 'documents',
    '/ai/assistant': 'ai_assistant', '/ai/forecasting': 'forecasting',
    '/ai/control-center': 'ai_control_center', '/ai/opportunities': 'ai_control_center',
  }
  for (const [path, code] of Object.entries(routes)) {
    expect(moduleForPath(path)).toBe(code)
    expect(Object.keys(moduleNames)).toContain(code)
  }
  expect(moduleForPath('/profile')).toBeNull()
})
