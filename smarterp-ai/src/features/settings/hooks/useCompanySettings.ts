import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import * as api from '../api/settings.api'
import type { SettingsPayload, SettingsSection } from '../types/settings.types'
export function useCompanySettings(section: SettingsSection) {
  const { scope, key, invalidate } = useBusinessScope(), company = useAuthStore((s) => s.company)
  const query = useQuery({ ...options, queryKey: [...key('company-settings'), env.settingsUseMock], queryFn: ({ signal }) => api.getSettings(scope, company, signal) })
  const ai = useQuery({ ...options, queryKey: [...key('ai-status'), env.settingsUseMock], enabled: section === 'ai' && !!query.data?.permissions.includes('settings.view') && query.data.policies.ai.canView, queryFn: ({ signal }) => api.getAIStatus(scope, company, signal) })
  const update = useMutation({ ...options, mutationFn: ({ input, version }: { input: SettingsPayload; version: number }) => api.updateSettingsSection(scope, company, input, version), onSuccess: async (result, { input }) => { if (input.section === 'company') { const auth = useAuthStore.getState(); if (auth.user && auth.company?.id === company?.id && auth.company) auth.setAuth({ user: auth.user, company: { ...auth.company, name: result.values.company.companyName } }) } await invalidate(['company-settings', 'ai-status', 'documents', 'document', 'ai-conversations', 'forecast', 'ai-opportunities']) } })
  const integration = useMutation({ ...options, mutationFn: (id: string) => api.testIntegration(scope, company, id) })
  return { ...query, update, ai, integration, isDemo: env.settingsUseMock }
}
