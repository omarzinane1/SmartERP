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
