import { isAxiosError } from 'axios'
import { apiClient } from './axios'

// Keep the identity after an ambiguous network/server failure. A retry of the
// same operation within this session cannot record another financial document.
const pending = new Map<string, string>()
export async function postIdempotent<T>(scope: string, path: string, body: unknown = {}): Promise<T> {
  const identity = JSON.stringify([scope, path, body])
  const key = pending.get(identity) ?? crypto.randomUUID()
  pending.set(identity, key)
  try {
    const { data } = await apiClient.post<T>(path, body, { headers: { 'Idempotency-Key': key } })
    pending.delete(identity)
    return data
  } catch (error) {
    if (isAxiosError(error) && error.response && error.response.status < 500) pending.delete(identity)
    throw error
  }
}
