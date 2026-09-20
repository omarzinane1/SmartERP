export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: number
  name: string
  email: string
  role: string
}

export interface Company {
  id: number
  name: string
  onboardingCompleted: boolean
}

export interface LoginResponse {
  user: AuthUser
  company: Company | null
}
