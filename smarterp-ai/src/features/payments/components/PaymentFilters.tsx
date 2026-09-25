import { X } from 'lucide-react'
import { paymentDefaultFilters } from '../payments.utils'
import { paymentMethodLabels, paymentStatusLabels, type PaymentFilters as Filters, type PaymentsData } from '../types/payments.types'

export function PaymentFilters({ filters, expanded, partners, onChange }: { filters: Filters; expanded: boolean; partners: PaymentsData['partners']; onChange: (value: Filters) => void }) {
  const set = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value })
  const quick = [{ name: 'Tous', value: '' }, { name: 'Encaissements clients', value: 'incoming' }, { name: 'Paiements fournisseurs', value: 'outgoing' }, { name: 'En attente', value: 'pending' }, { name: 'Virements', value: 'bank_transfer' }]
  const current = filters.direction || (filters.status === 'pending' ? 'pending' : filters.method === 'bank_transfer' ? 'bank_transfer' : '')
  const labels: Record<string, string> = { search: 'Recherche', direction: 'Direction', partnerType: 'Type de tiers', partnerId: 'Tiers', invoice: 'Facture', method: 'Méthode', status: 'Statut', period: 'Période', dateFrom: 'Depuis', dateTo: 'Jusqu’au', minAmount: 'Minimum', maxAmount: 'Maximum' }
  return <>
    <div className="business-quick" aria-label="Filtres rapides paiements">{quick.map((item) => <button key={item.value} aria-pressed={current === item.value} onClick={() => onChange({ ...filters, direction: item.value === 'incoming' || item.value === 'outgoing' ? item.value : '', partnerType: '', partnerId: '', status: item.value === 'pending' ? 'pending' : '', method: item.value === 'bank_transfer' ? 'bank_transfer' : '' })}>{item.name}</button>)}</div>
    {expanded && <section className="business-filters" aria-label="Filtres avancés paiements">
      <label>Direction<select aria-label="Direction" value={filters.direction} onChange={(event) => set('direction', event.target.value)}><option value="">Tous les flux</option><option value="incoming">Entrant</option><option value="outgoing">Sortant</option></select></label>
      <label>Type de tiers<select aria-label="Type de tiers" value={filters.partnerType} onChange={(event) => onChange({ ...filters, partnerType: event.target.value, partnerId: '' })}><option value="">Tous</option><option value="customer">Client</option><option value="supplier">Fournisseur</option></select></label>
      <label>Client / Fournisseur<select aria-label="Client / Fournisseur" value={filters.partnerId} onChange={(event) => set('partnerId', event.target.value)}><option value="">Tous les tiers</option>{partners.filter((row) => !filters.partnerType || row.type === filters.partnerType).map((row) => <option key={`${row.type}:${row.id}`} value={`${row.type}:${row.id}`}>{row.name}</option>)}</select></label>
      <label>Facture<input value={filters.invoice} onChange={(event) => set('invoice', event.target.value)} placeholder="INV-2026-…" /></label>
      <label>Méthode<select aria-label="Méthode" value={filters.method} onChange={(event) => set('method', event.target.value)}><option value="">Toutes</option>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Statut<select aria-label="Statut" value={filters.status} onChange={(event) => set('status', event.target.value)}><option value="">Tous</option>{Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Période<select aria-label="Période" value={filters.period} onChange={(event) => set('period', event.target.value)}><option value="">Toutes les dates</option><option value="today">Aujourd’hui</option><option value="week">Cette semaine</option><option value="month">Ce mois</option><option value="custom">Personnalisée</option></select></label>
      {filters.period === 'custom' && <><label>Du<input type="date" value={filters.dateFrom} onChange={(event) => set('dateFrom', event.target.value)} /></label><label>Au<input type="date" value={filters.dateTo} onChange={(event) => set('dateTo', event.target.value)} /></label></>}
      <label>Montant minimum<input type="number" min="0" value={filters.minAmount} onChange={(event) => set('minAmount', event.target.value)} /></label><label>Montant maximum<input type="number" min="0" value={filters.maxAmount} onChange={(event) => set('maxAmount', event.target.value)} /></label>
    </section>}
    <div className="business-chips">{Object.entries(filters).filter(([, value]) => value).map(([key, value]) => <button key={key} onClick={() => set(key as keyof Filters, '')}>{labels[key]} : {key === 'partnerId' ? partners.find((row) => `${row.type}:${row.id}` === value)?.name : ({ incoming: 'Entrant', outgoing: 'Sortant', month: 'Ce mois', week: 'Cette semaine', today: 'Aujourd’hui', custom: 'Personnalisée', customer: 'Client', supplier: 'Fournisseur', ...paymentMethodLabels, ...paymentStatusLabels } as Record<string, string>)[value] ?? value}<X size={10} /></button>)}<button onClick={() => onChange({ ...paymentDefaultFilters, period: '' })}>Réinitialiser les filtres</button></div>
  </>
}

