import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { getAIControlCenter, getAlerts, getAlert, refreshIntelligence, changeAlert } from '../api/aiControlCenter.api'
import type { AlertFilters } from '../types/aiControlCenter.types'

export function useAIControlCenter(filters: AlertFilters, page: number, selectedId: string | null) {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const cache = useQueryClient()
  const scope = `${userId}:${companyId}`
  const prefix = ['ai-control-center', userId, companyId]
  const query = useQuery({
    queryKey: [
      'ai-control-center',
      userId,
      companyId,
      env.aiControlCenterUseMock,
    ],
    queryFn: ({ signal }) => getAIControlCenter(signal),
    retry: false,
    refetchInterval: (query) => ['pending', 'running'].includes(query.state.data?.lastRun?.status ?? '') ? 2500 : false,
    networkMode: env.aiControlCenterUseMock ? 'always' : 'online',
  })
  const alerts = useQuery({ queryKey: [...prefix, 'alerts', filters, page], queryFn: ({ signal }) => getAlerts(filters, page, signal), enabled: !env.aiControlCenterUseMock, retry: false })
  const detail = useQuery({ queryKey: [...prefix, 'detail', selectedId], queryFn: ({ signal }) => getAlert(selectedId!, signal), enabled: !env.aiControlCenterUseMock && selectedId !== null, retry: false })
  const refresh = useMutation({ mutationFn: () => refreshIntelligence(scope), onSuccess: () => cache.invalidateQueries({ queryKey: prefix }) })
  const action = useMutation({ mutationFn: (args: { id: string; action: 'acknowledge' | 'resolve' | 'dismiss' }) => changeAlert(scope, args.id, args.action), onSuccess: () => cache.invalidateQueries({ queryKey: prefix }) })
  const runId = query.data?.lastRun?.id
  const runStatus = query.data?.lastRun?.status
  useEffect(() => {
    if (runStatus === 'completed') {
      void cache.invalidateQueries({ queryKey: ['ai-control-center', userId, companyId, 'alerts'] })
      void cache.invalidateQueries({ queryKey: ['ai-control-center', userId, companyId, 'detail'] })
    }
  }, [cache, userId, companyId, runId, runStatus])
  return { ...query, alerts, detail, refresh, action, isDemo: env.aiControlCenterUseMock }
}
