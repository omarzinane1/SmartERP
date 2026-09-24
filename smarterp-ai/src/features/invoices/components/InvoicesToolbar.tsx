import { Download, Filter, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import type { InvoiceGroup, InvoicePermission } from '../types/invoices.types'

export function InvoicesToolbar({ permissions, search, expanded, group, view, onSearch, onToggleFilters, onGroup, onView, onExport, onFavorite }: {
  permissions: InvoicePermission[]; search: string; expanded: boolean; group: InvoiceGroup; view: 'list' | 'kanban'
  onSearch: (search: string) => void; onToggleFilters: () => void; onGroup: (group: InvoiceGroup) => void; onView: (view: 'list' | 'kanban') => void; onExport: () => void; onFavorite: (favorite: string) => void
}) {
  return <div className="invoice-toolbar">{permissions.includes('invoices.create') && <Link className="invoice-create-link" to="/invoices/new"><Plus size={13} />Créer une facture</Link>}
    <label className="invoice-search"><Search size={13} aria-hidden="true" /><input aria-label="Rechercher une facture, un client ou une référence" value={search} placeholder="Rechercher une facture, un client ou une référence…" onChange={(event) => onSearch(event.target.value)} /></label>
    <Button variant="secondary" className="invoice-button" aria-expanded={expanded} aria-controls="invoice-advanced-filters" onClick={onToggleFilters}><Filter size={12} />Filtres</Button>
    <select aria-label="Regrouper par" value={group} onChange={(event) => onGroup(event.target.value as InvoiceGroup)}><option value="">Regrouper par</option><option value="status">Statut</option><option value="customer">Client</option><option value="salesperson">Commercial</option><option value="month">Mois</option><option value="due">Échéance</option><option value="aging">Tranche d’aging</option></select>
    <select aria-label="Favoris" value="" onChange={(event) => onFavorite(event.target.value)}><option value="">Favoris</option><option value="overdue">Factures en retard</option><option value="unpaid">Impayées</option><option value="partial">Paiements partiels</option><option value="soon">Échéances proches</option><option value="mine">Mes factures</option></select>
    <Button className="invoice-button" variant="secondary" onClick={onExport}><Download size={12} />Exporter</Button>
    <details className="invoice-menu"><summary>Plus</summary><div><button type="button" onClick={() => onFavorite('all')}>Réinitialiser les filtres</button><p>Les relances se préparent depuis la sélection et nécessitent une permission dédiée.</p></div></details>
    <div className="invoice-view-switch"><button aria-label="Vue Liste" aria-pressed={view === 'list'} onClick={() => onView('list')}><List size={14} /></button><button aria-label="Vue Kanban" aria-pressed={view === 'kanban'} onClick={() => onView('kanban')}><LayoutGrid size={14} /></button></div>
  </div>
}
