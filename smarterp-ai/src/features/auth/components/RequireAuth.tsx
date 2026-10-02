import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RouteLoading } from '../../../components/layout/RouteLoading'
import { restoreSession } from '../api/auth.api'
import { useAuthStore } from '../../../store/auth.store'

export function RequireAuth() {
  const status = useAuthStore((state) => state.status)
  const company = useAuthStore((state) => state.company)
  const { pathname } = useLocation()
  if (status === 'idle' || status === 'loading') return <RouteLoading />
  if (status === 'error') return <main className="grid min-h-svh place-content-center gap-4 text-center"><p role="alert">Impossible de restaurer votre session. Vérifiez votre connexion.</p><button onClick={() => void restoreSession()}>Réessayer</button></main>
  if (status !== 'authenticated') return <Navigate to="/login" replace />
  if (!company?.onboardingCompleted && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  if (company?.onboardingCompleted && pathname === '/onboarding') return <Navigate to="/dashboard" replace />
  return <Outlet />
}
