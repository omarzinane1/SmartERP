import { expect, test, type Page, type Request } from './fixtures'

const endpoint = '**/api/company/onboarding/'

function completedResponse(payload: { company: { name: string }; modules: string[] }) {
  return { user: { id: 1, name: 'Admin', email: 'admin@atlas.ma', role: 'admin', permissions: [] }, company: { id: 1, name: payload.company.name, onboarding_completed: true, enabled_modules: payload.modules } }
}

const next = (page: Page) =>
  page.getByRole('button', { name: 'Enregistrer et continuer' }).click()

async function openOnboarding(page: Page) {
  await page.route('**/api/auth/login/', (route) =>
    route.fulfill({
      json: {
        user: { id: 1, name: 'Admin', email: 'admin@atlas.ma', role: 'admin' },
        company: {
          id: 1,
          name: 'Atlas Distribution SARL',
          onboarding_completed: false,
        },
      },
    }),
  )
  await page.goto('/login')
  await page
    .getByLabel('Adresse e-mail', { exact: true })
    .fill('admin@atlas.ma')
  await page
    .getByLabel('Mot de passe', { exact: true })
    .fill('test-password-42')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(
    page.getByRole('heading', { name: '1. Informations de la société' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close toast', exact: true }).click()
}

async function fillCompany(page: Page) {
  await page
    .getByLabel('Raison sociale')
    .fill('Atlas Distribution SARL d’importation et négoce')
  await page.getByLabel('ICE / Identifiant fiscal').fill('002391290000018')
  await page
    .getByLabel('Email professionnel')
    .fill('contact@atlasdistribution.ma')
  await page.getByLabel('Téléphone', { exact: true }).fill('+212 522 48 90 00')
  await page
    .getByLabel('Site web', { exact: true })
    .fill('https://atlasdistribution.ma')
  await page
    .getByLabel('Adresse de la société')
    .fill('Zone industrielle Sidi Maârouf, boulevard Al Qods, lot 42')
  await page.getByLabel('Ville', { exact: false }).fill('Casablanca')
  await page.getByLabel('Code postal').fill('20280')
}

async function fillBusiness(page: Page) {
  await page.getByLabel('Secteur d’activité').selectOption('Distribution')
  await page
    .getByLabel('Activité principale')
    .fill('Distribution de fournitures professionnelles')
  await page.getByLabel('Taille de l’entreprise').selectOption('small')
  await page.getByLabel('Nombre d’employés').fill('25')
}

async function reachInventory(page: Page) {
  await openOnboarding(page)
  await fillCompany(page)
  await next(page)
  await fillBusiness(page)
  await next(page)
  await expect(
    page.getByRole('heading', { name: '3. Finance et fiscalité' }),
  ).toBeVisible()
  await next(page)
}

async function reachReview(page: Page, stock = true) {
  await reachInventory(page)
  if (stock) {
    await page
      .getByLabel('Nom du dépôt principal')
      .fill('Dépôt principal Casablanca')
    await page.getByLabel('Code dépôt').fill('CAS-01')
  } else {
    await page
      .getByRole('switch', { name: /Activer la gestion du stock/ })
      .uncheck()
  }
  await next(page)
  await next(page)
  await next(page)
  await expect(
    page.getByRole('heading', { name: '7. Vérifiez votre configuration' }),
  ).toBeVisible()
}

test('guards the route and validates company fields before next or sidebar navigation', async ({
  page,
}) => {
  await page.goto('/onboarding')
  await expect(page).toHaveURL(/\/login$/)
  await openOnboarding(page)
  await page.getByLabel('Nom de la société').fill('')
  await page
    .getByRole('navigation', { name: 'Étapes de configuration' })
    .getByRole('button', { name: /7 Vérification/ })
    .click()
  await expect(
    page.getByText('Le nom de la société est obligatoire.'),
  ).toBeVisible()
  await expect(page.getByLabel('Nom de la société')).toBeFocused()
  await expect(
    page.getByRole('heading', { name: '1. Informations de la société' }),
  ).toBeVisible()
  await page.getByLabel('Nom de la société').fill('Atlas Distribution SARL')
  await fillCompany(page)
  await page.getByLabel('Email professionnel').fill('adresse-invalide')
  await next(page)
  await expect(
    page.getByText('Veuillez saisir une adresse e-mail valide.'),
  ).toBeVisible()
  await page.getByLabel('Email professionnel').fill('contact@atlas.ma')
  await next(page)
  await expect(
    page.getByRole('heading', { name: '2. Votre activité' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Retour', exact: true }).click()
  await expect(page.getByLabel('Email professionnel')).toHaveValue(
    'contact@atlas.ma',
  )
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '14',
  )
})

test('validates numeric finance fields and fiscal date ordering', async ({
  page,
}) => {
  await openOnboarding(page)
  await fillCompany(page)
  await next(page)
  await fillBusiness(page)
  await page.getByLabel('Nombre d’employés').fill('-1')
  await next(page)
  await expect(
    page.getByText('Le nombre ne peut pas être négatif.'),
  ).toBeVisible()
  await page.getByLabel('Nombre d’employés').fill('')
  await next(page)
  await page.getByLabel('TVA par défaut').fill('101')
  await page.getByLabel('Début exercice fiscal').fill('2026-12-31')
  await page.getByLabel('Fin exercice fiscal').fill('2026-01-01')
  await next(page)
  await expect(
    page.getByText('Le taux doit être entre 0 et 100 %.'),
  ).toBeVisible()
  await expect(
    page.getByText('La fin de l’exercice doit suivre sa date de début.'),
  ).toBeVisible()
  await page.getByLabel('TVA par défaut').fill('20')
  await page.getByLabel('Début exercice fiscal').fill('2026-01-01')
  await page.getByLabel('Fin exercice fiscal').fill('2026-12-31')
  await next(page)
  await expect(
    page.getByRole('heading', { name: '4. Gestion du stock' }),
  ).toBeVisible()
})

test('handles stock conditionally, invoice validation, module selection and review editing', async ({
  page,
}) => {
  await reachInventory(page)
  await next(page)
  await expect(
    page.getByText(
      'Le nom du dépôt est obligatoire lorsque le stock est activé.',
    ),
  ).toBeVisible()
  await page
    .getByRole('switch', { name: /Activer la gestion du stock/ })
    .uncheck()
  await expect(page.getByLabel('Nom du dépôt principal')).not.toBeVisible()
  await next(page)
  await page.getByLabel('Numéro de départ facture').fill('0')
  await next(page)
  await expect(
    page.getByText('Le numéro doit être supérieur à zéro.'),
  ).toBeVisible()
  await page.getByLabel('Numéro de départ facture').fill('42')
  await expect(
    page.getByText(`INV-${new Date().getFullYear()}-0042`, { exact: true }),
  ).toBeVisible()
  await next(page)
  await expect(
    page.getByRole('switch', { name: 'Stock', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('switch', { name: 'Stock', exact: true }),
  ).not.toBeChecked()
  await page
    .getByRole('switch', { name: 'AI Control Center', exact: true })
    .check()
  await next(page)
  await expect(
    page.getByRole('region', { name: 'Résumé Modules' }),
  ).toContainText('AI Control Center')
  await expect(
    page.getByRole('region', { name: 'Résumé Stock' }),
  ).toContainText('Désactivée')
  await page.getByRole('button', { name: 'Modifier Société' }).click()
  await page.getByLabel('Nom de la société').fill('Atlas Services')
  await page
    .getByRole('navigation', { name: 'Étapes de configuration' })
    .getByRole('button', { name: /Vérification/ })
    .click()
  await expect(
    page.getByRole('region', { name: 'Résumé Société' }),
  ).toContainText('Atlas Services')
  await expect(
    page.getByRole('region', { name: 'Résumé Facturation' }),
  ).toContainText('0042')
})

test('requires one module and preserves the selection across previous and next steps', async ({
  page,
}) => {
  await reachReview(page)
  await page.getByRole('button', { name: 'Modifier Modules' }).click()
  const switches = page.getByRole('switch')
  for (const control of await switches.all())
    if (await control.isChecked()) await control.uncheck()
  await next(page)
  await expect(
    page.getByText('Activez au moins un module pour commencer.'),
  ).toBeVisible()
  await page.getByRole('switch', { name: 'Documents', exact: true }).check()
  await page.getByRole('button', { name: 'Retour', exact: true }).click()
  await next(page)
  await expect(
    page.getByRole('switch', { name: 'Documents', exact: true }),
  ).toBeChecked()
  await next(page)
  await expect(
    page.getByRole('region', { name: 'Résumé Modules' }),
  ).toContainText('Documents')
})

test('submits once, maps the Django payload, displays success and redirects', async ({
  page,
}) => {
  const requests: Request[] = []
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  let finish: (() => void) | undefined
  const ready = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(endpoint, async (route) => {
    requests.push(route.request())
    await ready
    await route.fulfill({ status: 200, json: completedResponse(route.request().postDataJSON()) })
  })
  await reachReview(page)
  expect(requests).toHaveLength(0)
  await page.getByRole('button', { name: 'Terminer la configuration' }).click()
  await expect(
    page.getByRole('button', { name: 'Enregistrement...' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Modifier Société' }),
  ).toBeDisabled()
  await expect.poll(() => requests.length).toBe(1)
  await page.keyboard.press('Enter')
  const payload = requests[0].postDataJSON()
  expect(requests[0].method()).toBe('POST')
  expect(payload.company).toMatchObject({
    name: 'Atlas Distribution SARL',
    country: 'MA',
    currency: 'MAD',
    legal_name: 'Atlas Distribution SARL d’importation et négoce',
    logo: null,
  })
  expect(payload.business.employee_count).toBe(25)
  expect(payload.finance.vat_rate).toBe(20)
  expect(payload.inventory).toMatchObject({
    enabled: true,
    warehouse_name: 'Dépôt principal Casablanca',
    warehouse_code: 'CAS-01',
  })
  expect(payload.invoicing).toMatchObject({
    invoice_prefix: 'INV-',
    invoice_start: 1,
    quote_prefix: 'QT-',
  })
  expect(payload.modules).toContain('ai_assistant')
  expect(requests).toHaveLength(1)
  finish?.()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(
    page.getByText('Votre société est prête.', { exact: true }),
  ).toBeVisible()
  expect(browserErrors).toEqual([])
})

test('keeps data after API errors, permits retry and omits disabled stock settings', async ({
  page,
}) => {
  let attempts = 0
  await page.route(endpoint, async (route) => {
    attempts += 1
    expect(route.request().postDataJSON().inventory).toEqual({ enabled: false })
    expect(route.request().postDataJSON().modules).not.toContain('inventory')
    expect(route.request().postDataJSON().modules).not.toContain('warehouses')
    await route.fulfill(
      attempts === 1
        ? { status: 500, json: { detail: 'SECRET_INTERNAL_ERROR' } }
        : { status: 200, json: completedResponse(route.request().postDataJSON()) },
    )
  })
  await reachReview(page, false)
  await page.getByRole('button', { name: 'Terminer la configuration' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Impossible d’enregistrer la configuration. Veuillez réessayer.',
  )
  await expect(page.getByText('SECRET_INTERNAL_ERROR')).not.toBeVisible()
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(
    page.getByRole('region', { name: 'Résumé Société' }),
  ).toContainText('Atlas Distribution SARL')
  await page.getByRole('button', { name: 'Terminer la configuration' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(attempts).toBe(2)
})

test('handles an offline submission without staying in a loading state', async ({
  page,
  context,
}) => {
  await reachReview(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Terminer la configuration' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Impossible d’enregistrer la configuration.',
  )
  await expect(
    page.getByRole('button', { name: 'Terminer la configuration' }),
  ).toBeEnabled()
})

test('imports, previews and removes the company logo and rejects unsupported files', async ({
  page,
}) => {
  await openOnboarding(page)
  const upload = page.getByLabel('Importer le logo de la société')
  await upload.setInputFiles({
    name: 'logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg />'),
  })
  await expect(
    page.getByText('Choisissez une image PNG, JPG ou WebP de 2 Mo maximum.'),
  ).toBeVisible()
  await upload.setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',
      'base64',
    ),
  })
  await expect(
    page.getByRole('img', { name: 'Logo de la société' }),
  ).toBeVisible()
  await fillCompany(page)
  await next(page)
  await page.getByRole('button', { name: 'Retour', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'Logo de la société' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Supprimer le logo' }).click()
  await expect(
    page.getByRole('img', { name: 'Logo de la société' }),
  ).not.toBeVisible()
})

test('renders the company page at desktop size and keeps all steps usable on mobile', async ({
  page,
}) => {
  await openOnboarding(page)
  await fillCompany(page)
  await page.screenshot({
    path: 'test-results/onboarding-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.screenshot({
    path: 'test-results/onboarding-mobile.png',
    fullPage: true,
  })
  const noOverflow = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  await noOverflow()
  await expect(
    page.getByRole('button', { name: 'Enregistrer et continuer' }),
  ).toBeInViewport()
  await next(page)
  await fillBusiness(page)
  await next(page)
  await noOverflow()
  await next(page)
  await page
    .getByRole('switch', { name: /Activer la gestion du stock/ })
    .uncheck()
  await next(page)
  await next(page)
  await noOverflow()
  await expect(
    page
      .getByRole('navigation', { name: 'Étapes de configuration' })
      .getByRole('button', { name: /6 Modules/ }),
  ).toBeInViewport()
  await page.screenshot({
    path: 'test-results/onboarding-modules-mobile.png',
    fullPage: true,
  })
  await next(page)
  await noOverflow()
  await expect(
    page.getByRole('button', { name: 'Terminer la configuration' }),
  ).toBeInViewport()
})
