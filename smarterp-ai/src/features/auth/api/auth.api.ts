import { isAxiosError } from 'axios'
import { z } from 'zod'
import { apiClient } from '../../../lib/axios'
import { useAuthStore } from '../../../store/auth.store'
import type { LoginCredentials, LoginResponse } from '../types/auth.types'

const authResponseSchema = z.object({
  user: z.object({
    id: z.number().int().positive(), name: z.string(), email: z.email(),
    role: z.string(), permissions: z.array(z.string()).optional(),
  }),
  company: z.object({
    id: z.number().int().positive(), name: z.string(),
    onboarding_completed: z.boolean(), enabled_modules: z.array(z.string()).optional(),
  }).nullable(),
})

export function parseAuthResponse(data: unknown): LoginResponse {
  const response = authResponseSchema.parse(data)
  return {
    user: response.user,
    company: response.company ? {
      id: response.company.id, name: response.company.name,
      onboardingCompleted: response.company.onboarding_completed,
      enabledModules: response.company.enabled_modules,
    } : null,
  }
}

export function getAuthErrorMessage(error: unknown): string {
  if (isAxiosError<{ code?: string }>(error)) {
    const code = error.response?.data?.code
    if (code === 'account_disabled' || code === 'disabled_account') return 'Votre compte a été désactivé. Contactez votre administrateur.'
    if (error.response?.status === 401) return 'Adresse e-mail ou mot de passe incorrect.'
    if (error.response?.status === 403) return "Votre compte n'est pas autorisé à accéder à SmartERP AI."
    if (!error.response) return 'Impossible de contacter le serveur. Vérifiez votre connexion.'
  }
  return 'Une erreur est survenue. Veuillez réessayer.'
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  try {
    const { data } = await apiClient.post<unknown>('/auth/login/', {
      email: credentials.email, password: credentials.password,
    })
    return parseAuthResponse(data)
  } catch (error: unknown) {
    // eslint-disable-next-line preserve-caught-error -- Axios configs may contain the password.
    throw new Error(getAuthErrorMessage(error))
  }
}

export async function getSession(): Promise<LoginResponse> {
  return parseAuthResponse((await apiClient.get<unknown>('/auth/session/')).data)
}

let restoring: Promise<void> | null = null

export function restoreSession(): Promise<void> {
  if (restoring) return restoring
  const revision = useAuthStore.getState().revision
  useAuthStore.setState({ status: 'loading' })
  restoring = getSession().then((auth) => {
    if (useAuthStore.getState().revision === revision) useAuthStore.getState().setAuth(auth)
  }).catch((error: unknown) => {
    if (useAuthStore.getState().revision !== revision) return
    if (isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
      useAuthStore.getState().clearAuth()
    } else {
      useAuthStore.getState().clearAuth()
      useAuthStore.setState({ status: 'error' })
    }
  }).finally(() => { restoring = null })
  return restoring
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout/')
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.status === 401) return
    throw error
  }
}
