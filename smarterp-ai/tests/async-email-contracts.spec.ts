import { expect, test, type Page } from './fixtures'
import { invoicesMock } from '../src/features/invoices/data/invoices.mock'

const permissions = ['invoices.view', 'invoices.send', 'invoices.remind', 'reports.view', 'reports.generate', 'reports.export', 'customers.view', 'customers.export']
async function session(page: Page) {
  await page.route('**/api/auth/session/', (route) => route.fulfill({ json: {
    user: { id: 41, name: 'Async Tester', email: 'async@example.test', role: 'ERP', permissions },
    company: { id: 11, name: 'Async Company', onboarding_completed: true, enabled_modules: ['customers', 'invoices', 'reports'] },
  } }))
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Profil de Async Tester' })).toBeVisible()
  await page.evaluate(async () => { const path = '/src/config/env.ts'; const { env } = await import(path); env.reportsUseMock = false; env.invoicesUseMock = false })
}
const navigate = (page: Page, url: string) => page.evaluate((path) => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, url)

test('async report queues once, polls real states and downloads the protected file', async ({ page }) => {
  let status = 'pending', queued = false, polls = 0
  const job = () => ({ id: 9, status, entity: 'customers', format: 'csv', filename: status === 'completed' ? 'customers-9.csv' : null, created_at: '2026-10-08T12:00:00Z', parameters: {}, download_url: status === 'completed' ? '/api/jobs/9/download/' : null, error_message: null })
  await page.route('**/api/reports/catalog/', (route) => route.fulfill({ json: { reports: [{ id: 'customers', name: 'Clients', category: 'Ventes', description: 'Export clients', formats: ['csv'], supportsPeriod: false, path: null, canOpen: false, lastGenerated: null, generatedBy: null }], permissions, asOf: '2026-10-08' } }))
  await page.route('**/api/reports/recent/', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/jobs/', (route) => { polls++; return route.fulfill({ json: { jobs: queued ? [job()] : [] } }) })
  await page.route('**/api/reports/export/', (route) => {
    expect(route.request().headers()['idempotency-key']).toBeTruthy()
    expect(route.request().postDataJSON().company_id).toBeUndefined()
    queued = true
    return route.fulfill({ status: 202, json: job() })
  })
  await page.route('**/api/jobs/9/download/', (route) => route.fulfill({ contentType: 'text/csv', body: 'Nom\r\nClient local\r\n' }))
  await session(page)
  await navigate(page, '/reports')
  await page.getByRole('button', { name: 'Générer', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Générer rapport', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('cell', { name: 'En attente', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Télécharger', exact: true })).toBeDisabled()
  status = 'processing'
  await expect(page.getByRole('cell', { name: 'En cours', exact: true })).toBeVisible({ timeout: 10000 })
  status = 'completed'
  await expect(page.getByRole('cell', { name: 'Disponible', exact: true })).toBeVisible({ timeout: 10000 })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('customers-9.csv')
  expect(polls).toBeGreaterThanOrEqual(3)
})

test('invoice email shows delivery state and explicit resend uses a new idempotent request', async ({ page }) => {
  const invoice = { ...structuredClone(invoicesMock.find((row) => row.id === 413)!), permissions, emailDeliveries: [] as { id: number; type: string; status: string }[] }
  let sentRequests = 0, state = 'pending'
  await page.route('**/api/invoices/413/', (route) => route.fulfill({ json: invoice }))
  await page.route('**/api/business-emails/?*', (route) => route.fulfill({ json: { emails: invoice.emailDeliveries.map((email) => ({ ...email, status: state, recipient: 'client@example.test', createdAt: '2026-10-08T12:00:00Z', errorMessage: null, backend: 'django.core.mail.backends.smtp.EmailBackend' })) } }))
  await page.route('**/api/invoices/413/send/', (route) => {
    expect(route.request().headers()['idempotency-key']).toBeTruthy()
    if (sentRequests) expect(route.request().postDataJSON()).toEqual({ resend: true })
    sentRequests++
    invoice.emailDeliveries = [{ id: sentRequests, type: 'invoice', status: 'pending' }]
    state = 'pending'
    return route.fulfill({ json: invoice })
  })
  await session(page)
  await navigate(page, '/invoices/413')
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Envoyer la facture', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Suivi des e-mails' })
  await expect(panel.getByText('Document · En attente', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Renvoyer le document' })).toBeDisabled()
  state = 'sent'
  await expect(panel.getByText('Document · Envoyé', { exact: true })).toBeVisible({ timeout: 10000 })
  await panel.getByRole('button', { name: 'Renvoyer le document' }).click()
  expect(sentRequests).toBe(1)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer le renvoi' }).click()
  await expect.poll(() => sentRequests).toBe(2)
  await expect(panel.getByText('Document · En attente', { exact: true })).toBeVisible()
})
