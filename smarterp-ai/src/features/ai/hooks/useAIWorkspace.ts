import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import * as api from '../api/ai.api'
import type { AIResponseBlock, ForecastDomain } from '../types/ai.types'
export function useAIAssistant() {
  const { scope, key, invalidate } = useBusinessScope(), controller = useRef<AbortController | null>(null), [stream, setStream] = useState<{ conversationId: string; blocks: AIResponseBlock[]; status: 'streaming' | 'tool_running'; tool: string | null } | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const query = useQuery({ ...options, queryKey: [...key('ai-conversations'), env.aiWorkspaceUseMock], queryFn: ({ signal }) => api.getConversations(scope, signal) })
  const create = useMutation({ ...options, mutationFn: () => api.createConversation(scope), onSuccess: () => invalidate(['ai-conversations']) })
  const send = useMutation({ ...options, mutationFn: async ({ conversationId, question }: { conversationId: string; question: string }) => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort; setStream({ conversationId, blocks: [], status: 'streaming', tool: null })
    try { return await api.streamAIChat(scope, conversationId, question, (event) => { if (abort.signal.aborted) return; if (event.type === 'status') setStream((s) => s?.conversationId === conversationId ? { ...s, status: event.status, tool: event.tool ?? s.tool } : s); if (event.type === 'block') setStream((s) => s?.conversationId === conversationId ? { ...s, blocks: [...s.blocks, event.block] } : s) }, abort.signal) } finally { if (controller.current === abort) controller.current = null }
  }, onSuccess: async () => { await invalidate(['ai-conversations']); setStream(null) } })
  const sources = useMutation({ ...options, mutationFn: (id: string) => api.getMessageSources(scope, id) })
  const stop = () => { controller.current?.abort(); controller.current = null; setStream(null) }
  return { ...query, create, send, sources, stream, stop, isDemo: env.aiWorkspaceUseMock }
}
export function useForecasting(domain: ForecastDomain, horizon: number) {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('forecast'), env.aiWorkspaceUseMock, domain, horizon], queryFn: ({ signal }) => api.getForecast(scope, domain, horizon, signal) })
  const drivers = useQuery({ ...options, queryKey: [...key('forecast-drivers'), env.aiWorkspaceUseMock, domain], enabled: query.data?.permissions.includes('forecast.view') ?? false, queryFn: ({ signal }) => api.getForecastDrivers(scope, domain, signal) })
  const recalculate = useMutation({ ...options, mutationFn: () => api.recalculateForecast(scope, domain, horizon), onSuccess: () => invalidate(['forecast', 'forecast-drivers']) })
  return { ...query, drivers, recalculate, isDemo: env.aiWorkspaceUseMock }
}
export function useAIOpportunities() {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('ai-opportunities'), env.aiWorkspaceUseMock], queryFn: ({ signal }) => api.getAIOpportunities(scope, signal) })
  const detail = useMutation({ ...options, mutationFn: (id: number) => api.getAIOpportunityById(scope, id) })
  const assign = useMutation({ ...options, mutationFn: ({ id, userId }: { id: number; userId: number }) => api.assignAIOpportunity(scope, id, userId), onSuccess: () => invalidate(['ai-opportunities']) })
  return { ...query, detail, assign, isDemo: env.aiWorkspaceUseMock }
}
