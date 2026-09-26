import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { changeModuleMock, modulesMock } from '../data/modules.mock'
import type { ModulesData } from '../types/modules.types'
export const getModules = async (scope: string, companyId: number, signal?: AbortSignal): Promise<ModulesData> => env.modulesUseMock ? modulesMock(scope, companyId) : (await apiClient.get('/modules/', { signal })).data
export const enableModule = async (scope: string, companyId: number, moduleKey: string): Promise<ModulesData> => env.modulesUseMock ? changeModuleMock(scope, companyId, moduleKey, true) : (await apiClient.post(`/companies/${companyId}/modules/${encodeURIComponent(moduleKey)}/enable/`, {})).data
export const disableModule = async (scope: string, companyId: number, moduleKey: string): Promise<ModulesData> => env.modulesUseMock ? changeModuleMock(scope, companyId, moduleKey, false) : (await apiClient.post(`/companies/${companyId}/modules/${encodeURIComponent(moduleKey)}/disable/`, {})).data
