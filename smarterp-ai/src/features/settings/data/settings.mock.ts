import type { Company } from '../../auth/types/auth.types'
import { modulesSnapshot } from '../../modules/data/modules.mock'
import { rolesSnapshot } from '../../admin/data/admin.mock'
import { warehouseSnapshot } from '../../warehouses/data/warehouses.mock'
import { settingsSchema } from '../schemas/settings.schema'
import { saveAIPolicyMock } from './aiPolicy.mock'
import { settingSections, type AIStatus, type IntegrationTestResult, type SettingsData, type SettingsPayload } from '../types/settings.types'
const stores = new Map<string, SettingsData>()
export function settingsMock(scope: string, company: Company | null): SettingsData {
  if (!stores.has(scope)) stores.set(scope, {
    values: {
      general: { language: 'fr', timezone: 'Africa/Casablanca', dateFormat: 'DD/MM/YYYY', currency: 'MAD', numberFormat: 'fr-FR' },
      company: { companyName: company?.name ?? 'Atlas Distribution SARL', legalName: 'Atlas Distribution SARL', taxId: '', email: 'contact@atlas.example', phone: '', address: '', city: 'Casablanca', country: 'Maroc', logoUrl: null },
      branches: { activeBranches: [{ id: 'casa', name: 'Casablanca' }, { id: 'rabat', name: 'Rabat' }], defaultBranch: 'casa' },
      finance: { currency: 'MAD', fiscalYearStart: '2026-01-01', defaultAccount: 'Compte de trésorerie de démonstration', paymentTerms: '30 jours', rounding: 'half_up_2' },
      taxes: { activeTaxes: ['standard', 'zero'], vatRate: 20, inclusive: false, rounding: 'half_up_2' },
      invoices: { prefix: 'INV', numbering: 'INV-YYYY-NNNN', paymentTerms: '30 jours', defaultDueDays: 30, notes: '', sendEmail: false },
      sales: { quotePrefix: 'QUO', orderPrefix: 'SO', quoteValidityDays: 30, reserveStock: true, requireApproval: true },
      purchasing: { prefix: 'PO', approvalThreshold: 50000, defaultWarehouse: '1', defaultTax: 'standard' },
      inventory: { allowNegative: false, valuationMethod: 'average_cost', minimumStock: 10, unit: 'unit', alerts: true },
      documents: { allowedFormats: ['.pdf', '.txt'], maxSizeMB: 15, autoIndex: false, retentionDays: 365, ragEnabled: true },
      users: { allowInvitations: true, defaultRole: '8', sessionTimeoutMinutes: 60, passwordPolicySummary: 'Politique de démonstration : 12 caractères minimum. Validation définitive par Django.' },
      notifications: { email: false, inApp: true, stockAlerts: true, invoiceOverdue: true, approvals: true, aiAlerts: true },
      security: { require2FA: true, sessionMinutes: 60, passwordPolicy: 'company_policy', sensitiveApproval: true, auditRetentionDays: 365 },
      ai: { allowAnalysis: true, allowDocumentRag: true, allowForecasting: true, allowRecommendations: true, requireSensitiveApproval: true },
      integrations: { items: [{ id: 'email', name: 'Email société', status: 'not_connected', configured: false, canTest: true, detail: 'Service SMTP non configuré dans la démonstration.' }, { id: 'storage', name: 'Stockage documentaire', status: 'not_connected', configured: false, canTest: true, detail: 'Les documents de démonstration restent dans le navigateur.' }] },
    },
    policies: Object.fromEntries(settingSections.map((section) => [section, { canView: true, canManage: true, lockedFields: ({ security: ['require2FA', 'sensitiveApproval', 'auditRetentionDays'], ai: ['requireSensitiveApproval'], general: ['currency'], finance: ['currency', 'rounding'], inventory: ['allowNegative', 'valuationMethod'], documents: ['allowedFormats', 'maxSizeMB', 'ragEnabled', 'autoIndex'], users: ['passwordPolicySummary'], branches: ['activeBranches'], company: ['logoUrl'] } as Partial<Record<string, string[]>>)[section] ?? [], explanation: section === 'security' ? 'La double authentification, la validation sensible et la conservation des audits sont imposées par la politique société.' : null }])) as SettingsData['policies'],
    permissions: ['settings.view', 'settings.manage', 'users.manage'], asOf: '2026-09-30', version: 1,
    options: { languages: ['fr', 'en', 'ar'], timezones: ['Africa/Casablanca', 'Europe/Paris', 'UTC'], dateFormats: ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'], currencies: ['MAD', 'EUR', 'USD'], numberFormats: ['fr-FR', 'en-US', 'ar-MA'], rounding: ['half_up_2', 'half_even_2'], valuationMethods: ['average_cost', 'fifo'], units: ['unit', 'kg', 'm'], accounts: ['Compte de trésorerie de démonstration'], warehouses: warehouseSnapshot(scope).map((w) => ({ id: String(w.id), name: w.name })), taxes: [{ id: 'standard', name: 'TVA standard' }, { id: 'zero', name: 'Taux zéro' }], roles: rolesSnapshot(scope).filter((r) => r.id > 2).map((r) => ({ id: String(r.id), name: r.name })), passwordPolicies: ['company_policy'] },
  }); return structuredClone(stores.get(scope)!)
}
export async function updateSettingsMock(scope: string, company: Company | null, input: SettingsPayload, version: number) {
  await new Promise((r) => setTimeout(r, 250)); settingsMock(scope, company); const state = stores.get(scope)!, parsed = settingsSchema.parse(input), policy = state.policies[parsed.section]
  if (!state.permissions.includes('settings.manage') || !policy.canManage || !policy.canView) throw new Error('Section en lecture seule.')
  if (state.version !== version) throw new Error('Les paramètres ont changé. Rechargez la version courante.')
  const previous = state.values[parsed.section]
  for (const key of policy.lockedFields) if (JSON.stringify(Reflect.get(previous, key)) !== JSON.stringify(Reflect.get(parsed.values, key))) throw new Error('Une règle imposée ne peut pas être modifiée.')
  if (parsed.section === 'branches' && !parsed.values.activeBranches.some((b) => b.id === parsed.values.defaultBranch)) throw new Error('Branche invalide.')
  if (parsed.section === 'purchasing' && (!state.options.warehouses.some((w) => w.id === parsed.values.defaultWarehouse) || !state.options.taxes.some((t) => t.id === parsed.values.defaultTax))) throw new Error('Dépôt ou taxe invalide.')
  if (parsed.section === 'users' && !state.options.roles.some((r) => r.id === parsed.values.defaultRole)) throw new Error('Rôle non attribuable.')
  if (parsed.section === 'ai') { state.values.documents.ragEnabled = parsed.values.allowDocumentRag; saveAIPolicyMock(scope, parsed.values) }
  Object.assign(state.values, { [parsed.section]: structuredClone(parsed.values) }); state.version++; return structuredClone(state)
}
export function aiStatusMock(scope: string, company: Company | null): AIStatus { const active = modulesSnapshot(scope).some((m) => m.key === 'ai' && m.status === 'active'); return { status: active ? 'offline' : 'disabled', provider: null, model: null, ragEnabled: settingsMock(scope, company).values.ai.allowDocumentRag, embeddingsAvailable: false, checkedAt: '2026-09-30T09:00:00Z', simulated: true, detail: 'Aucun modèle ni service d’embeddings connecté. Les analyses de démonstration sont déterministes.' } }
export async function testIntegrationMock(scope: string, company: Company | null, id: string): Promise<IntegrationTestResult> { await new Promise((r) => setTimeout(r, 350)); const integration = settingsMock(scope, company).values.integrations.items.find((i) => i.id === id); if (!integration?.canTest) throw new Error('Test non autorisé.'); return { status: 'incomplete', message: 'Configuration incomplète. Aucun appel à un service externe en démonstration.', checkedAt: new Date().toISOString(), simulated: true } }
