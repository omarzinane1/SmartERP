import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import * as api from '../api/admin.api'
import type { AuditFilters, RoleInput, UserInput } from '../types/admin.types'
export function useUsersAdmin() {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('admin-users'), env.adminUseMock], queryFn: ({ signal }) => api.getUsers(scope, signal) })
  const save = useMutation({ ...options, mutationFn: ({ input, id, invite }: { input: UserInput; id?: number; invite?: boolean }) => id ? api.updateUser(scope, id, input) : invite ? api.inviteUser(scope, input) : api.createUser(scope, input), onSuccess: () => invalidate(['admin-users', 'admin-roles', 'audit-logs']) })
  return { ...query, save, isDemo: env.adminUseMock }
}
export function useRoles() {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('admin-roles'), env.adminUseMock], queryFn: ({ signal }) => api.getRoles(scope, signal) })
  const permissions = useQuery({ ...options, queryKey: [...key('admin-permissions'), env.adminUseMock], enabled: query.data?.permissions.includes('roles.manage') ?? false, queryFn: ({ signal }) => api.getPermissions(signal) })
  const save = useMutation({ ...options, mutationFn: ({ input, id }: { input: RoleInput; id?: number }) => id ? api.updateRole(scope, id, input) : api.createRole(scope, input), onSuccess: () => invalidate(['admin-roles', 'admin-users', 'audit-logs']) })
  return { ...query, permissions, save, isDemo: env.adminUseMock }
}
export function useAuditLogs() {
  const { scope, key } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('audit-logs'), env.adminUseMock], queryFn: ({ signal }) => api.getAuditLogs(scope, signal) })
  const detail = useMutation({ ...options, mutationFn: (id: number) => api.getAuditLogById(scope, id) })
  const download = useMutation({ ...options, mutationFn: ({ params, format }: { params: AuditFilters; format: 'csv' | 'pdf' | 'xlsx' }) => api.exportAuditLogs(scope, params, format) })
  return { ...query, detail, download, isDemo: env.adminUseMock }
}
