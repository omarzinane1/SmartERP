import { readFile } from 'node:fs/promises'
import { env } from 'node:process'
import { expect, test, type Page } from '@playwright/test'

const apiMode = env.VITE_QUOTES_USE_MOCK === 'false'
async function openQuotes(page: Page) {
  await page.route('**/api/auth/login/', (route) => route.fulfill({ json: {
    user: { id: 1, name: 'Omar Zinane', email: 'omar@atlas.ma', role: 'admin' },
    company: { id: 1, name: 'Atlas Distribution SARL', onboarding_completed: true },
  } }))
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('omar@atlas.ma')
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password-42')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('navigation', { name: 'Navigation ERP' }).locator('summary').filter({ hasText: /^Ventes$/ }).click()
  await page.getByRole('link', { name: 'Devis / Quotes', exact: true }).click()
  await expect(page).toHaveURL(/\/quotes$/)
}
const rows = (page: Page) => page.locator('.quotes-table tbody tr:not(.quotes-group-row)')
const row = (page: Page, reference: string) => rows(page).filter({ hasText: reference })

test.describe('Devis démo', () => {
  test.skip(apiMode, 'Mode démonstration requis')

  test('coherent KPIs, navigation, search, periods and sorting', async ({ page }) => {
    const errors: string[] = []
    const requests: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => { if (request.url().includes('/api/quotes/')) requests.push(request.url()) })
    await openQuotes(page)
    await expect(page.getByRole('link', { name: 'Devis / Quotes' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' })).toContainText('Ventes/Devis')
    await expect(page.getByRole('region', { name: 'Indicateurs devis' }).getByRole('article')).toHaveCount(5)
    await expect(page.getByText('1–25 sur 68 devis', { exact: true })).toBeVisible()
    await expect(rows(page)).toHaveCount(25)
    await page.screenshot({ path: 'test-results/quotes-desktop.png', fullPage: true, style: '[data-sonner-toaster] { visibility: hidden; }' })
    await page.getByRole('button', { name: 'Montant TTC', exact: true }).click()
    const amounts = await rows(page).locator('.quotes-amount').allTextContents()
    const numbers = amounts.map((amount) => Number(amount.replace(/\D/g, '')))
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    await page.getByRole('textbox', { name: 'Rechercher un devis' }).fill('fes')
    await expect(rows(page)).toHaveCount(8)
    await expect(page.getByRole('region', { name: 'Indicateurs devis' }).getByRole('article').first()).toContainText('8')
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    await expect(page.locator('.quotes-kanban-card')).toHaveCount(8)
    await page.getByRole('textbox', { name: 'Rechercher un devis' }).fill('introuvable')
    await expect(page.getByText('Aucun devis ne correspond à vos critères.')).toBeVisible()
    await page.getByRole('button', { name: 'Réinitialiser les filtres', exact: true }).click()
    await expect(page.locator('.quotes-kanban-card')).toHaveCount(80)
    await page.getByRole('combobox', { name: 'Période', exact: true }).selectOption('previous_month')
    await expect(page.locator('.quotes-kanban-card')).toHaveCount(12)
    expect(errors).toEqual([])
    expect(requests).toEqual([])
  })

  test('combined filters, grouping, favorites and pagination', async ({ page }) => {
    await openQuotes(page)
    await page.getByRole('button', { name: 'Page suivante' }).click()
    await expect(page.getByText('26–50 sur 68 devis')).toBeVisible()
    await page.getByRole('combobox', { name: 'Devis par page' }).selectOption('50')
    await expect(rows(page)).toHaveCount(50)
    await page.getByRole('combobox', { name: 'Regrouper par' }).selectOption('salesperson')
    await expect(page.locator('.quotes-group-row')).toHaveCount(3)
    await page.locator('summary').filter({ hasText: /^Favoris/ }).click()
    await page.getByRole('button', { name: 'Devis acceptés', exact: true }).click()
    await expect(rows(page)).toHaveCount(9)
    await expect(page.getByText('1–9 sur 9 devis', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Indicateurs devis' })).toContainText('100 %')
    await page.locator('summary').filter({ hasText: /^Filtres/ }).click()
    await page.getByRole('combobox', { name: 'Client', exact: true }).selectOption('85')
    await page.keyboard.press('Escape')
    await expect(page.getByText('Aucun devis ne correspond à vos critères.')).toBeVisible()
    await page.getByRole('button', { name: 'Effacer tous les filtres' }).click()
    await page.getByRole('button', { name: 'Mes devis', exact: true }).click()
    await expect(rows(page)).toHaveCount(23)
    await page.getByRole('combobox', { name: 'Filtrer par commercial' }).selectOption('all')
    await page.locator('summary').filter({ hasText: /^Favoris/ }).click()
    await page.getByRole('button', { name: 'Devis expirant bientôt', exact: true }).click()
    await expect(rows(page).first()).toBeVisible()
    for (const text of await rows(page).allTextContents()) {
      expect(text).not.toMatch(/Accepté|Refusé|Expiré/)
      expect(text).toMatch(/Dans \d jours|Expire aujourd’hui/)
    }
  })

  test('selection across pages and views, status rules, CSV and demo sending', async ({ page }) => {
    await openQuotes(page)
    await page.getByRole('checkbox', { name: 'Sélectionner QT-2026-0268', exact: true }).check()
    let selection = page.getByRole('region', { name: 'Actions sur la sélection' })
    await expect(selection.getByRole('button', { name: 'Envoyer', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Page suivante' }).click()
    await expect(selection).toContainText('1 hors de cette page')
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'Sélectionner QT-2026-0268', exact: true })).toBeChecked()
    await page.screenshot({ path: 'test-results/quotes-kanban.png', fullPage: true })
    await selection.getByRole('button', { name: 'Effacer la sélection' }).click()
    await page.getByRole('button', { name: 'Vue Liste', exact: true }).click()
    await page.getByRole('button', { name: 'Brouillons', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Sélectionner tous les devis de cette page' }).check()
    selection = page.getByRole('region', { name: 'Actions sur la sélection' })
    const downloadReady = page.waitForEvent('download')
    await selection.getByRole('button', { name: 'Exporter CSV' }).click()
    const csv = await readFile((await (await downloadReady).path())!, 'utf8')
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv.split('\r\n')).toHaveLength(18)
    expect(csv).toContain('"Brouillon"')
    await selection.getByRole('button', { name: 'Envoyer', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Aucun e-mail ne sera envoyé.')
    await page.screenshot({ path: 'test-results/quotes-send-desktop.png', fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await selection.getByRole('button', { name: 'Effacer la sélection' }).click()
    await row(page, 'QT-2026-0265').getByRole('button', { name: 'Envoyer QT-2026-0265' }).click()
    await dialog.getByRole('button', { name: 'Simuler l’envoi' }).click()
    await expect(dialog.getByRole('button', { name: 'Envoi en cours…' })).toBeDisabled()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('1 envoi(s) simulé(s). Aucun e-mail envoyé.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Effacer tous les filtres' }).click()
    await expect(row(page, 'QT-2026-0265')).toContainText('Envoyé')
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Envoyé', exact: true })).toContainText('QT-2026-0265')
    expect(csv).toContain('Démonstration')
  })

  test('duplication creates a draft, exports filtered results and opens the editor', async ({ page }) => {
    await openQuotes(page)
    await row(page, 'QT-2026-0268').getByRole('button', { name: 'Dupliquer QT-2026-0268' }).click()
    await expect(row(page, 'QT-2026-0269')).toContainText('Brouillon')
    await expect(row(page, 'QT-2026-0268')).toContainText('Accepté')
    await page.getByRole('textbox', { name: 'Rechercher un devis' }).fill('QT-2026-0269')
    const downloadReady = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter', exact: true }).click()
    const csv = await readFile((await (await downloadReady).path())!, 'utf8')
    expect(csv.split('\r\n')).toHaveLength(2)
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    await expect(page.locator('.quotes-kanban-card')).toHaveCount(1)
    await page.getByRole('link', { name: 'QT-2026-0269', exact: true }).click()
    await expect(page).toHaveURL(/\/quotes\/269$/)
    await expect(page.getByRole('heading', { name: 'Devis QT-2026-0269', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Retour aux devis' }).click()
    await expect(row(page, 'QT-2026-0269')).toBeVisible()
    for (const reference of ['QT-2026-0268', 'QT-2026-0269'])
      await page.getByRole('checkbox', { name: `Sélectionner ${reference}`, exact: true }).check()
    await page.getByRole('region', { name: 'Actions sur la sélection' }).getByRole('button', { name: 'Dupliquer', exact: true }).click()
    await expect(row(page, 'QT-2026-0270')).toContainText('Brouillon')
    await expect(row(page, 'QT-2026-0271')).toContainText('Brouillon')
    await expect(page.getByText('1–25 sur 71 devis', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Créer un devis', exact: true }).click()
    await expect(page).toHaveURL(/\/quotes\/new$/)
    await expect(page.getByRole('heading', { name: 'Nouveau devis', exact: true })).toBeVisible()
  })

  test('mobile layout, accessible confirmation and PDF placeholder', async ({ page }) => {
    await openQuotes(page)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    await page.getByRole('button', { name: 'Envoyer QT-2026-0265', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({ path: 'test-results/quotes-mobile.png', fullPage: true })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Envoyer QT-2026-0265', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Exporter PDF QT-2026-0265', exact: true }).click()
    await expect(page.getByText(/L’export PDF sera disponible avec le backend Django/)).toBeVisible()
  })
})

const apiQuote = {
  id: 1, reference: 'QT-2026-0001', customer_id: 124, customer_name: 'Client API', customer_email: 'client@example.com',
  salesperson: 'Sara El Mansouri', created_at: '2026-09-22', expires_at: '2026-10-22', total_amount: '12345.00', status: 'draft',
}
const apiResponse = {
  results: [apiQuote], next: null as string | null, as_of: '2026-09-23', current_salesperson: 'Sara El Mansouri',
  permissions: ['quotes.view', 'quotes.create', 'quotes.send', 'quotes.export'],
}
test.describe('Devis API', () => {
  test.skip(!apiMode, 'Lancer avec VITE_QUOTES_USE_MOCK=false')

  test('loading, DTO adaptation, DRF pagination and read-only permissions', async ({ page }) => {
    let finish: () => void = () => {}
    const ready = new Promise<void>((resolve) => { finish = resolve })
    await page.route('**/api/quotes/?page=2', (route) => route.fulfill({ json: { ...apiResponse, results: [{ ...apiQuote, id: 2, reference: 'QT-2026-0002', status: 'accepted' }] } }))
    await page.route('**/api/quotes/', async (route) => {
      await ready
      await route.fulfill({ json: { ...apiResponse, permissions: ['quotes.view'], next: '?page=2' } })
    })
    await openQuotes(page)
    await expect(page.getByText('Chargement des devis…')).toBeVisible()
    finish()
    await expect(rows(page)).toHaveCount(2)
    await expect(row(page, 'QT-2026-0001')).toContainText(/12\s345 MAD/)
    await expect(page.getByRole('region', { name: 'Indicateurs devis' })).toContainText(/24\s690/)
    await expect(page.getByRole('button', { name: 'Créer un devis', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Exporter', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Envoyer QT-2026-0001' })).toHaveCount(0)
    await expect(page.getByText(/Données de démonstration/)).toHaveCount(0)
  })

  test('load errors have no mock fallback, retry and genuine empty state', async ({ page }) => {
    let fail = true
    await page.route('**/api/quotes/', (route) => route.fulfill(fail ? { status: 500, json: { detail: 'PRIVATE_ERROR' } } : { json: { ...apiResponse, results: [] } }))
    await openQuotes(page)
    await expect(page.getByRole('alert')).toContainText('Impossible de charger les devis.')
    await expect(page.getByText('PRIVATE_ERROR')).toHaveCount(0)
    await expect(rows(page)).toHaveCount(0)
    fail = false
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByText('Aucun devis pour le moment.')).toBeVisible()
  })

  for (const type of ['http', 'permissions']) test(`access denied via ${type}`, async ({ page }) => {
    await page.route('**/api/quotes/', (route) => route.fulfill(type === 'http' ? { status: 403, json: {} } : { json: { ...apiResponse, permissions: [] } }))
    await openQuotes(page)
    await expect(page.getByRole('heading', { name: 'Accès non autorisé' })).toBeVisible()
    await expect(rows(page)).toHaveCount(0)
  })

  test('send failure, retry, cache refresh and duplicate endpoint', async ({ page }) => {
    let quote = { ...apiQuote }
    let copies: typeof apiQuote[] = []
    let fails = true
    let sends = 0
    await page.route('**/api/quotes/', (route) => route.fulfill({ json: { ...apiResponse, results: [quote, ...copies] } }))
    await page.route('**/api/quotes/1/send/', (route) => {
      sends += 1
      expect(route.request().method()).toBe('POST')
      if (fails) return route.fulfill({ status: 500, json: { detail: 'PRIVATE_SEND_ERROR' } })
      quote = { ...quote, status: 'sent' }
      return route.fulfill({ json: quote })
    })
    await page.route('**/api/quotes/1/duplicate/', (route) => {
      expect(route.request().method()).toBe('POST')
      copies = [{ ...quote, id: 2, reference: 'QT-2026-0002', status: 'draft' }]
      return route.fulfill({ json: copies[0] })
    })
    await openQuotes(page)
    await page.getByRole('button', { name: 'Envoyer QT-2026-0001' }).click()
    await page.getByRole('button', { name: 'Confirmer l’envoi' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Impossible de terminer l’envoi.')
    await expect(page.getByText('PRIVATE_SEND_ERROR')).toHaveCount(0)
    await expect(row(page, 'QT-2026-0001')).toContainText('Brouillon')
    fails = false
    await page.getByRole('button', { name: 'Confirmer l’envoi' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(row(page, 'QT-2026-0001')).toContainText('Envoyé')
    expect(sends).toBe(2)
    await page.getByRole('button', { name: 'Dupliquer QT-2026-0001' }).click()
    await expect(row(page, 'QT-2026-0002')).toContainText('Brouillon')
  })

  test('partial bulk send retries only the remaining quote', async ({ page }) => {
    const quotes = [apiQuote, { ...apiQuote, id: 2, reference: 'QT-2026-0002' }].map((quote) => ({ ...quote }))
    const attempts = [0, 0]
    await page.route('**/api/quotes/', (route) => route.fulfill({ json: { ...apiResponse, results: quotes } }))
    await page.route('**/api/quotes/*/send/', (route) => {
      const id = Number(route.request().url().split('/').at(-3))
      attempts[id - 1] += 1
      if (id === 1 && attempts[0] === 1) return route.fulfill({ status: 500, json: {} })
      quotes[id - 1].status = 'sent'
      return route.fulfill({ json: quotes[id - 1] })
    })
    await openQuotes(page)
    await page.getByRole('checkbox', { name: 'Sélectionner tous les devis de cette page' }).check()
    await page.getByRole('region', { name: 'Actions sur la sélection' }).getByRole('button', { name: 'Envoyer', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer l’envoi' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('1 devis déjà traité(s).')
    await expect(page.getByRole('dialog').locator('li')).toHaveCount(1)
    await page.getByRole('button', { name: 'Confirmer l’envoi' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(attempts).toEqual([2, 1])
    await expect(rows(page).filter({ hasText: 'Envoyé' })).toHaveCount(2)
  })

  test('offline sends stop loading and preserve the last data with a safe error', async ({ page, context }) => {
    await page.route('**/api/quotes/', (route) => route.fulfill({ json: apiResponse }))
    await openQuotes(page)
    await expect(rows(page)).toHaveCount(1)
    await page.getByRole('button', { name: 'Envoyer QT-2026-0001' }).click()
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Confirmer l’envoi' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Impossible de terminer l’envoi.')
    await expect(page.getByRole('button', { name: 'Confirmer l’envoi' })).toBeEnabled()
    await expect(row(page, 'QT-2026-0001')).toContainText('Brouillon')
    await context.setOffline(false)
  })
})
