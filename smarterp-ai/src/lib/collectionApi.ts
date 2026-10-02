import { apiClient } from './axios'

/** Existing screens filter complete collections locally; the API bounds each page. */
export async function getCollection<T, K extends keyof T>(path: string, key: K, signal?: AbortSignal): Promise<T> {
  const first = (await apiClient.get<T & { next?: string | null }>(path, { signal })).data
  if (!Array.isArray(first[key])) throw new Error('Réponse de collection invalide.')
  const rows: unknown[] = [...first[key]]
  let next = first.next
  let page = 1
  while (next) {
    const result = (await apiClient.get<T & { next?: string | null }>(path, { signal, params: { page: ++page } })).data
    if (!Array.isArray(result[key])) throw new Error('Réponse de collection invalide.')
    rows.push(...result[key])
    next = result.next
  }
  return { ...first, [key]: rows }
}
