import { Download, MoreHorizontal, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { PaymentGroup, PaymentPermission } from '../types/payments.types'

export function PaymentsToolbar({ permissions, search, expanded, group, exporting, onSearch, onFilters, onGroup, onFavorite, onCreate, onExport, onMore }: { permissions: PaymentPermission[]; search: string; expanded: boolean; group: PaymentGroup; exporting: boolean; onSearch: (value: string) => void; onFilters: () => void; onGroup: (value: PaymentGroup) => void; onFavorite: (value: string) => void; onCreate: () => void; onExport: () => void; onMore: () => void }) {
  return <div className="business-toolbar" aria-label="Outils paiements">
    {permissions.includes('payments.create') && <Button className="business-button" onClick={onCreate}><Plus size={13} />Enregistrer un paiement</Button>}
    <label className="business-search"><Search size={14} /><input aria-label="Rechercher un paiement, une facture ou un tiers" placeholder="Rechercher un paiement, une facture ou un tiers…" value={search} onChange={(event) => onSearch(event.target.value)} /></label>
    <Button variant="secondary" className="business-button" aria-expanded={expanded} onClick={onFilters}><SlidersHorizontal size={12} />Filtres</Button>
    <select aria-label="Regrouper par" value={group} onChange={(event) => onGroup(event.target.value as PaymentGroup)}><option value="">Regrouper par</option><option value="direction">Direction</option><option value="method">Méthode</option><option value="status">Statut</option><option value="customer">Client</option><option value="supplier">Fournisseur</option><option value="month">Mois</option></select>
    <select aria-label="Favoris" value="" onChange={(event) => onFavorite(event.target.value)}><option value="">Favoris</option><option value="incoming">Encaissements du mois</option><option value="outgoing">Décaissements du mois</option><option value="pending">Paiements en attente</option><option value="bank_transfer">Virements bancaires</option></select>
    {permissions.includes('payments.export') && <Button variant="secondary" className="business-button" disabled={exporting} onClick={onExport}><Download size={12} />{exporting ? 'Export…' : 'Exporter'}</Button>}
    <Button variant="secondary" className="business-button" onClick={onMore}><MoreHorizontal size={14} />Plus</Button>
  </div>
}
