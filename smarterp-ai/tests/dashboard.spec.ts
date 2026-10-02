import { readFile } from 'node:fs/promises'
import { env } from 'node:process'
import { expect, test, type Page } from './fixtures'
import { dashboardMock } from '../src/features/dashboard/data/dashboard.mock'

const apiMode = env.VITE_DASHBOARD_USE_MOCK === 'false'

async function signIn(page: Page) {
  await page.route('**/api/auth/login/', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 1,
          name: 'Omar Zinane',
          email: 'omar@atlas.ma',
          role: 'admin',
        },
        company: {
          id: 1,
          name: 'Atlas Distribution SARL',
          onboarding_completed: true,
        },
      },
    }),
  )
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('omar@atlas.ma')
  await page
    .getByLabel('Mot de passe', { exact: true })
    .fill('test-password-42')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(
    page.getByRole('heading', { name: 'Tableau de bord', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close toast', exact: true }).click()
}

test.describe('Dashboard démo', () => {
  test.skip(
    apiMode,
    'Ces tests vérifient les données locales de démonstration.',
  )

  test('shows all executive sections, eight KPIs and explicit AI/forecast labels without API calls', async ({
    page,
  }) => {
    const errors: string[] = []
    const requests: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning')
        errors.push(message.text())
    })
    page.on('request', (request) => {
      if (request.url().includes('/api/dashboard/'))
        requests.push(request.url())
    })
    await signIn(page)
    await expect(page.getByText(/Données de démonstration/)).toBeVisible()
    const cards = page
      .getByRole('region', { name: 'Indicateurs clés' })
      .getByRole('article')
    await expect(cards).toHaveCount(8)
    await expect(cards.filter({ hasText: 'Chiffre d’affaires' })).toContainText(
      /1\s284\s500/,
    )
    await expect(cards.filter({ hasText: 'Factures en retard' })).toContainText(
      /73\s500/,
    )
    for (const name of [
      'Résumé exécutif',
      'Évolution du chiffre d’affaires',
      'Revenus vs dépenses',
      'Trésorerie & Cash Flow',
      'Créances par ancienneté',
      'Santé du stock',
      'Nécessite votre attention',
      'Top 5 clients du mois',
      'Top produits & performance',
      'Dernières factures émises',
      'Actions rapides',
    ]) {
      await expect(
        page.getByRole('heading', { name, exact: true }),
      ).toBeVisible()
    }
    await expect(page.getByText('Santé : 82/100 · Sain')).toBeVisible()
    await expect(page.getByText('SmartERP AI · Analyse IA')).toBeVisible()
    await expect(page.getByText('Prévision à J+30')).toBeVisible()
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(26)
    await expect(
      page.locator('.recharts-line-curve[stroke-dasharray="5 4"]'),
    ).toHaveCount(1)
    await expect(page.getByRole('table')).toHaveCount(3)
    await expect(
      page.getByRole('row', { name: /FAC-2026-0925/ }),
    ).toContainText('Partiellement payée')
    expect(requests).toEqual([])
    expect(errors).toEqual([])
    await page.screenshot({
      path: 'test-results/dashboard-desktop.png',
      fullPage: true,
    })
    await page.screenshot({ path: 'test-results/dashboard-top-desktop.png' })
  })

  test('uses the shared shell and keeps future links inactive', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('navigation', { name: 'Navigation ERP' }),
    ).not.toBeVisible()
    await signIn(page)
    const navigation = page.getByRole('navigation', { name: 'Navigation ERP' })
    await expect(
      navigation.getByRole('link', { name: 'Tableau de bord' }),
    ).toHaveAttribute('aria-current', 'page')
    await navigation
      .locator('summary')
      .filter({ hasText: /^Ventes$/ })
      .click()
    await expect(
      navigation.getByRole('link', { name: 'Customers', exact: true }),
    ).toHaveAttribute('href', '/customers')
    await navigation
      .locator('summary')
      .filter({ hasText: /^Administration$/ })
      .click()
    await expect(
      navigation.getByRole('button', { name: /Rôles & permissions/ }),
    ).toBeDisabled()
    await navigation.getByRole('link', { name: /AI Control Center/ }).click()
    await expect(page).toHaveURL(/\/ai\/control-center$/)
    await expect(
      page.getByRole('heading', { name: 'AI Control Center' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Business Health Score' }),
    ).toBeVisible()
    await navigation.getByRole('link', { name: 'Tableau de bord' }).click()
    await expect(
      page
        .getByRole('region', { name: 'Indicateurs clés' })
        .getByRole('article'),
    ).toHaveCount(8)
  })

  test('focuses global search with Ctrl+K, switches chart metrics and filters alerts', async ({
    page,
  }) => {
    await signIn(page)
    await page.keyboard.press('Control+k')
    await expect(
      page.getByRole('textbox', { name: 'Recherche globale' }),
    ).toBeFocused()
    await page
      .getByRole('textbox', { name: 'Recherche globale' })
      .fill('Nova Retail')
    await page.keyboard.press('Enter')
    await expect(
      page.getByText(
        'La recherche globale sera disponible avec les prochains modules.',
      ),
    ).toBeVisible()
    const chart = page.getByRole('region', {
      name: 'Évolution du chiffre d’affaires',
    })
    await chart.getByRole('button', { name: 'Commandes', exact: true }).click()
    await expect(
      chart.getByRole('button', { name: 'Commandes', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      chart.getByRole('img', { name: /Commandes : comparaison/ }),
    ).toBeVisible()
    await expect(chart).toContainText('2026 · 296')
    await chart.getByRole('button', { name: 'Marge', exact: true }).click()
    await expect(chart).toContainText('28,6 %')
    const alerts = page.getByRole('region', {
      name: 'Nécessite votre attention',
    })
    await expect(alerts.getByRole('listitem')).toHaveCount(5)
    await page
      .getByRole('combobox', { name: 'Filtrer les alertes par criticité' })
      .selectOption('critical')
    await expect(alerts.getByRole('listitem')).toHaveCount(1)
    await expect(alerts).toContainText('Factures importantes en retard')
    await page
      .getByRole('combobox', { name: 'Filtrer les alertes par criticité' })
      .selectOption('opportunity')
    await expect(alerts.getByRole('listitem')).toHaveCount(1)
    await expect(alerts).toContainText('Opportunité commerciale Nova Retail')
    await page
      .getByRole('combobox', { name: 'Filtrer les alertes par criticité' })
      .selectOption('all')
    await expect(alerts.getByRole('listitem')).toHaveCount(5)
    await page
      .getByRole('button', { name: 'Créer une facture', exact: true })
      .click()
    await expect(
      page.getByText(
        '« Créer une facture » sera disponible avec le module correspondant.',
      ),
    ).toBeVisible()
  })

  test('exports the displayed indicators as CSV with an explicit demo source', async ({
    page,
  }) => {
    await signIn(page)
    const downloadReady = page.waitForEvent('download')
    await page
      .getByRole('button', { name: 'Exporter les indicateurs en CSV' })
      .click()
    const download = await downloadReady
    expect(download.suggestedFilename()).toBe('indicateurs-demo-2026-09-30.csv')
    const path = await download.path()
    expect(path).toBeTruthy()
    const content = await readFile(path!, 'utf8')
    expect(content).toContain('"Chiffre d’affaires";"1284500";"MAD"')
    expect(content).toContain('Démonstration')
    expect(content.split('\r\n')).toHaveLength(9)
  })

  test('keeps the mobile dashboard usable without horizontal page overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await signIn(page)
    await expect(
      page.getByRole('navigation', { name: 'Navigation ERP' }),
    ).not.toBeVisible()
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await expect(
      page.getByRole('navigation', { name: 'Navigation ERP' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('navigation', { name: 'Navigation ERP' }),
    ).not.toBeVisible()
    await expect(
      page
        .getByRole('region', { name: 'Indicateurs clés' })
        .getByRole('article'),
    ).toHaveCount(8)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page
      .getByRole('heading', { name: 'Actions rapides' })
      .scrollIntoViewIfNeeded()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: 'test-results/dashboard-mobile.png',
      fullPage: true,
    })
    await page.screenshot({ path: 'test-results/dashboard-top-mobile.png' })
  })
})

test.describe('Dashboard API', () => {
  test.skip(
    !apiMode,
    'Lancer avec VITE_DASHBOARD_USE_MOCK=false pour vérifier le mode Django.',
  )

  test('shows a loading state then renders data returned by the configured endpoint', async ({
    page,
  }) => {
    let finish: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      finish = resolve
    })
    await page.route('**/api/dashboard/summary/', async (route) => {
      expect(route.request().method()).toBe('GET')
      await ready
      await route.fulfill({
        json: {
          ...dashboardMock,
          kpis: dashboardMock.kpis.map((kpi) =>
            kpi.id === 'revenue' ? { ...kpi, value: 1500000 } : kpi,
          ),
        },
      })
    })
    await signIn(page)
    await expect(page.getByText('Chargement du tableau de bord…')).toBeVisible()
    finish?.()
    await expect(
      page
        .getByRole('region', { name: 'Indicateurs clés' })
        .getByRole('article')
        .filter({ hasText: 'Chiffre d’affaires' }),
    ).toContainText(/1\s500\s000/)
    await expect(page.getByText(/Données de démonstration/)).not.toBeVisible()
  })

  test('shows a safe API error and retries without falling back to mock data', async ({
    page,
  }) => {
    let attempts = 0
    await page.route('**/api/dashboard/summary/', async (route) => {
      attempts += 1
      await route.fulfill(
        attempts === 1
          ? { status: 500, json: { detail: 'PRIVATE_TRACEBACK' } }
          : { json: dashboardMock },
      )
    })
    await signIn(page)
    await expect(page.getByRole('alert')).toContainText(
      'Impossible de charger le tableau de bord.',
    )
    await expect(page.getByText('PRIVATE_TRACEBACK')).not.toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Indicateurs clés' }),
    ).not.toBeVisible()
    await page.getByRole('button', { name: 'Réessayer' }).click()
    await expect(
      page
        .getByRole('region', { name: 'Indicateurs clés' })
        .getByRole('article'),
    ).toHaveCount(8)
    expect(attempts).toBe(2)
  })

  test('exposes a retry action when the network request fails', async ({
    page,
  }) => {
    await page.route('**/api/dashboard/summary/', (route) =>
      route.abort('failed'),
    )
    await signIn(page)
    await expect(page.getByRole('alert')).toContainText(
      'Impossible de charger le tableau de bord.',
    )
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeEnabled()
  })
})
