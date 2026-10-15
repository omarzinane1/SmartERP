import { refreshIntelligence } from '../../ai-control-center/api/aiControlCenter.api'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import * as api from '../api/ai.api'
import type { AIResponseBlock, ForecastDomain, OpportunityFilters, OpportunityAction } from '../types/ai.types'
export function useAIAssistant() {
  const { scope, key, invalidate } = useBusinessScope(), controller = useRef<AbortController | null>(null), [stream, setStream] = useState<{ scope: string; conversationId: string; blocks: AIResponseBlock[]; status: 'streaming' | 'tool_running'; tool: string | null } | null>(null)
  useEffect(() => () => controller.current?.abort(), [scope])
  const query = useQuery({ ...options, queryKey: key('ai-conversations'), queryFn: ({ signal }) => api.getConversations(signal) })
  const create = useMutation({ ...options, mutationFn: () => api.createConversation(), onSuccess: () => invalidate(['ai-conversations']) })
  const send = useMutation({ ...options, mutationFn: async ({ conversationId, question }: { conversationId: string; question: string }) => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort; setStream({ scope, conversationId, blocks: [], status: 'streaming', tool: null })
    try { return await api.streamAIChat(conversationId, question, (event) => { if (abort.signal.aborted) return; if (event.type === 'status') setStream((s) => s?.scope === scope && s.conversationId === conversationId ? { ...s, status: event.status, tool: event.tool ?? s.tool } : s); if (event.type === 'block') setStream((s) => s?.scope === scope && s.conversationId === conversationId ? { ...s, blocks: [...s.blocks, event.block] } : s) }, abort.signal) } finally { if (controller.current === abort) controller.current = null }
  }, onSuccess: async () => { await invalidate(['ai-conversations']); setStream(null) } })
  const sources = useMutation({ ...options, mutationFn: (id: string) => api.getMessageSources(id) })
  const stop = () => { controller.current?.abort(); controller.current = null; setStream(null) }
  return { ...query, create, send, sources, stream: stream?.scope === scope ? stream : null, stop, isDemo: false }
}
export function useForecasting(domain: ForecastDomain, horizon: number) {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('forecast'), env.aiWorkspaceUseMock, domain, horizon], queryFn: ({ signal }) => api.getForecast(scope, domain, horizon, signal) })
  const drivers = useQuery({ ...options, queryKey: [...key('forecast-drivers'), env.aiWorkspaceUseMock, domain], enabled: query.data?.permissions.includes('forecast.view') ?? false, queryFn: ({ signal }) => api.getForecastDrivers(scope, domain, signal) })
  const recalculate = useMutation({ ...options, mutationFn: () => api.recalculateForecast(scope, domain, horizon), onSuccess: () => invalidate(['forecast', 'forecast-drivers']) })
  return { ...query, drivers, recalculate, isDemo: env.aiWorkspaceUseMock }
}
export function useAIOpportunities(filters: OpportunityFilters, selectedId: number | null) {
  const { scope, key, invalidate } = useBusinessScope()
  const cache = useQueryClient()
  const [userId, companyId] = key('ai-opportunities').slice(1)
  const query = useQuery({ ...options, queryKey: [...key('ai-opportunities'), filters], queryFn: ({ signal }) => api.getAIOpportunities(filters, signal),
    placeholderData: (previous, query) => query?.queryKey[1] === userId && query?.queryKey[2] === companyId ? previous : undefined,
    refetchInterval: (query) => ['pending', 'running'].includes(query.state.data?.lastRun?.status ?? '') ? 2500 : false })
  const detail = useQuery({ ...options, queryKey: [...key('ai-opportunity-detail'), selectedId], enabled: selectedId !== null, queryFn: ({ signal }) => api.getAIOpportunityById(selectedId!, signal) })
  const update = () => invalidate(['ai-opportunities', 'ai-opportunity-detail', 'ai-control-center'])
  const action = useMutation({ ...options, mutationFn: ({ id, action }: { id: number; action: OpportunityAction }) => api.changeAIOpportunity(scope, id, action), onSuccess: update })
  const refresh = useMutation({ ...options, mutationFn: () => refreshIntelligence(scope), onSuccess: update })
  const runId = query.data?.lastRun?.id, runStatus = query.data?.lastRun?.status
  useEffect(() => {
    if (runStatus === 'completed') {
      void cache.invalidateQueries({ queryKey: ['ai-opportunity-detail', userId, companyId] })
      void cache.invalidateQueries({ queryKey: ['ai-control-center', userId, companyId] })
    }
  }, [cache, userId, companyId, runId, runStatus])
  return { ...query, detail, action, refresh }
}
