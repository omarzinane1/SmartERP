import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import type { Company } from '../../auth/types/auth.types'
import { aiStatusMock, settingsMock, testIntegrationMock, updateSettingsMock } from '../data/settings.mock'
import type { AIStatus, IntegrationTestResult, SettingsData, SettingsPayload } from '../types/settings.types'
export const getSettings = async (scope: string, company: Company | null, signal?: AbortSignal): Promise<SettingsData> => env.settingsUseMock ? settingsMock(scope, company) : (await apiClient.get('/settings/', { signal })).data
export const updateSettingsSection = async (scope: string, company: Company | null, input: SettingsPayload, version: number): Promise<SettingsData> => env.settingsUseMock ? updateSettingsMock(scope, company, input, version) : (await apiClient.patch(`/settings/${input.section}/`, { values: input.values, version })).data
export const getAIStatus = async (scope: string, company: Company | null, signal?: AbortSignal): Promise<AIStatus> => env.settingsUseMock ? aiStatusMock(scope, company) : (await apiClient.get('/ai/status/', { signal })).data
export const testIntegration = async (scope: string, company: Company | null, id: string): Promise<IntegrationTestResult> => env.settingsUseMock ? testIntegrationMock(scope, company, id) : (await apiClient.post(`/integrations/${encodeURIComponent(id)}/test/`, {})).data
