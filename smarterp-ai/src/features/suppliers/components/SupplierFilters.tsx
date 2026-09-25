import { X } from 'lucide-react'
import { supplierDefaultFilters } from '../suppliers.utils'
import { supplierRiskLabels, supplierStatusLabels, type SupplierFilters as Filters, type SuppliersData } from '../types/suppliers.types'

export function SupplierFilters({ filters, expanded, facets, onChange }: { filters: Filters; expanded: boolean; facets: SuppliersData['facets']; onChange: (value: Filters) => void }) {
  const set = (key: keyof Filters, value: string | boolean) => onChange({ ...filters, [key]: value })
  const quick = [['', 'Tous'], ['active', 'Actifs'], ['risk', 'À risque'], ['balance', 'Solde élevé'], ['delay', 'Délai > 30 jours'], ['new', 'Nouveaux fournisseurs']]
  const active = Object.entries(filters).filter(([, value]) => value)
  const names: Record<string, string> = { search: 'Recherche', category: 'Catégorie', country: 'Pays', risk: 'Risque', status: 'Statut', buyer: 'Acheteur', city: 'Ville', quick: 'Raccourci', strategic: 'Stratégiques' }
  return <>
    <div className="business-quick" aria-label="Filtres rapides fournisseurs">{quick.map(([value, label]) => <button key={value} aria-pressed={filters.quick === value} onClick={() => set('quick', value)}>{label}</button>)}</div>
    {expanded && <section className="business-filters" aria-label="Filtres avancés fournisseurs">
      <label>Catégorie<select aria-label="Catégorie" value={filters.category} onChange={(event) => set('category', event.target.value)}><option value="">Toutes</option>{facets.categories.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Pays<select aria-label="Pays" value={filters.country} onChange={(event) => set('country', event.target.value)}><option value="">Tous</option>{facets.countries.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Risque<select aria-label="Risque" value={filters.risk} onChange={(event) => set('risk', event.target.value)}><option value="">Tous</option>{Object.entries(supplierRiskLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Statut<select aria-label="Statut" value={filters.status} onChange={(event) => set('status', event.target.value)}><option value="">Tous</option>{Object.entries(supplierStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Acheteur<select aria-label="Acheteur" value={filters.buyer} onChange={(event) => set('buyer', event.target.value)}><option value="">Tous</option>{facets.buyers.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Ville<input value={filters.city} onChange={(event) => set('city', event.target.value)} /></label>
      <p className="business-note">Solde élevé : ≥ 50 000 MAD. Nouveaux : créés dans les 30 derniers jours du périmètre.</p>
    </section>}
    {active.length > 0 && <div className="business-chips">{active.map(([key, value]) => <button key={key} onClick={() => set(key as keyof Filters, key === 'strategic' ? false : '')}>{names[key]} : {typeof value === 'boolean' ? 'Oui' : key === 'quick' ? quick.find(([item]) => item === value)?.[1] : ({ ...supplierRiskLabels, ...supplierStatusLabels } as Record<string, string>)[value] ?? value}<X size={10} /></button>)}<button onClick={() => onChange({ ...supplierDefaultFilters })}>Réinitialiser les filtres</button></div>}
  </>
}

