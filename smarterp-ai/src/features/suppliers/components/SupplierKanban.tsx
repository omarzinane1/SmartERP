import { Link } from 'react-router-dom'
import { Checkbox } from '../../../components/ui/Checkbox'
import { Badge } from '../../../components/ui/Badge'
import { formatMoney } from '../../../lib/money'
import { supplierGroupLabel } from '../suppliers.utils'
import { supplierStatusLabels, type Supplier } from '../types/suppliers.types'
import { SupplierScoreBadge } from './SupplierKPIGrid'
import { SupplierActions, SupplierRiskBadge, type SupplierCollectionProps } from './SupplierTable'

export function SupplierKanban(props: SupplierCollectionProps) {
  const groups = new Map<string, Supplier[]>()
  for (const supplier of props.suppliers) { const key = supplierGroupLabel(supplier, props.group || 'risk'); groups.set(key, [...groups.get(key) ?? [], supplier]) }
  return <div className="supplier-board" role="region" aria-label="Kanban des fournisseurs">{[...groups].map(([label, rows]) => <section key={label} className="supplier-column" aria-label={label}><header><h2>{label}</h2><span>{rows.length}</span></header>{rows.map((supplier) => <article className="business-card supplier-tile" key={supplier.id}><header><Checkbox aria-label={`Sélectionner ${supplier.name}`} checked={props.selected.includes(supplier.id)} onChange={() => props.onSelect(supplier)} /><Link to={`/suppliers/${supplier.id}`}><h3>{supplier.name}</h3></Link></header><p>{supplier.reference} · {supplier.category}</p><p>{supplier.city}, {supplier.country}</p><dl><div><dt>Volume achats</dt><dd>{formatMoney(supplier.purchaseVolume)}</dd></div><div><dt>Solde</dt><dd>{formatMoney(supplier.outstandingBalance)}</dd></div><div><dt>Délai moyen</dt><dd>{supplier.averageLeadTimeDays === null ? 'Indisponible' : `${supplier.averageLeadTimeDays} jours`}</dd></div><div><dt>Score fournisseur</dt><dd><SupplierScoreBadge supplier={supplier} /></dd></div></dl><SupplierRiskBadge supplier={supplier} /><span className="ml-2"><Badge>{supplierStatusLabels[supplier.status]}</Badge></span><p>Acheteur · {supplier.buyer}</p><footer><SupplierActions {...props} supplier={supplier} /></footer></article>)}</section>)}</div>
}
