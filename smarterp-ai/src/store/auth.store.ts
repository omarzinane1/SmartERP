import { create } from 'zustand'
import { clearAuthSensitiveCache } from '../app/authCache'
import type { AuthUser, Company, LoginResponse } from '../features/auth/types/auth.types'

interface AuthState {
  user: AuthUser | null
  company: Company | null
  isAuthenticated: boolean
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error'
  revision: number
  setAuth: (auth: LoginResponse) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  company: null,
  isAuthenticated: false,
  status: 'idle',
  revision: 0,
  setAuth: ({ user, company }) => {
    const previous = get()
    if (previous.user?.id !== user.id || previous.company?.id !== company?.id ||
        previous.company?.onboardingCompleted !== company?.onboardingCompleted ||
        JSON.stringify(previous.company?.enabledModules) !== JSON.stringify(company?.enabledModules) ||
        JSON.stringify(previous.user?.permissions) !== JSON.stringify(user.permissions)) clearAuthSensitiveCache()
    set({ user, company, isAuthenticated: true, status: 'authenticated', revision: previous.revision + 1 })
  },
  clearAuth: () => {
    clearAuthSensitiveCache()
    set({ user: null, company: null, isAuthenticated: false, status: 'unauthenticated', revision: get().revision + 1 })
  },
}))
