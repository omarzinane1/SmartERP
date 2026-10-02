import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { getCollection } from '../../../lib/collectionApi'
import { stockDemoDate } from '../../products/data/products.mock'
import { filterAudit } from '../admin.utils'
import * as mock from '../data/admin.mock'
import type { AdminUser, AuditData, AuditFilters, AuditLog, Permission, Role, RoleInput, RolesData, UserInput, UsersData } from '../types/admin.types'
export const getUsers = async (scope: string, signal?: AbortSignal): Promise<UsersData> => env.adminUseMock ? { users: mock.adminUsersSnapshot(scope), permissions: mock.adminPermissions, asOf: stockDemoDate, roles: mock.rolesSnapshot(scope).map(({ id, name }) => ({ id, name })), departments: ['Direction', 'Finance', 'Commercial', 'Achats', 'Stock'], currentUserId: 1, assignableRoleIds: mock.rolesSnapshot(scope).filter((r) => r.id !== 1).map((r) => r.id), canCreateDirectly: true } : getCollection<UsersData, 'users'>('/admin/users/', 'users', signal)
const userDTO = (v: UserInput) => ({ name: v.name, email: v.email, department: v.department, ...(v.roleId !== undefined ? { role_id: v.roleId } : {}), ...(v.status ? { status: v.status } : {}) })
export const createUser = async (scope: string, v: UserInput): Promise<AdminUser> => env.adminUseMock ? mock.saveAdminUserMock(scope, v) : (await apiClient.post('/admin/users/', userDTO(v))).data
export const inviteUser = async (scope: string, v: UserInput): Promise<AdminUser> => env.adminUseMock ? mock.saveAdminUserMock(scope, v, undefined, true) : (await apiClient.post('/admin/invitations/', userDTO(v))).data
export const updateUser = async (scope: string, id: number, v: UserInput): Promise<AdminUser> => env.adminUseMock ? mock.saveAdminUserMock(scope, v, id) : (await apiClient.patch(`/admin/users/${id}/`, userDTO(v))).data
export const getRoles = async (scope: string, signal?: AbortSignal): Promise<RolesData> => env.adminUseMock ? { roles: mock.rolesSnapshot(scope), users: mock.adminUsersSnapshot(scope).map(({ id, name, roleId }) => ({ id, name, roleId })), permissions: mock.adminPermissions, asOf: stockDemoDate } : getCollection<RolesData, 'roles'>('/admin/roles/', 'roles', signal)
export const getPermissions = async (signal?: AbortSignal): Promise<Permission[]> => env.adminUseMock ? structuredClone(mock.permissionCatalog) : (await apiClient.get('/admin/permissions/', { signal })).data
export const createRole = async (scope: string, v: RoleInput): Promise<Role> => env.adminUseMock ? mock.saveRoleMock(scope, v) : (await apiClient.post('/admin/roles/', { name: v.name, description: v.description, permission_codes: v.permissionCodes })).data
export const updateRole = async (scope: string, id: number, v: RoleInput): Promise<Role> => env.adminUseMock ? mock.saveRoleMock(scope, v, id) : (await apiClient.patch(`/admin/roles/${id}/`, { name: v.name, description: v.description, permission_codes: v.permissionCodes, version: v.version })).data
export const getAuditLogs = async (scope: string, signal?: AbortSignal): Promise<AuditData> => env.adminUseMock ? { logs: mock.auditSnapshot(scope), permissions: mock.adminPermissions, asOf: stockDemoDate, canViewNetwork: false, exportFormats: ['csv'] } : (await apiClient.get('/audit-logs/', { signal })).data
export const getAuditLogById = async (scope: string, id: number): Promise<AuditLog> => env.adminUseMock ? mock.auditByIdMock(scope, id) : (await apiClient.get(`/audit-logs/${id}/`)).data
export async function exportAuditLogs(scope: string, params: AuditFilters, format: 'csv' | 'pdf' | 'xlsx'): Promise<{ rows?: (string | number)[][]; blob?: Blob; filename: string }> {
  if (env.adminUseMock) { if (format !== 'csv') throw new Error('Format indisponible.'); return { filename: 'audit-demo.csv', rows: [['Date', 'Utilisateur', 'Module', 'Action', 'Entité', 'Référence', 'Résultat'], ...filterAudit(mock.auditSnapshot(scope), params, false).map((l) => [l.timestamp, l.actor, l.module, l.action, l.restricted ? 'Restreint' : l.entityType, l.restricted ? 'Restreint' : l.reference, l.result])] } }
  return { blob: (await apiClient.get('/audit-logs/export/', { params: { ...params, date_from: params.dateFrom, date_to: params.dateTo, format }, responseType: 'blob' })).data, filename: `audit.${format}` }
}
