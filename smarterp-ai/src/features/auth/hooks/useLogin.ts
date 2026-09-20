import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../../../store/auth.store'
import { login } from '../api/auth.api'
import type { Company, LoginCredentials, LoginResponse } from '../types/auth.types'

export function getPostLoginPath(company: Company | null): '/dashboard' | '/onboarding' {
  return company?.onboardingCompleted ? '/dashboard' : '/onboarding'
}

export function useLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation<LoginResponse, Error, LoginCredentials>({
    mutationFn: login,
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    onSuccess: (response) => {
      setAuth(response)
      toast.success('Connexion réussie')
      void navigate(getPostLoginPath(response.company), { replace: true })
    },
  })
}
