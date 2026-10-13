import { expect, type Page } from './fixtures'
import type { AIAlert, AIControlCenterData, IntelligenceRun } from '../src/features/ai-control-center/types/aiControlCenter.types'

const defaultPermissions = ['ai.use', 'invoices.view']
export async function session(page: Page, permissions = defaultPermissions, target = '/ai/control-center') {
  await page.route('**/api/auth/session/', (route) => route.fulfill({ json: {
    user: { id: 41, name: 'Intelligence Tester', email: 'intelligence@example.test', role: 'ERP', permissions },
    company: { id: 11, name: 'Company A', onboarding_completed: true, enabled_modules: ['ai_control_center', 'invoices'] },
  } }))
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Profil de Intelligence Tester' })).toBeVisible()
  await page.evaluate((target) => { history.pushState({}, '', target); dispatchEvent(new PopStateEvent('popstate')) }, target)
}

export function signal(id = '71'): AIAlert {
  return { id, title: `Facture échue INV-${id}`, scope: `INV-${id}`, department: 'Clients', severity: 'medium', type: 'fact', metric: 'Solde échu', currentValue: '100.00 MAD', baseline: 'Échéance passée', deviation: '1 jour', impact: 'Exposition observée', confidence: null, detectedAt: new Date().toISOString(), status: 'open', facts: [{ label: 'Solde échu', value: '100.00 MAD' }], analysis: 'Solde exigible de 100.00 MAD.', causes: [], estimates: [], recommendations: [], evidence: [] }
}

export function snapshot(alerts: AIAlert[], run: IntelligenceRun | null = null): AIControlCenterData {
  const now = new Date().toISOString()
  return { period: { label: 'Situation actuelle', asOf: now, generatedAt: now }, health: { score: null, trend: null, confidence: null, status: 'warning', departments: [{ name: 'Clients', score: null, trend: null, alerts: 1, status: 'À surveiller', tone: 'warning' }] }, stats: { critical: 0, warnings: alerts.filter((a) => a.status !== 'resolved').length, forecasts: 0, opportunities: 0, resolved: alerts.filter((a) => a.status === 'resolved').length }, summary: { text: 'Indicateurs ERP observés.', confidence: null, priorities: [], impacts: [], recommendations: [], sources: ['receivables'], model: 'Règles déterministes ERP' }, alerts, risks: [], forecasts: [], opportunities: [], actions: [], governance: [], anomalyHistory: [], resolutionRate: null, responseMinutes: null, assignees: [], lastRun: run }
}

