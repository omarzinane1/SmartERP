import { env } from 'node:process'
import { expect, test, type Page } from './fixtures'
import { sumMoney } from '../src/lib/money'
import { catalogSnapshot, completeTransferMock, createMovementMock, inventorySummaryMock, movementSnapshot, saveTransferMock, stockSnapshot, transferSnapshot, warehouseSummaryMock } from '../src/features/inventory/data/inventory.mock'
import { productMargin } from '../src/features/products/products.utils'
import { productsMock, saveProductMock, stockDemoDate } from '../src/features/products/data/products.mock'
import { productDetailMock, productHistoryMock, productMetricsMock } from '../src/features/products/data/productDetail.mock'
import { transferSchema } from '../src/features/inventory/schemas/inventory.schema'
import { warehouseSnapshot } from '../src/features/warehouses/data/warehouses.mock'
import { createExpenseMock, expenseActionMock, expenseCategories, expenseSnapshot, expenseTotals } from '../src/features/expenses/data/expenses.mock'
import { cashFlowMock, cashForecastMock, cashLedgerMock, cashUpcomingMock } from '../src/features/finance/data/finance.mock'
import { createPaymentMock, cancelPaymentMock } from '../src/features/payments/data/payments.mock'
import { generateReportMock, recentReportsMock, reportCatalogMock } from '../src/features/reports/data/reports.mock'
const apiMode = env.VITE_PRODUCTS_USE_MOCK === 'false'
async function login(page: Page) {
  await page.route('**/api/auth/login/', (route) => route.fulfill({ json: { user: { id: 1, name: 'Omar Zinane', email: 'omar@atlas.ma', role: 'admin' }, company: { id: 1, name: 'Atlas Distribution SARL', onboarding_completed: true } } }))
  await page.goto('/login'); await page.getByLabel('Adresse e-mail', { exact: true }).fill('omar@atlas.ma'); await page.getByLabel('Mot de passe', { exact: true }).fill('test-password-42'); await page.getByRole('button', { name: 'Se connecter', exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/)
}
const navigate = (page: Page, path: string) => page.evaluate((url) => { history.pushState({}, '', url); dispatchEvent(new PopStateEvent('popstate')) }, path)
async function open(page: Page, path: string) { await login(page); await navigate(page, path) }

test('stock ledger keeps catalogue, warehouse and dashboard quantities and valuation coherent', async () => {
  const scope = 'stock-coherence', rows = stockSnapshot(scope), products = catalogSnapshot(scope), summary = inventorySummaryMock(scope)
  expect(summary.value).toBe(sumMoney(rows.map((r) => r.value)))
  expect(summary.value).toBe(sumMoney(warehouseSummaryMock(scope).map((w) => w.stockValue)))
  for (const p of products) {
    if (p.type === 'service') { expect([p.available, p.reserved, p.stockValue, p.stockHealth]).toEqual([null, null, null, 'not_stocked']); continue }
    const own = rows.filter((r) => r.productId === p.id)
    expect(p.available).toBe(own.reduce((s, r) => s + r.available, 0)); expect(p.stockValue).toBe(sumMoney(own.map((r) => r.value)))
  }
  expect(products.find((p) => p.id === 104)?.available).toBe(148)
  expect(productMargin(100, 0)).toBeNull(); expect(productMargin(80, 100)).toBe(20)
  const detail = await productDetailMock(scope, 104), metrics = await productMetricsMock(scope, 104), history = await productHistoryMock(scope, 104)
  expect(metrics.revenue).toBe(sumMoney(detail.sales.map((s) => s.net))); expect(history.stock.at(-1)?.available).toBe(148)
  for (const m of movementSnapshot(scope)) expect(m.after - m.before).toBeCloseTo(m.quantity, 3)
})
test('transfers reject invalid quantities, protect reserved stock and conserve physical plus transit units', async () => {
  const scope = 'transfer-conservation', input = { sourceId: 1, destinationId: 2, date: stockDemoDate, referenceExternal: '', notes: '', lines: [{ productId: 104, quantity: 25 }] }, initial = catalogSnapshot(scope).find((p) => p.id === 104)!
  const schema = transferSchema(stockSnapshot(scope))
  expect(schema.safeParse({ ...input, destinationId: 1 }).success).toBe(false)
  expect(schema.safeParse({ ...input, lines: [input.lines[0], input.lines[0]] }).success).toBe(false)
  await expect(saveTransferMock(scope, { ...input, lines: [{ productId: 104, quantity: 101 }] })).rejects.toThrow()
  const draft = await saveTransferMock(scope, input)
  expect(catalogSnapshot(scope).find((p) => p.id === 104)?.available).toBe(initial.available)
  await saveTransferMock(scope, { status: 'ready' }, draft.id); await saveTransferMock(scope, { status: 'in_transit' }, draft.id)
  let p = catalogSnapshot(scope).find((p) => p.id === 104)!
  expect(p.onHand! + p.incoming!).toBe(initial.onHand! + initial.incoming!); expect(p.available).toBe(123)
  await expect(saveTransferMock(scope, { status: 'cancelled' }, draft.id)).rejects.toThrow()
  await completeTransferMock(scope, draft.id); p = catalogSnapshot(scope).find((p) => p.id === 104)!
  expect(p.available).toBe(148); expect(p.incoming).toBe(0); expect(stockSnapshot(scope).find((r) => r.productId === 104 && r.warehouseId === 2)?.available).toBe(73)
  await expect(completeTransferMock(scope, draft.id)).rejects.toThrow()
})
test('stock movements are immutable, new products start empty and services cannot move', async () => {
  const scope = 'movement-integrity', input = { productId: 104, warehouseId: 1, quantity: 101, type: 'out' as const, date: stockDemoDate, sourceReference: 'TEST', note: '', adjustmentDirection: 'increase' as const }
  await expect(createMovementMock(scope, input)).rejects.toThrow()
  await expect(createMovementMock(scope, { ...input, productId: 301, type: 'in' })).rejects.toThrow()
  const historical = movementSnapshot(scope), m = await createMovementMock(scope, { ...input, quantity: 10 })
  expect([m.before, m.after, m.quantity]).toEqual([120, 110, -10]); m.after = 0
  expect(movementSnapshot(scope).find((r) => r.id === m.id)?.after).toBe(110)
  for (const old of historical) expect(movementSnapshot(scope).find((r) => r.id === old.id)).toEqual(old)
  const newProduct = await saveProductMock(scope, { ...productsMock[0], sku: 'NEW-TEST', name: 'Nouveau produit' })
  expect(catalogSnapshot(scope).find((p) => p.id === newProduct.id)?.available).toBe(0)
  await createMovementMock(scope, { ...input, productId: newProduct.id, quantity: 5, type: 'in' })
  expect(catalogSnapshot(scope).find((p) => p.id === newProduct.id)?.available).toBe(5)
  await expect(saveProductMock(scope, { ...newProduct, type: 'service' }, newProduct.id)).rejects.toThrow()
  expect(catalogSnapshot('different-company').find((p) => p.id === newProduct.id)).toBeUndefined()
})
test('expense approvals are not payments; cash uses confirmed journal plus distinct paid expenses once', async () => {
  const scope = 'cash-coherence', before = cashFlowMock(scope), ledger = cashLedgerMock(scope)
  expect(before.cash).toBe(sumMoney([before.opening, ...ledger.map((m) => m.amount)])); expect(new Set(ledger.map((m) => m.id)).size).toBe(ledger.length)
  expect(before.receivable).toBe(sumMoney(before.receivableAging.map((a) => a.amount))); expect(before.payable).toBe(sumMoney(before.payableAging.map((a) => a.amount)))
  const expense = await createExpenseMock(scope, { date: stockDemoDate, description: 'Test dépense', category: 'Fournitures', supplierId: null, employee: 'Omar', amountHT: 100.05, taxRate: 20, note: '' })
  expect(expenseTotals(100.05, 20)).toEqual({ taxAmount: 20.01, total: 120.06 })
  await expect(expenseActionMock(scope, expense.id, 'approve')).rejects.toThrow()
  await expenseActionMock(scope, expense.id, 'submit'); await expenseActionMock(scope, expense.id, 'approve')
  expect(cashFlowMock(scope).cash).toBe(before.cash)
  const payment = await createPaymentMock(scope, { direction: 'outgoing', partnerId: 42, invoiceId: 78, amount: 100, date: stockDemoDate, method: 'bank_transfer', referenceExternal: '', note: '' })
  expect(cashFlowMock(scope).cash).toBe(sumMoney([before.cash!, -100])); expect(cashFlowMock(scope).payable).toBe(sumMoney([before.payable, -100]))
  await cancelPaymentMock(scope, payment.id); expect(cashFlowMock(scope).cash).toBe(before.cash)
  const forecast = cashForecastMock(scope, 90); expect(forecast.lowConfidence).toBe(true); expect(forecast.confidence).toBeNull(); expect(forecast.series[0].forecast).toBe(before.cash)
})
test('report exports use current canonical rows, preserve generated snapshots and reject unsupported formats', async () => {
  const scope = 'report-integrity', input = { reportId: 'stock', dateFrom: '2026-09-01', dateTo: stockDemoDate, filter: 'Premium Cable', format: 'csv' as const }, result = await generateReportMock(scope, input)
  expect(result.rows).toHaveLength(4); expect(sumMoney(result.rows!.slice(1).map((r) => Number(r[7])))).toBe(catalogSnapshot(scope).find((p) => p.id === 104)?.stockValue)
  await expect(generateReportMock(scope, { ...input, format: 'pdf' })).rejects.toThrow()
  await expect(generateReportMock(scope, { ...input, dateFrom: '2026-10-01' })).rejects.toThrow()
  result.rows![1][0] = 'changed'; expect(recentReportsMock(scope)[0].rows![1][0]).toBe('Premium Cable')
  expect(reportCatalogMock(scope).find((r) => r.id === 'stock')?.lastGenerated).not.toBeNull()
})

test.describe('operations demo', () => {
  test.skip(apiMode, 'Mode API')
  test('all ten routes render at 1440px with no page overflow or runtime errors', async ({ page }) => {
    test.setTimeout(90000); const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); await login(page)
    for (const [path, heading] of [['/products', 'Produits & Services'], ['/products/104', 'Premium Cable'], ['/inventory', 'Dashboard Stock'], ['/inventory/movements', 'Mouvements de stock'], ['/warehouses', 'Dépôts'], ['/warehouses/1', 'Casablanca Central'], ['/inventory/transfers', 'Transferts de stock'], ['/expenses', 'Dépenses'], ['/finance/cash-flow', 'Trésorerie / Cash Flow'], ['/reports', 'Rapports']]) {
      await navigate(page, path); await expect(page.getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible(); await expect(page.getByText('Chargement…', { exact: true })).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      if (['/products', '/inventory', '/warehouses', '/finance/cash-flow', '/reports'].includes(path)) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `test-results/operations-${path.replaceAll('/', '-')}-1440.png`, fullPage: false }) }
    }
    expect(errors).toEqual([])
  })
  test('products search, services, list/kanban, create, edit and CSV export', async ({ page }) => {
    await open(page, '/products'); await page.getByRole('button', { name: 'Services', exact: true }).click(); await expect(page.getByRole('cell', { name: 'Non stocké', exact: true }).first()).toBeVisible(); await page.getByRole('button', { name: 'Kanban', exact: true }).click(); await expect(page.locator('main .ops-card')).toHaveCount(5)
    await page.getByRole('button', { name: 'Tous', exact: true }).click(); await page.getByRole('button', { name: 'Créer produit', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Nom', { exact: true }).fill('Produit QA'); await dialog.getByLabel('SKU', { exact: true }).fill('QA-NEW'); await dialog.getByLabel('Catégorie', { exact: true }).fill('Tests'); await dialog.getByLabel('Prix achat (MAD)', { exact: true }).fill('80'); await dialog.getByLabel('Prix vente (MAD)', { exact: true }).fill('100'); await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await expect(dialog).toHaveCount(0)
    await page.getByRole('searchbox', { name: /Rechercher un produit/ }).fill('QA-NEW'); await expect(page.locator('main .ops-card')).toHaveCount(1); await page.getByRole('link', { name: 'Produit QA', exact: true }).click(); await page.getByRole('button', { name: 'Modifier', exact: true }).click(); await page.getByRole('dialog').getByLabel('Prix vente (MAD)', { exact: true }).fill('110'); await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0)
    await navigate(page, '/products'); await page.getByRole('searchbox', { name: /Rechercher un produit/ }).fill('QA-NEW'); const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exporter CSV', exact: true }).click(); expect((await download).suggestedFilename()).toBe('produits.csv')
  })
  test('stock movement validates availability then updates product and warehouse in the same session', async ({ page }) => {
    await open(page, '/inventory/movements?product=104&warehouse=1&create=1'); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Type', { exact: true }).selectOption('out'); await dialog.getByLabel('Quantité', { exact: true }).fill('101'); await dialog.getByRole('button', { name: 'Enregistrer le mouvement' }).click(); await expect(dialog.getByText('Quantité supérieure au disponible.')).toBeVisible(); await dialog.getByLabel('Quantité').fill('10'); await dialog.getByRole('button', { name: 'Enregistrer le mouvement' }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('row').filter({ hasText: 'MOV-DEMO' }).first()).toContainText('-10')
    await navigate(page, '/products/104'); await expect(page.getByRole('button', { name: 'Stock · 138', exact: true })).toBeVisible(); await page.getByRole('tab', { name: 'Inventaire', exact: true }).click(); await expect(page.getByRole('row').filter({ hasText: 'Casablanca Central' })).toContainText('90')
  })
  test('transfer completes the full workflow and moves source units into destination once', async ({ page }) => {
    await open(page, '/inventory/transfers?source=1&create=1'); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Produit ligne 1', { exact: true }).selectOption('104'); await dialog.getByLabel('Quantité ligne 1', { exact: true }).fill('25'); await dialog.getByRole('button', { name: 'Enregistrer le brouillon' }).click(); await expect(dialog).toHaveCount(0); const row = page.getByRole('row').filter({ hasText: 'TRF-DEMO' }).first()
    for (const action of ['Valider', 'Démarrer', 'Terminer']) { await row.getByRole('button', { name: action, exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0) }
    await expect(row).toContainText('Terminé'); await navigate(page, '/products/104'); await page.getByRole('tab', { name: 'Inventaire', exact: true }).click(); await expect(page.getByRole('row').filter({ hasText: 'Rabat Distribution' })).toContainText('73'); await expect(page.getByRole('button', { name: 'Stock · 148', exact: true })).toBeVisible()
  })
  test('warehouse creation produces an empty depot with real detail and transfer links', async ({ page }) => {
    await open(page, '/warehouses'); await page.getByRole('button', { name: 'Créer dépôt', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Nom', { exact: true }).fill('Dépôt QA'); await dialog.getByLabel('Ville', { exact: true }).fill('Fès'); await dialog.getByLabel('Responsable', { exact: true }).fill('Omar'); await dialog.getByRole('button', { name: 'Créer le dépôt', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.getByRole('link', { name: 'Dépôt QA', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Dépôt QA', level: 1 })).toBeVisible(); await expect(page.getByText('Aucune donnée disponible.', { exact: true })).toBeVisible()
  })
  test('expense creation and approval retain exact taxes; attachments stay local', async ({ page }) => {
    await open(page, '/expenses'); await page.getByRole('button', { name: 'Créer dépense', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Description', { exact: true }).fill('Fournitures QA'); await dialog.getByLabel('Employé', { exact: true }).fill('Omar QA'); await dialog.getByLabel('Montant HT', { exact: true }).fill('100.05'); await expect(dialog.getByText(/120,06/)).toBeVisible(); await dialog.getByRole('button', { name: 'Enregistrer le brouillon' }).click(); await expect(dialog).toHaveCount(0); await page.getByRole('searchbox', { name: 'Rechercher une dépense…' }).fill('Fournitures QA'); const row = page.getByRole('row').filter({ hasText: 'Fournitures QA' })
    for (const action of ['Soumettre', 'Approuver']) { await row.getByRole('button', { name: action, exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0) }
    await expect(row).toContainText('Approuvée'); await page.getByRole('button', { name: 'Kanban', exact: true }).click(); await expect(page.locator('.ops-expense-board .ops-card')).toHaveCount(1)
  })
  test('cash forecasts disclose uncertainty and reports generate actual CSV files and recent history', async ({ page }) => {
    await open(page, '/finance/cash-flow'); await expect(page.getByText(/Prévision à faible confiance/)).toBeVisible(); await page.getByLabel('Horizon', { exact: true }).selectOption('90'); await page.getByRole('button', { name: 'Demander analyse IA', exact: true }).click(); await expect(page.getByRole('heading', { name: 'FACTS', exact: true })).toBeVisible(); await expect(page.getByText(/Analyse générée le.*Horizon 90 jours/)).toBeVisible()
    await navigate(page, '/reports'); const card = page.locator('.ops-reports-card').filter({ has: page.getByRole('heading', { name: 'Stock et valorisation', exact: true }) }); await card.getByRole('button', { name: 'Générer', exact: true }).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('Format').locator('option')).toHaveCount(1); const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Générer rapport', exact: true }).click(); expect((await download).suggestedFilename()).toBe('stock-2026-09-30.csv'); await expect(page.getByRole('cell', { name: 'Stock et valorisation', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Télécharger', exact: true })).toBeEnabled()
  })
  for (const path of ['/products/99999', '/products/nope', '/warehouses/99999']) test(`not found ${path}`, async ({ page }) => { await open(page, path); await expect(page.getByRole('heading', { name: 'Enregistrement introuvable' })).toBeVisible() })
})

test.describe('operations API', () => {
  test.skip(!apiMode, 'Mode démo')
  const routes = [['/products', '/products/'], ['/products/104', '/products/104/'], ['/inventory', '/inventory/summary/'], ['/inventory/movements', '/inventory/movements/'], ['/inventory/transfers', '/inventory/transfers/'], ['/warehouses', '/warehouses/'], ['/warehouses/1', '/warehouses/1/'], ['/expenses', '/expenses/'], ['/finance/cash-flow', '/finance/cash-flow/'], ['/reports', '/reports/catalog/']]
  for (const [path, endpoint] of routes) test(`loading, error retry and denied without fallback ${path}`, async ({ page }) => {
    let mode = 'error', requested = 0
    await page.route(`**/api${endpoint}`, async (route) => { requested++; await new Promise((r) => setTimeout(r, 250)); await route.fulfill(mode === 'error' ? { status: 500, json: { detail: 'Indisponible' } } : { json: { permissions: [] } }) })
    await open(page, path); await expect(page.getByRole('heading', { name: 'Chargement…' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeVisible(); await expect(page.getByText(/Mode démonstration/)).toHaveCount(0); mode = 'denied'; await page.getByRole('button', { name: 'Réessayer', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Accès non autorisé', exact: true })).toBeVisible(); expect(requested).toBeGreaterThanOrEqual(2)
  })
  test('products read-only permissions hide stock and writes; empty data stays empty', async ({ page }) => {
    let products = catalogSnapshot('api-fixture'); await page.route('**/api/products/', (route) => route.fulfill({ json: { products, suppliers: [], permissions: ['products.view'], asOf: stockDemoDate } })); await open(page, '/products'); await expect(page.getByRole('button', { name: 'Créer produit' })).toHaveCount(0); await expect(page.getByRole('columnheader', { name: 'Disponible', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Exporter CSV' })).toHaveCount(0); products = []; await navigate(page, '/warehouses'); await navigate(page, '/products'); await expect(page.getByText('Aucune donnée disponible.', { exact: true })).toBeVisible()
  })
  test('movement server error preserves entry and success uses server returned stock', async ({ page }) => {
    const scope = 'api-movements'; let movements = movementSnapshot(scope), failed = true, body: unknown
    await page.route('**/api/inventory/movements/', async (route) => { if (route.request().method() === 'GET') return route.fulfill({ json: { movements, products: catalogSnapshot(scope), stock: stockSnapshot(scope), warehouses: warehouseSnapshot(scope), permissions: ['inventory.movements.view', 'inventory.movements.create'], asOf: stockDemoDate } }); body = route.request().postDataJSON(); if (failed) return route.fulfill({ status: 409, json: { detail: 'Stock modifié' } }); movements = [{ ...movements[0], id: 9999, reference: 'SERVER-MOV', quantity: 3 }, ...movements]; return route.fulfill({ json: movements[0] }) })
    await open(page, '/inventory/movements'); await page.getByRole('button', { name: 'Créer mouvement' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Quantité', { exact: true }).fill('3'); await dialog.getByRole('button', { name: 'Enregistrer le mouvement' }).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByLabel('Quantité', { exact: true })).toHaveValue('3'); failed = false; await dialog.getByRole('button', { name: 'Enregistrer le mouvement' }).click(); await expect(dialog).toHaveCount(0); expect(body).toMatchObject({ product_id: 104, warehouse_id: 1, quantity: 3, type: 'in' }); await expect(page.getByRole('button', { name: 'SERVER-MOV' })).toBeVisible()
  })
  test('transfer status PATCH requires explicit backend support, approve alone does not invent endpoints', async ({ page }) => {
    await page.route('**/api/inventory/transfers/', (route) => route.fulfill({ json: { transfers: transferSnapshot('api-transfers'), products: [], stock: [], warehouses: [], permissions: ['inventory.transfers.view', 'inventory.transfers.approve'], asOf: stockDemoDate, supportsStatusPatch: false } })); await open(page, '/inventory/transfers'); await expect(page.getByRole('button', { name: 'Valider', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Terminer', exact: true })).toBeVisible()
  })
  test('expense approval API posts only after confirmation; rejection has no fabricated request', async ({ page }) => {
    let expenses = expenseSnapshot('api-expenses').filter((e) => e.status === 'submitted').slice(0, 1), calls = 0
    await page.route('**/api/expenses/', (route) => route.fulfill({ json: { expenses, permissions: ['expenses.view', 'expenses.approve'], asOf: stockDemoDate, suppliers: [], categories: expenseCategories } })); await page.route('**/api/expenses/*/approve/', (route) => { calls++; expenses = expenses.map((e) => ({ ...e, status: 'approved', capabilities: { canSubmit: false, canApprove: false } })); return route.fulfill({ json: expenses[0] }) }); await open(page, '/expenses'); await expect(page.getByRole('button', { name: 'Refuser · à venir' })).toBeDisabled(); await page.getByRole('button', { name: 'Approuver', exact: true }).click(); expect(calls).toBe(0); await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click(); await expect(page.getByRole('cell', { name: 'Approuvée', exact: true })).toBeVisible(); expect(calls).toBe(1)
  })
  test('cash permissions suppress children and no forecast state retains actual balances', async ({ page }) => {
    const flow = cashFlowMock('api-finance'); await page.route('**/api/finance/cash-flow/', (route) => route.fulfill({ json: { ...flow, permissions: ['finance.view', 'cashflow.view'] } })); await page.route('**/api/finance/forecast/?*', (route) => route.fulfill({ json: { horizon: 30, generatedAt: stockDemoDate, confidence: null, lowConfidence: false, projected: null, series: [], assumptions: '' } })); await page.route('**/api/finance/upcoming-payments/', (route) => route.fulfill({ json: cashUpcomingMock('api-finance') })); await open(page, '/finance/cash-flow'); await expect(page.getByText('Aucune prévision disponible pour cet horizon.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Demander analyse IA' })).toHaveCount(0); await expect(page.locator('main a[href^="/invoices/"]')).toHaveCount(0)
  })
  test('report generation error retains inputs and unsupported formats are not offered', async ({ page }) => {
    const report = reportCatalogMock('api-report').find((r) => r.id === 'stock')!; await page.route('**/api/reports/catalog/', (route) => route.fulfill({ json: { reports: [report], permissions: ['reports.view', 'reports.generate'], asOf: stockDemoDate } })); await page.route('**/api/reports/recent/', (route) => route.fulfill({ json: [] })); let payload: unknown; await page.route('**/api/reports/generate/', (route) => { payload = route.request().postDataJSON(); return route.fulfill({ status: 500, json: { detail: 'Failed' } }) }); await open(page, '/reports'); await page.getByRole('button', { name: 'Générer', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Filtre texte', { exact: true }).fill('Cable'); await dialog.getByRole('button', { name: 'Générer rapport', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByLabel('Filtre texte', { exact: true })).toHaveValue('Cable'); expect(payload).toMatchObject({ report_id: 'stock', filter: 'Cable', format: 'csv' }); await expect(dialog.getByLabel('Format').locator('option')).toHaveCount(1)
  })
})
