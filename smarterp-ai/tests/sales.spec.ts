import { env } from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { salesMock } from '../src/features/sales/data/sales.mock'
import { remainingQuantity, salesActions, salesFinancials, orderMargin } from '../src/features/sales/sales.utils'
import { calculateTotals, formatMoney } from '../src/lib/money'
import { customerSalesMock } from '../src/features/customers/data/customers.mock'

const apiMode = env.VITE_SALES_USE_MOCK === 'false'
const internalNavigate = async (page: Page, path: string) => page.evaluate((url) => { history.pushState({}, '', url); dispatchEvent(new PopStateEvent('popstate')) }, path)
async function openSales(page: Page) {
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
  await page.getByRole('link', { name: 'Commandes clients', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Commandes clients', exact: true })).toBeVisible()
}
async function openOrder(page: Page, id = 1048) {
  await openSales(page)
  await page.getByRole('link', { name: `Ouvrir SO-2026-${id}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: `Commande SO-2026-${id}`, exact: true })).toBeVisible()
}

test('sales accounting excludes draft/cancelled invoices and unrelated/pending payments; quantities and costs remain coherent', () => {
  const order = structuredClone(salesMock[0])
  expect(order.totalAmount).toBe(customerSalesMock.find((sale) => sale.reference === order.reference)?.amount)
  expect(order.createdAt).toBe('2026-09-30')
  expect(salesFinancials(order)).toEqual({ invoiced: 25500, paid: 12400, balance: 13100, unbilled: 17000 })
  order.invoices.push({ ...order.invoices[0], id: 2, amount: 9000, status: 'draft' }, { ...order.invoices[0], id: 3, amount: 9000, status: 'cancelled' })
  order.payments.push({ ...order.payments[0], id: 2, invoiceId: 2, amount: 9000 }, { ...order.payments[0], id: 3, amount: 500, status: 'pending' }, { ...order.payments[0], id: 4, invoiceId: 999, amount: 700 })
  expect(salesFinancials(order)).toEqual({ invoiced: 25500, paid: 12400, balance: 13100, unbilled: 17000 })
  expect(remainingQuantity(order.lines[0])).toBe(4)
  expect(orderMargin(order)).toBe(11487.84)
  expect(orderMargin(salesMock[5])).toBeNull()
  for (const fixture of salesMock) {
    expect(calculateTotals(fixture.lines)).toEqual(fixture.totals)
    expect(fixture.totalAmount).toBe(fixture.totals.total)
    for (const line of fixture.lines) expect(line.deliveredQuantity).toBeGreaterThanOrEqual(0)
    for (const line of fixture.lines) expect(line.deliveredQuantity).toBeLessThanOrEqual(line.quantity)
    expect(salesFinancials(fixture).paid).toBeLessThanOrEqual(salesFinancials(fixture).invoiced)
  }
  expect(salesActions({ ...salesMock[1], capabilities: { ...salesMock[1].capabilities, canConfirm: false } }).confirm).toBe(false)
})

test.describe('Sales démo', () => {
  test.skip(apiMode, 'Démonstration requise')
  test('partial order, linked records, independent workflow, smart buttons and financial balance', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openOrder(page)
    await expect(page.getByRole('navigation', { name: 'Navigation ERP' }).getByRole('link', { name: 'Commandes clients' })).toHaveAttribute('aria-current', 'page')
    const finance = page.getByRole('region', { name: 'Résumé financier', exact: true })
    await expect(finance).toContainText(formatMoney(42500))
    await expect(finance).toContainText(formatMoney(13100))
    await expect(page.getByRole('region', { name: 'Suivi de livraison' })).toContainText('6 / 13 unités livrées')
    await expect(page.getByRole('region', { name: 'Cycle de la commande' }).locator('[aria-current="step"]')).toHaveText(/En préparation/)
    await expect(page.getByRole('button', { name: 'Confirmer', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Annuler la commande' })).toHaveCount(0)
    await page.getByRole('navigation', { name: 'Documents liés à la commande' }).getByRole('link', { name: 'Factures 1' }).click()
    await expect(page).toHaveURL(/#sales-invoices$/)
    await expect(page.locator('#sales-invoices')).toBeFocused()
    await page.getByRole('link', { name: 'Voir la fiche client' }).click()
    await expect(page).toHaveURL(/\/customers\/124$/)
    await internalNavigate(page, '/sales/1054')
    await page.getByRole('link', { name: 'Devis source 1' }).click()
    await expect(page.getByRole('heading', { name: 'Devis QT-2026-0268', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
  test('delivery and invoice preparations validate limits without changing quantities, stock or counters', async ({ page }) => {
    await openOrder(page)
    await page.getByRole('button', { name: 'Créer une livraison', exact: true }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Aucun document enregistré, aucun stock modifié')
    await dialog.getByLabel('Premium Cable', { exact: false }).fill('5')
    await dialog.getByRole('button', { name: 'Vérifier la préparation' }).click()
    await expect(dialog.getByRole('alert')).toContainText('limite du restant')
    await dialog.getByLabel('Premium Cable', { exact: false }).fill('4')
    await dialog.getByRole('button', { name: 'Vérifier la préparation' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('region', { name: 'Suivi de livraison' })).toContainText('6 / 13 unités livrées')
    await expect(page.getByRole('link', { name: 'Livraisons 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Créer une facture', exact: true }).first().click()
    await dialog.getByLabel('Montant TTC à facturer (MAD)').fill('17000.01')
    await dialog.getByRole('button', { name: 'Vérifier la préparation' }).click()
    await expect(dialog.getByRole('alert')).toContainText('limite facturable')
    await dialog.getByLabel('Montant TTC à facturer (MAD)').fill('1000')
    await dialog.getByRole('button', { name: 'Vérifier la préparation' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Factures 1' })).toBeVisible()
  })
  test('confirmation is explicitly simulated, updates list and activities; cancelled/completed actions stay unavailable', async ({ page }) => {
    await openOrder(page, 1049)
    await expect(page.getByRole('button', { name: 'Annuler la commande' })).toBeDisabled()
    await page.getByRole('button', { name: 'Confirmer', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('confirmation simulée localement')
    await page.getByRole('button', { name: 'Confirmer la commande', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('region', { name: 'Cycle de la commande' }).locator('[aria-current="step"]')).toHaveText(/Confirmée/)
    await expect(page.getByRole('region', { name: 'Activités de la commande' })).toContainText('Confirmation simulée localement')
    await page.getByRole('link', { name: 'Retour', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: 'SO-2026-1049' })).toContainText('Confirmée')
    await page.getByRole('link', { name: 'Ouvrir SO-2026-1051' }).click()
    await expect(page.getByRole('region', { name: 'Résumé financier' })).toContainText('0 MAD')
    await expect(page.getByRole('button', { name: 'Créer une livraison', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Créer une facture', exact: true })).toHaveCount(0)
    await internalNavigate(page, '/sales/1052')
    await expect(page.getByRole('region', { name: 'Cycle de la commande' })).toContainText('Annulée')
    await expect(page.getByRole('button', { name: 'Confirmer', exact: true })).toHaveCount(0)
  })
  test('AI facts are separate from recommendations, unknown margin is explicit, mobile and missing IDs work', async ({ page }) => {
    await openOrder(page, 1053)
    await expect(page.getByRole('region', { name: 'Résumé financier' })).toContainText('Marge indisponible')
    await page.getByRole('button', { name: 'Demander à l’IA' }).click()
    await expect(page.getByRole('button', { name: 'Analyse en cours…' })).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'Faits de la commande' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Risques potentiels' })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: 'test-results/sales-mobile-verified.png', fullPage: true })
    await internalNavigate(page, '/sales/999999')
    await expect(page.getByRole('heading', { name: 'Commande introuvable' })).toBeVisible()
  })
})

test.describe('Sales API', () => {
  test.skip(!apiMode, 'Lancer avec VITE_SALES_USE_MOCK=false')
  async function list(page: Page) {
    await page.route('**/api/sales-orders/', (route) => route.fulfill({ json: { orders: salesMock, permissions: ['sales.view'], asOf: '2026-09-30' } }))
  }
  test('server confirmation, loading lock, cache refresh and rejected delivery remain authoritative', async ({ page }) => {
    let order = structuredClone(salesMock[1])
    let calls = 0
    let gets = 0
    let deliveryCalls = 0
    await list(page)
    await page.route('**/api/sales-orders/', (route) => route.fulfill({ json: { orders: salesMock.map((item) => item.id === order.id ? order : item), permissions: ['sales.view'], asOf: '2026-09-30' } }))
    await page.route('**/api/sales-orders/1049/', (route) => { gets++; return route.fulfill({ json: order }) })
    await page.route('**/api/sales-orders/1049/confirm/', async (route) => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 500))
      order = { ...order, orderStatus: 'confirmed', capabilities: { ...order.capabilities, canConfirm: false, canDeliver: true } }
      await route.fulfill({ json: order })
    })
    await page.route('**/api/sales-orders/1049/delivery/', (route) => { deliveryCalls++; expect(route.request().postDataJSON()).toEqual({ warehouse: 'Casablanca Principal', lines: [{ line_id: 1, quantity: 10 }, { line_id: 2, quantity: 2 }, { line_id: 3, quantity: 1 }] }); return route.fulfill({ status: 409, json: { detail: 'Insufficient stock' } }) })
    await openOrder(page, 1049)
    await page.getByRole('button', { name: 'Confirmer', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la commande', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Confirmation en cours…' })).toBeDisabled()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    expect(calls).toBe(1); expect(gets).toBeGreaterThan(1)
    await expect(page.getByRole('region', { name: 'Cycle de la commande' }).locator('[aria-current="step"]')).toHaveText(/Confirmée/)
    await page.getByRole('button', { name: 'Créer une livraison', exact: true }).first().click()
    await page.getByRole('button', { name: 'Créer la livraison', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('serveur a refusé')
    expect(deliveryCalls).toBe(1)
    await page.getByRole('dialog').getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Suivi de livraison' })).toContainText('0 / 13 unités livrées')
    await page.getByRole('link', { name: 'Retour', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: 'SO-2026-1049' })).toContainText('Confirmée')
  })
  test('successful delivery is planned by backend, invoice amount is capability limited and refreshes financials', async ({ page }) => {
    let order = structuredClone(salesMock[0])
    order.capabilities.invoiceableAmount = 1000
    await list(page)
    await page.route('**/api/sales-orders/1048/', (route) => route.fulfill({ json: order }))
    await page.route('**/api/sales-orders/1048/delivery/', (route) => {
      expect(route.request().method()).toBe('POST')
      order = { ...order, deliveries: [...order.deliveries, { id: 99, reference: 'DEL-SERVER-99', date: '2026-09-30', status: 'planned', warehouse: 'Casablanca Principal', lines: [{ lineId: 1, quantity: 4 }] }] }
      return route.fulfill({ json: { order, reference: 'DEL-SERVER-99' } })
    })
    await page.route('**/api/sales-orders/1048/invoice/', (route) => {
      expect(route.request().postDataJSON()).toEqual({ amount: 500 })
      order = { ...order, invoices: [...order.invoices, { id: 99, reference: 'INV-SERVER-99', date: '2026-09-30', dueDate: '2026-10-30', status: 'posted', amount: 500 }] }
      return route.fulfill({ json: { order, reference: 'INV-SERVER-99' } })
    })
    await openOrder(page)
    await expect(page.getByRole('button', { name: 'Demander à l’IA' })).toBeDisabled()
    await page.getByRole('button', { name: 'Créer une livraison', exact: true }).first().click()
    await page.getByRole('button', { name: 'Créer la livraison', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Livraisons 2' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Suivi de livraison' })).toContainText('6 / 13 unités livrées')
    await expect(page.getByRole('region', { name: 'Suivi de livraison' })).toContainText('Planifiée')
    await page.getByRole('button', { name: 'Créer une facture', exact: true }).first().click()
    await expect(page.getByLabel('Montant TTC à facturer (MAD)')).toHaveValue('1000')
    await page.getByLabel('Montant TTC à facturer (MAD)').fill('500')
    await page.getByRole('button', { name: 'Créer la facture', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Factures 2' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Résumé financier' })).toContainText(formatMoney(13600))
  })
  test('read-only, hidden margins and actions, unknown backend status and disabled capabilities', async ({ page }) => {
    await list(page)
    const order = { ...salesMock[0], orderStatus: 'awaiting_review', permissions: ['sales.view'], capabilities: { ...salesMock[0].capabilities, canConfirm: true } }
    await page.route('**/api/sales-orders/1048/', (route) => route.fulfill({ json: order }))
    await openOrder(page)
    await expect(page.getByText('Lecture seule pour les informations de commande.', { exact: false })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Cycle de la commande' })).toContainText('awaiting_review')
    await expect(page.getByRole('region', { name: 'Résumé financier' })).toContainText('Accès restreint')
    await expect(page.getByText(formatMoney(11487.84), { exact: true })).toHaveCount(0)
    for (const name of ['Confirmer', 'Créer une livraison', 'Créer une facture', 'Demander à l’IA', 'Annuler la commande']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  })
  for (const status of [403, 404, 500]) test(`handles detail HTTP ${status} and offers a useful recovery`, async ({ page }) => {
    await list(page)
    await page.route('**/api/sales-orders/1048/', (route) => route.fulfill({ status, json: { detail: 'Error' } }))
    await openSales(page)
    await page.getByRole('link', { name: 'Ouvrir SO-2026-1048' }).click()
    if (status === 500) { await expect(page.getByRole('alert')).toContainText('Impossible de charger'); await expect(page.getByRole('button', { name: 'Réessayer' })).toBeEnabled() }
    else await expect(page.getByRole('heading', { name: status === 403 ? 'Accès non autorisé' : 'Commande introuvable' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Retour aux commandes' })).toBeVisible()
  })
  test('missing backend capabilities never grant business actions and missing cost stays unavailable', async ({ page }) => {
    await list(page)
    const order = { ...salesMock[1], capabilities: undefined, lines: salesMock[1].lines.map((line) => ({ ...line, unitCost: undefined })) }
    await page.route('**/api/sales-orders/1049/', (route) => route.fulfill({ json: order }))
    await openOrder(page, 1049)
    await expect(page.getByRole('button', { name: 'Confirmer', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Annuler la commande', exact: true })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Résumé financier' })).toContainText('Marge indisponible')
  })
  test('sales.view is required even when the detail endpoint returns HTTP 200', async ({ page }) => {
    await list(page)
    await page.route('**/api/sales-orders/1048/', (route) => route.fulfill({ json: { ...salesMock[0], permissions: [] } }))
    await openSales(page)
    await page.getByRole('link', { name: 'Ouvrir SO-2026-1048' }).click()
    await expect(page.getByRole('heading', { name: 'Accès non autorisé' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Commande SO-2026-1048' })).toHaveCount(0)
  })
})
