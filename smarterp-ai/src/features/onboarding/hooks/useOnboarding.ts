import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { saveOnboarding } from '../api/onboarding.api'
import { useAuthStore } from '../../../store/auth.store'

export function useOnboarding() {
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: saveOnboarding,
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    onSuccess: (_response, values) => {
      const { user, company, setAuth } = useAuthStore.getState()
      if (user && company)
        setAuth({
          user,
          company: {
            ...company,
            name: values.company.name,
            onboardingCompleted: true,
          },
        })
      toast.success('Votre société est prête.', { description: 'Enregistré' })
      void navigate('/dashboard', { replace: true })
    },
  })

  return {
    ...mutation,
    errorMessage: mutation.isError
      ? 'Impossible d’enregistrer la configuration. Veuillez réessayer.'
      : null,
  }
}
