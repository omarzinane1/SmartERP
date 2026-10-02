import axios, { type InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { env } from '../config/env'
import { useAuthStore } from '../store/auth.store'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
  // Explicit token fetch works across localhost ports in Chrome and Edge.
  withXSRFToken: false,
})

let csrfRequest: Promise<string> | null = null
const requestRevisions = new WeakMap<InternalAxiosRequestConfig, number>()

export function ensureCsrfToken(): Promise<string> {
  if (!csrfRequest) {
    csrfRequest = apiClient.get<{ csrfToken: string }>('/auth/csrf/').then(({ data }) => {
      if (typeof data.csrfToken !== 'string' || !data.csrfToken) throw new Error('Jeton CSRF indisponible.')
      return data.csrfToken
    }).finally(() => { csrfRequest = null })
  }
  return csrfRequest
}

apiClient.interceptors.request.use(async (config) => {
  requestRevisions.set(config, useAuthStore.getState().revision)
  if (['get', 'head', 'options'].includes(config.method?.toLowerCase() ?? 'get')) return config
  const origin = window.location.origin
  const apiOrigin = new URL(env.apiBaseUrl, origin).origin
  const requestOrigin = new URL(apiClient.getUri(config), origin).origin
  if (requestOrigin === apiOrigin) config.headers.set('X-CSRFToken', await ensureCsrfToken())
  return config
})

apiClient.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 &&
      !/\/auth\/(login|session|csrf|logout)\//.test(error.config?.url ?? '') &&
      error.config && requestRevisions.get(error.config) === useAuthStore.getState().revision &&
      useAuthStore.getState().isAuthenticated) {
    useAuthStore.getState().clearAuth()
    toast.error('Votre session a expiré. Veuillez vous reconnecter.')
  }
  return Promise.reject(error)
})
