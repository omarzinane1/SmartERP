import { env } from 'node:process'
import { expect, test, type Page } from './fixtures'
import { cancelPaymentMock, createPaymentMock, getPaymentsMock, getPaymentsSummaryMock, openPaymentInvoices, paymentSnapshot, paymentsDemoDate } from '../src/features/payments/data/payments.mock'
import { invoiceSnapshot } from '../src/features/invoices/data/invoices.mock'
import { getSuppliersMock, supplierSnapshot, suppliersMock } from '../src/features/suppliers/data/suppliers.mock'
import { filterSuppliers, supplierDefaultFilters, supplierSummary } from '../src/features/suppliers/suppliers.utils'
import { filterPayments, paymentDefaultFilters, paymentPeriod, paymentSummary } from '../src/features/payments/payments.utils'
import { recordPaymentSchema } from '../src/features/payments/schemas/payment.schema'
import { remainingAmount } from '../src/features/invoices/utils/invoiceCalculations'
import { sumMoney, formatMoney } from '../src/lib/money'
import type { PaymentInput } from '../src/features/payments/types/payments.types'

const apiMode = env.VITE_PAYMENTS_USE_MOCK === 'false' && env.VITE_SUPPLIERS_USE_MOCK === 'false'
const paymentQuery = { ...paymentDefaultFilters, page: 1, pageSize: 25, sort: 'date_desc' }
const supplierQuery = { ...supplierDefaultFilters, page: 1, pageSize: 25, sort: 'name' }
async function login(page: Page) {
  await page.route('**/api/auth/login/', (route) => route.fulfill({ json: { user: { id: 1, name: 'Omar Zinane', email: 'omar@atlas.ma', role: 'admin' }, company: { id: 1, name: 'Atlas Distribution SARL', onboarding_completed: true } } }))
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('omar@atlas.ma')
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password-42')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}
async function navigate(page: Page, target: 'Paiements' | 'Fournisseurs') {
  const navigation = page.getByRole('navigation', { name: 'Navigation ERP' })
  const link = navigation.getByRole('link', { name: target, exact: true })
  if (!await link.isVisible()) await navigation.locator('summary').filter({ hasText: target === 'Paiements' ? /^Finance$/ : /^Achats$/ }).click()
  await link.click()
  await expect(page.getByRole('heading', { name: target, exact: true })).toBeVisible()
}
async function recordCritical(page: Page, amount = '6400') {
  await page.getByRole('button', { name: 'Enregistrer un paiement', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tiers *', { exact: true }).selectOption('124')
  await dialog.getByLabel('Facture liée *', { exact: true }).selectOption('413')
  await dialog.getByLabel('Montant (MAD) *', { exact: true }).fill(amount)
  return dialog
}

test('payment summaries count confirmed positive directions, exclude failed/cancelled and never invent missing dates', () => {
  const all = paymentSnapshot('unit-summary')
  expect(new Set(all.map((row) => row.id)).size).toBe(all.length)
  expect(all.every((row) => row.amount > 0)).toBe(true)
  const incoming = all.filter((row) => row.direction === 'incoming' && row.status === 'completed')
  expect(sumMoney(incoming.map((row) => row.amount))).toBe(sumMoney(invoiceSnapshot('unit-summary').map((row) => row.paidAmount)))
  const row = incoming[0]
  const summary = paymentSummary([{ ...row, amount: 6400, invoiceIssuedDate: '2026-09-01', date: '2026-09-23' }, { ...row, amount: 10, status: 'cancelled' }, { ...row, amount: 20, status: 'failed' }, { ...row, amount: 30, direction: 'outgoing', invoiceIssuedDate: null }])
  expect(summary).toEqual({ received: 6400, sent: 30, pending: 0, averageCollectionDays: 22, datedReceipts: 1 })
  expect(paymentSummary([{ ...row, invoiceIssuedDate: null }]).averageCollectionDays).toBeNull()
  expect(paymentPeriod('week', '2026-09-30')).toEqual(['2026-09-28', '2026-09-30'])
  expect(filterPayments(all, { ...paymentDefaultFilters, direction: 'outgoing', status: 'pending', method: 'bank_transfer' }, paymentsDemoDate).every((payment) => payment.direction === 'outgoing' && payment.status === 'pending' && payment.method === 'bank_transfer')).toBe(true)
})
test('critical payment reduces 12800 to 6400 and cancellation restores balances without erasing history', async () => {
  const scope = 'unit-payment-critical'
  const input: PaymentInput = { direction: 'incoming', partnerId: 124, invoiceId: 413, date: paymentsDemoDate, amount: 6400, method: 'bank_transfer', referenceExternal: 'BANK-REF', note: 'Test' }
  const schema = recordPaymentSchema(openPaymentInvoices(scope))
  for (const changed of [{ amount: 0 }, { amount: -1 }, { amount: 12800.01 }, { amount: 1.001 }, { partnerId: 85 }, { direction: 'outgoing' }, { date: '2026-02-31' }]) expect(schema.safeParse({ ...input, ...changed }).success).toBe(false)
  const payment = await createPaymentMock(scope, input)
  expect(remainingAmount(invoiceSnapshot(scope).find((row) => row.id === 413)!)).toBe(6400)
  expect(payment.referenceExternal).toBe('BANK-REF')
  await cancelPaymentMock(scope, payment.id)
  expect(remainingAmount(invoiceSnapshot(scope).find((row) => row.id === 413)!)).toBe(12800)
  expect(paymentSnapshot(scope).find((row) => row.id === payment.id)?.status).toBe('cancelled')
  await expect(cancelPaymentMock(scope, payment.id)).rejects.toThrow()
})
test('outgoing confirmed payments update supplier balances, pending cancellation does not add money', async () => {
  const scope = 'unit-outgoing'
  await cancelPaymentMock(scope, 2_000_005)
  expect(supplierSnapshot(scope).find((row) => row.id === 42)?.outstandingBalance).toBe(48600)
  const payment = await createPaymentMock(scope, { direction: 'outgoing', partnerId: 42, invoiceId: 78, date: paymentsDemoDate, amount: 1000, method: 'cash', referenceExternal: '', note: '' })
  expect(supplierSnapshot(scope).find((row) => row.id === 42)?.outstandingBalance).toBe(47600)
  await cancelPaymentMock(scope, payment.id)
  expect(supplierSnapshot(scope).find((row) => row.id === 42)?.outstandingBalance).toBe(48600)
})
test('supplier filters, unknown lead times and independent score/risk remain coherent', () => {
  const filtered = filterSuppliers(suppliersMock, { ...supplierDefaultFilters, search: 'atlas packaging', country: 'Maroc', buyer: 'Amine Berrada', category: 'Packaging', risk: 'low', status: 'active' }, paymentsDemoDate)
  expect(filtered).toHaveLength(1)
  expect(supplierSummary(filtered)).toEqual({ active: 1, purchaseVolume: 684200, outstandingBalance: 48600, averageLeadTimeDays: 18, atRisk: 0 })
  expect(suppliersMock.some((row) => (row.score ?? 0) > 85 && row.risk === 'high')).toBe(true)
  expect(supplierSummary([{ ...filtered[0], averageLeadTimeDays: null }]).averageLeadTimeDays).toBeNull()
})

test.describe('Payments and Suppliers démo', () => {
  test.skip(apiMode, 'Démonstration requise')
  test('payments list, periods, grouping, filtering, pagination, export and detail', async ({ page }) => {
    await login(page); await navigate(page, 'Paiements')
    await expect(page.locator('.payment-table tbody tr')).toHaveCount(25)
    const summary = await getPaymentsSummaryMock('ui-expected', paymentQuery)
    await expect(page.getByRole('region', { name: 'Indicateurs des paiements filtrés' })).toContainText(formatMoney(summary.received))
    await page.getByRole('button', { name: 'Page suivante' }).click()
    await expect(page.getByText(/Page 2 \//)).toBeVisible()
    await page.getByRole('textbox', { name: 'Rechercher un paiement, une facture ou un tiers' }).fill('SUP-00042')
    await expect(page.locator('.payment-table tbody tr')).toHaveCount(1)
    await expect(page.locator('.payment-table tbody')).toContainText('18 600 MAD')
    await page.getByRole('combobox', { name: 'Regrouper par' }).selectOption('direction')
    await expect(page.locator('.payment-table .group')).toContainText('Décaissement')
    await page.getByRole('button', { name: 'Ouvrir PAY-2026-0186' }).click()
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Ouvrir BILL-2026-0078' })).toBeVisible()
    await page.getByRole('button', { name: 'Fermer', exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter', exact: true }).click()
    expect((await download).suggestedFilename()).toBe('paiements-demo.csv')
    await page.getByRole('button', { name: 'Réinitialiser les filtres', exact: true }).click()
    await page.getByRole('button', { name: 'Filtres', exact: true }).click()
    await page.getByRole('region', { name: 'Filtres avancés paiements' }).getByLabel('Méthode', { exact: true }).selectOption('cheque')
    await page.getByRole('region', { name: 'Filtres avancés paiements' }).getByLabel('Statut', { exact: true }).selectOption('completed')
    await expect(page.locator('.payment-table tbody')).toContainText('Chèque')
    await page.getByRole('combobox', { name: 'Période des paiements' }).selectOption('today')
    await expect(page.locator('.payment-table tbody tr').filter({ hasText: 'PAY-2026-0179' })).toHaveCount(0)
  })
  test('records 6400 against 12800, validates limits, refreshes invoice and cancels without deleting', async ({ page }) => {
    await login(page); await navigate(page, 'Paiements')
    const dialog = await recordCritical(page, '12800.01')
    await dialog.getByRole('button', { name: 'Simuler le paiement' }).click()
    await expect(dialog.getByText(/Le montant dépasse le solde/)).toBeVisible()
    await dialog.getByLabel('Montant (MAD) *', { exact: true }).fill('6400')
    await dialog.getByLabel('Référence externe', { exact: true }).fill('CRITICAL-6400')
    await page.screenshot({ path: 'test-results/payment-modal-desktop.png' })
    await dialog.getByRole('button', { name: 'Simuler le paiement' }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('textbox', { name: 'Rechercher un paiement, une facture ou un tiers' }).fill('CRITICAL-6400')
    const row = page.locator('.payment-table tbody tr')
    await expect(row).toHaveCount(1)
    await row.getByRole('link', { name: 'INV-2026-0413', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Solde restant' })).toHaveText('6 400 MAD')
    await navigate(page, 'Paiements')
    await page.getByRole('textbox', { name: 'Rechercher un paiement, une facture ou un tiers' }).fill('CRITICAL-6400')
    await page.locator('.payment-table tbody tr').getByRole('button', { name: /^Annuler paiement/ }).click()
    await expect(page.getByRole('dialog')).toContainText('modifier le solde')
    await page.getByRole('button', { name: 'Annuler le paiement', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(row).toContainText('Annulé')
    await row.getByRole('link', { name: 'INV-2026-0413', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Solde restant' })).toHaveText('12 800 MAD')
  })
  test('outgoing payment synchronizes supplier balance and screenshots fit desktop and mobile', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message))
    await login(page); await navigate(page, 'Paiements')
    await expect(page.locator('.payment-table tbody tr')).toHaveCount(25)
    await page.screenshot({ path: 'test-results/payments-desktop.png', fullPage: true })
    await page.getByRole('button', { name: 'Enregistrer un paiement', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Type de paiement').selectOption('outgoing')
    await dialog.getByLabel('Tiers *', { exact: true }).selectOption('42')
    await dialog.getByLabel('Facture liée *', { exact: true }).selectOption('78')
    await dialog.getByLabel('Montant (MAD) *', { exact: true }).fill('1000')
    await dialog.getByRole('button', { name: 'Simuler le paiement' }).click()
    await expect(dialog).not.toBeVisible()
    await navigate(page, 'Fournisseurs')
    await page.getByRole('textbox', { name: 'Rechercher un fournisseur, contact, ville ou référence' }).fill('SUP-00042')
    await expect(page.locator('.supplier-table tbody')).toContainText('47 600 MAD')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
  test('suppliers list, combined filters, groups, same-page Kanban, selection, export and placeholder', async ({ page }) => {
    await login(page); await navigate(page, 'Fournisseurs')
    await expect(page.locator('.supplier-table tbody tr')).toHaveCount(25)
    await page.screenshot({ path: 'test-results/suppliers-desktop.png', fullPage: true })
    await page.getByRole('button', { name: 'Page suivante' }).click()
    await expect(page.getByText('Page 2 / 2', { exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: 'Rechercher un fournisseur, contact, ville ou référence' }).fill('SUP-00042')
    await expect(page.locator('.supplier-table tbody tr')).toHaveCount(1)
    await page.getByRole('button', { name: 'Filtres', exact: true }).click()
    await page.getByRole('region', { name: 'Filtres avancés fournisseurs' }).getByLabel('Pays', { exact: true }).selectOption('Maroc')
    await page.getByRole('region', { name: 'Filtres avancés fournisseurs' }).getByLabel('Catégorie', { exact: true }).selectOption('Packaging')
    await page.getByRole('combobox', { name: 'Regrouper par' }).selectOption('buyer')
    await expect(page.locator('.supplier-table .group')).toContainText('Amine Berrada')
    await page.getByRole('checkbox', { name: 'Sélectionner Atlas Packaging', exact: true }).check()
    await page.getByRole('button', { name: 'Vue Kanban' }).click()
    await expect(page.locator('.supplier-tile')).toHaveCount(1)
    await expect(page.getByRole('checkbox', { name: 'Sélectionner Atlas Packaging', exact: true })).toBeChecked()
    await expect(page.locator('.supplier-tile')).toContainText('91 · Excellent')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter la sélection' }).click()
    expect((await download).suggestedFilename()).toBe('fournisseurs-demo.csv')
    await page.getByRole('link', { name: 'Ouvrir Atlas Packaging', exact: true }).click()
    await expect(page).toHaveURL(/\/suppliers\/42$/)
    await expect(page.getByRole('heading', { name: 'Atlas Packaging', exact: true })).toBeVisible()
  })
  test('supplier create, edit and archive are explicit local mutations; empty filter and risk view work', async ({ page }) => {
    await login(page); await navigate(page, 'Fournisseurs')
    await page.getByRole('button', { name: 'Créer un fournisseur', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Nom du fournisseur *', { exact: true }).fill('Nouveau Partenaire Test')
    await dialog.getByLabel('Catégorie *', { exact: true }).fill('Services')
    await dialog.getByLabel('Ville *', { exact: true }).fill('Rabat')
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('textbox', { name: 'Rechercher un fournisseur, contact, ville ou référence' }).fill('Nouveau Partenaire Test')
    await expect(page.locator('.supplier-table tbody')).toContainText('Non évalué')
    await page.getByRole('button', { name: 'Modifier Nouveau Partenaire Test' }).click()
    await dialog.getByLabel('Ville *', { exact: true }).fill('Fès')
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.supplier-table tbody')).toContainText('Fès')
    await page.getByRole('button', { name: 'Archiver Nouveau Partenaire Test' }).click()
    await page.getByRole('button', { name: 'Confirmer l’archivage' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.supplier-table tbody')).toContainText('Archivé')
    await expect(page.getByRole('button', { name: 'Archiver Nouveau Partenaire Test' })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Rechercher un fournisseur, contact, ville ou référence' }).fill('zz-inconnu')
    await expect(page.getByRole('heading', { name: 'Aucun fournisseur ne correspond à vos critères' })).toBeVisible()
    await page.getByRole('button', { name: 'Réinitialiser les filtres', exact: true }).first().click()
    await page.getByRole('combobox', { name: 'Favoris' }).selectOption('risk')
    await page.getByRole('button', { name: 'Vue Kanban' }).click()
    await expect(page.getByRole('region', { name: 'Élevé', exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/suppliers-kanban-desktop.png', fullPage: true })
  })
})

test.describe('Payments and Suppliers API', () => {
  test.skip(!apiMode, 'Lancer avec VITE_PAYMENTS_USE_MOCK=false et VITE_SUPPLIERS_USE_MOCK=false')
  async function paymentRoutes(page: Page) {
    const data = await getPaymentsMock('api-fixture', paymentQuery)
    const summary = await getPaymentsSummaryMock('api-fixture', paymentQuery)
    await page.route(/\/api\/payments\/(?:\?.*)?$/, (route) => route.fulfill({ json: data }))
    await page.route(/\/api\/payments\/summary\/(?:\?.*)?$/, (route) => route.fulfill({ json: summary }))
    return data
  }
  async function supplierRoutes(page: Page) {
    const data = await getSuppliersMock('api-fixture', supplierQuery)
    await page.route(/\/api\/suppliers\/(?:\?.*)?$/, (route) => route.fulfill({ json: data }))
    return data
  }
  for (const [target, path] of [['Paiements', 'payments'], ['Fournisseurs', 'suppliers']] as const) {
    test(`${target}: loading, error without fallback, retry and empty response`, async ({ page }) => {
      const data = target === 'Paiements' ? await paymentRoutes(page) : await supplierRoutes(page)
      let fail = true
      await page.route(new RegExp(`/api/${path}/(?:\\?.*)?$`), async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return route.fulfill(fail ? { status: 500, json: { detail: 'Private error' } } : { json: { ...data, [path]: [], count: 0, totalCount: 0 } })
      })
      await login(page); await navigate(page, target)
      await expect(page.getByRole('status')).toContainText(`Chargement des ${path === 'payments' ? 'paiements' : 'fournisseurs'}`)
      await expect(page.getByRole('alert')).toContainText(`Impossible de charger les ${path === 'payments' ? 'paiements' : 'fournisseurs'}`)
      await expect(page.getByText(/Mode démonstration/)).toHaveCount(0)
      fail = false
      await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
      await expect(page.getByRole('heading', { name: target === 'Paiements' ? 'Aucun paiement enregistré.' : 'Aucun fournisseur pour le moment', exact: true })).toBeVisible()
    })
    for (const deniedStatus of [200, 403]) test(`${target}: access denied with HTTP ${deniedStatus}`, async ({ page }) => {
      const data = target === 'Paiements' ? await paymentRoutes(page) : await supplierRoutes(page)
      await page.route(new RegExp(`/api/${path}/(?:\\?.*)?$`), (route) => route.fulfill({ status: deniedStatus, json: { ...data, permissions: [] } }))
      await login(page)
      const navigation = page.getByRole('navigation', { name: 'Navigation ERP' })
      await navigation.locator('summary').filter({ hasText: target === 'Paiements' ? /^Finance$/ : /^Achats$/ }).click()
      await navigation.getByRole('link', { name: target, exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Accès non autorisé' })).toBeVisible()
      await expect(page.locator('.business-table')).toHaveCount(0)
    })
  }
  test('read-only RBAC hides mutations and exports in both modules and filters reach the server', async ({ page }) => {
    const payments = await paymentRoutes(page)
    const suppliers = await supplierRoutes(page)
    let paymentSearch = ''; let supplierSearch = ''
    await page.route(/\/api\/payments\/(?:\?.*)?$/, (route) => { paymentSearch = new URL(route.request().url()).searchParams.get('search') ?? ''; return route.fulfill({ json: { ...payments, permissions: ['payments.view'] } }) })
    await page.route(/\/api\/suppliers\/(?:\?.*)?$/, (route) => { supplierSearch = new URL(route.request().url()).searchParams.get('search') ?? ''; return route.fulfill({ json: { ...suppliers, permissions: ['suppliers.view'] } }) })
    await login(page); await navigate(page, 'Paiements')
    await expect(page.locator('.payment-table tbody tr')).toHaveCount(25)
    for (const name of [/^Enregistrer un paiement$/, /^Exporter$/, /^Annuler paiement/]) await expect(page.getByRole('button', { name })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Rechercher un paiement, une facture ou un tiers' }).fill('nova')
    await expect.poll(() => paymentSearch).toBe('nova')
    await navigate(page, 'Fournisseurs')
    await expect(page.locator('.supplier-table tbody tr')).toHaveCount(25)
    for (const name of [/^Créer un fournisseur$/, /^Exporter$/, /^Modifier /, /^Archiver /]) await expect(page.getByRole('button', { name })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Rechercher un fournisseur, contact, ville ou référence' }).fill('atlas')
    await expect.poll(() => supplierSearch).toBe('atlas')
  })
  test('missing capabilities never allow cancellation or archive, and summary failure is explicit', async ({ page }) => {
    const payments = await paymentRoutes(page)
    const suppliers = await supplierRoutes(page)
    await page.route(/\/api\/payments\/(?:\?.*)?$/, (route) => route.fulfill({ json: { ...payments, payments: payments.payments.map((row) => ({ ...row, canCancel: undefined })) } }))
    await page.route(/\/api\/payments\/summary\/(?:\?.*)?$/, (route) => route.fulfill({ status: 500, json: {} }))
    await page.route(/\/api\/suppliers\/(?:\?.*)?$/, (route) => route.fulfill({ json: { ...suppliers, suppliers: suppliers.suppliers.map((row) => ({ ...row, capabilities: undefined })) } }))
    await login(page); await navigate(page, 'Paiements')
    await expect(page.getByRole('alert')).toContainText('Impossible de charger les indicateurs')
    await expect(page.getByRole('button', { name: /^Annuler paiement/ })).toHaveCount(0)
    await navigate(page, 'Fournisseurs')
    await expect(page.locator('.supplier-table tbody tr')).toHaveCount(25)
    await expect(page.getByRole('button', { name: /^Archiver / })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Modifier / })).toHaveCount(0)
  })
  test('server payment rejection preserves form; confirmed creation and cancellation refresh invoice balance', async ({ page }) => {
    const base = await paymentRoutes(page)
    const invoice = structuredClone(invoiceSnapshot('api-fixture').find((row) => row.id === 413)!)
    const seed = paymentSnapshot('api-fixture').find((row) => row.invoiceId === 413)!
    let rows = [seed]; let reject = true; let creates = 0; let cancels = 0
    await page.route(/\/api\/payments\/(?:\?.*)?$/, async (route) => {
      if (route.request().method() === 'POST') {
        creates++
        expect(route.request().postDataJSON()).toMatchObject({ direction: 'incoming', partner_id: 124, invoice_id: 413, amount: 6400, method: 'bank_transfer' })
        if (reject) return route.fulfill({ status: 409, json: { detail: 'Balance conflict' } })
        const created = { ...seed, id: 9001, reference: 'PAY-SERVER-9001', amount: 6400, status: 'completed' as const }
        rows.push(created); invoice.paidAmount = 18200
        invoice.payments.push({ id: 9001, reference: created.reference, date: paymentsDemoDate, amount: 6400, method: 'Virement bancaire', status: 'confirmed' })
        return route.fulfill({ json: created })
      }
      return route.fulfill({ json: { ...base, payments: rows, count: rows.length } })
    })
    await page.route('**/api/payments/9001/cancel/', async (route) => {
      cancels++; await new Promise((resolve) => setTimeout(resolve, 400))
      rows = rows.map((row) => row.id === 9001 ? { ...row, status: 'cancelled', canCancel: false } : row)
      invoice.paidAmount = 11800; invoice.payments.at(-1)!.status = 'cancelled'
      return route.fulfill({ json: rows[1] })
    })
    await page.route('**/api/invoices/413/', (route) => route.fulfill({ json: invoice }))
    await login(page); await navigate(page, 'Paiements')
    const dialog = await recordCritical(page)
    await dialog.getByRole('button', { name: 'Confirmer le paiement' }).click()
    await expect(dialog.getByRole('alert')).toContainText('refusé')
    await expect(dialog.getByLabel('Montant (MAD) *')).toHaveValue('6400')
    expect(invoice.paidAmount).toBe(11800)
    reject = false
    await dialog.getByRole('button', { name: 'Confirmer le paiement' }).click()
    await expect(dialog).not.toBeVisible()
    const row = page.locator('.payment-table tbody tr').filter({ hasText: 'PAY-SERVER-9001' })
    await row.getByRole('link', { name: 'INV-2026-0413' }).click()
    await expect(page.getByRole('status', { name: 'Solde restant' })).toHaveText('6 400 MAD')
    await navigate(page, 'Paiements')
    expect(cancels).toBe(0)
    await page.getByRole('button', { name: 'Annuler paiement PAY-SERVER-9001' }).click()
    await page.getByRole('button', { name: 'Annuler le paiement', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(row).toContainText('Annulé')
    await row.getByRole('link', { name: 'INV-2026-0413' }).click()
    await expect(page.getByRole('status', { name: 'Solde restant' })).toHaveText('12 800 MAD')
    expect(creates).toBe(2); expect(cancels).toBe(1)
  })
  test('supplier PATCH errors preserve edits; successful edits and archive use canonical data and no invented endpoint', async ({ page }) => {
    const base = await supplierRoutes(page)
    let supplier = structuredClone(suppliersMock[0]); let reject = true; let archives = 0
    await page.route(/\/api\/suppliers\/(?:\?.*)?$/, (route) => route.fulfill({ json: { ...base, suppliers: [supplier], count: 1 } }))
    await page.route('**/api/suppliers/42/', (route) => {
      expect(route.request().method()).toBe('PATCH')
      const input = route.request().postDataJSON()
      if (input.status === 'archived') { archives++; expect(input).toEqual({ status: 'archived' }); supplier = { ...supplier, status: 'archived', capabilities: { canEdit: false, canArchive: false } } }
      else {
        expect(input).not.toHaveProperty('purchaseVolume')
        if (reject) return route.fulfill({ status: 400, json: { name: ['Invalid'] } })
        supplier = { ...supplier, city: input.city }
      }
      return route.fulfill({ json: supplier })
    })
    await login(page); await navigate(page, 'Fournisseurs')
    await page.getByRole('button', { name: 'Modifier Atlas Packaging' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Ville *', { exact: true }).fill('Rabat')
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Impossible')
    await expect(dialog.getByLabel('Ville *', { exact: true })).toHaveValue('Rabat')
    reject = false
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.supplier-table tbody')).toContainText('Rabat')
    await page.getByRole('button', { name: 'Archiver Atlas Packaging' }).click()
    expect(archives).toBe(0)
    await page.getByRole('button', { name: 'Confirmer l’archivage' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.supplier-table tbody')).toContainText('Archivé')
    expect(archives).toBe(1)
  })
})

