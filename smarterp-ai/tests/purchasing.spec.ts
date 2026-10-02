import { env } from 'node:process'
import { expect, test, type Page } from './fixtures'
import { calculateTotals, formatMoney, sumMoney } from '../src/lib/money'
import { purchaseActionMock, purchaseById, purchaseSnapshot, purchasingDemoDate, purchasingPermissions, savePurchaseMock } from '../src/features/purchases/data/purchases.mock'
import { billPurchaseMock, postSupplierInvoiceMock, purchaseDetailMock, recordSupplierPaymentMock, saveSupplierInvoiceMock, supplierInvoiceById, supplierInvoiceSnapshot } from '../src/features/supplier-invoices/data/supplierInvoices.mock'
import { supplierDetailMock, supplierMetricsMock } from '../src/features/suppliers/data/supplierDetail.mock'
import { supplierSnapshot } from '../src/features/suppliers/data/suppliers.mock'
import { cancelPaymentMock, createPaymentMock, paymentSnapshot } from '../src/features/payments/data/payments.mock'
import { filterPurchases, purchaseDefaultFilters, purchaseSummary, receiptProgress } from '../src/features/purchases/purchases.utils'
import { hasQuantityMismatch, payableAging, payableBalance, payableBucket, payableSummary } from '../src/features/supplier-invoices/supplierInvoices.utils'
import { purchaseSchema, receiptSchema } from '../src/features/purchases/schemas/purchase.schema'
import { supplierInvoiceSchema } from '../src/features/supplier-invoices/schemas/supplierInvoice.schema'
import type { PurchasingPermission } from '../src/features/purchases/types/purchases.types'

const apiMode = env.VITE_PURCHASES_USE_MOCK === 'false' && env.VITE_SUPPLIER_INVOICES_USE_MOCK === 'false'
const navigate = async (page: Page, path: string) => page.evaluate((url) => { history.pushState({}, '', url); dispatchEvent(new PopStateEvent('popstate')) }, path)
async function login(page: Page) {
  await page.route('**/api/auth/login/', (route) => route.fulfill({ json: { user: { id: 1, name: 'Omar Zinane', email: 'omar@atlas.ma', role: 'admin' }, company: { id: 1, name: 'Atlas Distribution SARL', onboarding_completed: true } } }))
  await page.goto('/login'); await page.getByLabel('Adresse e-mail', { exact: true }).fill('omar@atlas.ma'); await page.getByLabel('Mot de passe', { exact: true }).fill('test-password-42'); await page.getByRole('button', { name: 'Se connecter', exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/)
}
async function open(page: Page, path: string) { await login(page); await navigate(page, path) }

test('purchasing ledger: totals, receipts, supplier balances and outgoing payments share the same facts', () => {
  const scope = 'purchasing-integrity', orders = purchaseSnapshot(scope), bills = supplierInvoiceSnapshot(scope)
  for (const o of orders) {
    expect(o.lines.every((l) => l.receivedQuantity <= l.quantity && l.receivedQuantity >= 0)).toBe(true)
    expect(calculateTotals(o.lines).total).toBe(o.total)
    for (const line of o.lines) expect(o.receipts.flatMap((r) => r.lines).filter((l) => l.lineId === line.id).reduce((sum, l) => sum + l.quantity, 0)).toBe(line.receivedQuantity)
  }
  for (const bill of bills) {
    expect(calculateTotals(bill.lines).total).toBe(bill.total)
    expect(bill.paidAmount).toBe(sumMoney(paymentSnapshot(scope).filter((p) => p.direction === 'outgoing' && p.invoiceId === bill.id && p.status === 'completed').map((p) => p.amount)))
  }
  for (const supplier of supplierSnapshot(scope)) {
    const metrics = supplierMetricsMock(scope, supplier.id)
    expect(metrics.outstandingBalance).toBe(supplier.outstandingBalance)
    expect(metrics.purchaseVolume).toBe(supplier.purchaseVolume)
  }
  const order = purchaseDetailMock(scope, 321), bill = supplierInvoiceById(scope, 78)
  expect([order.total, order.billedAmount, order.paidAmount, payableBalance(bill)]).toEqual([86400, 48600, 18600, 30000])
  expect([order.status, order.receiptStatus, order.billingStatus]).toEqual(['confirmed', 'partially_received', 'partially_billed'])
  expect(receiptProgress(order).percent).toBe(60)
  expect(purchaseSummary([order], purchasingDemoDate)).toMatchObject({ month: 86400, expected: 1, overdue: 1, remaining: 34560 })
  expect(filterPurchases(orders, { ...purchaseDefaultFilters, supplier: '42', quick: 'partial' }, purchasingDemoDate, 'Amine Berrada')).toHaveLength(1)
})
test('aging boundaries use only posted remaining balances and exclude drafts, cancelled and paid', () => {
  const invoice = supplierInvoiceById('aging', 78)
  for (const [date, bucket] of [['2026-09-30', 'current'], ['2026-10-01', '1-30'], ['2026-10-30', '1-30'], ['2026-10-31', '31-60'], ['2026-11-29', '31-60'], ['2026-11-30', '61-90'], ['2026-12-29', '61-90'], ['2026-12-30', '90+']]) expect(payableBucket(invoice, date)).toBe(bucket)
  const rows = [invoice, { ...invoice, workflowStatus: 'draft' as const }, { ...invoice, workflowStatus: 'cancelled' as const }, { ...invoice, paidAmount: invoice.total }]
  expect(sumMoney(payableAging(rows, '2026-10-01').map((b) => b.amount))).toBe(30000)
  expect(payableSummary([invoice], '2026-09-30')).toEqual({ balance: 30000, soon: 30000, overdue: 0, paid: 18600 })
})
test('receipt validation and bill creation reserve only received quantities and prevent duplicate billing', async () => {
  const scope = 'receipt-and-bill', order = purchaseById(scope, 321)
  const input = { date: purchasingDemoDate, warehouse: order.warehouse, lines: [{ lineId: 'box', quantity: 401 }] }
  expect(receiptSchema(order).safeParse(input).success).toBe(false)
  expect(receiptSchema(order).safeParse({ ...input, lines: [{ lineId: 'box', quantity: 0 }] }).success).toBe(false)
  await expect(purchaseActionMock(scope, 321, 'receive', input)).rejects.toThrow()
  const received = await purchaseActionMock(scope, 321, 'receive', { ...input, lines: [{ lineId: 'box', quantity: 400 }, { lineId: 'film', quantity: 360 }] })
  expect(received.receiptStatus).toBe('received'); expect(received.status).toBe('confirmed')
  const bill = await billPurchaseMock(scope, 321)
  expect(bill.total).toBe(37800); expect(bill.workflowStatus).toBe('draft')
  expect(purchaseDetailMock(scope, 321).billedAmount).toBe(48600)
  await expect(billPurchaseMock(scope, 321)).rejects.toThrow()
  await postSupplierInvoiceMock(scope, bill.id)
  expect(purchaseDetailMock(scope, 321).billingStatus).toBe('billed')
  expect(supplierMetricsMock(scope, 42).outstandingBalance).toBe(86400)
})
test('payment on either entry point refreshes canonical bill and supplier balances; cancellation restores history', async () => {
  const scope = 'bill-payment', input = { direction: 'outgoing' as const, partnerId: 42, invoiceId: 78, date: purchasingDemoDate, amount: 10000, method: 'bank_transfer' as const, referenceExternal: 'TEST-BANK', note: '' }
  const first = await recordSupplierPaymentMock(scope, input)
  expect(payableBalance(supplierInvoiceById(scope, 78))).toBe(20000)
  expect(supplierMetricsMock(scope, 42).outstandingBalance).toBe(38600)
  expect(paymentSnapshot(scope).find((p) => p.id === first.id)?.amount).toBe(10000)
  await expect(createPaymentMock(scope, { ...input, amount: 20000.01 })).rejects.toThrow()
  const second = await createPaymentMock(scope, { ...input, amount: 20000 })
  expect(supplierInvoiceById(scope, 78).paymentStatus).toBe('paid')
  await cancelPaymentMock(scope, second.id)
  expect(payableBalance(supplierInvoiceById(scope, 78))).toBe(20000)
  expect(supplierInvoiceById(scope, 78).payments.find((p) => p.id === second.id)?.status).toBe('cancelled')
  await expect(recordSupplierPaymentMock(scope, { ...input, amount: -1 })).rejects.toThrow()
})
test('draft editing, posting and quantity matching validate rather than inventing facts', async () => {
  const scope = 'draft-edit', initial = supplierInvoiceById(scope, 78)
  expect(supplierInvoiceSchema.safeParse({ ...initial, dueDate: '2026-02-31' }).success).toBe(false)
  expect(supplierInvoiceSchema.safeParse({ ...initial, lines: [] }).success).toBe(false)
  expect(hasQuantityMismatch(initial)).toBe(false)
  expect(hasQuantityMismatch({ ...initial, lines: [initial.lines[0], { ...initial.lines[0], id: 'duplicate' }] })).toBe(true)
  const draft = await saveSupplierInvoiceMock(scope, { ...initial, supplierReference: 'NEW-42', lines: [{ ...initial.lines[0], purchaseLineId: null, quantity: 10 }] })
  expect(draft.workflowStatus).toBe('draft')
  const posted = await postSupplierInvoiceMock(scope, draft.id)
  expect(posted.workflowStatus).toBe('posted')
  await expect(saveSupplierInvoiceMock(scope, posted, posted.id)).rejects.toThrow()
  const order = purchaseById(scope, 321)
  expect(purchaseSchema.safeParse({ ...order, expectedDate: '2025-01-01' }).success).toBe(false)
  const created = await savePurchaseMock(scope, { ...order, lines: [{ ...order.lines[0], quantity: 10, receivedQuantity: 0 }] })
  const volume = supplierSnapshot(scope).find((s) => s.id === 42)!.purchaseVolume
  await purchaseActionMock(scope, created.id, 'send'); await purchaseActionMock(scope, created.id, 'confirm')
  expect(supplierSnapshot(scope).find((s) => s.id === 42)!.purchaseVolume).toBe(volume + created.total)
})

test.describe('Purchasing demo', () => {
  test.skip(apiMode, 'Démonstration requise')
  test('supplier 360, tabs, metrics, history, AI and real related routes', async ({ page }) => {
    await open(page, '/suppliers/42')
    await expect(page.getByRole('heading', { name: 'Atlas Packaging', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Indicateurs fournisseur' })).toContainText(formatMoney(684200))
    await page.getByLabel('Période historique prix').selectOption('12')
    await page.getByRole('button', { name: 'Analyser avec IA', exact: true }).click()
    await expect(page.getByText('Analyse en cours…').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'AI ANALYSIS', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Contrats', exact: true }).click(); await expect(page.getByRole('tabpanel')).toContainText('Accord de fourniture')
    await page.getByRole('button', { name: 'Commandes achat — 2', exact: true }).click()
    await page.getByRole('link', { name: 'PO-2026-0321', exact: true }).click(); await expect(page).toHaveURL(/\/purchases\/321$/)
    await expect(page.getByRole('navigation', { name: 'Navigation ERP' }).getByRole('link', { name: 'Commandes fournisseurs', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
  test('purchases filters, grouping, list/kanban, selection, pagination, export and empty search', async ({ page }) => {
    await open(page, '/purchases'); await expect(page.locator('.purchase-table tbody tr')).toHaveCount(25)
    await page.getByRole('button', { name: 'Page suivante' }).click(); await expect(page.getByText(/Page 2 \//)).toBeVisible()
    await page.getByRole('textbox', { name: 'Rechercher une commande fournisseur' }).fill('Atlas Packaging')
    await page.getByRole('button', { name: 'Filtres', exact: true }).click()
    await page.getByRole('region', { name: 'Filtres achats' }).getByLabel('Fournisseur', { exact: true }).selectOption('42')
    await page.getByLabel('Regrouper par').selectOption('supplierName'); await expect(page.locator('.purchase-table .group')).toContainText('Atlas Packaging')
    await page.getByRole('checkbox', { name: 'Sélectionner PO-2026-0321', exact: true }).check()
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exporter la sélection' }).click(); expect((await download).suggestedFilename()).toBe('commandes-fournisseurs.csv')
    await page.getByRole('button', { name: 'Kanban', exact: true }).click(); await expect(page.locator('.supplier-tile')).toHaveCount(2)
    await page.getByRole('button', { name: 'En retard', exact: true }).click(); await expect(page.locator('.supplier-tile')).toHaveCount(1)
    await page.screenshot({ path: 'test-results/purchases-kanban-1440.png', fullPage: true })
    await page.getByRole('textbox', { name: 'Rechercher une commande fournisseur' }).fill('inexistant-zz'); await expect(page.getByRole('heading', { name: 'Aucune commande ne correspond à vos critères.' })).toBeVisible()
  })
  test('draft create, edit, send confirmation and confirm remain separate from receipt', async ({ page }) => {
    await open(page, '/purchases'); await page.getByRole('button', { name: 'Créer commande', exact: true }).click()
    const d = page.getByRole('dialog'); await d.getByLabel('Fournisseur *', { exact: true }).selectOption('42')
    await d.getByLabel('Produit ligne 1', { exact: true }).fill('Boîte test'); await d.getByLabel('Quantité ligne 1', { exact: true }).fill('10'); await d.getByLabel('Prix unitaire ligne 1', { exact: true }).fill('100')
    await d.getByRole('button', { name: 'Enregistrer le brouillon', exact: true }).click(); await expect(page).toHaveURL(/\/purchases\/\d+$/)
    await page.getByRole('button', { name: 'Modifier', exact: true }).click(); await d.getByLabel('Notes', { exact: true }).fill('Contrôle édition'); await d.getByRole('button', { name: 'Enregistrer le brouillon', exact: true }).click(); await expect(d).not.toBeVisible()
    await page.getByRole('button', { name: 'Envoyer', exact: true }).click(); await expect(d).toBeVisible(); await d.getByRole('button', { name: 'Retour', exact: true }).click(); await expect(page.getByLabel('États de la commande')).toContainText('Brouillon')
    await page.getByRole('button', { name: 'Envoyer', exact: true }).click(); await d.getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(d).not.toBeVisible()
    await page.getByRole('button', { name: 'Confirmer', exact: true }).click(); await d.getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(d).not.toBeVisible()
    await expect(page.getByLabel('États de la commande')).toContainText('Non reçue'); await expect(page.getByRole('button', { name: 'Réceptionner', exact: true })).toBeVisible()
  })
  test('receive partial order validates remaining quantities then creates one linked draft bill', async ({ page }) => {
    await open(page, '/purchases/321'); await expect(page.getByLabel('États de la commande')).toContainText('Partiellement facturée')
    await page.getByRole('button', { name: 'Réceptionner', exact: true }).click()
    const d = page.getByRole('dialog'); await d.getByLabel('Quantité à recevoir Premium Packaging Box').fill('401'); await d.getByRole('button', { name: 'Confirmer la réception' }).click(); await expect(d).toContainText('dépasse le restant')
    await d.getByLabel('Quantité à recevoir Premium Packaging Box').fill('400'); await d.getByLabel('Quantité à recevoir Film de protection').fill('360'); await d.getByRole('button', { name: 'Confirmer la réception' }).click(); await expect(d).not.toBeVisible()
    await expect(page.getByText('100 % reçu', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Créer facture fournisseur', exact: true }).click(); await d.getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(page).toHaveURL(/\/supplier-invoices\/\d+$/)
    await expect(page.locator('.business-kpis')).toContainText(formatMoney(37800)); await expect(page.getByRole('button', { name: 'Valider', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Valider', exact: true }).click(); await d.getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(d).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Modifier le brouillon' })).toHaveCount(0)
  })
  test('bill payment, overpayment validation, linked payments and cancellation update both pages', async ({ page }) => {
    await open(page, '/supplier-invoices/78'); await expect(page.locator('.business-kpis')).toContainText(formatMoney(30000))
    await page.getByRole('button', { name: 'Enregistrer paiement', exact: true }).click(); const d = page.getByRole('dialog')
    await expect(d.getByLabel('Type de paiement')).toHaveValue('outgoing'); await d.getByLabel('Montant (MAD) *', { exact: true }).fill('30000.01'); await d.getByRole('button', { name: 'Simuler le paiement' }).click(); await expect(d).toContainText('dépasse le solde disponible')
    await d.getByLabel('Montant (MAD) *', { exact: true }).fill('10000'); await d.getByRole('button', { name: 'Simuler le paiement' }).click(); await expect(d).not.toBeVisible(); await expect(page.locator('.business-kpis')).toContainText(formatMoney(20000))
    await page.locator('#bill-payments').getByRole('link', { name: /PAY-DEMO/ }).click(); await expect(page.locator('.payment-table tbody tr')).toHaveCount(1)
    await page.getByRole('button', { name: /Annuler paiement PAY-DEMO/ }).click(); await d.getByRole('button', { name: 'Annuler le paiement', exact: true }).click(); await expect(d).not.toBeVisible()
    await page.getByRole('link', { name: 'BILL-2026-0078', exact: true }).click(); await expect(page.locator('.business-kpis')).toContainText(formatMoney(30000))
  })
  test('invoice list aging, filters, draft edition, attachment local preview and Ask AI', async ({ page }) => {
    await open(page, '/supplier-invoices'); await expect(page.locator('.supplier-invoice-table tbody tr')).toHaveCount(25)
    await page.getByRole('textbox', { name: 'Rechercher une facture fournisseur' }).fill('BILL-2026-0078'); await expect(page.getByRole('region', { name: 'Indicateurs factures fournisseurs' })).toContainText(formatMoney(30000))
    await page.getByRole('link', { name: 'BILL-2026-0078', exact: true }).click(); await expect(page.getByRole('region', { name: 'Contrôle Achat Réception Facture' })).toContainText('Conforme')
    await page.getByRole('button', { name: 'Demander à l’IA', exact: true }).click(); await expect(page.getByRole('heading', { name: 'AI ANALYSIS', exact: true })).toBeVisible()
    await page.locator('input[type=file]').setInputFiles({ name: 'facture-test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') }); await page.getByRole('button', { name: 'Prévisualiser', exact: true }).last().click(); await expect(page.getByRole('dialog').getByRole('img')).toBeVisible(); await page.getByRole('button', { name: 'Fermer', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: 'test-results/supplier-invoice-1440.png', fullPage: true })
  })
  for (const path of ['/suppliers/999999', '/purchases/invalid', '/supplier-invoices/999999']) test(`not found ${path}`, async ({ page }) => { await open(page, path); await expect(page.getByRole('heading', { name: 'Enregistrement introuvable' })).toBeVisible() })
})

test.describe('Purchasing API', () => {
  test.skip(!apiMode, 'Variables des quatre modules à false requises')
  const scope = 'api-purchasing'
  const purchaseList = () => ({ orders: purchaseSnapshot(scope).map((o) => purchaseDetailMock(scope, o.id)), permissions: purchasingPermissions, asOf: purchasingDemoDate, currentBuyer: 'Amine Berrada', suppliers: supplierSnapshot(scope), canExport: true })
  const invoiceList = () => ({ invoices: supplierInvoiceSnapshot(scope), permissions: purchasingPermissions, asOf: purchasingDemoDate, suppliers: supplierSnapshot(scope), canExport: true })
  for (const [path, endpoint, title, data] of [
    ['/purchases', '/purchase-orders/', 'Impossible de charger les commandes fournisseurs.', purchaseList],
    ['/supplier-invoices', '/supplier-invoices/', 'Impossible de charger les factures fournisseurs.', invoiceList],
    ['/purchases/321', '/purchase-orders/321/', 'Impossible de charger la commande fournisseur.', () => purchaseDetailMock(scope, 321)],
    ['/supplier-invoices/78', '/supplier-invoices/78/', 'Impossible de charger la facture fournisseur.', () => supplierInvoiceById(scope, 78)],
    ['/suppliers/42', '/suppliers/42/', 'Impossible de charger le fournisseur.', () => supplierDetailMock(scope, 42)],
  ] as const) {
    test(`loading, error, retry and deny ${path}`, async ({ page }) => {
      let status = 500
      await page.route(`**/api${endpoint}`, async (route) => { await new Promise((resolve) => setTimeout(resolve, 500)); await route.fulfill({ status, json: { ...data(), permissions: [] } }) })
      await open(page, path); await expect(page.getByRole('status', { name: 'Chargement des données' })).toBeVisible(); await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible(); await expect(page.getByText(/Mode démonstration/)).toHaveCount(0)
      status = 200; await page.getByRole('button', { name: 'Réessayer', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Accès non autorisé' })).toBeVisible()
    })
  }
  test('empty lists and permissions omit create/export and finance summary', async ({ page }) => {
    await page.route('**/api/purchase-orders/', (r) => r.fulfill({ json: { ...purchaseList(), orders: [], permissions: ['purchases.view'], canExport: false } }))
    await page.route('**/api/supplier-invoices/', (r) => r.fulfill({ json: { ...invoiceList(), invoices: [], permissions: ['supplier_invoices.view'], canExport: false } }))
    await open(page, '/purchases'); await expect(page.getByRole('heading', { name: 'Aucune commande fournisseur pour le moment.' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Créer commande', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Exporter', exact: true })).toHaveCount(0)
    await navigate(page, '/supplier-invoices'); await expect(page.getByRole('heading', { name: 'Aucune facture fournisseur pour le moment.' })).toBeVisible(); await expect(page.getByRole('region', { name: 'Indicateurs factures fournisseurs' })).toHaveCount(0)
  })
  test('supplier restricted viewer cannot see purchases, billing, payments, history or AI data', async ({ page }) => {
    await page.route('**/api/suppliers/42/', (r) => r.fulfill({ json: { ...supplierDetailMock(scope, 42), permissions: ['suppliers.view'] } }))
    await page.route('**/api/suppliers/42/metrics/', (r) => r.fulfill({ json: supplierMetricsMock(scope, 42) }))
    await open(page, '/suppliers/42'); await expect(page.getByRole('heading', { name: 'Atlas Packaging', exact: true })).toBeVisible()
    for (const name of ['Commandes', 'Factures', 'Paiements', 'Activité']) await expect(page.getByRole('tab', { name, exact: true })).toHaveCount(0)
    for (const name of ['Modifier', 'Analyser avec IA']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    await expect(page.getByText('684 200,00 MAD', { exact: true })).toHaveCount(0); await expect(page.getByText('48 600,00 MAD', { exact: true })).toHaveCount(0)
  })
  test('edit never grants posting, missing capabilities fail closed, and detailed purchase actions are hidden', async ({ page }) => {
    const invoice = supplierInvoiceById(scope, 78)
    await page.route('**/api/supplier-invoices/78/', (r) => r.fulfill({ json: { ...invoice, workflowStatus: 'draft', permissions: ['supplier_invoices.view', 'supplier_invoices.edit'], capabilities: { canEdit: true } } }))
    await open(page, '/supplier-invoices/78'); await expect(page.getByRole('button', { name: 'Modifier le brouillon' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Valider', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Enregistrer paiement', exact: true })).toHaveCount(0); await expect(page.getByRole('region', { name: 'Contrôle Achat Réception Facture' })).toHaveCount(0)
    await page.route('**/api/purchase-orders/321/', (r) => r.fulfill({ json: { ...purchaseDetailMock(scope, 321), permissions: ['purchases.view'], capabilities: {} } }))
    await navigate(page, '/purchases/321'); await expect(page.getByRole('heading', { name: 'Commande fournisseur PO-2026-0321' })).toBeVisible()
    for (const name of ['Réceptionner', 'Créer facture fournisseur', 'Confirmer', 'Envoyer', 'Modifier']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Factures fournisseurs', exact: true })).toHaveCount(0)
  })
  test('backend payment failure preserves balance, success uses authoritative response and invalidates list', async ({ page }) => {
    let bill = supplierInvoiceById(scope, 78), fail = true, writes = 0
    await page.route('**/api/supplier-invoices/78/', (r) => r.fulfill({ json: bill }))
    await page.route('**/api/supplier-invoices/78/payment/', async (r) => {
      writes++; expect(r.request().method()).toBe('POST'); expect(r.request().postDataJSON()).toMatchObject({ amount: 10000, method: 'bank_transfer' })
      if (fail) return r.fulfill({ status: 400, json: { amount: ['Insufficient balance'] } })
      bill = { ...bill, paidAmount: 28600 }; return r.fulfill({ json: bill })
    })
    await open(page, '/supplier-invoices/78'); await page.getByRole('button', { name: 'Enregistrer paiement', exact: true }).click()
    const d = page.getByRole('dialog'); await d.getByLabel('Montant (MAD) *', { exact: true }).fill('10000'); await d.getByRole('button', { name: 'Confirmer le paiement' }).click(); await expect(d.getByRole('alert')).toBeVisible(); await expect(page.locator('.business-kpis')).toContainText(formatMoney(30000))
    fail = false; await d.getByRole('button', { name: 'Confirmer le paiement' }).click(); await expect(d).not.toBeVisible(); await expect(page.locator('.business-kpis')).toContainText(formatMoney(20000)); expect(writes).toBe(2)
  })
  test('send and confirmation hit specified endpoints only after confirmation', async ({ page }) => {
    let order = { ...purchaseDetailMock(scope, 321), status: 'draft' as const, permissions: ['purchases.view', 'purchases.confirm'] as PurchasingPermission[], capabilities: { canEdit: false, canSend: true, canConfirm: true, canReceive: false, canBill: false } }
    const writes: string[] = []
    await page.route('**/api/purchase-orders/321/', (r) => r.fulfill({ json: order }))
    await page.route(/\/api\/purchase-orders\/321\/(send|confirm)\/$/, (r) => { writes.push(r.request().url().split('/').at(-2)!); order = { ...order, status: (writes.at(-1) === 'send' ? 'sent' : 'confirmed') as 'draft' }; return r.fulfill({ json: order }) })
    await open(page, '/purchases/321'); await page.getByRole('button', { name: 'Envoyer', exact: true }).click(); expect(writes).toHaveLength(0); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.getByRole('button', { name: 'Confirmer', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible(); expect(writes).toEqual(['send', 'confirm'])
  })
})
