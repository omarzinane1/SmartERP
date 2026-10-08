import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { generateReport, getRecentReports, getReportsCatalog, retryReport } from '../api/reports.api'
import type { ReportInput } from '../types/reports.types'
export function useReports() {
  const { scope, key, invalidate } = useBusinessScope()
  const catalog = useQuery({ ...options, queryKey: [...key('reports'), env.reportsUseMock], queryFn: ({ signal }) => getReportsCatalog(scope, signal) })
  const recent = useQuery({ ...options, queryKey: [...key('reports-recent'), env.reportsUseMock], enabled: catalog.data?.permissions.includes('reports.view') ?? false, queryFn: ({ signal }) => getRecentReports(scope, signal), refetchInterval: (query) => !query.state.error && query.state.data?.some((r) => r.status === 'pending' || r.status === 'processing') ? 3000 : false })
  const generate = useMutation({ ...options, mutationFn: (v: ReportInput) => generateReport(scope, v), onSuccess: () => invalidate(['reports', 'reports-recent']) })
  const retry = useMutation({ ...options, mutationFn: retryReport, onSuccess: () => invalidate(['reports-recent']) })
  return { catalog, recent, generate, retry, isDemo: env.reportsUseMock }
}
