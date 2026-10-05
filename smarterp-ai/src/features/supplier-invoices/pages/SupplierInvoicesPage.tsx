import { downloadEntityExport } from '../../../lib/fileDownloads'
import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { CollectionPagination } from '../../../components/ui/CollectionPagination'
import { downloadCSV } from '../../../lib/csv'
import { PurchasingNotice, PurchasingState } from '../../purchases/components/PurchasingShared'
import { useSupplierInvoices } from '../hooks/useSupplierInvoices'
import { filterSupplierInvoices, payableBalance, supplierInvoiceDefaultFilters } from '../supplierInvoices.utils'
import { SupplierInvoiceKPIGrid } from '../components/SupplierInvoiceKPIGrid'
import { PayableAging } from '../components/PayableAging'
import { SupplierInvoiceFilters } from '../components/SupplierInvoiceFilters'
import { SupplierInvoiceTable } from '../components/SupplierInvoiceTable'
import { SupplierInvoiceForm } from '../components/SupplierInvoiceForm'
import type { SupplierInvoiceFilters as Filters, SupplierInvoiceInput } from '../types/supplierInvoices.types'
import '../../purchases/purchasing.css'
export function SupplierInvoicesPage() {
  const [params] = useSearchParams(), navigate = useNavigate()
  const [filters, setFilters] = useState<Filters>({ ...supplierInvoiceDefaultFilters, supplier: params.get('supplier') ?? '', order: params.get('order') ?? '' })
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25), [sort, setSort] = useState('due')
  const [expanded, setExpanded] = useState(false), [selected, setSelected] = useState<number[]>([])
  const [create, setCreate] = useState(params.get('create') === '1'), [plan, setPlan] = useState(false)
  const [error, setError] = useState<string | null>(null), lock = useRef(false)
  const q = useSupplierInvoices(), data = q.data
  const filtered = useMemo(() => data ? filterSupplierInvoices(data.invoices, filters, data.asOf).sort((a, b) => sort === 'amount' ? b.total - a.total : sort === 'date' ? b.invoiceDate.localeCompare(a.invoiceDate) : a.dueDate.localeCompare(b.dueDate)) : [], [data, filters, sort])
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  function apply(f: Filters) { setFilters(f); setPage(1); setSelected([]) }
  async function save(input: SupplierInvoiceInput) {
    if (lock.current || !data?.permissions.includes('supplier_invoices.create')) return
    lock.current = true; setError(null)
    try { const result = await q.create.mutateAsync(input); setCreate(false); toast.success(q.isDemo ? 'Brouillon fournisseur simulé en mémoire.' : 'Facture créée par le serveur.'); navigate(`/supplier-invoices/${result.id}`) }
    catch { setError('Impossible d’enregistrer la facture. Votre saisie est conservée.') } finally { lock.current = false }
  }
  function exportRows() { if (data?.canExport !== true) return; const rows = selected.length ? filtered.filter((i) => selected.includes(i.id)) : filtered; if (!q.isDemo) { void downloadEntityExport('supplier-invoices', rows.map((row) => row.id)); return } downloadCSV('factures-fournisseurs.csv', [['Référence', 'Fournisseur', 'Date', 'Échéance', 'TTC MAD', 'Payé MAD', 'Solde MAD', 'Comptabilité', 'Paiement', 'Source'], ...rows.map((i) => [i.reference, i.supplierName, i.invoiceDate, i.dueDate, i.total, i.paidAmount, payableBalance(i), i.workflowStatus, i.paymentStatus, q.isDemo ? 'Démonstration' : 'Serveur'])]) }
  if (q.isForbidden || !data) return <PurchasingState forbidden={q.isForbidden} loading={q.isPending} error="Impossible de charger les factures fournisseurs." onRetry={() => void q.refetch()} />
  return <main className="dashboard-page business-page purchasing-page"><header className="business-header"><div><small>Finance / Factures fournisseurs</small><h1>Factures fournisseurs</h1><p>Suivez les dettes, les échéances et les paiements liés à vos achats.</p></div><span className="business-note">{filtered.length} factures dans le périmètre</span></header>{q.isError && <Alert variant="error">L’actualisation a échoué. Dernières données affichées.</Alert>}{data.permissions.includes('finance.view') && <><SupplierInvoiceKPIGrid invoices={filtered} asOf={data.asOf} /><PayableAging invoices={filtered} asOf={data.asOf} selected={filters.aging} onSelect={(aging) => apply({ ...filters, aging })} /></>}<section className="business-card"><div className="business-toolbar">{data.permissions.includes('supplier_invoices.create') && <Button className="business-button" onClick={() => { setError(null); setCreate(true) }}><Plus size={13} />Créer facture fournisseur</Button>}{data.canExport === true && <Button variant="secondary" className="business-button" onClick={exportRows}><Download size={13} />Exporter</Button>}{data.permissions.includes('payments.create') && <Button variant="secondary" className="business-button" onClick={() => setPlan(true)}>Planifier paiement</Button>}<label className="business-search"><Search size={14} /><input aria-label="Rechercher une facture fournisseur" placeholder="Facture, fournisseur ou commande…" value={filters.search} onChange={(e) => apply({ ...filters, search: e.target.value })} /></label><Button variant="secondary" className="business-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Filtres</Button></div><SupplierInvoiceFilters filters={filters} invoices={data.invoices} expanded={expanded} onChange={apply} canPurchase={data.permissions.includes('purchases.view')} /><div className="business-results"><span>{filtered.length} résultat(s) · Indicateurs avant pagination</span><label>Trier<select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }}><option value="due">Échéance</option><option value="date">Date décroissante</option><option value="amount">Montant décroissant</option></select></label><Button variant="ghost" className="business-button" disabled={q.isFetching} onClick={() => void q.refetch()}>Actualiser</Button></div>{selected.length > 0 && <div className="business-selection"><strong>{selected.length} sélectionnée(s)</strong>{data.canExport === true && <button onClick={exportRows}>Exporter la sélection</button>}<button onClick={() => setSelected([])}>Effacer la sélection</button></div>}{rows.length ? <SupplierInvoiceTable invoices={rows} asOf={data.asOf} permissions={data.permissions} selected={selected} onSelect={setSelected} /> : <div className="business-state"><h2>{data.invoices.length ? 'Aucune facture ne correspond à vos critères.' : 'Aucune facture fournisseur pour le moment.'}</h2>{data.invoices.length > 0 && <Button variant="secondary" className="business-button" onClick={() => apply({ ...supplierInvoiceDefaultFilters })}>Réinitialiser les filtres</Button>}</div>}<CollectionPagination page={safePage} pageSize={pageSize} count={filtered.length} onPage={setPage} onPageSize={(v) => { setPageSize(v); setPage(1) }} /></section><PurchasingNotice demo={q.isDemo} asOf={data.asOf} />{create && data.permissions.includes('supplier_invoices.create') && <SupplierInvoiceForm suppliers={filters.supplier ? data.suppliers.filter((s) => s.id === Number(filters.supplier)) : data.suppliers} asOf={data.asOf} demo={q.isDemo} busy={q.create.isPending} error={error} onClose={() => setCreate(false)} onSubmit={(v) => void save(v)} />}{plan && data.permissions.includes('payments.create') && <Dialog title="Préparer un paiement fournisseur" className="business-dialog" onClose={() => setPlan(false)}><p>La planification attend un contrat backend. Aucun paiement n’a été planifié.</p><p>Ouvrez une facture comptabilisée pour enregistrer un décaissement immédiat, dans la limite de son solde.</p><footer><Button className="business-button" onClick={() => setPlan(false)}>Fermer</Button></footer></Dialog>}</main>
}
