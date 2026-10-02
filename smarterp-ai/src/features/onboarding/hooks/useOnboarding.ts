import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { saveOnboarding } from '../api/onboarding.api'
import { useAuthStore } from '../../../store/auth.store'
import { clearAuthSensitiveCache } from '../../../app/authCache'
import type { OnboardingData } from '../types/onboarding.types'

function validationMessages(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return [path ? `${path} : ${value}` : value]
  if (Array.isArray(value)) return value.flatMap((entry) => validationMessages(entry, path))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, entry]) => validationMessages(entry, path ? `${path}.${key}` : key))
  return []
}

export function useOnboarding() {
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: async (values: OnboardingData) => {
      const revision = useAuthStore.getState().revision
      return { response: await saveOnboarding(values), revision }
    },
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    onSuccess: ({ response, revision }) => {
      if (useAuthStore.getState().revision !== revision) return
      clearAuthSensitiveCache()
      useAuthStore.getState().setAuth(response)
      toast.success('Votre société est prête.', { description: 'Enregistré' })
      void navigate('/dashboard', { replace: true })
    },
  })
  let errorMessage: string | null = null
  if (mutation.isError) {
    errorMessage = 'Impossible d’enregistrer la configuration. Veuillez réessayer.'
    if (isAxiosError(mutation.error)) {
      if (mutation.error.response?.status === 400) errorMessage = validationMessages(mutation.error.response.data).join(' · ') || errorMessage
      if (mutation.error.response?.status === 409) errorMessage = 'Cette société est déjà configurée. Rechargez la page pour actualiser votre session.'
      if (mutation.error.response?.status === 403) errorMessage = 'Votre session ne permet pas de configurer cette société.'
    }
  }
  return { ...mutation, errorMessage }
}
