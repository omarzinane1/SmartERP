import { useEffect, type PropsWithChildren } from 'react'
import { restoreSession } from '../api/auth.api'
import { useAuthStore } from '../../../store/auth.store'
import { RouteLoading } from '../../../components/layout/RouteLoading'

export function AuthBootstrap({ children }: PropsWithChildren) {
  const status = useAuthStore((state) => state.status)
  useEffect(() => {
    if (useAuthStore.getState().status === 'idle') void restoreSession()
  }, [])
  return status === 'idle' || status === 'loading' ? <RouteLoading /> : children
}
