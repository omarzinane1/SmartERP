export const settingSections = ['general', 'company', 'branches', 'finance', 'taxes', 'invoices', 'sales', 'purchasing', 'inventory', 'documents', 'users', 'notifications', 'security', 'ai', 'integrations'] as const
export type SettingsSection = typeof settingSections[number]
export const sectionLabels: Record<SettingsSection, string> = { general: 'Général', company: 'Société', branches: 'Branches', finance: 'Finance', taxes: 'Taxes', invoices: 'Facturation', sales: 'Ventes', purchasing: 'Achats', inventory: 'Stock', documents: 'Documents', users: 'Utilisateurs', notifications: 'Notifications', security: 'Sécurité', ai: 'IA', integrations: 'Intégrations' }
export interface GeneralSettings { language: string; timezone: string; dateFormat: string; currency: string; numberFormat: string }
export interface CompanySettings { companyName: string; legalName: string; taxId: string; email: string; phone: string; address: string; city: string; country: string; logoUrl: string | null }
export interface BranchSettings { activeBranches: { id: string; name: string }[]; defaultBranch: string }
export interface FinanceSettings { currency: string; fiscalYearStart: string; defaultAccount: string; paymentTerms: string; rounding: string }
export interface TaxSettings { activeTaxes: string[]; vatRate: number; inclusive: boolean; rounding: string }
export interface InvoiceSettings { prefix: string; numbering: string; paymentTerms: string; defaultDueDays: number; notes: string; sendEmail: boolean }
export interface SalesSettings { quotePrefix: string; orderPrefix: string; quoteValidityDays: number; reserveStock: boolean; requireApproval: boolean }
export interface PurchasingSettings { prefix: string; approvalThreshold: number; defaultWarehouse: string; defaultTax: string }
export interface InventorySettings { allowNegative: boolean; valuationMethod: string; minimumStock: number; unit: string; alerts: boolean }
export interface DocumentSettings { allowedFormats: string[]; maxSizeMB: number; autoIndex: boolean; retentionDays: number; ragEnabled: boolean }
export interface UserSettings { allowInvitations: boolean; defaultRole: string; sessionTimeoutMinutes: number; passwordPolicySummary: string }
export interface NotificationSettings { email: boolean; inApp: boolean; stockAlerts: boolean; invoiceOverdue: boolean; approvals: boolean; aiAlerts: boolean }
export interface SecuritySettings { require2FA: boolean; sessionMinutes: number; passwordPolicy: string; sensitiveApproval: boolean; auditRetentionDays: number }
export interface AISettings { allowAnalysis: boolean; allowDocumentRag: boolean; allowForecasting: boolean; allowRecommendations: boolean; requireSensitiveApproval: boolean }
export interface Integration { id: string; name: string; status: 'connected' | 'not_connected' | 'error'; configured: boolean; canTest: boolean; detail: string }
export interface SettingsValues { general: GeneralSettings; company: CompanySettings; branches: BranchSettings; finance: FinanceSettings; taxes: TaxSettings; invoices: InvoiceSettings; sales: SalesSettings; purchasing: PurchasingSettings; inventory: InventorySettings; documents: DocumentSettings; users: UserSettings; notifications: NotificationSettings; security: SecuritySettings; ai: AISettings; integrations: { items: Integration[] } }
export type EditableSettingsSection = Exclude<SettingsSection, 'integrations'>
export type SettingsPayload = { [S in EditableSettingsSection]: { section: S; values: SettingsValues[S] } }[EditableSettingsSection]
export interface SettingsPolicy { canView: boolean; canManage: boolean; lockedFields: string[]; explanation: string | null }
export interface SettingsData { values: SettingsValues; policies: Record<SettingsSection, SettingsPolicy>; permissions: string[]; asOf: string; options: { languages: string[]; timezones: string[]; dateFormats: string[]; currencies: string[]; numberFormats: string[]; rounding: string[]; valuationMethods: string[]; units: string[]; accounts: string[]; warehouses: { id: string; name: string }[]; taxes: { id: string; name: string }[]; roles: { id: string; name: string }[]; passwordPolicies: string[] }; version: number }
export interface AIStatus { status: 'online' | 'offline' | 'error' | 'disabled'; provider: string | null; model: string | null; ragEnabled: boolean; embeddingsAvailable: boolean; checkedAt: string; simulated: boolean; detail: string }
export interface IntegrationTestResult { status: 'success' | 'failure' | 'incomplete'; message: string; checkedAt: string; simulated: boolean }
