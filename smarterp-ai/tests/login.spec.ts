import { expect, test, type Page, type Request } from './fixtures'

const loginEndpoint = '**/api/auth/login/'
const credentials = { email: 'admin@company.com', password: 'test-password-42' }

function successfulResponse(onboardingCompleted: boolean | null = true) {
  return {
    user: { id: 1, name: 'Test Admin', email: credentials.email, role: 'admin' },
    company: onboardingCompleted === null
      ? null
      : { id: 1, name: 'Test Company', onboarding_completed: onboardingCompleted },
    access: 'fixture-access-token',
    refresh: 'fixture-refresh-token',
  }
}

async function fillCredentials(page: Page) {
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(credentials.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password)
}

async function browserStorage(page: Page) {
  return page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
  }))
}

test('validates required fields and email in French without contacting the API', async ({ page }) => {
  let requests = 0
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.location().url.includes('/api/auth/session/')) browserErrors.push(message.text())
  })
  await page.route(loginEndpoint, async (route) => {
    requests += 1
    await route.abort()
  })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Bon retour parmi nous' })).toBeVisible()
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByText(/L[’']adresse e-mail est obligatoire\./)).toBeVisible()
  await expect(page.getByText('Le mot de passe est obligatoire.')).toBeVisible()
  await expect(page.getByLabel('Adresse e-mail', { exact: true })).toBeFocused()
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('invalid-email')
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByText('Veuillez saisir une adresse e-mail valide.')).toBeVisible()
  expect(requests).toBe(0)
  expect(browserErrors).toEqual([])
})

test('toggles the password with keyboard controls without submitting', async ({ page }) => {
  await page.goto('/login')
  const password = page.getByLabel('Mot de passe', { exact: true })
  await password.fill(credentials.password)
  await expect(password).toHaveAttribute('type', 'password')
  await password.press('Tab')
  const showPassword = page.getByRole('button', { name: 'Afficher le mot de passe' })
  await expect(showPassword).toBeFocused()
  await showPassword.press('Enter')
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue(credentials.password)
  await page.getByRole('button', { name: 'Masquer le mot de passe' }).press('Space')
  await expect(password).toHaveAttribute('type', 'password')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText(/L[’']adresse e-mail est obligatoire\./)).not.toBeVisible()
})

test('submits on Enter, sends only the credentials, and prevents duplicate pending requests', async ({ page }) => {
  const requests: Request[] = []
  let releaseResponse: (() => void) | undefined
  const responseReady = new Promise<void>((resolve) => { releaseResponse = resolve })
  await page.route(loginEndpoint, async (route) => {
    requests.push(route.request())
    await responseReady
    await route.fulfill({ json: successfulResponse() })
  })
  await page.goto('/login')
  await fillCredentials(page)
  await page.getByLabel('Mot de passe', { exact: true }).press('Enter')
  const pendingButton = page.getByRole('button', { name: /Connexion\.\.\./ })
  await expect(pendingButton).toBeDisabled()
  await expect(page.getByLabel('Adresse e-mail', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeDisabled()
  await expect.poll(() => requests.length).toBe(1)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  expect(requests).toHaveLength(1)
  expect(requests[0].method()).toBe('POST')
  expect(new URL(requests[0].url()).pathname).toBe('/api/auth/login/')
  expect(requests[0].postDataJSON()).toEqual(credentials)
  releaseResponse?.()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Connexion réussie', { exact: true })).toBeVisible()
})

for (const scenario of [
  { name: 'completed onboarding', completed: true, path: '/dashboard' },
  { name: 'incomplete onboarding', completed: false, path: '/onboarding' },
  { name: 'no company yet', completed: null, path: '/onboarding' },
]) {
  test(`redirects after login with ${scenario.name} without persisting credentials or tokens`, async ({ page }) => {
    await page.route(loginEndpoint, (route) => route.fulfill({ json: successfulResponse(scenario.completed) }))
    await page.goto('/login')
    await fillCredentials(page)
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${scenario.path}$`))
    const storage = await browserStorage(page)
    expect(storage).toEqual({ local: {}, session: {} })
    await expect(page.getByText('fixture-access-token')).not.toBeVisible()
    await expect(page.getByText('fixture-refresh-token')).not.toBeVisible()
  })
}

for (const scenario of [
  { name: 'invalid credentials', status: 401, code: 'invalid_credentials', message: 'Adresse e-mail ou mot de passe incorrect.' },
  { name: 'forbidden access', status: 403, code: 'permission_denied', message: "Votre compte n'est pas autorisé à accéder à SmartERP AI." },
  { name: 'disabled account', status: 403, code: 'account_disabled', message: 'Votre compte a été désactivé. Contactez votre administrateur.' },
  { name: 'server failure', status: 500, code: 'internal_error', message: 'Une erreur est survenue. Veuillez réessayer.' },
]) {
  test(`shows a safe French error for ${scenario.name} and permits retry`, async ({ page }) => {
    let attempts = 0
    await page.route(loginEndpoint, async (route) => {
      attempts += 1
      await route.fulfill({ status: scenario.status, json: { code: scenario.code, detail: 'Technical traceback: SECRET_INTERNAL_ERROR' } })
    })
    await page.goto('/login')
    await fillCredentials(page)
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(scenario.message)
    await expect(page.getByText(/SECRET_INTERNAL_ERROR/)).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeEnabled()
    await expect(page).toHaveURL(/\/login$/)
    expect(attempts).toBe(1)
    await expect(page.getByLabel('Adresse e-mail', { exact: true })).toHaveValue(credentials.email)
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect.poll(() => attempts).toBe(2)
    await expect(page.getByRole('alert')).toContainText(scenario.message)
  })
}

test('shows a French network error when the server cannot be reached', async ({ page }) => {
  await page.route(loginEndpoint, (route) => route.abort('failed'))
  await page.goto('/login')
  await fillCredentials(page)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Impossible de contacter le serveur. Vérifiez votre connexion.')
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeEnabled()
})

test('does not remain loading when the browser is already offline at submission', async ({ page, context }) => {
  await page.goto('/login')
  await fillCredentials(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Impossible de contacter le serveur. Vérifiez votre connexion.')
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeEnabled()
  await expect(page).toHaveURL(/\/login$/)
})

test('rejects a malformed success response without authenticating', async ({ page }) => {
  await page.route(loginEndpoint, (route) => route.fulfill({ json: { unexpected: true } }))
  await page.goto('/login')
  await fillCredentials(page)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Une erreur est survenue. Veuillez réessayer.')
  await expect(page).toHaveURL(/\/login$/)
  expect(await browserStorage(page)).toEqual({ local: {}, session: {} })
})

test('remembers only the email after opt-in and removes it after opt-out', async ({ page }) => {
  await page.route(loginEndpoint, (route) => route.fulfill({ json: successfulResponse() }))
  await page.goto('/login')
  await fillCredentials(page)
  await page.getByRole('checkbox', { name: 'Se souvenir de moi' }).check()
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const storage = await browserStorage(page)
  expect(Object.values(storage.local)).toEqual([credentials.email])
  expect(storage.session).toEqual({})
  await page.goto('/login')
  await expect(page.getByLabel('Adresse e-mail', { exact: true })).toHaveValue(credentials.email)
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue('')
  await expect(page.getByRole('checkbox', { name: 'Se souvenir de moi' })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Se souvenir de moi' }).uncheck()
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(await browserStorage(page)).toEqual({ local: {}, session: {} })
  await page.goto('/login')
  await expect(page.getByLabel('Adresse e-mail', { exact: true })).toHaveValue('')
  await expect(page.getByRole('checkbox', { name: 'Se souvenir de moi' })).not.toBeChecked()
})

test('keeps the form usable on a small screen without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await expect(page.getByLabel('Adresse e-mail', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeInViewport()
  const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  expect(widths.page).toBeLessThanOrEqual(widths.viewport)
})
