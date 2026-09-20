import { create } from 'zustand'
import type { AuthUser, Company, LoginResponse } from '../features/auth/types/auth.types'

interface AuthState {
  user: AuthUser | null
  company: Company | null
  isAuthenticated: boolean
  setAuth: (auth: LoginResponse) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  isAuthenticated: false,
  setAuth: ({ user, company }) => set({ user, company, isAuthenticated: true }),
  clearAuth: () => set({ user: null, company: null, isAuthenticated: false }),
}))
