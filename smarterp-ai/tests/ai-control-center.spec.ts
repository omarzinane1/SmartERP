import { readFile } from 'node:fs/promises'
import { env } from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { aiControlCenterMock } from '../src/features/ai-control-center/data/aiControlCenter.mock'

const apiMode = env.VITE_AI_CONTROL_CENTER_USE_MOCK === 'false'

async function openControlCenter(page: Page) {
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
  await page
    .getByRole('navigation', { name: 'Navigation ERP' })
    .getByRole('link', { name: /AI Control Center/ })
    .click()
  await expect(page).toHaveURL(/\/ai\/control-center$/)
}

test.describe('AI Control Center démo', () => {
  test.skip(apiMode, 'Données de démonstration uniquement.')

  test('renders the full BI screen and a contextual default drawer without backend calls', async ({
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
      if (request.url().includes('/api/ai/')) requests.push(request.url())
    })
    await openControlCenter(page)
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation ERP' })
        .getByRole('link', { name: /AI Control Center/ }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      page
        .getByRole('region', { name: 'Santé de l’entreprise' })
        .getByRole('article'),
    ).toHaveCount(7)
    await expect(
      page
        .getByRole('region', { name: 'Statistiques d’intelligence' })
        .getByRole('article'),
    ).toHaveCount(5)
    const table = page.getByRole('region', {
      name: 'Flux des alertes opérationnelles',
    })
    await expect(table.locator('tbody tr')).toHaveCount(6)
    const drawer = page.locator('#alert-detail')
    await expect(
      drawer.getByRole('heading', {
        name: 'Baisse inhabituelle de marge — Électronique',
      }),
    ).toBeVisible()
    await expect(drawer).toContainText('24,1 %')
    await expect(drawer).toContainText('FACT · Faits observés (démonstration)')
    await expect(drawer).toContainText('AI ANALYSIS · Diagnostic')
    await expect(drawer).toContainText('FORECAST / ESTIMATE')
    await expect(drawer).toContainText('RECOMMENDATION')
    await expect(
      page
        .getByRole('region', { name: 'Risques prévisionnels' })
        .getByRole('article'),
    ).toHaveCount(4)
    await expect(
      page
        .getByRole('region', { name: 'Opportunités de croissance' })
        .getByRole('article'),
    ).toHaveCount(3)
    await expect(
      page
        .getByRole('region', { name: 'Actions recommandées' })
        .getByRole('article'),
    ).toHaveCount(3)
    // Recharts ne dessine pas les six segments dont la valeur est nulle.
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(38)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: 'test-results/ai-control-center-desktop.png',
      fullPage: true,
    })
    await page.screenshot({ path: 'test-results/ai-control-center-top.png' })
    await table.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/ai-control-center-alerts.png' })
    expect(errors).toEqual([])
    expect(requests).toEqual([])
  })

  test('combines filters, saves a view, handles empty results and exports only visible alerts', async ({
    page,
  }) => {
    await openControlCenter(page)
    const table = page.getByRole('region', {
      name: 'Flux des alertes opérationnelles',
    })
    await page
      .getByRole('combobox', { name: 'Département des alertes' })
      .selectOption('Ventes')
    await expect(table.locator('tbody tr')).toHaveCount(2)
    await page
      .getByRole('combobox', { name: 'Sévérité', exact: true })
      .selectOption('high')
    await page
      .getByRole('combobox', { name: 'Type d’intelligence' })
      .selectOption('analysis')
    await page
      .getByRole('combobox', { name: 'Statut', exact: true })
      .selectOption('open')
    await page
      .getByRole('textbox', { name: 'Rechercher une alerte' })
      .fill('electronique')
    await expect(table.locator('tbody tr')).toHaveCount(1)
    await page
      .getByRole('button', { name: 'Enregistrer la vue', exact: true })
      .click()
    const downloadReady = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter', exact: true }).click()
    const download = await downloadReady
    const content = await readFile((await download.path())!, 'utf8')
    expect(content.split('\r\n')).toHaveLength(2)
    expect(content).toContain('Baisse inhabituelle de marge')
    expect(content).toContain('Démonstration')
    await page
      .getByRole('textbox', { name: 'Rechercher une alerte' })
      .fill('aucun-résultat')
    await expect(
      page.getByText('Aucune alerte ne correspond aux filtres.'),
    ).toBeVisible()
    await expect(page.locator('#alert-detail')).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Réinitialiser les filtres' })
      .click()
    await expect(table.locator('tbody tr')).toHaveCount(6)
    await page
      .getByRole('button', { name: 'Vue enregistrée', exact: true })
      .click()
    await expect(table.locator('tbody tr')).toHaveCount(1)
    await page
      .getByRole('button', { name: 'Réinitialiser les filtres' })
      .click()
    await page
      .getByRole('combobox', { name: 'Période des alertes' })
      .selectOption('1')
    await expect(table.locator('tbody tr')).toHaveCount(4)
    await page
      .getByRole('combobox', { name: 'Grouper les alertes' })
      .selectOption('department')
    await expect(
      table.getByRole('rowgroup').filter({ hasText: 'Finance' }),
    ).toBeVisible()
  })

  test('selects alerts, shows their own evidence, assigns, resolves and reviews safe drafts', async ({
    page,
  }) => {
    await openControlCenter(page)
    const drawer = page.locator('#alert-detail')
    await drawer.getByRole('button', { name: 'Ouvrir SO-2026-1048' }).click()
    await expect(drawer.getByRole('status')).toContainText(
      'remise supérieure à 15 %',
    )
    await drawer.getByRole('button', { name: 'Assigner', exact: true }).click()
    await drawer
      .getByRole('combobox', { name: 'Responsable de l’alerte' })
      .selectOption('Nadia Benali')
    await expect(
      drawer.getByRole('button', { name: 'Nadia', exact: true }),
    ).toBeVisible()
    await expect(drawer).toContainText('En analyse')
    await drawer.getByRole('button', { name: 'Résoudre', exact: true }).click()
    await expect(
      drawer.getByRole('button', { name: 'Résolue', exact: true }),
    ).toBeDisabled()
    await expect(
      page
        .getByRole('region', { name: 'Statistiques d’intelligence' })
        .getByRole('article')
        .filter({ hasText: 'Problèmes résolus' }),
    ).toContainText('13')
    const row = page
      .getByRole('region', { name: 'Flux des alertes opérationnelles' })
      .getByRole('button', {
        name: 'Risque de rupture produit PRD-204',
        exact: true,
      })
    await row.click()
    await expect(
      drawer.getByRole('heading', {
        name: 'Risque de rupture produit PRD-204',
      }),
    ).toBeVisible()
    await expect(drawer).toContainText('120 unités')
    await expect(drawer).not.toContainText('24,1 %')
    await drawer
      .getByRole('button', { name: /1. Réapprovisionner PRD-204/ })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'Réapprovisionner PRD-204',
    })
    await expect(dialog).toContainText('450 unités')
    await expect(dialog).toContainText('Approval Required')
    await dialog
      .getByRole('button', { name: 'Enregistrer le brouillon (démo)' })
      .click()
    await expect(dialog.getByRole('status')).toContainText(
      'en attente de validation',
    )
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(drawer).toBeVisible()
    await drawer
      .getByRole('button', { name: 'Fermer le détail de l’alerte' })
      .click()
    await expect(drawer).toHaveCount(0)
    await page
      .getByRole('button', { name: /^Créances échues : impact/ })
      .click()
    await expect(
      drawer.getByRole('heading', {
        name: 'Créances clients à risque (> 30 j)',
      }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Explorer les simulations (4)' })
      .click()
    await expect(
      page.getByText(/Projection basée sur les échéances/),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Actualiser l’analyse' }).click()
    await expect(
      page.getByText('Instantané de démonstration rechargé.'),
    ).toBeVisible()
  })

  test('uses a full screen drawer on mobile, traps focus and restores the usable page', async ({
    page,
  }) => {
    await openControlCenter(page)
    await page.setViewportSize({ width: 390, height: 844 })
    const drawer = page.getByRole('dialog', {
      name: 'Baisse inhabituelle de marge — Électronique',
    })
    await expect(drawer).toHaveAttribute('aria-modal', 'true')
    await expect(drawer).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(
      drawer.getByRole('button', { name: 'Ouvrir PRD-204' }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      drawer.getByRole('button', { name: 'Fermer le détail de l’alerte' }),
    ).toBeFocused()
    await page.screenshot({
      path: 'test-results/ai-control-center-mobile-drawer.png',
    })
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: 'test-results/ai-control-center-mobile.png',
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await page
      .getByRole('navigation', { name: 'Navigation ERP' })
      .getByRole('link', { name: 'Tableau de bord' })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Tableau de bord', exact: true }),
    ).toBeVisible()
  })
})

test.describe('AI Control Center API', () => {
  test.skip(!apiMode, 'Exécuter avec VITE_AI_CONTROL_CENTER_USE_MOCK=false.')

  test('shows loading, then server data without demo claims', async ({
    page,
  }) => {
    let finish: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      finish = resolve
    })
    await page.route('**/api/ai/control-center/', async (route) => {
      expect(route.request().method()).toBe('GET')
      await ready
      await route.fulfill({
        json: {
          ...aiControlCenterMock,
          health: { ...aiControlCenterMock.health, score: 65 },
        },
      })
    })
    await openControlCenter(page)
    await expect(
      page.getByText('Chargement de l’AI Control Center…'),
    ).toBeVisible()
    finish?.()
    await expect(
      page.getByRole('region', { name: 'Santé de l’entreprise' }),
    ).toContainText('65')
    await expect(
      page.getByText('Données de démonstration', { exact: false }),
    ).toHaveCount(0)
    await expect(
      page
        .locator('#alert-detail')
        .getByRole('button', { name: 'Résoudre', exact: true }),
    ).toBeDisabled()
  })

  test('hides technical errors and retries, then renders an empty alert list', async ({
    page,
  }) => {
    let attempts = 0
    let failing = true
    await page.route('**/api/ai/control-center/', (route) => {
      attempts++
      return route.fulfill(
        failing
          ? { status: 500, json: { detail: 'PRIVATE_TRACEBACK' } }
          : { json: { ...aiControlCenterMock, alerts: [] } },
      )
    })
    await openControlCenter(page)
    await expect(page.getByRole('alert')).toContainText(
      'Impossible de charger l’AI Control Center.',
    )
    await expect(page.getByText('PRIVATE_TRACEBACK')).toHaveCount(0)
    const attemptsBeforeRetry = attempts
    failing = false
    await page.getByRole('button', { name: 'Réessayer' }).click()
    await expect(
      page.getByText('Aucune alerte active.', { exact: true }),
    ).toBeVisible()
    await expect(page.locator('#alert-detail')).toHaveCount(0)
    expect(attempts).toBe(attemptsBeforeRetry + 1)
  })
})
