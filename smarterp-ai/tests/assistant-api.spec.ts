import { expect, test } from './fixtures'
import { session } from './control-center.fixtures'
import type { AIMessage, Conversation } from '../src/features/ai/types/ai.types'
import type { DocumentRecord } from '../src/features/documents/types/documents.types'

const permissions = ['ai.use', 'ai.tools.finance', 'invoices.view', 'documents.view']
const message = (text: string): AIMessage => ({ id: '22', role: 'assistant', text, blocks: [], sources: [], createdAt: '2026-10-13T12:00:00Z', tools: [], period: null, simulated: false })

test('assistant creates a real API conversation, consumes validated SSE, and verifies citations', async ({ page }) => {
  const conversations: Conversation[] = []
  await page.route('**/api/ai/conversations/', async (route) => {
    if (route.request().method() === 'POST') { const conversation = { id: '11', title: 'Nouvelle conversation', createdAt: '2026-10-13', messages: [] }; conversations.push(conversation); return route.fulfill({ status: 201, json: conversation }) }
    return route.fulfill({ json: { conversations, permissions, asOf: '2026-10-13', availableTools: [{ id: 'revenue', label: "Chiffre d'affaires HT" }], canChat: true } })
  })
  let sent: Record<string, unknown> = {}
  await page.route('**/api/ai/chat/stream/', async (route) => {
    sent = route.request().postDataJSON()
    const result = { ...message('Le contrat prévoit un paiement à trente jours.'), sources: [{ id: '99', documentId: 7, documentName: 'Contrat API', page: 2, section: null, excerpt: 'Paiement à trente jours.', recordPath: null, period: null, authorized: true }] }
    conversations[0].messages.push(result)
    return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ type: 'done', message: result })}\n\n` })
  })
  await page.route('**/api/ai/messages/22/sources/', (route) => route.fulfill({ json: [] }))
  await session(page, permissions, '/ai/assistant', ['ai_assistant', 'documents'])
  await expect(page.getByText("Chiffre d'affaires HT", { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Votre question' }).fill('Que dit le contrat ?')
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  await expect(page.getByText('Le contrat prévoit un paiement à trente jours.', { exact: true })).toBeVisible()
  expect(sent).toMatchObject({ conversation_id: '11', message: 'Que dit le contrat ?', request_id: expect.any(String) })
  expect(sent).not.toHaveProperty('company_id')
  await expect(page.locator('main')).not.toContainText('Simulation')
  await expect(page.getByText('Contrat API').first()).toBeVisible()
  await page.getByRole('button', { name: 'Vérifier les sources' }).click()
  await expect(page.getByText('Contrat API')).toHaveCount(0)
})

test('backend failures preserve the question and never show mock financial data', async ({ page }) => {
  await page.route('**/api/ai/conversations/', (route) => route.fulfill({ json: { conversations: [{ id: '11', title: 'API', createdAt: '2026-10-13', messages: [] }], permissions, asOf: '2026-10-13', availableTools: [] } }))
  await page.route('**/api/ai/chat/stream/', (route) => route.fulfill({ status: 409, json: { detail: 'private server diagnostic' } }))
  await session(page, permissions, '/ai/assistant', ['ai_assistant', 'documents'])
  await page.getByRole('textbox', { name: 'Votre question' }).fill('Quel est mon CA ?')
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Réponse non finalisée')
  await expect(page.getByRole('textbox', { name: 'Votre question' })).toHaveValue('Quel est mon CA ?')
  await expect(page.locator('main')).not.toContainText('private server diagnostic')
  await expect(page.locator('main')).not.toContainText('Cash simulé')
})

test('confirmation requirement stays informational and mobile layout remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/ai/conversations/', (route) => route.fulfill({ json: { conversations: [{ id: '11', title: 'Paiement', createdAt: '2026-10-13', messages: [message("Cette opération nécessite une décision humaine dans le module métier concerné.")] }], permissions, asOf: '2026-10-13', availableTools: [] } }))
  await session(page, permissions, '/ai/assistant', ['ai_assistant', 'documents'])
  await expect(page.getByText('Cette opération nécessite une décision humaine dans le module métier concerné.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmer', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('403 has no fallback conversation', async ({ page }) => {
  await page.route('**/api/ai/conversations/', (route) => route.fulfill({ status: 403, json: { detail: 'private' } }))
  await session(page, ['ai.use'], '/ai/assistant', ['ai_assistant', 'documents'])
  await expect(page.getByRole('heading', { name: 'Accès non autorisé' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Votre question' })).toHaveCount(0)
})

test('documents use the API and poll ingestion until indexed', async ({ page }) => {
  const documentPermissions = ['ai.use', 'documents.view', 'documents.upload', 'documents.ai_analyze']
  const document: DocumentRecord = { id: 17, name: 'Contrat ingestion API', mime: 'text/plain', category: 'Contrats', department: 'Finance', author: 'Validation', size: 120, createdAt: '2026-10-14', status: 'uploaded', visibility: 'Public entreprise', url: null, pageCount: 1, canView: true, capabilities: { canDelete: false, canIndex: true, canDownload: false, canAnalyze: false }, indexError: null }
  let indexed = false, reads = 0
  await page.route('**/api/documents/', (route) => {
    if (indexed && ++reads > 1) document.status = 'indexed'
    return route.fulfill({ json: { documents: [document], permissions: documentPermissions, asOf: '2026-10-14', acceptedTypes: [], maxBytes: 15728640, visibilityOptions: ['Public entreprise'] } })
  })
  await page.route('**/api/documents/17/index/', (route) => {
    expect(route.request().method()).toBe('POST')
    indexed = true
    document.status = 'processing'
    return route.fulfill({ status: 202, json: document })
  })
  await session(page, documentPermissions, '/documents', ['documents'])
  await expect(page.getByText('Contrat ingestion API')).toBeVisible()
  await expect(page.locator('main')).not.toContainText('Simulation')
  await page.getByRole('button', { name: 'Indexer', exact: true }).click()
  await expect(page.getByText('Traitement…', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Réindexer', exact: true })).toBeVisible({ timeout: 10000 })
  expect(reads).toBeGreaterThan(1)
})
