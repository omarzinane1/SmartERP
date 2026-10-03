import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Archive, MoreHorizontal, Pencil } from 'lucide-react'
import { Checkbox } from '../../../components/ui/Checkbox'
import { Badge } from '../../../components/ui/Badge'
import { formatMoney } from '../../../lib/money'
import { supplierGroupLabel } from '../suppliers.utils'
import { SupplierScoreBadge } from './SupplierKPIGrid'
import { supplierRiskLabels, supplierStatusLabels, type Supplier, type SupplierGroup, type SupplierPermission } from '../types/suppliers.types'

export interface SupplierCollectionProps { suppliers: Supplier[]; selected: number[]; permissions: SupplierPermission[]; group: SupplierGroup; busy: boolean; onSelect: (supplier: Supplier) => void; onEdit: (supplier: Supplier) => void; onArchive: (supplier: Supplier) => void; onMore: (supplier: Supplier) => void }
export function SupplierRiskBadge({ supplier }: { supplier: Supplier }) { return <Badge tone={supplier.risk === null ? 'neutral' : supplier.risk === 'high' ? 'critical' : supplier.risk === 'medium' ? 'warning' : 'positive'}>{supplier.risk ? supplierRiskLabels[supplier.risk] : 'Non évalué'}</Badge> }
export function SupplierActions({ supplier, permissions, busy, onEdit, onArchive, onMore }: Pick<SupplierCollectionProps, 'permissions' | 'busy' | 'onEdit' | 'onArchive' | 'onMore'> & { supplier: Supplier }) {
  return <div className="business-actions"><Link to={`/suppliers/${supplier.id}`} aria-label={`Ouvrir ${supplier.name}`}>Ouvrir</Link>{permissions.includes('suppliers.edit') && <>{supplier.capabilities.canEdit && <button disabled={busy} aria-label={`Modifier ${supplier.name}`} onClick={() => onEdit(supplier)}><Pencil size={12} /></button>}{supplier.status !== 'archived' && supplier.capabilities.canArchive && <button disabled={busy} aria-label={`Archiver ${supplier.name}`} onClick={() => onArchive(supplier)}><Archive size={12} /></button>}</>}<button aria-label={`Plus pour ${supplier.name}`} onClick={() => onMore(supplier)}><MoreHorizontal size={13} /></button></div>
}
export function SupplierTable(props: SupplierCollectionProps & { onSelectPage: () => void }) {
  const groups = new Map<string, Supplier[]>()
  for (const supplier of props.suppliers) { const key = supplierGroupLabel(supplier, props.group); groups.set(key, [...groups.get(key) ?? [], supplier]) }
  return <div className="business-table-scroll" role="region" aria-label="Tableau des fournisseurs" tabIndex={0}><table className="business-table supplier-table"><thead><tr><th><Checkbox aria-label="Sélectionner la page" checked={props.suppliers.length > 0 && props.suppliers.every((row) => props.selected.includes(row.id))} onChange={props.onSelectPage} /></th><th>Fournisseur</th><th>Catégorie</th><th>Ville / Pays</th><th>Acheteur</th><th className="money">Volume achats</th><th className="money">Solde</th><th>Délai moyen</th><th>Score</th><th>Risque</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{[...groups].map(([label, rows]) => <Fragment key={label}>{props.group && <tr className="group"><th colSpan={12}>{label} · {rows.length} sur cette page</th></tr>}{rows.map((supplier) => <tr key={supplier.id} data-selected={props.selected.includes(supplier.id)}>
    <td><Checkbox aria-label={`Sélectionner ${supplier.name}`} checked={props.selected.includes(supplier.id)} onChange={() => props.onSelect(supplier)} /></td><td><Link to={`/suppliers/${supplier.id}`}><strong>{supplier.name}</strong></Link><small>{supplier.reference}</small></td><td>{supplier.category}</td><td>{supplier.city}<small>{supplier.country}</small></td><td>{supplier.buyer}</td><td className="money">{formatMoney(supplier.purchaseVolume)}</td><td className="money"><strong>{formatMoney(supplier.outstandingBalance)}</strong></td><td>{supplier.averageLeadTimeDays === null ? '—' : `${supplier.averageLeadTimeDays} j`}</td><td><SupplierScoreBadge supplier={supplier} /></td><td><SupplierRiskBadge supplier={supplier} /></td><td><Badge tone={supplier.status === 'active' ? 'positive' : supplier.status === 'blocked' ? 'critical' : 'neutral'}>{supplierStatusLabels[supplier.status]}</Badge></td><td><SupplierActions {...props} supplier={supplier} /></td>
  </tr>)}</Fragment>)}</tbody></table></div>
}
