import { isAxiosError } from 'axios'
import { z } from 'zod'
import { apiClient } from '../../../lib/axios'
import type { LoginCredentials, LoginResponse } from '../types/auth.types'

const loginResponseSchema = z.object({
  user: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    email: z.string().email(),
    role: z.string(),
    permissions: z.array(z.string()).optional(),
  }),
  company: z
    .object({
      id: z.number().int().positive(),
      name: z.string(),
      onboarding_completed: z.boolean(),
      enabled_modules: z.array(z.string()).optional(),
    })
    .nullable(),
})

const apiErrorSchema = z.object({ code: z.string().optional() })

export function getAuthErrorMessage(error: unknown): string {
  if (isAxiosError<unknown>(error)) {
    const errorBody = apiErrorSchema.safeParse(error.response?.data)
    const code = errorBody.success ? errorBody.data.code : undefined

    if (code === 'account_disabled' || code === 'disabled_account') {
      return 'Votre compte a été désactivé. Contactez votre administrateur.'
    }

    if (error.response?.status === 401) {
      return 'Adresse e-mail ou mot de passe incorrect.'
    }

    if (error.response?.status === 403) {
      return "Votre compte n'est pas autorisé à accéder à SmartERP AI."
    }

    if (!error.response) {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion.'
    }
  }

  return 'Une erreur est survenue. Veuillez réessayer.'
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  try {
    const { data } = await apiClient.post<unknown>('/auth/login/', {
      email: credentials.email,
      password: credentials.password,
    })
    const response = loginResponseSchema.parse(data)

    // Keep the Django response format at this boundary, away from the UI.
    return {
      user: response.user,
      company: response.company
        ? {
            id: response.company.id,
            name: response.company.name,
            onboardingCompleted: response.company.onboarding_completed,
            enabledModules: response.company.enabled_modules,
          }
        : null,
    }
  } catch (error: unknown) {
    // eslint-disable-next-line preserve-caught-error -- Axios causes can include the submitted password.
    throw new Error(getAuthErrorMessage(error))
  }
}
