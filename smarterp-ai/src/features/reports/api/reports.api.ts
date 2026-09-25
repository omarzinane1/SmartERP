import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { stockDemoDate } from '../../products/data/products.mock'
import { generateReportMock, recentReportsMock, reportCatalogMock } from '../data/reports.mock'
import type { GeneratedReport, ReportInput, ReportsCatalog } from '../types/reports.types'
export const getReportsCatalog = async (scope: string, signal?: AbortSignal): Promise<ReportsCatalog> => env.reportsUseMock ? { reports: reportCatalogMock(scope), permissions: ['reports.view', 'reports.generate'], asOf: stockDemoDate } : (await apiClient.get('/reports/catalog/', { signal })).data
export const getRecentReports = async (scope: string, signal?: AbortSignal): Promise<GeneratedReport[]> => env.reportsUseMock ? recentReportsMock(scope) : (await apiClient.get('/reports/recent/', { signal })).data
export const generateReport = async (scope: string, v: ReportInput): Promise<GeneratedReport> => env.reportsUseMock ? generateReportMock(scope, v) : (await apiClient.post('/reports/generate/', { report_id: v.reportId, date_from: v.dateFrom, date_to: v.dateTo, filter: v.filter, format: v.format })).data
