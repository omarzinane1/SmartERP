const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const env = {
  apiBaseUrl: (apiBaseUrl || 'http://localhost:8000/api').replace(/\/+$/, ''),
} as const
