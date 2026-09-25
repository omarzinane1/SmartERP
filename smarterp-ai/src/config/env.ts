const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const env = {
  apiBaseUrl: (apiBaseUrl || 'http://localhost:8000/api').replace(/\/+$/, ''),
  dashboardUseMock: import.meta.env.VITE_DASHBOARD_USE_MOCK !== 'false',
  aiControlCenterUseMock: import.meta.env.VITE_AI_CONTROL_CENTER_USE_MOCK !== 'false',
  customersUseMock: import.meta.env.VITE_CUSTOMERS_USE_MOCK !== 'false',
  quotesUseMock: import.meta.env.VITE_QUOTES_USE_MOCK !== 'false',
  salesUseMock: import.meta.env.VITE_SALES_USE_MOCK !== 'false',
  invoicesUseMock: import.meta.env.VITE_INVOICES_USE_MOCK !== 'false',
  paymentsUseMock: import.meta.env.VITE_PAYMENTS_USE_MOCK !== 'false',
  suppliersUseMock: import.meta.env.VITE_SUPPLIERS_USE_MOCK !== 'false',
} as const
