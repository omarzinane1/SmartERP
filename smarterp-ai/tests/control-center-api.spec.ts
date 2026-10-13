import { expect, test } from './fixtures'
import type { IntelligenceRun } from '../src/features/ai-control-center/types/aiControlCenter.types'
import { session, signal, snapshot } from './control-center.fixtures'

test('control center persists alert actions and polls a queued analysis without invented scores', async ({ page }) => {
  const alert = signal()
  let run: IntelligenceRun | null = null
  const actions: string[] = []
  await page.route('**/api/ai/control-center/', (route) => route.fulfill({ json: snapshot([alert], run) }))
  await page.route('**/api/ai/alerts/?*', (route) => route.fulfill({ json: { alerts: [alert], count: 1, next: null, previous: null } }))
  await page.route('**/api/ai/alerts/71/', (route) => route.fulfill({ json: alert }))
  for (const action of ['acknowledge', 'resolve']) {
    await page.route(`**/api/ai/alerts/71/${action}/`, (route) => {
      expect(route.request().postDataJSON()).toEqual({})
      expect(route.request().headers()['idempotency-key']).toBeTruthy()
      actions.push(action)
      alert.status = action === 'acknowledge' ? 'investigating' : 'resolved'
      return route.fulfill({ json: alert })
    })
  }
  await page.route('**/api/ai/control-center/refresh/', (route) => {
    expect(route.request().headers()['idempotency-key']).toBeTruthy()
    expect(route.request().postDataJSON()).toEqual({})
    run = { id: 12, status: 'pending', errorMessage: null }
    return route.fulfill({ status: 202, json: run })
  })
  await session(page)
  await expect(page.getByText('Score non disponible').first()).toBeVisible()
  await expect(page.locator('main')).not.toContainText('null %')
  await page.getByRole('button', { name: 'Examiner' }).click()
  await expect(page.getByRole('heading', { name: alert.title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Prendre en charge' }).click()
  await expect(page.getByRole('button', { name: 'Prise en charge' })).toBeVisible()
  await page.getByRole('button', { name: 'Résoudre', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Résolue', exact: true })).toBeDisabled()
  expect(actions).toEqual(['acknowledge', 'resolve'])
  await page.getByRole('button', { name: 'Actualiser l’analyse' }).click()
  await expect(page.getByText('Dernière analyse : En attente', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Actualiser l’analyse' })).toBeDisabled()
  run = { id: 12, status: 'completed', errorMessage: null }
  await expect(page.getByText('Dernière analyse : Terminée', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Actualiser l’analyse' })).toBeEnabled()
})

test('server pagination and filters are used; failed alert mutation leaves persisted state visible', async ({ page }) => {
  const alert = signal()
  const seen: string[] = []
  await page.route('**/api/ai/control-center/', (route) => route.fulfill({ json: snapshot([alert]) }))
  await page.route('**/api/ai/alerts/?*', (route) => {
    const params = new URL(route.request().url()).searchParams
    seen.push(params.toString())
    const second = params.get('page') === '2'
    return route.fulfill({ json: { alerts: [second ? signal('72') : alert], count: 51, next: second ? null : '/api/ai/alerts/?page=2', previous: second ? '/api/ai/alerts/?page=1' : null } })
  })
  await page.route('**/api/ai/alerts/71/', (route) => route.fulfill({ json: alert }))
  await page.route('**/api/ai/alerts/71/resolve/', (route) => route.fulfill({ status: 409, json: { detail: 'État incompatible.' } }))
  await session(page)
  await page.getByRole('button', { name: 'Suivante', exact: true }).click()
  await expect(page.getByText('51 alertes · Page 2')).toBeVisible()
  await expect(page.getByText('Facture échue INV-72', { exact: true })).toBeVisible()
  expect(seen.some((query) => query.includes('page=2'))).toBe(true)
  await page.getByRole('button', { name: 'Précédente', exact: true }).click()
  await page.getByLabel('Sévérité', { exact: true }).selectOption('medium')
  await expect.poll(() => seen.some((query) => query.includes('severity=medium'))).toBe(true)
  await page.getByRole('button', { name: 'Examiner' }).click()
  await page.getByRole('button', { name: 'Résoudre', exact: true }).click()
  await expect(page.getByText('Action refusée ou indisponible. Les données n’ont pas été modifiées localement.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Résoudre', exact: true })).toBeEnabled()
  expect(alert.status).toBe('open')
})
