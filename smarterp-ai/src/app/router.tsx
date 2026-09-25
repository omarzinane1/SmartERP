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
              const { SupplierPlaceholderPage } = await import('../features/suppliers/pages/SuppliersPage')
              return { Component: SupplierPlaceholderPage }
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
