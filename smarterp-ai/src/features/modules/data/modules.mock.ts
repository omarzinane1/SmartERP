import type { ERPModule, ModulesData } from '../types/modules.types'
const definitions: [string, string, string, string, ERPModule['status'], string[], string | null][] = [
  ['crm', 'CRM', 'Contacts, comptes clients et suivi de la relation.', 'Commercial', 'active', [], null],
  ['sales', 'Ventes', 'Devis, commandes et facturation client.', 'Commercial', 'active', ['crm'], 'sales'],
  ['purchasing', 'Achats', 'Fournisseurs, commandes et factures d’achat.', 'Opérations', 'active', [], 'purchasing'],
  ['inventory', 'Stock', 'Produits, dépôts, mouvements et transferts.', 'Opérations', 'active', [], 'inventory'],
  ['finance', 'Finance', 'Paiements, dépenses et suivi de trésorerie.', 'Finance', 'active', [], 'finance'],
  ['hr', 'RH', 'Activation de la disponibilité du module RH ; écrans métier à venir.', 'Organisation', 'inactive', [], null],
  ['projects', 'Projets', 'Activation de la disponibilité des projets ; écrans métier à venir.', 'Organisation', 'inactive', [], null],
  ['production', 'Production', 'Ordres de fabrication et consommation de composants.', 'Opérations', 'premium_locked', ['inventory', 'purchasing'], null],
  ['maintenance', 'Maintenance', 'Entretien des équipements et interventions.', 'Opérations', 'coming_soon', [], null],
  ['pos', 'Point de vente', 'Ventes en magasin et suivi des caisses.', 'Commercial', 'coming_soon', ['inventory', 'finance'], null],
  ['documents', 'Documents', 'Base documentaire, accès et indexation.', 'Intelligence', 'active', [], 'documents'],
  ['ai', 'Intelligence IA', 'Assistant, prévisions et recommandations sourcées.', 'Intelligence', 'active', ['documents'], 'ai'],
]
const stores = new Map<string, ERPModule[]>()
export function modulesSnapshot(scope: string): ERPModule[] { if (!stores.has(scope)) stores.set(scope, definitions.map(([key, name, description, category, status, dependencies, settingsSection]) => ({ id: key, key, name, description, category, status, dependencies, settingsSection, premium: key === 'production', configurable: settingsSection !== null, configuration: [{ label: 'Périmètre', value: 'Société actuelle' }, { label: 'Conservation des données', value: 'Aucune suppression lors d’une désactivation' }], capabilities: { canEnable: status === 'active' || status === 'inactive', canDisable: status === 'active' || status === 'inactive', canConfigure: settingsSection !== null } }))); return structuredClone(stores.get(scope)!) }
export const modulesMock = (scope: string, companyId: number): ModulesData => ({ companyId, modules: modulesSnapshot(scope), permissions: ['modules.manage', 'settings.view'], asOf: '2026-09-30', plan: 'Business · démonstration' })
export async function changeModuleMock(scope: string, companyId: number, key: string, enable: boolean) {
  await new Promise((r) => setTimeout(r, 200)); modulesSnapshot(scope); const list = stores.get(scope)!, module = list.find((m) => m.key === key)
  if (!module || !['active', 'inactive'].includes(module.status) || !(enable ? module.capabilities.canEnable : module.capabilities.canDisable)) throw new Error('Action non autorisée pour ce module.')
  if (enable && module.dependencies.some((dep) => !list.some((m) => m.key === dep && m.status === 'active'))) throw new Error('Activez les dépendances requises séparément.')
  if (!enable && list.some((m) => m.status === 'active' && m.dependencies.includes(key))) throw new Error('Un module actif dépend de ce module.')
  module.status = enable ? 'active' : 'inactive'; return modulesMock(scope, companyId)
}
