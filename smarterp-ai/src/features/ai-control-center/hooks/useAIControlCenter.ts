import { useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { getAIControlCenter } from '../api/aiControlCenter.api'

export function useAIControlCenter() {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const query = useQuery({
    queryKey: [
      'ai-control-center',
      userId,
      companyId,
      env.aiControlCenterUseMock,
    ],
    queryFn: ({ signal }) => getAIControlCenter(signal),
    retry: false,
    networkMode: env.aiControlCenterUseMock ? 'always' : 'online',
  })
  return { ...query, isDemo: env.aiControlCenterUseMock }
}
