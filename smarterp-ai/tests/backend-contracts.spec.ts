import { expect, test } from './fixtures'

const session = {
  user: { id: 41, name: 'Session User', email: 'session@example.test', role: 'Commercial custom', permissions: ['customers.view', 'customers.create', 'customers.edit', 'quotes.view', 'quotes.create', 'quotes.convert'] },
  company: { id: 11, name: 'Session Company', onboarding_completed: true, enabled_modules: ['customers', 'sales', 'invoices'] },
}

test('API customer form saves with CSRF and loads every bounded page', async ({ page }) => {
  const makeCustomer = (id: number, name: string) => ({ id, name, reference: `CUS-${id}`, type: 'company', phone: '', email: `customer${id}@example.test`, city: 'Rabat', district: '', salesperson: 'Session User', revenue: 0, outstanding: 0, overdue: 0, lastActivity: '2026-10-02', activity: 'Fiche créée', createdAt: '2026-10-02', status: 'prospect', tags: [] })
  const rows = [makeCustomer(1, 'Alpha API'), makeCustomer(2, 'Beta API')]
  const pages: number[] = []
  let writes = 0
  await page.route('**/api/auth/session/', (route) => route.fulfill({ json: session }))
  await page.route('**/api/customers/**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      expect(request.headers()['x-csrftoken']).toBe('a'.repeat(64))
      const input = request.postDataJSON()
      expect(input.company_id).toBeUndefined()
      const created = { ...makeCustomer(3, input.name), ...input }
      rows.push(created)
      writes++
      await route.fulfill({ status: 201, json: created })
      return
    }
    const number = Number(new URL(request.url()).searchParams.get('page') ?? 1)
    pages.push(number)
    await route.fulfill({ json: { customers: number === 1 ? rows.slice(0, 1) : rows.slice(1), next: number === 1 ? 'http://localhost:8000/api/customers/?page=2' : null,
      count: rows.length, permissions: session.user.permissions, salespeople: ['Session User'], currentSalesperson: 'Session User',
      period: { asOf: '2026-10-02', syncedAt: '2026-10-02T10:00:00Z', label: 'Portefeuille actuel' }, revenueGrowth: null, dsoDays: null, dsoTarget: null } })
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Profil de Session User' })).toBeVisible()
  await page.evaluate(async () => { const path = '/src/config/env.ts'; (await import(path)).env.customersUseMock = false })
  const nav = page.getByRole('navigation', { name: 'Navigation ERP' })
  await nav.locator('summary').filter({ hasText: /^Ventes$/ }).click()
  await nav.getByRole('link', { name: 'Customers', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Beta API', exact: true })).toBeVisible()
  expect(pages.slice(0, 2)).toEqual([1, 2])
  await expect(page.getByText('Objectif non configuré')).toBeVisible()
  await page.getByRole('button', { name: 'Nouveau client', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom ou raison sociale').fill('Client enregistré API')
  await dialog.getByLabel('Ville du client').fill('Rabat')
  await dialog.getByLabel('E-mail du client').fill('created@example.test')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('link', { name: 'Client enregistré API', exact: true })).toBeVisible()
  expect(writes).toBe(1)
})

test('quote adapter preserves the Django snake_case contract and decimal amounts', async ({ page }) => {
  await page.route('**/api/auth/session/', (route) => route.fulfill({ json: session }))
  await page.route('**/api/quotes/', async (route) => {
    const input = route.request().postDataJSON()
    expect(input.customer_id).toBe(12)
    expect(input.company_id).toBeUndefined()
    expect(input.lines[0]).toEqual({ product_id: null, description: 'Service', quantity: 3, unit_price: 19.99, discount_rate: 10, tax_rate: 20 })
    expect(route.request().headers()['x-csrftoken']).toBe('a'.repeat(64))
    await route.fulfill({ status: 201, json: { ...input, id: 25, reference: 'QUO-2026-0025', customer_name: 'API Customer', customer_email: 'api@example.test', created_at: '2026-10-02T10:00:00Z', total_amount: '64.76', status: 'draft', lines: [{ ...input.lines[0], id: 91, quantity: '3.000', unit_price: '19.99' }], permissions: session.user.permissions, activities: [], as_of: '2026-10-02', products: [], can_accept: false, conversion_targets: [], converted_to: null } })
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Profil de Session User' })).toBeVisible()
  const quote = await page.evaluate(async () => {
    const config = '/src/config/env.ts'; (await import(config)).env.quotesUseMock = false
    const path = '/src/features/quotes/api/quotes.api.ts'
    return (await import(path)).createQuote('scope', { customerId: 12, billingAddress: '', salesperson: 'Session User', issueDate: '2026-10-02', expiresAt: '2026-11-02', currency: 'MAD', paymentTerms: '', customerReference: '', subject: '', deliveryTerms: '', commercialTerms: '', internalNotes: '', customerNotes: '', lines: [{ id: 'local', productId: null, description: 'Service', quantity: 3, unitPrice: 19.99, discountRate: 10, taxRate: 20 }] })
  })
  expect(quote.totalAmount).toBe(64.76)
  expect(quote.lines[0].id).toBe('91')
  expect(quote.lines[0].quantity).toBe(3)
  expect(quote.customerName).toBe('API Customer')
})
