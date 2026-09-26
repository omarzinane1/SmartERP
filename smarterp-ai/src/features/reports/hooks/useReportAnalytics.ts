import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { exportReport, generateReportAIAnalysis, getReport } from '../api/reports.api'
import type { ReportParams, ReportType } from '../types/analytics.types'
export function useReportAnalytics(type: ReportType, params: ReportParams, valid: boolean) {
  const { scope, key } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('report-analytics'), env.reportsUseMock, type, params], enabled: valid, queryFn: ({ signal }) => getReport(scope, type, params, signal) })
  const insight = useMutation({ ...options, mutationFn: () => generateReportAIAnalysis(scope, type, params) })
  const download = useMutation({ ...options, mutationFn: (format: 'csv' | 'pdf' | 'xlsx') => exportReport(scope, type, params, format) })
  return { ...query, insight, download, isDemo: env.reportsUseMock }
}
