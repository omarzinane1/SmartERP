export type ModuleStatus = 'active' | 'inactive' | 'premium_locked' | 'coming_soon'
export interface ERPModule { id: string; key: string; name: string; description: string; status: ModuleStatus; category: string; premium: boolean; configurable: boolean; dependencies: string[]; settingsSection: string | null; configuration: { label: string; value: string }[]; capabilities: { canEnable: boolean; canDisable: boolean; canConfigure: boolean } }
export interface ModulesData { companyId: number; modules: ERPModule[]; permissions: string[]; asOf: string; plan: string }
export const moduleStatusLabels: Record<ModuleStatus, string> = { active: 'Actif', inactive: 'Inactif', premium_locked: 'Premium', coming_soon: 'Bientôt disponible' }
