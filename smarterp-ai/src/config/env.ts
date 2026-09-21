const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const env = {
  apiBaseUrl: (apiBaseUrl || 'http://localhost:8000/api').replace(/\/+$/, ''),
  dashboardUseMock: import.meta.env.VITE_DASHBOARD_USE_MOCK !== 'false',
} as const
