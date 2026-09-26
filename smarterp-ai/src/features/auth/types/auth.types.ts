export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: number
  name: string
  email: string
  role: string
  permissions?: string[]
  preferences?: { theme: 'system' | 'light' | 'dark'; language?: string; timezone?: string; dateFormat?: string; numberFormat?: string }
}

export interface Company {
  id: number
  name: string
  onboardingCompleted: boolean
  enabledModules?: string[]
}

export interface LoginResponse {
  user: AuthUser
  company: Company | null
}
