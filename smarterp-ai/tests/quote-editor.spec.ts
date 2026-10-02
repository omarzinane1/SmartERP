import { env } from 'node:process'
import { expect, test, type Page } from './fixtures'

const apiMode = env.VITE_QUOTES_USE_MOCK === 'false'
async function openQuotes(page: Page) {
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
  await page.getByRole('link', { name: 'Devis / Quotes', exact: true }).click()
  await expect(page).toHaveURL(/\/quotes$/)
  await expect(page.getByRole('heading', { name: 'Devis', exact: true })).toBeVisible()
}
async function openDraft(page: Page) {
  await openQuotes(page)
  await page.getByRole('button', { name: 'Ouvrir QT-2026-0265', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Devis QT-2026-0265', exact: true })).toBeVisible()
}

test.describe('Éditeur démo', () => {
  test.skip(apiMode, 'Mode démonstration requis')

  test('creates, previews current values without internal notes, saves and updates list and Kanban', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openQuotes(page)
    await page.getByRole('button', { name: 'Créer un devis', exact: true }).click()
    await expect(page).toHaveURL(/\/quotes\/new$/)
    await expect(page.getByRole('navigation', { name: 'Fil d’Ariane du devis' })).toContainText('Nouveau devis')
    await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toBeDisabled()
    await page.getByLabel('Rechercher un client').fill('nova')
    await page.getByRole('combobox', { name: 'Client *', exact: true }).selectOption('124')
    await expect(page.getByLabel('Adresse de facturation')).toHaveValue(/Casablanca/)
    await page.getByLabel('Objet du devis').fill('Équipement réseau septembre')
    await page.getByLabel('Conditions de paiement', { exact: true }).fill('30 jours fin de mois')
    await page.getByLabel('Produit ligne 1').selectOption('104')
    await page.getByLabel('Quantité ligne 1').fill('10')
    await page.getByLabel('Remise ligne 1').fill('5')
    await expect(page.getByRole('status', { name: 'Total TTC' })).toHaveText(/13\s680 MAD/)
    await page.getByRole('button', { name: 'Ajouter une ligne' }).click()
    await page.getByLabel('Produit ligne 2').selectOption('301')
    await page.getByLabel('Quantité ligne 2').fill('2')
    await expect(page.getByRole('status', { name: 'Total TTC' })).toHaveText(/16\s980 MAD/)
    await page.getByRole('button', { name: 'Supprimer la ligne 2' }).click()
    await expect(page.getByRole('status', { name: 'Total TTC' })).toHaveText(/13\s680 MAD/)
    await page.getByRole('tab', { name: 'Notes', exact: true }).click()
    await page.getByLabel('Notes internes').fill('SECRET_INTERNE_TEST')
    await page.getByLabel('Notes visibles sur le devis').fill('Livraison sur rendez-vous.')
    await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'Prévisualisation du devis' })
    await expect(preview).toContainText('Équipement réseau septembre')
    await expect(preview).toContainText('Livraison sur rendez-vous.')
    await expect(preview).not.toContainText('SECRET_INTERNE_TEST')
    await expect(preview).toContainText('APERÇU NON ENREGISTRÉ')
    await page.screenshot({ path: 'test-results/quote-preview-desktop.png', fullPage: true })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Prévisualiser', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled()
    await expect(page).toHaveURL(/\/quotes\/269$/)
    await expect(page.getByText('Modifications non enregistrées', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled()
    await page.getByRole('link', { name: 'Retour aux devis', exact: true }).click()
    await expect(page.locator('.quotes-table tbody tr').filter({ hasText: 'QT-2026-0269' })).toContainText(/13\s680 MAD/)
    await page.getByRole('button', { name: 'Vue Kanban', exact: true }).click()
    await expect(page.locator('.quotes-kanban-card').filter({ hasText: 'QT-2026-0269' })).toContainText('Nova Retail SARL')
    expect(errors).toEqual([])
  })

  test('loads a draft, validates fields, guards dirty navigation and sends only saved values', async ({ page }) => {
    await openDraft(page)
    await expect(page.getByRole('status', { name: 'Total TTC' })).toHaveText(/24\s800 MAD/)
    await page.screenshot({ path: 'test-results/quote-editor-desktop.png', fullPage: true, style: '[data-sonner-toaster] { visibility: hidden; }' })
    await page.getByLabel('Quantité ligne 1').fill('0')
    await page.getByLabel('Date d’expiration').fill('2026-01-01')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByText('La quantité doit être supérieure à zéro.')).toBeVisible()
    await expect(page.getByText('L’expiration ne doit pas précéder la date du devis.')).toBeVisible()
    await page.getByLabel('Quantité ligne 1').fill('3')
    await page.getByLabel('Prix unitaire ligne 1').fill('0.1')
    await page.getByLabel('TVA ligne 1').fill('20')
    await page.getByLabel('Date d’expiration').fill('2026-10-23')
    await expect(page.getByRole('status', { name: 'Total TTC' })).toHaveText('0,36 MAD')
    await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toBeDisabled()
    await page.getByRole('link', { name: 'Retour aux devis', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Quitter le devis ?' })).toBeVisible()
    await page.getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(page.getByLabel('Quantité ligne 1')).toHaveValue('3')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
    await page.getByRole('button', { name: 'Simuler l’envoi' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('Envoi simulé. Aucun e-mail envoyé.', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Quantité ligne 1')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toHaveCount(0)
    await page.getByRole('tab', { name: /Activités/ }).click()
    await expect(page.getByRole('tabpanel')).toContainText('Envoi simulé. Aucun e-mail envoyé.')
    await page.getByRole('link', { name: 'Retour aux devis', exact: true }).click()
    await expect(page.locator('.quotes-table tbody tr').filter({ hasText: 'QT-2026-0265' })).toContainText('0,36 MAD')
  })

  test('accepted record stays read-only, conversion and PDF are explicit, duplication opens an editable copy', async ({ page }) => {
    await openQuotes(page)
    await page.getByRole('button', { name: 'Ouvrir QT-2026-0268' }).click()
    await expect(page.getByLabel('Quantité ligne 1')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Télécharger PDF' })).toBeDisabled()
    await page.locator('summary').filter({ hasText: /^Plus/ }).click()
    await expect(page.getByRole('button', { name: 'Accepter', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Convertir en commande' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Convertir en facture' })).toBeDisabled()
    await page.getByRole('button', { name: 'Dupliquer le devis enregistré' }).click()
    await expect(page).toHaveURL(/\/quotes\/269$/)
    await expect(page.getByLabel('Quantité ligne 1')).toBeEnabled()
    await expect(page.getByRole('status', { name: 'Total TTC' })).toHaveText(/400\s400 MAD/)
    await page.getByRole('link', { name: 'Retour aux devis', exact: true }).click()
    await expect(page.locator('.quotes-table tbody tr').filter({ hasText: 'QT-2026-0268' })).toContainText('Accepté')
  })

  test('discarding changes, missing quote, accessible tabs and mobile preview', async ({ page }) => {
    await openDraft(page)
    await page.getByLabel('Objet du devis').fill('À abandonner')
    await page.getByRole('link', { name: 'Retour aux devis', exact: true }).click()
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click()
    await expect(page).toHaveURL(/\/quotes$/)
    await page.getByRole('button', { name: 'Ouvrir QT-2026-0265', exact: true }).click()
    await expect(page.getByLabel('Objet du devis')).not.toHaveValue('À abandonner')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('tab', { name: 'Conditions', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Notes', exact: true })).toBeFocused()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: 'test-results/quote-editor-mobile.png', fullPage: true })
    await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer l’aperçu' }).click()
    // Navigation interne pour conserver la session en mémoire.
    await page.evaluate(() => { window.history.pushState({}, '', '/quotes/999999'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await expect(page.getByRole('heading', { name: 'Devis introuvable' })).toBeVisible()
  })
})

const permissions = ['quotes.view', 'quotes.create', 'quotes.edit', 'quotes.send', 'quotes.export', 'quotes.accept', 'quotes.convert']
const detailFixture = {
  id: 265, reference: 'QT-2026-0265', customer_id: 124, customer_name: 'Nova Retail SARL', customer_email: 'contact@novaretail.ma',
  salesperson: 'Sara El Mansouri', created_at: '2026-09-22', issue_date: '2026-09-22', expires_at: '2026-10-23',
  total_amount: '120.00', status: 'draft', currency: 'MAD', billing_address: 'Casablanca', payment_terms: '30 jours',
  customer_reference: '', subject: 'Commande de test', delivery_terms: 'Sous 7 jours', commercial_terms: '', internal_notes: '', customer_notes: '',
  lines: [{ id: 1, product_id: null, description: 'Service API', quantity: '1', unit_price: '100', discount_rate: '0', tax_rate: '20' }],
  permissions, activities: [], as_of: '2026-09-23', products: [], can_accept: false, conversion_targets: ['sales_order', 'invoice'], converted_to: null,
}
async function routeList(page: Page) {
  await page.route('**/api/quotes/', (route) => route.fulfill({ json: { results: [detailFixture], next: null, permissions, as_of: '2026-09-23', current_salesperson: 'Sara El Mansouri' } }))
}
test.describe('Éditeur API', () => {
  test.skip(!apiMode, 'Lancer avec VITE_QUOTES_USE_MOCK=false')

  test('loads detail, handles server field validation, preserves dirty input and updates list after PATCH', async ({ page }) => {
    let detail = { ...detailFixture }
    let reject = true
    await routeList(page)
    await page.route('**/api/quotes/265/', (route) => {
      if (route.request().method() === 'PATCH') {
        const input = route.request().postDataJSON()
        expect(input).not.toHaveProperty('total_amount')
        expect(input).not.toHaveProperty('status')
        if (reject) return route.fulfill({ status: 400, json: { expires_at: ['PRIVATE_VALIDATION'] } })
        detail = { ...detail, subject: input.subject, total_amount: '120.00' }
      }
      return route.fulfill({ json: detail })
    })
    await openDraft(page)
    await page.getByLabel('Objet du devis').fill('Version modifiée')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByText('Vérifiez cette valeur avec les règles du serveur.')).toBeVisible()
    await expect(page.getByText('PRIVATE_VALIDATION')).toHaveCount(0)
    await expect(page.getByLabel('Objet du devis')).toHaveValue('Version modifiée')
    reject = false
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByText('Toutes les modifications sont enregistrées')).toBeVisible()
    await expect(page.getByLabel('Objet du devis')).toHaveValue('Version modifiée')
  })

  test('uses server ID after POST and prevents duplicate saves', async ({ page }) => {
    let posts = 0
    await routeList(page)
    await page.route('**/api/quotes/', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      posts += 1
      const input = route.request().postDataJSON()
      expect(input.lines[0]).not.toHaveProperty('id')
      await new Promise((resolve) => setTimeout(resolve, 300))
      await route.fulfill({ json: { ...detailFixture, ...input, id: 901, reference: 'QT-2026-0901', lines: input.lines.map((line: object) => ({ ...line, id: 9001 })) } })
    })
    await openQuotes(page)
    await page.getByRole('button', { name: 'Créer un devis', exact: true }).click()
    await page.getByRole('combobox', { name: 'Client *', exact: true }).selectOption('124')
    await page.getByLabel('Description ligne 1').fill('Service API')
    await page.getByLabel('Prix unitaire ligne 1').fill('100')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled()
    await expect(page).toHaveURL(/\/quotes\/901$/)
    await expect(page.getByRole('heading', { name: 'Devis QT-2026-0901' })).toBeVisible()
    expect(posts).toBe(1)
  })

  test('separate acceptance and conversion require backend confirmation and explicit target', async ({ page }) => {
    let detail = { ...detailFixture, status: 'sent', can_accept: true }
    await routeList(page)
    await page.route('**/api/quotes/265/', (route) => route.fulfill({ json: detail }))
    await page.route('**/api/quotes/265/accept/', (route) => {
      expect(route.request().method()).toBe('POST')
      detail = { ...detail, status: 'accepted', can_accept: false }
      return route.fulfill({ json: detail })
    })
    await page.route('**/api/quotes/265/convert/', (route) => {
      expect(route.request().postDataJSON()).toEqual({ target: 'sales_order' })
      return route.fulfill({ json: { id: 1048, reference: 'SO-2026-1048', target: 'sales_order' } })
    })
    await openDraft(page)
    await page.locator('summary').filter({ hasText: /^Plus/ }).click()
    await expect(page.getByRole('button', { name: 'Convertir en commande' })).toBeDisabled()
    await page.getByRole('button', { name: 'Accepter', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Convertir en commande' })).toBeEnabled()
    await page.getByRole('button', { name: 'Convertir en commande' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click()
    await expect(page.getByText(/Conversion confirmée par le serveur : SO-2026-1048/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Convertir en commande' })).toBeDisabled()
  })

  for (const response of ['readonly', 'forbidden', 'missing', 'error']) test(`handles ${response} without demo fallback`, async ({ page }) => {
    await routeList(page)
    await page.route('**/api/quotes/265/', (route) => route.fulfill(response === 'readonly'
      ? { json: { ...detailFixture, permissions: ['quotes.view'] } }
      : { status: response === 'forbidden' ? 403 : response === 'missing' ? 404 : 500, json: { detail: 'PRIVATE_ERROR' } }))
    await openQuotes(page)
    await page.getByRole('button', { name: 'Ouvrir QT-2026-0265', exact: true }).click()
    if (response === 'readonly') {
      await expect(page.getByLabel('Quantité ligne 1')).toBeDisabled()
      for (const name of ['Enregistrer', 'Envoyer', 'Accepter', 'Convertir en commande'])
        await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    } else if (response === 'error') await expect(page.getByRole('alert')).toContainText('Impossible de charger le devis.')
    else await expect(page.getByRole('heading', { name: response === 'forbidden' ? 'Accès non autorisé' : 'Devis introuvable' })).toBeVisible()
    await expect(page.getByText('PRIVATE_ERROR')).toHaveCount(0)
  })
})
