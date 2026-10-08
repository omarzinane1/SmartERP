import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { postIdempotent } from '../../../lib/idempotentApi'
import { stockDemoDate } from '../../products/data/products.mock'
import { generateReportMock, recentReportsMock, reportCatalogMock } from '../data/reports.mock'
import type { GeneratedReport, ReportInput, ReportsCatalog } from '../types/reports.types'
import { analyticsReportMock, reportAnalysisMock } from '../data/analytics.mock'
import type { AnalyticsReport, ReportAnalysis, ReportParams, ReportType } from '../types/analytics.types'
export const getReportsCatalog = async (scope: string, signal?: AbortSignal): Promise<ReportsCatalog> => env.reportsUseMock ? { reports: reportCatalogMock(scope), permissions: ['reports.view', 'reports.generate'], asOf: stockDemoDate } : (await apiClient.get('/reports/catalog/', { signal })).data
interface AsyncJob { id: number; status: 'pending' | 'processing' | 'completed' | 'failed'; entity: string; format: GeneratedReport['format']; filename: string | null; created_at: string; download_url: string | null; error_message: string | null; parameters: { date_from?: string; date_to?: string } }
function fromJob(job: AsyncJob): GeneratedReport {
  return { id: `job-${job.id}`, jobId: job.id, reportId: job.entity, name: job.filename ?? job.entity, createdAt: job.created_at, generatedBy: 'Vous', format: job.format,
    status: job.status === 'completed' ? 'ready' : job.status, filename: job.filename ?? `${job.entity}.${job.format}`, downloadUrl: job.download_url, errorMessage: job.error_message,
    dateFrom: job.parameters.date_from ?? '', dateTo: job.parameters.date_to ?? '' }
}
export async function getRecentReports(scope: string, signal?: AbortSignal): Promise<GeneratedReport[]> {
  if (env.reportsUseMock) return recentReportsMock(scope)
  const [legacy, jobs] = await Promise.all([apiClient.get<GeneratedReport[]>('/reports/recent/', { signal }), apiClient.get<{ jobs: AsyncJob[] }>('/jobs/', { signal })])
  return [...jobs.data.jobs.map(fromJob), ...legacy.data.map((r) => ({ ...r, id: `legacy-${r.id}` }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
}
export const generateReport = async (scope: string, v: ReportInput): Promise<GeneratedReport> => env.reportsUseMock ? generateReportMock(scope, v) : fromJob(await postIdempotent<AsyncJob>(scope, '/reports/export/', { report_id: v.reportId, ...(v.reportId === 'inventory' ? {} : { date_from: v.dateFrom, date_to: v.dateTo }), filter: v.filter, format: v.format }))
export const retryReport = async (jobId: number): Promise<GeneratedReport> => fromJob((await apiClient.post<AsyncJob>(`/jobs/${jobId}/retry/`, {})).data)
export async function downloadAsyncReport(jobId: number): Promise<Blob> {
  return (await apiClient.get(`/jobs/${jobId}/download/`, { responseType: 'blob' })).data
}
const analyticsParams = (v: ReportParams) => ({ date_from: v.dateFrom, date_to: v.dateTo, page: v.page, page_size: v.pageSize, ordering: v.ordering, partner: v.partner || undefined, owner: v.owner || undefined, category: v.category || undefined, warehouse: v.warehouse || undefined })
export const getReport = async (scope: string, type: ReportType, params: ReportParams, signal?: AbortSignal): Promise<AnalyticsReport> => env.reportsUseMock ? analyticsReportMock(scope, type, params) : (await apiClient.get(`/reports/${type}/`, { params: analyticsParams(params), signal })).data
export const generateReportAIAnalysis = async (scope: string, type: ReportType, params: ReportParams): Promise<ReportAnalysis> => env.reportsUseMock ? reportAnalysisMock(scope, type, params) : (await apiClient.post(`/reports/${type}/ai-analysis/`, analyticsParams(params))).data
export async function exportReport(scope: string, type: ReportType, params: ReportParams, format: 'csv' | 'pdf' | 'xlsx'): Promise<{ rows?: (string | number)[][]; blob?: Blob; filename: string }> {
  if (env.reportsUseMock) { if (format !== 'csv') throw new Error('Format indisponible.'); const r = analyticsReportMock(scope, type, params); return { filename: `${type}-${params.dateFrom}-${params.dateTo}.csv`, rows: [['Référence', 'Libellé', 'Date', r.amountLabel, r.quantityLabel, 'Groupe'], ...r.rows.map((row) => [row.reference, row.name, row.date, row.amount, row.quantity ?? '', row.group])] } }
  return { blob: (await apiClient.get(`/reports/${type}/export/`, { params: { ...analyticsParams(params), format }, responseType: 'blob' })).data, filename: `${type}.${format}` }
}
