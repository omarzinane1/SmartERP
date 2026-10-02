import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { logout } from '../api/auth.api'
import { useAuthStore } from '../../../store/auth.store'

let pendingLogout: Promise<void> | null = null

export function useLogout() {
  const navigate = useNavigate()
  const [isPending, setPending] = useState(false)
  async function signOut() {
    if (pendingLogout) return
    setPending(true)
    // Hide private data and discard in-flight query results immediately.
    useAuthStore.getState().clearAuth()
    useAuthStore.setState({ status: 'loading' })
    const request = logout()
    pendingLogout = request
    try {
      await request
    } catch {
      toast.error('Les données locales ont été effacées, mais la déconnexion serveur a échoué. Réessayez avant de quitter cet appareil.', { duration: 10000, action: { label: 'Réessayer', onClick: () => void signOut() } })
    } finally {
      pendingLogout = null
      useAuthStore.getState().clearAuth()
      setPending(false)
      void navigate('/login', { replace: true })
    }
  }
  return { signOut, isPending }
}
