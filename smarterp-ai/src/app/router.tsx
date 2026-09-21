import { createBrowserRouter, Navigate } from 'react-router-dom'
import { FeaturePlaceholder } from '../components/layout/FeaturePlaceholder'
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
          const { OnboardingPage } = await import('../features/onboarding/pages/OnboardingPage')
          return { Component: OnboardingPage }
        },
      },
      {
        element: <AppShell />,
        children: [
          {
            path: '/dashboard',
            HydrateFallback: RouteLoading,
            lazy: async () => {
              const { DashboardPage } = await import('../features/dashboard/pages/DashboardPage')
              return { Component: DashboardPage }
            },
          },
          { path: '/ai/control-center', element: <FeaturePlaceholder title="AI Control Center" /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])
