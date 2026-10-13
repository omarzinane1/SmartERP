import { expect, test } from './fixtures'
import { session, snapshot, signal } from './control-center.fixtures'
import type { AIControlCenterData } from '../src/features/ai-control-center/types/aiControlCenter.types'

function forecast(): AIControlCenterData['forecasts'][number] {
  return { id: '81', title: 'Flux net de trésorerie', detail: 'Total prévu : -700.00 MAD. Ce flux ne prédit pas le solde bancaire.', horizon: '7 jours', confidence: null, severity: 'high', source: 'statistical', assumptions: 'Journal ERP supposé complet. Journée courante exclue.', generatedAt: '2026-10-12T10:00:00Z', stale: false,
    result: { status: 'completed', metric: 'net_cash_flow', model: 'naive', version: 'decimal-daily-v1', parameters: {}, metrics: { mae: '0.00', rmse: '0.00' }, trainingStart: '2026-08-03', trainingEnd: '2026-10-11', validation: { trainingEnd: '2026-10-04', start: '2026-10-05', end: '2026-10-11', days: 7 }, candidates: [{ model: 'naive', mae: '0.00', rmse: '0.00' }], history: [{ date: '2026-10-11', value: '-100.00', activity: true }], forecast: [{ date: '2026-10-12', value: '-100.00', lowerBound: null, upperBound: null }], risk: true } }
}

test('quantitative forecast exposes validation and exact API series without fabricated confidence', async ({ page }) => {
  const data = snapshot([])
  data.forecasts = [forecast()]
  data.stats.forecasts = 1
  data.health.departments[0].reason = '2 factures échues, 500.00 MAD de créances TTC.'
  await page.route('**/api/ai/control-center/', (route) => route.fulfill({ json: data }))
  await page.route('**/api/ai/alerts/?*', (route) => route.fulfill({ json: { alerts: [], count: 0 } }))
  await session(page)
  await expect(page.getByText('2 factures échues, 500.00 MAD de créances TTC.')).toBeVisible()
  await expect(page.getByText('Flux prévu négatif', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Voir les explications (1)' }).click()
  await expect(page.getByText('MAE : 0.00 · RMSE : 0.00', { exact: true })).toBeVisible()
  await expect(page.getByText('Validation : 2026-10-05 → 2026-10-11')).toBeVisible()
  await page.getByText('Valeurs prévues (1 jours)', { exact: true }).click()
  await expect(page.getByRole('cell', { name: '-100.00', exact: true })).toBeVisible()
  await expect(page.getByText('Intervalle de confiance : non disponible.')).toBeVisible()
  await expect(page.locator('main')).not.toContainText('null %')
  await expect(page.locator('main')).not.toContainText('Démonstration')
})

test('insufficient history and stale forecasts are labeled', async ({ page }) => {
  const data = snapshot([])
  const empty = forecast()
  empty.id = '82'
  empty.title = 'Chiffre d’affaires HT net'
  empty.detail = 'Historique insuffisant : 12 jours ; minimum 56 jours.'
  empty.result = { ...empty.result!, metric: 'revenue', status: 'INSUFFICIENT_DATA', model: null, forecast: [], candidates: [], metrics: null, risk: false }
  data.forecasts = [{ ...forecast(), stale: true }, empty]
  await page.route('**/api/ai/control-center/', (route) => route.fulfill({ json: data }))
  await page.route('**/api/ai/alerts/?*', (route) => route.fulfill({ json: { alerts: [], count: 0 } }))
  await session(page)
  await expect(page.getByText('À actualiser', { exact: true })).toBeVisible()
  await expect(page.getByText('Historique insuffisant', { exact: true })).toBeVisible()
})

test('statistical anomaly shows its method and persists API status', async ({ page }) => {
  const alert = { ...signal(), source: 'statistical' as const, type: 'analysis' as const, title: 'Pic de dépenses', method: 'activity_day_iqr', baseline: 'Médiane 5000.00 ; seuil 10000.00', currentValue: '30000.00 MAD', deviation: '25000.00', analysis: '35 journées actives, IQR = 0 ; seuil max(Q3 + 3×IQR, 2×médiane).' }
  await page.route('**/api/ai/control-center/', (route) => route.fulfill({ json: snapshot([alert]) }))
  await page.route('**/api/ai/alerts/?*', (route) => route.fulfill({ json: { alerts: [alert], count: 1 } }))
  await page.route('**/api/ai/alerts/71/', (route) => route.fulfill({ json: alert }))
  await session(page)
  await page.getByRole('button', { name: 'Examiner' }).click()
  await expect(page.getByText('Statistique · activity_day_iqr', { exact: true })).toBeVisible()
  await expect(page.getByText('35 journées actives, IQR = 0 ; seuil max(Q3 + 3×IQR, 2×médiane).')).toBeVisible()
})

test('API failure remains an error and never falls back to demonstration data', async ({ page }) => {
  await page.route('**/api/ai/control-center/', (route) => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }))
  await page.route('**/api/ai/alerts/?*', (route) => route.fulfill({ json: { alerts: [], count: 0 } }))
  await session(page)
  await expect(page.getByText('Impossible de charger l’AI Control Center.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prévisions et risques' })).toHaveCount(0)
})
