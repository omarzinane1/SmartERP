import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth.store'
import { isAxiosError } from 'axios'
export const businessQueryOptions = { retry: false, networkMode: 'always' as const }
export class BusinessNotFoundError extends Error {}
export const isBusinessNotFound = (error: unknown) => error instanceof BusinessNotFoundError || isAxiosError(error) && error.response?.status === 404
export const isBusinessForbidden = (error: unknown) => isAxiosError(error) && error.response?.status === 403
export const isValidBusinessId = (id: string | undefined) => !!id && /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0
export function useBusinessScope() {
  const userId = useAuthStore((s) => s.user?.id), companyId = useAuthStore((s) => s.company?.id), client = useQueryClient()
  const scope = `${userId}:${companyId}`
  const key = (name: string) => [name, userId, companyId]
  const invalidate = (names: string[]) => Promise.all(names.map((name) => client.invalidateQueries({ queryKey: key(name) })))
  return { scope, key, invalidate }
}
