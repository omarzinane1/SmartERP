import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import * as api from '../api/profile.api'
import type { PasswordInput, ProfileUpdate, TwoFactorInput } from '../types/profile.types'
export function useUserProfile() {
  const { scope, key, invalidate } = useBusinessScope(), user = useAuthStore((s) => s.user)
  const query = useQuery({ ...options, queryKey: [...key('me'), env.profileUseMock], enabled: !!user, queryFn: ({ signal }) => api.getMe(scope, user!, signal) })
  const update = useMutation({ ...options, mutationFn: (input: ProfileUpdate) => api.updateMe(scope, user!, input), onSuccess: async (profile) => { const auth = useAuthStore.getState(); if (auth.user?.id === profile.id) auth.setAuth({ user: { ...auth.user, name: profile.identity.displayName, email: profile.identity.email, preferences: profile.preferences }, company: auth.company }); await invalidate(['me']) } })
  const password = useMutation({ ...options, gcTime: 0, mutationFn: (input: PasswordInput) => api.changePassword(scope, user!, input), onSuccess: () => invalidate(['me']) })
  const twoFactor = useMutation({ ...options, gcTime: 0, mutationFn: (input: TwoFactorInput) => api.setup2FA(scope, user!, input), onSuccess: (result) => result.status !== 'setup' ? invalidate(['me']) : undefined })
  const revoke = useMutation({ ...options, mutationFn: (id: string) => api.deleteSession(scope, user!, id), onSuccess: () => invalidate(['me']) })
  return { ...query, update, password, twoFactor, revoke, isDemo: env.profileUseMock }
}
