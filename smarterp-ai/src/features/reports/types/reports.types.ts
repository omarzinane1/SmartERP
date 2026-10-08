export type ReportFormat = 'csv' | 'pdf' | 'xlsx'
export interface ReportDefinition { id: string; name: string; category: string; description: string; formats: ReportFormat[]; supportsPeriod: boolean; path: string | null; canOpen: boolean; lastGenerated: string | null; generatedBy: string | null }
export interface ReportsCatalog { reports: ReportDefinition[]; permissions: string[]; asOf: string }
export interface ReportInput { reportId: string; dateFrom: string; dateTo: string; filter: string; format: ReportFormat }
export interface GeneratedReport { id: string; reportId: string; name: string; createdAt: string; generatedBy: string; format: ReportFormat; status: 'ready' | 'pending' | 'processing' | 'failed'; filename: string; downloadUrl: string | null; rows?: (string | number)[][]; dateFrom: string; dateTo: string; jobId?: number; errorMessage?: string | null }
