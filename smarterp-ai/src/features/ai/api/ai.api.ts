import { readAIPolicyMock } from '../../settings/data/aiPolicy.mock'
import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { stockDemoDate } from '../../products/data/products.mock'
import type { DocumentSource } from '../../documents/types/documents.types'
import * as mock from '../data/ai.mock'
import { createChatStreamDecoder } from '../stream'
import type { AIMessage, AIOpportunity, ChatEvent, Conversation, ConversationsData, ForecastDomain, ForecastDriver, ForecastResult, OpportunitiesData } from '../types/ai.types'
export const getConversations = async (scope: string, signal?: AbortSignal): Promise<ConversationsData> => env.aiWorkspaceUseMock ? { canChat: readAIPolicyMock(scope).allowAnalysis, policyReason: readAIPolicyMock(scope).allowAnalysis ? null : 'Les analyses ERP sont désactivées par la politique société.', conversations: mock.conversationsMock(scope), permissions: mock.workspacePermissions, asOf: stockDemoDate, availableTools: [{ id: 'finance', label: 'Lecture des soldes financiers' }, { id: 'inventory', label: 'Lecture de la disponibilité stock' }] } : (await apiClient.get('/ai/conversations/', { signal })).data
export const createConversation = async (scope: string): Promise<Conversation> => env.aiWorkspaceUseMock ? mock.createConversationMock(scope) : (await apiClient.post('/ai/conversations/', {})).data
export async function streamAIChat(scope: string, conversationId: string, question: string, emit: (event: ChatEvent) => void, signal?: AbortSignal): Promise<AIMessage> {
  if (env.aiWorkspaceUseMock) return mock.streamChatMock(scope, conversationId, question, emit, signal)
  const decoder = createChatStreamDecoder(emit)
  let decodingError: unknown = null
  emit({ type: 'status', status: 'streaming' })
  const response = await apiClient.post<string>('/ai/chat/stream/', { conversation_id: conversationId, message: question }, { signal, responseType: 'text', adapter: 'xhr', headers: { Accept: 'text/event-stream' }, onDownloadProgress: (event) => { const xhr = event.event?.target as XMLHttpRequest | undefined; if (!decodingError && typeof xhr?.responseText === 'string') { try { decoder.consume(xhr.responseText) } catch (error) { decodingError = error } } } })
  if (decodingError) throw decodingError
  const message = decoder.consume(response.data, true); if (!message) throw new Error('Réponse interrompue avant sa finalisation.'); return message
}
export const getMessageSources = async (scope: string, id: string): Promise<DocumentSource[]> => env.aiWorkspaceUseMock ? mock.messageSourcesMock(scope, id) : (await apiClient.get(`/ai/messages/${encodeURIComponent(id)}/sources/`)).data
export const getForecast = async (scope: string, domain: ForecastDomain, horizon: number, signal?: AbortSignal): Promise<ForecastResult> => env.aiWorkspaceUseMock ? mock.forecastMock(scope, domain, horizon) : (await apiClient.get(`/forecast/${domain}/`, { params: { horizon }, signal })).data
export const recalculateForecast = async (scope: string, domain: ForecastDomain, horizon: number): Promise<ForecastResult> => env.aiWorkspaceUseMock ? mock.recalculateForecastMock(scope, domain, horizon) : (await apiClient.post(`/forecast/${domain}/recalculate/`, { horizon })).data
export const getForecastDrivers = async (_scope: string, domain: ForecastDomain, signal?: AbortSignal): Promise<ForecastDriver[]> => env.aiWorkspaceUseMock ? mock.forecastDriversMock(domain) : (await apiClient.get(`/forecast/${domain}/drivers/`, { signal })).data
export const getAIOpportunities = async (scope: string, signal?: AbortSignal): Promise<OpportunitiesData> => env.aiWorkspaceUseMock ? { opportunities: mock.opportunitiesMock(scope), permissions: mock.workspacePermissions, asOf: stockDemoDate, assignees: mock.opportunityAssigneesMock(scope) } : (await apiClient.get('/ai/opportunities/', { signal })).data
export const getAIOpportunityById = async (scope: string, id: number): Promise<AIOpportunity> => env.aiWorkspaceUseMock ? mock.opportunityByIdMock(scope, id) : (await apiClient.get(`/ai/opportunities/${id}/`)).data
export const assignAIOpportunity = async (scope: string, id: number, userId: number): Promise<AIOpportunity> => env.aiWorkspaceUseMock ? mock.assignOpportunityMock(scope, id, userId) : (await apiClient.post(`/ai/opportunities/${id}/assign/`, { user_id: userId })).data
