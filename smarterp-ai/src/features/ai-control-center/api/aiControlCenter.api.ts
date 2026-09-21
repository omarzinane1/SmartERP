import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { aiControlCenterMock } from '../data/aiControlCenter.mock'
import type { AIControlCenterData } from '../types/aiControlCenter.types'

export const AI_CONTROL_CENTER_ENDPOINT = '/ai/control-center/'

export async function getAIControlCenter(
  signal?: AbortSignal,
): Promise<AIControlCenterData> {
  if (env.aiControlCenterUseMock) return aiControlCenterMock

  // Django fournit le contrat AIControlCenterData ; adapter la réponse ici si nécessaire.
  const { data } = await apiClient.get<AIControlCenterData>(
    AI_CONTROL_CENTER_ENDPOINT,
    { signal },
  )
  return data
}
