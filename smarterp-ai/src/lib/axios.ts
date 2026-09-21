import axios from 'axios'
import { env } from '../config/env'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withXSRFToken: (config) => {
    if (typeof window === 'undefined') return false

    const apiOrigin = new URL(env.apiBaseUrl, window.location.origin).origin
    const requestOrigin = new URL(config.url ?? '', window.location.origin).origin

    // Allow Django's CSRF header only for the configured API origin.
    return requestOrigin === apiOrigin
  },
})
