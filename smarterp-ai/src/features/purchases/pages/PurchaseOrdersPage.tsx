import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { CollectionPagination } from '../../../components/ui/CollectionPagination'
import { downloadCSV } from '../../../lib/csv'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { filterPurchases, purchaseDefaultFilters } from '../purchases.utils'
import { PurchaseKPIGrid } from '../components/PurchaseKPIGrid'
import { PurchasesToolbar } from '../components/PurchasesToolbar'
import { PurchaseFilters } from '../components/PurchaseFilters'
import { PurchaseOrderTable } from '../components/PurchaseOrderTable'
import { PurchaseKanban } from '../components/PurchaseKanban'
import { PurchaseFormDialog } from '../components/PurchaseFormDialog'
import { ActionConfirmation, PurchasingNotice, PurchasingState } from '../components/PurchasingShared'
import type { PurchaseFilters as Filters, PurchaseGroup, PurchaseInput, PurchaseOrder } from '../types/purchases.types'
import '../purchasing.css'
export function PurchaseOrdersPage() {
  const [params] = useSearchParams(), navigate = useNavigate()
  const [filters, setFilters] = useState<Filters>({ ...purchaseDefaultFilters, supplier: params.get('supplier') ?? '' })
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25)
  const [view, setView] = useState<'list' | 'kanban'>('list'), [group, setGroup] = useState<PurchaseGroup>('')
  const [sort, setSort] = useState('date'), [expanded, setExpanded] = useState(false), [selected, setSelected] = useState<number[]>([])
  const [create, setCreate] = useState(params.get('create') === '1')
  const [confirmation, setConfirmation] = useState<{ order: PurchaseOrder; action: 'send' | 'confirm' } | null>(null)
  const [error, setError] = useState<string | null>(null), lock = useRef(false)
  const q = usePurchaseOrders(), data = q.data
  const filtered = useMemo(() => data ? filterPurchases(data.orders, filters, data.asOf, data.currentBuyer).sort((a, b) => sort === 'amount' ? b.total - a.total : sort === 'reference' ? a.reference.localeCompare(b.reference) : b.date.localeCompare(a.date) || b.id - a.id) : [], [data, filters, sort])
  function apply(f: Filters) { setFilters(f); setPage(1); setSelected([]) }
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  async function save(input: PurchaseInput) {
    if (lock.current || !data?.permissions.includes('purchases.create')) return
    lock.current = true; setError(null)
    try { const result = await q.create.mutateAsync(input); setCreate(false); toast.success(q.isDemo ? 'Brouillon simulé en mémoire.' : 'Commande créée.'); navigate(`/purchases/${result.id}`) }
    catch { setError('Impossible d’enregistrer la commande. La saisie est conservée.') } finally { lock.current = false }
  }
  async function act() {
    if (lock.current || !confirmation || !data) return
    const { order, action } = confirmation
    if (action === 'confirm' ? !data.permissions.includes('purchases.confirm') || order.capabilities?.canConfirm !== true : order.capabilities?.canSend !== true) return
    lock.current = true; setError(null)
    try { await q.action.mutateAsync({ id: order.id, action }); setConfirmation(null); toast.success(q.isDemo ? 'Action simulée en mémoire.' : 'Action confirmée par le serveur.') }
    catch { setError('Opération non confirmée. Réessayez après vérification de la commande.') } finally { lock.current = false }
  }
  function exportRows() { if (!data?.canExport) return; const exported = selected.length ? filtered.filter((o) => selected.includes(o.id)) : filtered; downloadCSV('commandes-fournisseurs.csv', [['Référence', 'Fournisseur', 'Date', 'Livraison', 'Acheteur', 'TTC MAD', 'Commande', 'Réception', 'Facturation', 'Source'], ...exported.map((o) => [o.reference, o.supplierName, o.date, o.expectedDate, o.buyer, o.total, o.status, o.receiptStatus, data.permissions.includes('supplier_invoices.view') ? o.billingStatus : '', q.isDemo ? 'Démonstration' : 'Serveur'])]) }
  if (q.isForbidden || !data) return <PurchasingState forbidden={q.isForbidden} loading={q.isPending} error="Impossible de charger les commandes fournisseurs." onRetry={() => void q.refetch()} />
  return <main className="dashboard-page business-page purchasing-page"><header className="business-header"><div><small>Achats / Commandes fournisseurs</small><h1>Commandes fournisseurs</h1><p>Suivez vos engagements d’achat, les réceptions attendues et les retards fournisseurs.</p></div><span className="business-note">{filtered.length} commandes dans le périmètre</span></header>{q.isError && <Alert variant="error">L’actualisation a échoué. Dernières données affichées.</Alert>}<PurchaseKPIGrid orders={filtered} asOf={data.asOf} /><section className="business-card"><PurchasesToolbar search={filters.search} onSearch={(search) => apply({ ...filters, search })} canCreate={data.permissions.includes('purchases.create')} canExport={data.canExport === true} onCreate={() => { setError(null); setCreate(true) }} onExport={exportRows} group={group} onGroup={setGroup} view={view} onView={setView} expanded={expanded} onFilters={() => setExpanded(!expanded)} /><PurchaseFilters filters={filters} expanded={expanded} orders={data.orders} onChange={apply} /><div className="business-results"><span>{filtered.length} résultat(s) · {view === 'kanban' ? 'Toutes les commandes filtrées' : 'Regroupement sur la page courante'}</span><label>Trier<select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }}><option value="date">Date décroissante</option><option value="reference">Référence</option><option value="amount">Montant décroissant</option></select></label><Button variant="ghost" className="business-button" disabled={q.isFetching} onClick={() => void q.refetch()}>Actualiser</Button></div>{selected.length > 0 && <div className="business-selection"><strong>{selected.length} sélectionnée(s)</strong>{data.canExport === true && <button onClick={exportRows}>Exporter la sélection</button>}<button onClick={() => setSelected([])}>Effacer la sélection</button></div>}{!filtered.length ? <div className="business-state"><h2>{data.orders.length ? 'Aucune commande ne correspond à vos critères.' : 'Aucune commande fournisseur pour le moment.'}</h2>{data.orders.length > 0 && <Button variant="secondary" className="business-button" onClick={() => apply({ ...purchaseDefaultFilters })}>Réinitialiser les filtres</Button>}</div> : view === 'list' ? <PurchaseOrderTable orders={rows} group={group} asOf={data.asOf} permissions={data.permissions} selected={selected} onSelect={setSelected} busy={q.action.isPending} onAction={(order, action) => { setError(null); setConfirmation({ order, action }) }} /> : <PurchaseKanban orders={filtered} asOf={data.asOf} />}{view === 'list' && <CollectionPagination page={safePage} pageSize={pageSize} count={filtered.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1) }} />}</section><PurchasingNotice demo={q.isDemo} asOf={data.asOf} />{create && data.permissions.includes('purchases.create') && <PurchaseFormDialog products={q.isDemo ? undefined : data.products} warehouses={data.warehouses} suppliers={filters.supplier ? data.suppliers.filter((s) => s.id === Number(filters.supplier)) : data.suppliers} asOf={data.asOf} buyer={data.currentBuyer} demo={q.isDemo} busy={q.create.isPending} error={error} onClose={() => setCreate(false)} onSubmit={(v) => void save(v)} />}{confirmation && <ActionConfirmation title={`${confirmation.action === 'send' ? 'Envoyer' : 'Confirmer'} ${confirmation.order.reference} ?`} demo={q.isDemo} busy={q.action.isPending} error={error} onClose={() => setConfirmation(null)} onConfirm={() => void act()}><p>{confirmation.action === 'send' ? 'Cette action enregistre votre attestation d’envoi externe au fournisseur. Aucun e-mail automatique n’est envoyé.' : 'La confirmation engage cette commande ; la réception et la facturation restent suivies séparément.'}</p></ActionConfirmation>}</main>
}
