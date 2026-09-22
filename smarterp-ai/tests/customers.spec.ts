import { readFile } from 'node:fs/promises'
import { env } from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { customersMock } from '../src/features/customers/data/customers.mock'

const apiMode = env.VITE_CUSTOMERS_USE_MOCK === 'false'

async function openCustomers(page: Page) {
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
  const navigation = page.getByRole('navigation', { name: 'Navigation ERP' })
  await navigation
    .locator('summary')
    .filter({ hasText: /^Ventes$/ })
    .click()
  await navigation.getByRole('link', { name: 'Customers', exact: true }).click()
  await expect(page).toHaveURL(/\/customers$/)
}

test.describe('Clients démo', () => {
  test.skip(apiMode, 'Vérification du portefeuille de démonstration.')

  test('renders the Stitch layout with real totals, 25 rows and the shared navigation', async ({
    page,
  }) => {
    const errors: string[] = []
    const requests: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error')
        errors.push(message.text())
    })
    page.on('request', (request) => {
      if (request.url().includes('/api/customers/'))
        requests.push(request.url())
    })
    await openCustomers(page)
    await expect(
      page.getByRole('heading', { name: 'Clients', exact: true }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation ERP' })
        .getByRole('link', { name: 'Customers', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      page.getByRole('navigation', { name: 'Fil d’Ariane' }),
    ).toContainText('Ventes')
    const summary = page.getByRole('region', { name: 'Indicateurs clients' })
    await expect(summary.getByRole('article')).toHaveCount(5)
    for (const value of [
      /248/,
      /231 actifs/,
      /284\s300 MAD/,
      /73\s500 MAD/,
      /8\s920\s400 MAD/,
    ])
      await expect(summary).toContainText(value)
    await expect(
      page.getByText('+32 nouveaux ce mois', { exact: false }),
    ).toBeVisible()
    await expect(page.locator('.customers-table tbody tr')).toHaveCount(25)
    await expect(
      page.getByText('1–25 sur 248 clients', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('checkbox', {
        name: 'Sélectionner Nova Retail SARL',
        exact: true,
      })
      .check()
    await expect(
      page.getByRole('region', { name: 'Actions sur la sélection' }),
    ).toContainText('Nova Retail SARL')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(
      page.getByText('Connexion réussie', { exact: true }),
    ).toBeHidden()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: 'test-results/customers-desktop.png',
      fullPage: true,
    })
    await page.screenshot({ path: 'test-results/customers-top.png' })
    expect(requests).toEqual([])
    expect(errors).toEqual([])
  })

  test('paginates all 248 records and shares selection between list and Kanban', async ({
    page,
  }) => {
    await openCustomers(page)
    await expect(
      page.getByRole('button', { name: 'Page précédente', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('checkbox', {
        name: 'Sélectionner Nova Retail SARL',
        exact: true,
      })
      .check()
    await page
      .getByRole('button', { name: 'Page suivante', exact: true })
      .click()
    await expect(
      page.getByText('26–50 sur 248 clients', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Actions sur la sélection' }),
    ).toContainText('Dont 1 hors de cette page')
    await page
      .getByRole('checkbox', {
        name: 'Sélectionner tous les clients de cette page',
      })
      .check()
    await expect(
      page.getByRole('region', { name: 'Actions sur la sélection' }),
    ).toContainText('26 clients sélectionnés')
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    const kanban = page.getByRole('region', { name: 'Vue Kanban des clients' })
    await expect(kanban.getByRole('article')).toHaveCount(25)
    await expect(kanban.getByRole('checkbox').first()).toBeChecked()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: 'test-results/customers-kanban.png',
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Vue liste', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Clients par page' })
      .selectOption('100')
    await expect(page.locator('.customers-table tbody tr')).toHaveCount(100)
    await page
      .getByRole('button', { name: 'Page suivante', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Page suivante', exact: true })
      .click()
    await expect(
      page.getByText('201–248 sur 248 clients', { exact: true }),
    ).toBeVisible()
    await expect(page.locator('.customers-table tbody tr')).toHaveCount(48)
    await expect(
      page.getByRole('button', { name: 'Page suivante', exact: true }),
    ).toBeDisabled()
  })

  test('searches contact fields, combines filters, groups rows and restores saved views', async ({
    page,
  }) => {
    await openCustomers(page)
    const search = page.getByRole('textbox', { name: 'Rechercher des clients' })
    for (const value of [
      'nova retail',
      'CUS-000124',
      'contact@novaretail.example',
      '+212 522 45 88 12',
    ]) {
      await search.fill(value)
      await expect(page.locator('.customers-table tbody tr')).toHaveCount(1)
      await expect(
        page.getByRole('link', { name: 'Nova Retail SARL', exact: true }),
      ).toBeVisible()
    }
    await search.fill('aucun-client-inconnu')
    await expect(
      page.getByText('Aucun client ne correspond à vos critères.'),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Réinitialiser les filtres', exact: true })
      .first()
      .click()
    await page
      .locator('summary')
      .filter({ hasText: /^Filtres/ })
      .click()
    await page
      .getByRole('combobox', { name: 'Filtrer par ville' })
      .selectOption('Marrakech')
    await page
      .getByRole('combobox', { name: 'Filtrer par statut' })
      .selectOption('at_risk')
    await page.getByRole('checkbox', { name: 'Avec encours client' }).check()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('link', { name: 'Riad Pro', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Nova Retail SARL', exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole('combobox', { name: 'Grouper les clients' })
      .selectOption('city')
    await expect(page.locator('.customers-group-row')).toContainText(
      'Marrakech',
    )
    await page
      .getByRole('button', { name: 'Enregistrer la vue', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Réinitialiser les filtres', exact: true })
      .click()
    await expect(page.locator('.customers-table tbody tr')).toHaveCount(25)
    await page
      .getByRole('combobox', { name: 'Favoris', exact: true })
      .selectOption('saved')
    await expect(page.locator('.customers-group-row')).toContainText(
      'Marrakech',
    )
    await page
      .getByRole('combobox', { name: 'Favoris', exact: true })
      .selectOption('overdue')
    await expect(
      page.getByText('1–5 sur 5 clients', { exact: true }),
    ).toBeVisible()
    const ready = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter', exact: true }).click()
    const download = await ready
    const content = await readFile((await download.path())!, 'utf8')
    expect(content.split('\r\n')).toHaveLength(6)
    expect(content).toContain('Nova Retail SARL')
    expect(content).not.toContain('Marrakech Market')
    expect(content).toContain('Démonstration')
  })

  test('creates and edits a small customer record and restores its status after archiving', async ({
    page,
  }) => {
    await openCustomers(page)
    await page
      .getByRole('button', { name: 'Nouveau client', exact: true })
      .click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByRole('textbox', { name: 'Nom ou raison sociale' })
      .fill('Client de contrôle')
    await dialog
      .getByRole('textbox', { name: 'Ville du client' })
      .fill('Casablanca')
    await dialog
      .getByRole('textbox', { name: 'E-mail du client' })
      .fill('controle@example.com')
    await dialog.getByRole('button', { name: 'Enregistrer (démo)' }).click()
    await expect(
      page.getByText('1–25 sur 249 clients', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Modifier Client de contrôle', exact: true })
      .click()
    await dialog
      .getByRole('textbox', { name: 'Nom ou raison sociale' })
      .fill('Client de contrôle modifié')
    await dialog.getByRole('button', { name: 'Enregistrer (démo)' }).click()
    await page
      .getByRole('textbox', { name: 'Rechercher des clients' })
      .fill('contrôle modifié')
    await expect(page.locator('.customers-table tbody tr')).toHaveCount(1)
    await page
      .getByRole('button', {
        name: 'Archiver Client de contrôle modifié',
        exact: true,
      })
      .click()
    await expect(page.locator('.customers-table tbody tr')).toContainText(
      'Archivé',
    )
    await page
      .getByRole('button', {
        name: 'Désarchiver Client de contrôle modifié',
        exact: true,
      })
      .click()
    await expect(page.locator('.customers-table tbody tr')).toContainText(
      'Prospect',
    )
  })

  test('assigns and tags a selection, exports it and never sends an imported file', async ({
    page,
  }) => {
    const uploads: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/customers/import/'))
        uploads.push(request.url())
    })
    await openCustomers(page)
    for (const name of ['Nova Retail SARL', 'Marrakech Market'])
      await page
        .getByRole('checkbox', { name: `Sélectionner ${name}`, exact: true })
        .check()
    const bar = page.getByRole('region', { name: 'Actions sur la sélection' })
    await bar.getByRole('button', { name: 'Assigner', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Commercial à assigner' })
      .selectOption('Amine Taha')
    await page.getByRole('button', { name: 'Appliquer (démo)' }).click()
    await expect(
      page
        .locator('.customers-table tbody tr')
        .filter({ hasText: 'Nova Retail SARL' }),
    ).toContainText('Amine Taha')
    await bar.getByRole('button', { name: 'Ajouter un tag' }).click()
    await page
      .getByRole('textbox', { name: 'Nouveau tag' })
      .fill('Priorité 2026')
    await page.getByRole('button', { name: 'Appliquer (démo)' }).click()
    const ready = page.waitForEvent('download')
    await bar.getByRole('button', { name: 'Exporter', exact: true }).click()
    const content = await readFile((await (await ready).path())!, 'utf8')
    expect(content.split('\r\n')).toHaveLength(3)
    expect(content).toContain('Priorité 2026')
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    await expect(
      page
        .getByRole('region', { name: 'Vue Kanban des clients' })
        .getByText('Priorité 2026'),
    ).toHaveCount(2)
    await page.getByRole('button', { name: 'Importer', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Importer des clients' })
    await dialog.getByLabel('Fichier clients').setInputFiles({
      name: 'clients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,email\nClient,client@example.com'),
    })
    await expect(dialog.getByRole('status')).toContainText('clients.csv')
    await expect(dialog).toContainText('Aucun fichier n’est envoyé ni importé')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(uploads).toEqual([])
  })

  test('opens the future customer detail and remains usable on mobile', async ({
    page,
  }) => {
    await page.goto('/customers/124')
    await expect(page).toHaveURL(/\/login$/)
    await openCustomers(page)
    await page
      .getByRole('link', { name: 'Nova Retail SARL', exact: true })
      .click()
    await expect(page).toHaveURL(/\/customers\/124$/)
    await expect(
      page.getByRole('heading', { name: 'Fiche client · 124' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Retour aux clients' }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page
      .getByRole('textbox', { name: 'Rechercher des clients' })
      .fill('Nova Retail')
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    await page
      .getByRole('checkbox', {
        name: 'Sélectionner Nova Retail SARL',
        exact: true,
      })
      .check()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: 'test-results/customers-mobile.png',
      fullPage: true,
    })
    await page
      .getByRole('button', { name: 'Nouveau client', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Nouveau client', exact: true }),
    ).toBeFocused()
  })
})

test.describe('Clients API', () => {
  test.skip(!apiMode, 'Lancer avec VITE_CUSTOMERS_USE_MOCK=false.')

  test('shows loading and uses the server permissions', async ({ page }) => {
    let finish: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      finish = resolve
    })
    await page.route('**/api/customers/', async (route) => {
      expect(route.request().method()).toBe('GET')
      await ready
      await route.fulfill({
        json: {
          ...customersMock,
          permissions: ['customers.view'],
          customers: customersMock.customers.slice(0, 2),
        },
      })
    })
    await openCustomers(page)
    await expect(page.getByText('Chargement des clients…')).toBeVisible()
    finish?.()
    await expect(
      page.getByText('1–2 sur 2 clients', { exact: true }),
    ).toBeVisible()
    for (const name of [
      'Nouveau client',
      'Importer',
      'Exporter',
      'Modifier Nova Retail SARL',
      'Archiver Nova Retail SARL',
    ])
      await expect(
        page.getByRole('button', { name, exact: true }),
      ).toBeDisabled()
    await expect(
      page.getByText('Données de démonstration', { exact: false }),
    ).toHaveCount(0)
  })

  test('shows a safe error, retries and offers create/import for an empty portfolio', async ({
    page,
  }) => {
    let failing = true
    await page.route('**/api/customers/', (route) =>
      route.fulfill(
        failing
          ? { status: 500, json: { detail: 'PRIVATE_CUSTOMERS_ERROR' } }
          : { json: { ...customersMock, customers: [] } },
      ),
    )
    await openCustomers(page)
    await expect(page.getByRole('alert')).toContainText(
      'Impossible de charger les clients.',
    )
    await expect(page.getByText('PRIVATE_CUSTOMERS_ERROR')).toHaveCount(0)
    failing = false
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByText('Aucun client pour le moment.')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Créer un client', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Importer des clients', exact: true }),
    ).toBeVisible()
  })

  for (const deniedBy of ['http', 'permissions'])
    test(`denies access via ${deniedBy} without exposing customer rows`, async ({
      page,
    }) => {
      await page.route('**/api/customers/', (route) =>
        route.fulfill(
          deniedBy === 'http'
            ? { status: 403, json: { detail: 'PRIVATE_PERMISSION_INFO' } }
            : { json: { ...customersMock, permissions: [] } },
        ),
      )
      await openCustomers(page)
      await expect(
        page.getByRole('heading', { name: 'Accès non autorisé' }),
      ).toBeVisible()
      await expect(page.getByRole('table')).toHaveCount(0)
      await expect(page.getByText('PRIVATE_PERMISSION_INFO')).toHaveCount(0)
    })
})
