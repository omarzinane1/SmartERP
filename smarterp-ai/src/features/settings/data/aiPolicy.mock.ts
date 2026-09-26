import type { AISettings } from '../types/settings.types'
// A small shared demo record keeps the settings and consuming pages in sync.
const policies = new Map<string, AISettings>()
export const readAIPolicyMock = (scope: string): AISettings => structuredClone(policies.get(scope) ?? { allowAnalysis: true, allowDocumentRag: true, allowForecasting: true, allowRecommendations: true, requireSensitiveApproval: true })
export const saveAIPolicyMock = (scope: string, policy: AISettings) => { policies.set(scope, structuredClone(policy)) }
