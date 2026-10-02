import { queryClient } from './queryClient'

// All current application queries are private. Future public catalogs can opt out.
export function clearAuthSensitiveCache() {
  const filters = { predicate: (query: { meta?: Record<string, unknown> }) => query.meta?.public !== true }
  void queryClient.cancelQueries(filters)
  queryClient.removeQueries(filters)
  for (const mutation of queryClient.getMutationCache().getAll()) {
    if (mutation.meta?.public !== true) queryClient.getMutationCache().remove(mutation)
  }
}
