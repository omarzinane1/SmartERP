import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RouteLoading } from '../components/layout/RouteLoading'
import { RequireAuth } from '../features/auth/components/RequireAuth'
import { AppShell } from '../components/layout/AppShell'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  {
    path: '/login',
    HydrateFallback: RouteLoading,
    lazy: async () => {
      const { LoginPage } = await import('../features/auth/pages/LoginPage')
      return { Component: LoginPage }
    },
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/onboarding',
        HydrateFallback: RouteLoading,
        lazy: async () => {
          const { OnboardingPage } = await import(
            '../features/onboarding/pages/OnboardingPage'
          )
          return { Component: OnboardingPage }
        },
      },
      {
        element: <AppShell />,
        children: [
          { path: '/modules', lazy: async () => ({ Component: (await import('../features/modules/pages/ModulesMarketplacePage')).ModulesMarketplacePage }) },
          { path: '/settings', lazy: async () => ({ Component: (await import('../features/settings/pages/CompanySettingsPage')).CompanySettingsPage }) },
          { path: '/profile', lazy: async () => ({ Component: (await import('../features/profile/pages/UserProfilePage')).UserProfilePage }) },
          { path: '/reports/:type', lazy: async () => ({ Component: (await import('../features/reports/pages/ReportAnalyticsPage')).ReportAnalyticsPage }) },
          { path: '/documents', lazy: async () => ({ Component: (await import('../features/documents/pages/DocumentsPage')).DocumentsPage }) },
          { path: '/documents/:id', lazy: async () => ({ Component: (await import('../features/documents/pages/DocumentDetailPage')).DocumentDetailPage }) },
          { path: '/ai/assistant', lazy: async () => ({ Component: (await import('../features/ai/pages/AIAssistantPage')).AIAssistantPage }) },
          { path: '/ai/forecasting', lazy: async () => ({ Component: (await import('../features/ai/pages/AIForecastingPage')).AIForecastingPage }) },
          { path: '/ai/opportunities', lazy: async () => ({ Component: (await import('../features/ai/pages/AIOpportunitiesPage')).AIOpportunitiesPage }) },
          { path: '/approvals', lazy: async () => ({ Component: (await import('../features/approvals/pages/ApprovalCenterPage')).ApprovalCenterPage }) },
          { path: '/admin/users', lazy: async () => ({ Component: (await import('../features/admin/pages/UsersAdminPage')).UsersAdminPage }) },
          { path: '/admin/roles', lazy: async () => ({ Component: (await import('../features/admin/pages/RolesPermissionsPage')).RolesPermissionsPage }) },
          { path: '/admin/audit-logs', lazy: async () => ({ Component: (await import('../features/admin/pages/AuditLogsPage')).AuditLogsPage }) },
          {
            path: '/purchases',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { PurchaseOrdersPage } = await import('../features/purchases/pages/PurchaseOrdersPage')
              return { Component: PurchaseOrdersPage }
            },
          },
          {
            path: '/purchases/:id',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { PurchaseOrderDetailPage } = await import('../features/purchases/pages/PurchaseOrderDetailPage')
              return { Component: PurchaseOrderDetailPage }
            },
          },
          {
            path: '/supplier-invoices',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { SupplierInvoicesPage } = await import('../features/supplier-invoices/pages/SupplierInvoicesPage')
              return { Component: SupplierInvoicesPage }
            },
          },
          {
            path: '/supplier-invoices/:id',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { SupplierInvoiceDetailPage } = await import('../features/supplier-invoices/pages/SupplierInvoiceDetailPage')
              return { Component: SupplierInvoiceDetailPage }
            },
          },
          {
            path: '/products',
            lazy: async () => ({ Component: (await import('../features/products/pages/ProductsPage')).ProductsPage }),
          },
          {
            path: '/products/:id',
            lazy: async () => ({ Component: (await import('../features/products/pages/ProductDetailPage')).ProductDetailPage }),
          },
          {
            path: '/inventory',
            lazy: async () => ({ Component: (await import('../features/inventory/pages/InventoryDashboardPage')).InventoryDashboardPage }),
          },
          {
            path: '/inventory/movements',
            lazy: async () => ({ Component: (await import('../features/inventory/pages/StockMovementsPage')).StockMovementsPage }),
          },
          {
            path: '/inventory/transfers',
            lazy: async () => ({ Component: (await import('../features/inventory/pages/StockTransfersPage')).StockTransfersPage }),
          },
          {
            path: '/warehouses',
            lazy: async () => ({ Component: (await import('../features/warehouses/pages/WarehousesPage')).WarehousesPage }),
          },
          {
            path: '/warehouses/:id',
            lazy: async () => ({ Component: (await import('../features/warehouses/pages/WarehouseDetailPage')).WarehouseDetailPage }),
          },
          {
            path: '/expenses',
            lazy: async () => ({ Component: (await import('../features/expenses/pages/ExpensesPage')).ExpensesPage }),
          },
          {
            path: '/finance/cash-flow',
            lazy: async () => ({ Component: (await import('../features/finance/pages/CashFlowPage')).CashFlowPage }),
          },
          {
            path: '/reports',
            lazy: async () => ({ Component: (await import('../features/reports/pages/ReportsLibraryPage')).ReportsLibraryPage }),
          },
          {
            path: '/payments',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { PaymentsPage } = await import('../features/payments/pages/PaymentsPage')
              return { Component: PaymentsPage }
            },
          },
          {
            path: '/suppliers',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { SuppliersPage } = await import('../features/suppliers/pages/SuppliersPage')
              return { Component: SuppliersPage }
            },
          },
          {
            path: '/suppliers/:id',
            lazy: async () => {
              const { SupplierDetailPage } = await import('../features/suppliers/pages/SupplierDetailPage')
              return { Component: SupplierDetailPage }
            },
          },
          {
            path: '/invoices',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { InvoicesPage } = await import('../features/invoices/pages/InvoicesPage')
              return { Component: InvoicesPage }
            },
          },
          {
            path: '/invoices/new',
            lazy: async () => {
              const { InvoiceDetailPage } = await import('../features/invoices/pages/InvoiceDetailPage')
              return { Component: InvoiceDetailPage }
            },
          },
          {
            path: '/invoices/:id',
            lazy: async () => {
              const { InvoiceDetailPage } = await import('../features/invoices/pages/InvoiceDetailPage')
              return { Component: InvoiceDetailPage }
            },
          },
          {
            path: '/sales',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { SalesOrdersPage } = await import('../features/sales/pages/SalesOrdersPage')
              return { Component: SalesOrdersPage }
            },
          },
          {
            path: '/sales/:id',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { SalesOrderDetailPage } = await import('../features/sales/pages/SalesOrderDetailPage')
              return { Component: SalesOrderDetailPage }
            },
          },
          {
            path: '/quotes',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { QuotesPage } = await import('../features/quotes/pages/QuotesPage')
              return { Component: QuotesPage }
            },
          },
          {
            path: '/quotes/new',
            lazy: async () => {
              const { QuoteEditorPage } = await import('../features/quotes/pages/QuoteEditorPage')
              return { Component: QuoteEditorPage }
            },
          },
          {
            path: '/quotes/:id',
            lazy: async () => {
              const { QuoteEditorPage } = await import('../features/quotes/pages/QuoteEditorPage')
              return { Component: QuoteEditorPage }
            },
          },
          {
            path: '/customers',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { CustomersPage } = await import(
                '../features/customers/pages/CustomersPage'
              )
              return { Component: CustomersPage }
            },
          },
          {
            path: '/customers/:id',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { CustomerDetailPage } = await import(
                '../features/customers/pages/CustomerDetailPage'
              )
              return { Component: CustomerDetailPage }
            },
          },
          {
            path: '/dashboard',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { DashboardPage } = await import(
                '../features/dashboard/pages/DashboardPage'
              )
              return { Component: DashboardPage }
            },
          },
          {
            path: '/ai/control-center',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { AIControlCenterPage } = await import(
                '../features/ai-control-center/pages/AIControlCenterPage'
              )
              return { Component: AIControlCenterPage }
            },
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])
