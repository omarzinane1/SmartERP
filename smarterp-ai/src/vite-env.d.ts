/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODULES_USE_MOCK?: string
  readonly VITE_SETTINGS_USE_MOCK?: string
  readonly VITE_PROFILE_USE_MOCK?: string
  readonly VITE_DOCUMENTS_USE_MOCK?: string
  readonly VITE_AI_WORKSPACE_USE_MOCK?: string
  readonly VITE_APPROVALS_USE_MOCK?: string
  readonly VITE_ADMIN_USE_MOCK?: string
  readonly VITE_PRODUCTS_USE_MOCK?: string
  readonly VITE_INVENTORY_USE_MOCK?: string
  readonly VITE_WAREHOUSES_USE_MOCK?: string
  readonly VITE_EXPENSES_USE_MOCK?: string
  readonly VITE_FINANCE_USE_MOCK?: string
  readonly VITE_REPORTS_USE_MOCK?: string

  readonly VITE_PURCHASES_USE_MOCK?: string
  readonly VITE_SUPPLIER_INVOICES_USE_MOCK?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DASHBOARD_USE_MOCK?: string
  readonly VITE_CUSTOMERS_USE_MOCK?: string
  readonly VITE_QUOTES_USE_MOCK?: string
  readonly VITE_SALES_USE_MOCK?: string
  readonly VITE_INVOICES_USE_MOCK?: string
  readonly VITE_PAYMENTS_USE_MOCK?: string
  readonly VITE_SUPPLIERS_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
