import type { AIOpportunity, OpportunityAction, OpportunityStatus, OpportunityType } from './types/ai.types'

export const opportunityTypes: Record<OpportunityType, string> = { customer_reactivation: 'Réactivation client', high_value_customer: 'Valeur client', receivable_collection: 'Créances prioritaires', stock_replenishment: 'Réapprovisionnement', dormant_stock: 'Stock dormant' }
export const opportunityStatuses: Record<OpportunityStatus, string> = { open: 'À examiner', acknowledged: 'Prise en charge', completed: 'Terminée', dismissed: 'Écartée', expired: 'Expirée' }
export const opportunityPriorities = { low: 'Faible', medium: 'Moyenne', high: 'Élevée', critical: 'Critique' }
export const opportunityActions: Record<OpportunityAction, string> = { acknowledge: 'Prendre en charge', complete: 'Marquer terminée', dismiss: 'Écarter' }
export const opportunityValueLabel = (o: AIOpportunity) => o.valueKind === 'outstanding_receivable' ? 'Solde échu observé' : o.valueKind === 'book_inventory_value' ? 'Valeur comptable immobilisée' : 'Impact monétaire'
// Preserve Decimal strings, including large values, without a floating point conversion.
export function opportunityValue(o: AIOpportunity) {
  if (o.potentialValue === null) return 'Non estimé'
  const [whole, fraction = ''] = o.potentialValue.split('.')
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')},${fraction.replace(/0+$/, '').padEnd(2, '0')} ${o.currency}`
}
