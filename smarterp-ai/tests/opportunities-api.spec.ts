import { expect, test, type Page } from './fixtures'
import { session, snapshot } from './control-center.fixtures'
import type { AIOpportunity, OpportunityAction } from '../src/features/ai/types/ai.types'
import type { IntelligenceRun } from '../src/features/ai-control-center/types/aiControlCenter.types'

const permissions = ['ai.use', 'ai.opportunities.view', 'customers.view', 'invoices.view']
const item = (): AIOpportunity => ({ id: 51, type: 'receivable_collection', domain: 'finance', title: 'Prioriser les créances de Client API', description: 'Vérifier les factures avant toute relance.', reason: '2 factures échues depuis 60 jours.', recommendation: 'Vérifier les factures avant toute relance.', priority: 'high', status: 'open', potentialValue: '150.250000', valueKind: 'outstanding_receivable', currency: 'MAD', confidence: null, source: 'analytics', detector: 'receivable_collection', version: 'opportunities-v1', metrics: { overdue_amount: '150.25', invoices_count: 2 }, entity: { type: 'customer', id: 7, name: 'Client API', path: '/customers/7' }, evidence: [{ id: 'e-51', documentId: null, documentName: 'Client API', page: null, section: null, excerpt: '2 factures échues', recordPath: '/customers/7', period: null, authorized: true }], detectedAt: '2026-10-12T10:00:00Z', lastSeenAt: '2026-10-12T10:00:00Z', expiresAt: '2026-10-19T10:00:00Z', acknowledgedAt: null, dismissedAt: null, completedAt: null, expiredAt: null, acknowledgedBy: null, dismissedBy: null, completedBy: null, actions: ['acknowledge', 'dismiss'] })
const envelope = (rows: AIOpportunity[], lastRun: IntelligenceRun | null = null, count = rows.length) => ({ opportunities: rows, count, next: null, previous: null, permissions, availableTypes: ['receivable_collection'], lastRun, asOf: '2026-10-12' })
const enter = (page: Page, target = '/ai/opportunities') => session(page, permissions, target)

test('real opportunity detail and lifecycle use empty idempotent POSTs and persisted statuses', async ({ page }) => {
  const row = item(), sent: OpportunityAction[] = []
  await page.route('**/api/ai/opportunities/?*', (r) => r.fulfill({ json: envelope([row]) }))
  await page.route('**/api/ai/opportunities/51/', (r) => r.fulfill({ json: row }))
  for (const action of ['acknowledge', 'complete'] as const) await page.route(`**/api/ai/opportunities/51/${action}/`, (r) => {
    expect(r.request().postDataJSON()).toEqual({}); expect(r.request().headers()['idempotency-key']).toBeTruthy(); sent.push(action)
    row.status = action === 'acknowledge' ? 'acknowledged' : 'completed'
    row.actions = action === 'acknowledge' ? ['complete', 'dismiss'] : []
    return r.fulfill({ json: row })
  })
  await enter(page, '/ai/opportunities?opportunity=51')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('150,25 MAD')
  await expect(dialog.getByRole('link', { name: 'Ouvrir enregistrement' })).toHaveAttribute('href', '/customers/7')
  await expect(dialog).not.toContainText('null %')
  await expect(dialog.getByRole('button', { name: 'Marquer terminée' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Prendre en charge' }).click()
  await expect(dialog).toContainText('Prise en charge')
  await dialog.getByRole('button', { name: 'Marquer terminée' }).click()
  await expect(dialog).toContainText('Terminée')
  await expect(dialog.getByRole('button', { name: 'Écarter', exact: true })).toHaveCount(0)
  expect(sent).toEqual(['acknowledge', 'complete'])
})

test('opportunity pagination search priority and status filters go to the server', async ({ page }) => {
  const seen: URLSearchParams[] = []
  await page.route('**/api/ai/opportunities/?*', (r) => {
    const params = new URL(r.request().url()).searchParams; seen.push(params)
    return r.fulfill({ json: envelope([{ ...item(), title: params.get('page') === '2' ? 'Seconde page API' : item().title }], null, 26) })
  })
  await enter(page)
  await expect(page.getByText('26 résultat(s)')).toBeVisible()
  await page.getByRole('button', { name: 'Page suivante' }).click()
  await expect(page.getByText('Seconde page API')).toBeVisible()
  await page.getByRole('combobox', { name: 'Statut', exact: true }).selectOption('acknowledged')
  await page.getByRole('combobox', { name: 'Priorité', exact: true }).selectOption('high')
  await page.getByPlaceholder('Rechercher une opportunité…').fill('Client API')
  await expect.poll(() => seen.some((p) => p.get('search') === 'Client API' && p.get('status') === 'acknowledged' && p.get('priority') === 'high' && p.get('page') === '1')).toBe(true)
})

test('refresh queues intelligence and polls until opportunities are available', async ({ page }) => {
  let run: IntelligenceRun | null = null
  await page.route('**/api/ai/opportunities/?*', (r) => r.fulfill({ json: envelope(run?.status === 'completed' ? [item()] : [], run) }))
  await page.route('**/api/ai/control-center/refresh/', (r) => {
    expect(r.request().postDataJSON()).toEqual({}); expect(r.request().headers()['idempotency-key']).toBeTruthy()
    run = { id: 72, status: 'pending', errorMessage: null }; return r.fulfill({ status: 202, json: run })
  })
  await enter(page)
  await page.getByRole('button', { name: 'Actualiser les opportunités' }).click()
  await expect(page.getByRole('button', { name: 'Analyse en cours…' })).toBeDisabled()
  run = { id: 72, status: 'completed', errorMessage: null }
  await expect(page.getByText(item().title)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Actualiser les opportunités' })).toBeEnabled()
})

test('failed lifecycle action preserves server state and cannot invent an assignment', async ({ page }) => {
  await page.route('**/api/ai/opportunities/?*', (r) => r.fulfill({ json: envelope([item()]) }))
  await page.route('**/api/ai/opportunities/51/', (r) => r.fulfill({ json: item() }))
  await page.route('**/api/ai/opportunities/51/acknowledge/', (r) => r.fulfill({ status: 409, json: { detail: 'Expirée.' } }))
  await enter(page, '/ai/opportunities?opportunity=51')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Prendre en charge' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Action non confirmée')
  await expect(dialog).toContainText('À examiner')
  await expect(dialog.getByRole('combobox', { name: 'Responsable' })).toHaveCount(0)
})

test('empty opportunities and foreign detail show no fallback demonstration', async ({ page }) => {
  await page.route('**/api/ai/opportunities/?*', (r) => r.fulfill({ json: envelope([]) }))
  await page.route('**/api/ai/opportunities/999/', (r) => r.fulfill({ status: 404, json: { detail: 'Not found.' } }))
  await enter(page, '/ai/opportunities?opportunity=999')
  await expect(page.getByText('Aucune donnée disponible.')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Opportunité indisponible')
  await expect(page.locator('main')).not.toContainText('Packaging')
})

test('forbidden opportunities remain inaccessible', async ({ page }) => {
  await page.route('**/api/ai/opportunities/?*', (r) => r.fulfill({ status: 403, json: { detail: 'Accès refusé.' } }))
  await enter(page)
  await expect(page.getByRole('button', { name: 'Actualiser les opportunités' })).toHaveCount(0)
  await expect(page.locator('main')).toContainText('Accès')
})

test('control center opportunity opens the real detail on mobile without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const center = snapshot([]); center.opportunities = [item()]; center.stats.opportunities = 1
  await page.route('**/api/ai/control-center/', (r) => r.fulfill({ json: center }))
  await page.route('**/api/ai/alerts/?*', (r) => r.fulfill({ json: { alerts: [], count: 0 } }))
  await page.route('**/api/ai/opportunities/?*', (r) => r.fulfill({ json: envelope([item()]) }))
  await page.route('**/api/ai/opportunities/51/', (r) => r.fulfill({ json: item() }))
  await enter(page, '/ai/control-center')
  await page.getByRole('link', { name: 'Examiner la recommandation' }).click()
  await expect(page.getByRole('dialog')).toContainText(item().title)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
