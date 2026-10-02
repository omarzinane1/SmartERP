import { expect, test, type Page } from './fixtures'

const session = {
  user: { id: 41, name: 'Session User', email: 'session@example.test', role: 'Customer reader', permissions: ['customers.view'] },
  company: { id: 11, name: 'Session Company', onboarding_completed: true, enabled_modules: ['customers'] },
}

async function openSession(page: Page) {
  await page.route('**/api/auth/session/', (route) => route.fulfill({ json: session }))
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Profil de Session User' })).toBeVisible()
}

async function clickLogout(page: Page) {
  await page.getByRole('button', { name: 'Profil de Session User' }).click()
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click()
}

test('bootstrap 200 and refresh preserve the Django session without a login flash', async ({ page }) => {
  const visited: string[] = []
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname) })
  await openSession(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Profil de Session User' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(visited).not.toContain('/login')
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} })
})

test('RequireAuth waits while the session status is unknown', async ({ page }) => {
  let finish!: () => void
  const waiting = new Promise<void>((resolve) => { finish = resolve })
  await page.route('**/api/auth/session/', async (route) => { await waiting; await route.fulfill({ json: session }) })
  await page.goto('/dashboard')
  await expect(page.getByRole('status')).toContainText('Chargement')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Bon retour parmi nous' })).not.toBeVisible()
  finish()
  await expect(page.getByRole('button', { name: 'Profil de Session User' })).toBeVisible()
})

test('bootstrap 401 redirects a protected route to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Bon retour parmi nous' })).toBeVisible()
})

test('bootstrap network failure exposes retry instead of assuming an anonymous session', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/auth/session/', async (route) => {
    attempts++
    if (attempts === 1) await route.abort('failed')
    else await route.fulfill({ json: session })
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('alert')).toContainText('Impossible de restaurer votre session')
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Profil de Session User' })).toBeVisible()
})

test('first login POST obtains CSRF explicitly and sends it to the API', async ({ page }) => {
  const calls: string[] = []
  const token = 'b'.repeat(64)
  await page.route('**/api/auth/csrf/', (route) => { calls.push('csrf'); return route.fulfill({ json: { csrfToken: token } }) })
  await page.route('**/api/auth/login/', async (route) => {
    calls.push('login')
    expect(route.request().headers()['x-csrftoken']).toBe(token)
    expect(new URL(route.request().url()).hostname).toBe('localhost')
    await route.fulfill({ json: session })
  })
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(session.user.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password-42')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(calls).toEqual(['csrf', 'login'])
})

test('logout calls Django with CSRF and clears private caches while retaining public data', async ({ page }) => {
  let loggedOut = false
  await page.route('**/api/auth/logout/', async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['x-csrftoken']).toBe('a'.repeat(64))
    loggedOut = true
    await route.fulfill({ status: 204 })
  })
  await openSession(page)
  await page.evaluate(async () => {
    const path = '/src/app/queryClient.ts'
    const { queryClient } = await import(path)
    queryClient.setQueryData(['private-test'], { secret: 'private-value' })
    await queryClient.fetchQuery({ queryKey: ['public-test'], meta: { public: true }, queryFn: () => 'public-value' })
  })
  await clickLogout(page)
  await expect(page).toHaveURL(/\/login$/)
  expect(loggedOut).toBe(true)
  const cache = await page.evaluate(async () => {
    const path = '/src/app/queryClient.ts'
    const { queryClient } = await import(path)
    return { privateMissing: queryClient.getQueryData(['private-test']) === undefined, publicValue: queryClient.getQueryData(['public-test']) }
  })
  expect(cache).toEqual({ privateMissing: true, publicValue: 'public-value' })
  await expect(page.getByRole('button', { name: 'Profil de Session User' })).not.toBeVisible()
})

test('failed logout hides private data and reports the server failure', async ({ page }) => {
  await page.route('**/api/auth/logout/', (route) => route.abort('failed'))
  await openSession(page)
  await clickLogout(page)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText(/la déconnexion serveur a échoué/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Profil de Session User' })).not.toBeVisible()
})

test('an expired session clears auth without calling logout recursively', async ({ page }) => {
  let logouts = 0
  await page.route('**/api/auth/logout/', (route) => { logouts++; return route.fulfill({ status: 204 }) })
  await page.route('**/api/me/', (route) => route.fulfill({ status: 401, json: { detail: 'Session expired.' } }))
  await openSession(page)
  await page.evaluate(async () => {
    const path = '/src/lib/axios.ts'
    const { apiClient } = await import(path)
    try { await apiClient.get('/me/') } catch { /* expected unauthorized response */ }
  })
  await expect(page).toHaveURL(/\/login$/)
  expect(logouts).toBe(0)
  await expect(page.getByText('Votre session a expiré. Veuillez vous reconnecter.')).toBeVisible()
})

test('changing company context removes cached business data', async ({ page }) => {
  await openSession(page)
  const result = await page.evaluate(async () => {
    const cachePath = '/src/app/queryClient.ts'
    const storePath = '/src/store/auth.store.ts'
    const { queryClient } = await import(cachePath)
    const { useAuthStore } = await import(storePath)
    queryClient.setQueryData(['company-a-private'], 'company A data')
    const auth = useAuthStore.getState()
    auth.setAuth({ user: auth.user, company: { ...auth.company, id: 12, name: 'Company B' } })
    return queryClient.getQueryData(['company-a-private']) === undefined
  })
  expect(result).toBe(true)
})

test('bootstrap routes an unfinished company to onboarding', async ({ page }) => {
  await page.route('**/api/auth/session/', (route) => route.fulfill({
    json: { ...session, company: { ...session.company, onboarding_completed: false } },
  }))
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { name: 'Configurer votre société' })).toBeVisible()
})
