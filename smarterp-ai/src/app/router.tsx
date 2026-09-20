import { createBrowserRouter, Navigate } from 'react-router-dom'
import { FeaturePlaceholder } from '../components/layout/FeaturePlaceholder'
import { RouteLoading } from '../components/layout/RouteLoading'
import { RequireAuth } from '../features/auth/components/RequireAuth'

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
      { path: '/onboarding', element: <FeaturePlaceholder title="Configuration de la société" /> },
      { path: '/dashboard', element: <FeaturePlaceholder title="Executive Dashboard" /> },
      { path: '/ai/control-center', element: <FeaturePlaceholder title="AI Control Center" /> },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])
