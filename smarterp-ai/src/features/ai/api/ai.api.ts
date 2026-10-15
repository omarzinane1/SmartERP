import { postIdempotent } from '../../../lib/idempotentApi'
import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import type { DocumentSource } from '../../documents/types/documents.types'
import * as mock from '../data/ai.mock'
import { createChatStreamDecoder } from '../stream'
import type { AIMessage, AIOpportunity, OpportunityFilters, OpportunityAction, ChatEvent, Conversation, ConversationsData, ForecastDomain, ForecastDriver, ForecastResult, OpportunitiesData } from '../types/ai.types'
export const getConversations = async (signal?: AbortSignal): Promise<ConversationsData> => (await apiClient.get('/ai/conversations/', { signal })).data
export const createConversation = async (): Promise<Conversation> => (await apiClient.post('/ai/conversations/', {})).data
export async function streamAIChat(conversationId: string, question: string, emit: (event: ChatEvent) => void, signal?: AbortSignal): Promise<AIMessage> {
  const decoder = createChatStreamDecoder(emit)
  let decodingError: unknown = null
  emit({ type: 'status', status: 'streaming' })
  const response = await apiClient.post<string>('/ai/chat/stream/', { conversation_id: conversationId, message: question, request_id: crypto.randomUUID() }, { timeout: 100000, signal, responseType: 'text', adapter: 'xhr', headers: { Accept: 'text/event-stream' }, onDownloadProgress: (event) => { const xhr = event.event?.target as XMLHttpRequest | undefined; if (!decodingError && typeof xhr?.responseText === 'string') { try { decoder.consume(xhr.responseText) } catch (error) { decodingError = error } } } })
  if (decodingError) throw decodingError
  const message = decoder.consume(response.data, true); if (!message) throw new Error('Réponse interrompue avant sa finalisation.'); return message
}
export const getMessageSources = async (id: string): Promise<DocumentSource[]> => (await apiClient.get(`/ai/messages/${encodeURIComponent(id)}/sources/`)).data
export const getForecast = async (scope: string, domain: ForecastDomain, horizon: number, signal?: AbortSignal): Promise<ForecastResult> => env.aiWorkspaceUseMock ? mock.forecastMock(scope, domain, horizon) : (await apiClient.get(`/forecast/${domain}/`, { params: { horizon }, signal })).data
export const recalculateForecast = async (scope: string, domain: ForecastDomain, horizon: number): Promise<ForecastResult> => env.aiWorkspaceUseMock ? mock.recalculateForecastMock(scope, domain, horizon) : (await apiClient.post(`/forecast/${domain}/recalculate/`, { horizon })).data
export const getForecastDrivers = async (_scope: string, domain: ForecastDomain, signal?: AbortSignal): Promise<ForecastDriver[]> => env.aiWorkspaceUseMock ? mock.forecastDriversMock(domain) : (await apiClient.get(`/forecast/${domain}/drivers/`, { signal })).data
export const getAIOpportunities = async (filters: OpportunityFilters, signal?: AbortSignal): Promise<OpportunitiesData> => (await apiClient.get('/ai/opportunities/', { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')), signal })).data
export const getAIOpportunityById = async (id: number, signal?: AbortSignal): Promise<AIOpportunity> => (await apiClient.get(`/ai/opportunities/${id}/`, { signal })).data
export const changeAIOpportunity = (scope: string, id: number, action: OpportunityAction) => postIdempotent<AIOpportunity>(scope, `/ai/opportunities/${id}/${action}/`)
