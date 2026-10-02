import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { disableModule, enableModule, getModules } from '../api/modules.api'
export function useModules() {
  const { scope, key, invalidate } = useBusinessScope(), companyId = useAuthStore((s) => s.company?.id)
  const query = useQuery({ ...options, queryKey: [...key('modules'), env.modulesUseMock], enabled: !!companyId, queryFn: ({ signal }) => getModules(scope, companyId!, signal) })
  useEffect(() => { if (env.modulesUseMock || !query.data?.permissions.includes('modules.manage')) return; const { user, company, setAuth } = useAuthStore.getState(); if (user && company?.id === query.data.companyId) { const enabledModules = query.data.modules.filter((m) => m.status === 'active').map((m) => m.key); if (JSON.stringify(company.enabledModules) !== JSON.stringify(enabledModules)) setAuth({ user, company: { ...company, enabledModules } }) } }, [query.data])
  const change = useMutation({ ...options, mutationFn: ({ key, enable }: { key: string; enable: boolean }) => enable ? enableModule(scope, companyId!, key) : disableModule(scope, companyId!, key), onSuccess: () => invalidate(['modules', 'company-settings', 'ai-status']) })
  return { ...query, change, isDemo: env.modulesUseMock }
}
