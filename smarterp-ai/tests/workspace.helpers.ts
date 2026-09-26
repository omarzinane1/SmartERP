import { expect, type Page } from '@playwright/test'
export const demoUser = { id: 1, name: 'Omar Zinane', email: 'omar@atlas.ma', role: 'admin' }
export const demoCompany = { id: 1, name: 'Atlas Distribution SARL', onboardingCompleted: true }
export async function signIn(page: Page, permissions?: string[]) {
  await page.route('**/api/auth/login/', (route) => route.fulfill({ json: { user: { ...demoUser, ...(permissions ? { permissions } : {}) }, company: { id: 1, name: demoCompany.name, onboarding_completed: true } } }))
  await page.goto('/login'); await page.getByLabel('Adresse e-mail', { exact: true }).fill(demoUser.email); await page.getByLabel('Mot de passe', { exact: true }).fill('test-password-42'); await page.getByRole('button', { name: 'Se connecter', exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/)
}
export const go = (page: Page, path: string) => page.evaluate((url) => { history.pushState({}, '', url); dispatchEvent(new PopStateEvent('popstate')) }, path)
export async function openPage(page: Page, path: string, permissions?: string[]) { await signIn(page, permissions); await go(page, path) }
export const reportParams = { dateFrom: '2026-09-01', dateTo: '2026-09-30', partner: '', owner: '', category: '', warehouse: '' }
