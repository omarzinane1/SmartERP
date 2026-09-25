import { Download, LayoutGrid, List, MoreHorizontal, Plus, Search, SlidersHorizontal, Upload } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { SupplierGroup, SupplierPermission } from '../types/suppliers.types'

export function SuppliersToolbar({ permissions, search, expanded, group, view, exporting, onSearch, onFilters, onGroup, onFavorite, onView, onCreate, onExport, onMore }: { permissions: SupplierPermission[]; search: string; expanded: boolean; group: SupplierGroup; view: 'list' | 'kanban'; exporting: boolean; onSearch: (value: string) => void; onFilters: () => void; onGroup: (value: SupplierGroup) => void; onFavorite: (value: string) => void; onView: (value: 'list' | 'kanban') => void; onCreate: () => void; onExport: () => void; onMore: () => void }) {
  return <div className="business-toolbar" aria-label="Outils fournisseurs">
    {permissions.includes('suppliers.create') && <Button className="business-button" onClick={onCreate}><Plus size={13} />Créer un fournisseur</Button>}
    <label className="business-search"><Search size={14} /><input aria-label="Rechercher un fournisseur, contact, ville ou référence" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Rechercher un fournisseur, contact, ville ou référence…" /></label>
    <Button variant="secondary" className="business-button" aria-expanded={expanded} onClick={onFilters}><SlidersHorizontal size={12} />Filtres</Button>
    <select aria-label="Regrouper par" value={group} onChange={(event) => onGroup(event.target.value as SupplierGroup)}><option value="">Regrouper par</option><option value="buyer">Acheteur</option><option value="category">Catégorie</option><option value="country">Pays</option><option value="risk">Risque</option><option value="status">Statut</option></select>
    <select aria-label="Favoris" value="" onChange={(event) => onFavorite(event.target.value)}><option value="">Favoris</option><option value="mine">Mes fournisseurs</option><option value="risk">Fournisseurs à risque</option><option value="strategic">Fournisseurs stratégiques</option><option value="casablanca">Fournisseurs Casablanca</option><option value="delay">Délai élevé</option></select>
    <Button variant="secondary" className="business-button" disabled title="Import CSV / Excel disponible après définition du service backend"><Upload size={12} />Importer</Button>
    {permissions.includes('suppliers.export') && <Button variant="secondary" className="business-button" disabled={exporting} onClick={onExport}><Download size={12} />{exporting ? 'Export…' : 'Exporter'}</Button>}
    <Button variant="secondary" className="business-button" onClick={onMore}><MoreHorizontal size={13} />Plus</Button>
    <div className="business-switch"><button aria-label="Vue Liste" aria-pressed={view === 'list'} onClick={() => onView('list')}><List size={15} /></button><button aria-label="Vue Kanban" aria-pressed={view === 'kanban'} onClick={() => onView('kanban')}><LayoutGrid size={15} /></button></div>
  </div>
}
