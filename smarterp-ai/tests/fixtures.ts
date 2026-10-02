import { test as base } from '@playwright/test'

export * from '@playwright/test'

// The existing UI suites mock business endpoints. Their anonymous auth transport
// must now include the session bootstrap and the explicit CSRF handshake.
export const test = base.extend<{ authTransport: void }>({
  authTransport: [async ({ page }, use) => {
    await page.route('**/api/auth/csrf/', (route) => route.fulfill({
      json: { csrfToken: 'a'.repeat(64) },
    }))
    await page.route('**/api/auth/session/', (route) => route.fulfill({
      status: 401, json: { detail: 'Authentication credentials were not provided.' },
    }))
    await use()
  }, { auto: true }],
})
