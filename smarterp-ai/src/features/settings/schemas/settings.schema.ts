import { z } from 'zod'
import type { SettingsPayload } from '../types/settings.types'
const text = z.string().max(1000), required = z.string().trim().min(1, 'Valeur obligatoire.').max(150), integer = z.number().int().nonnegative().max(100000), days = z.number().int().min(1).max(3650)
export const settingsSchema: z.ZodType<SettingsPayload, SettingsPayload> = z.discriminatedUnion('section', [
  z.object({ section: z.literal('general'), values: z.object({ language: required, timezone: required, dateFormat: required, currency: required, numberFormat: required }) }),
  z.object({ section: z.literal('company'), values: z.object({ companyName: required, legalName: text, taxId: text, email: z.union([z.email('Adresse e-mail invalide.'), z.literal('')]), phone: text, address: text, city: text, country: text, logoUrl: z.string().nullable() }) }),
  z.object({ section: z.literal('branches'), values: z.object({ activeBranches: z.array(z.object({ id: required, name: required })), defaultBranch: required }) }),
  z.object({ section: z.literal('finance'), values: z.object({ currency: required, fiscalYearStart: z.iso.date(), defaultAccount: text, paymentTerms: text, rounding: required }) }),
  z.object({ section: z.literal('taxes'), values: z.object({ activeTaxes: z.array(z.string()), vatRate: z.number().min(0).max(100), inclusive: z.boolean(), rounding: required }) }),
  z.object({ section: z.literal('invoices'), values: z.object({ prefix: required, numbering: required, paymentTerms: text, defaultDueDays: days, notes: text, sendEmail: z.boolean() }) }),
  z.object({ section: z.literal('sales'), values: z.object({ quotePrefix: required, orderPrefix: required, quoteValidityDays: days, reserveStock: z.boolean(), requireApproval: z.boolean() }) }),
  z.object({ section: z.literal('purchasing'), values: z.object({ prefix: required, approvalThreshold: z.number().nonnegative().max(1000000000), defaultWarehouse: required, defaultTax: required }) }),
  z.object({ section: z.literal('inventory'), values: z.object({ allowNegative: z.boolean(), valuationMethod: required, minimumStock: integer, unit: required, alerts: z.boolean() }) }),
  z.object({ section: z.literal('documents'), values: z.object({ allowedFormats: z.array(z.string()), maxSizeMB: z.number().positive().max(1000), autoIndex: z.boolean(), retentionDays: days, ragEnabled: z.boolean() }) }),
  z.object({ section: z.literal('users'), values: z.object({ allowInvitations: z.boolean(), defaultRole: required, sessionTimeoutMinutes: z.number().int().min(5).max(10080), passwordPolicySummary: text }) }),
  z.object({ section: z.literal('notifications'), values: z.object({ email: z.boolean(), inApp: z.boolean(), stockAlerts: z.boolean(), invoiceOverdue: z.boolean(), approvals: z.boolean(), aiAlerts: z.boolean() }) }),
  z.object({ section: z.literal('security'), values: z.object({ require2FA: z.boolean(), sessionMinutes: z.number().int().min(5).max(10080), passwordPolicy: required, sensitiveApproval: z.boolean(), auditRetentionDays: days }) }),
  z.object({ section: z.literal('ai'), values: z.object({ allowAnalysis: z.boolean(), allowDocumentRag: z.boolean(), allowForecasting: z.boolean(), allowRecommendations: z.boolean(), requireSensitiveApproval: z.boolean() }) }),
])
