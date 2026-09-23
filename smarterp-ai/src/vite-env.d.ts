/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DASHBOARD_USE_MOCK?: string
  readonly VITE_AI_CONTROL_CENTER_USE_MOCK?: string
  readonly VITE_CUSTOMERS_USE_MOCK?: string
  readonly VITE_QUOTES_USE_MOCK?: string
  readonly VITE_SALES_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
