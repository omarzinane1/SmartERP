import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { stockDemoDate } from '../../products/data/products.mock'
import { generateReportMock, recentReportsMock, reportCatalogMock } from '../data/reports.mock'
import type { GeneratedReport, ReportInput, ReportsCatalog } from '../types/reports.types'
import { analyticsReportMock, reportAnalysisMock } from '../data/analytics.mock'
import type { AnalyticsReport, ReportAnalysis, ReportParams, ReportType } from '../types/analytics.types'
export const getReportsCatalog = async (scope: string, signal?: AbortSignal): Promise<ReportsCatalog> => env.reportsUseMock ? { reports: reportCatalogMock(scope), permissions: ['reports.view', 'reports.generate'], asOf: stockDemoDate } : (await apiClient.get('/reports/catalog/', { signal })).data
export const getRecentReports = async (scope: string, signal?: AbortSignal): Promise<GeneratedReport[]> => env.reportsUseMock ? recentReportsMock(scope) : (await apiClient.get('/reports/recent/', { signal })).data
export const generateReport = async (scope: string, v: ReportInput): Promise<GeneratedReport> => env.reportsUseMock ? generateReportMock(scope, v) : (await apiClient.post('/reports/generate/', { report_id: v.reportId, date_from: v.dateFrom, date_to: v.dateTo, filter: v.filter, format: v.format })).data
const analyticsParams = (v: ReportParams) => ({ date_from: v.dateFrom, date_to: v.dateTo, partner: v.partner || undefined, owner: v.owner || undefined, category: v.category || undefined, warehouse: v.warehouse || undefined })
export const getReport = async (scope: string, type: ReportType, params: ReportParams, signal?: AbortSignal): Promise<AnalyticsReport> => env.reportsUseMock ? analyticsReportMock(scope, type, params) : (await apiClient.get(`/reports/${type}/`, { params: analyticsParams(params), signal })).data
export const generateReportAIAnalysis = async (scope: string, type: ReportType, params: ReportParams): Promise<ReportAnalysis> => env.reportsUseMock ? reportAnalysisMock(scope, type, params) : (await apiClient.post(`/reports/${type}/ai-analysis/`, analyticsParams(params))).data
export async function exportReport(scope: string, type: ReportType, params: ReportParams, format: 'csv' | 'pdf' | 'xlsx'): Promise<{ rows?: (string | number)[][]; blob?: Blob; filename: string }> {
  if (env.reportsUseMock) { if (format !== 'csv') throw new Error('Format indisponible.'); const r = analyticsReportMock(scope, type, params); return { filename: `${type}-${params.dateFrom}-${params.dateTo}.csv`, rows: [['Référence', 'Libellé', 'Date', r.amountLabel, r.quantityLabel, 'Groupe'], ...r.rows.map((row) => [row.reference, row.name, row.date, row.amount, row.quantity ?? '', row.group])] } }
  return { blob: (await apiClient.get(`/reports/${type}/export/`, { params: { ...analyticsParams(params), format }, responseType: 'blob' })).data, filename: `${type}.${format}` }
}
