import { downloadEntityExport } from '../../../lib/fileDownloads'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Download, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { CollectionPagination } from '../../../components/ui/CollectionPagination'
import { downloadCSV } from '../../../lib/csv'
import { formatDate } from '../../../lib/format'
import { useSuppliers } from '../hooks/useSuppliers'
import { supplierDefaultFilters } from '../suppliers.utils'
import { SupplierKPIGrid, SupplierScoreBadge } from '../components/SupplierKPIGrid'
import { SuppliersToolbar } from '../components/SuppliersToolbar'
import { SupplierFilters } from '../components/SupplierFilters'
import { SupplierTable } from '../components/SupplierTable'
import { SupplierKanban } from '../components/SupplierKanban'
import { SupplierDialog } from '../components/SupplierDialog'
import type { Supplier, SupplierFilters as Filters, SupplierGroup, SupplierInput } from '../types/suppliers.types'
import '../../../components/ui/business.css'

export function SuppliersPage() {
  const [filters, setFilters] = useState<Filters>({ ...supplierDefaultFilters })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState('name')
  const [group, setGroup] = useState<SupplierGroup>('')
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [expanded, setExpanded] = useState(false)
  const [selection, setSelection] = useState<Supplier[]>([])
  const [editor, setEditor] = useState<{ supplier: Supplier | null } | null>(null)
  const [archives, setArchives] = useState<Supplier[]>([])
  const [details, setDetails] = useState<Supplier | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const lock = useRef(false)
  const query = useSuppliers({ ...filters, page, pageSize, sort })
  const data = query.data
  const busy = query.save.isPending || archiving
  function apply(next: Filters) { setFilters(next); setPage(1); setSelection([]) }
  function toggle(supplier: Supplier) { setSelection((current) => current.some((row) => row.id === supplier.id) ? current.filter((row) => row.id !== supplier.id) : [...current, supplier]) }
  async function save(input: SupplierInput) {
    if (lock.current || !editor || !data?.permissions.includes(editor.supplier ? 'suppliers.edit' : 'suppliers.create')) return
    lock.current = true; setError(null)
    try {
      await query.save.mutateAsync({ id: editor.supplier?.id, input })
      setEditor(null); setPage(1); setSelection([])
      toast.success(query.isDemo ? 'Fournisseur enregistré dans la démonstration locale.' : 'Fournisseur enregistré par le serveur.')
    } catch { setError('Impossible d’enregistrer le fournisseur. Vos informations sont conservées ; vérifiez les champs et réessayez.') }
    finally { lock.current = false }
  }
  async function archive() {
    if (lock.current || !data?.permissions.includes('suppliers.edit')) return
    lock.current = true; setArchiving(true); setError(null)
    const remaining = [...archives]
    try {
      for (const supplier of archives) { if (!supplier.capabilities.canArchive) throw new Error('Archive non autorisée'); await query.archive.mutateAsync(supplier.id); remaining.shift() }
      setArchives([]); setSelection([]); setPage(1)
      toast.success(query.isDemo ? 'Archivage simulé localement. Historique conservé.' : 'Archivage confirmé par le serveur.')
    } catch { setArchives(remaining); setError(`Archivage non confirmé pour ${remaining.length} fournisseur(s). Réessayez uniquement ceux restant dans cette liste.`) }
    finally { lock.current = false; setArchiving(false) }
  }
  async function exportSuppliers(selectedOnly = false) {
    if (exporting || !data?.permissions.includes('suppliers.export')) return
    setExporting(true)
    try {
      const all = await query.exportRows()
      const rows = selectedOnly ? all.filter((row) => selection.some((selected) => selected.id === row.id)) : all
      if (!query.isDemo) { await downloadEntityExport('suppliers', rows.map((row) => row.id)); return }
      downloadCSV(`fournisseurs${query.isDemo ? '-demo' : ''}.csv`, [['Référence', 'Nom', 'Catégorie', 'Ville', 'Pays', 'Acheteur', 'Volume achats MAD', 'Solde MAD', 'Délai jours', 'Score', 'Provenance score', 'Risque', 'Statut', 'Source'], ...rows.map((row) => [row.reference, row.name, row.category, row.city, row.country, row.buyer, row.purchaseVolume ?? '', row.outstandingBalance ?? '', row.averageLeadTimeDays ?? '', row.score ?? '', row.scoreSource, row.risk ?? '', row.status, query.isDemo ? 'Démonstration' : 'Serveur'])])
    } catch { toast.error('Impossible d’exporter tous les fournisseurs autorisés.') }
    finally { setExporting(false) }
  }
  if (query.isForbidden) return <main className="dashboard-page business-page business-state"><ShieldAlert className="mx-auto" /><h1>Accès non autorisé</h1><p>La consultation nécessite suppliers.view.</p></main>
  const selectedIds = selection.map((row) => row.id)
  const canArchive = !!data?.permissions.includes('suppliers.edit') && selection.length > 0 && selection.every((row) => row.status !== 'archived' && row.capabilities.canArchive)
  const collection = data ? { suppliers: data.suppliers, permissions: data.permissions, group, selected: selectedIds, busy, onSelect: toggle, onEdit: (supplier: Supplier) => { setEditor({ supplier }); setError(null) }, onArchive: (supplier: Supplier) => { setArchives([supplier]); setError(null) }, onMore: setDetails } : null
  return <main className="dashboard-page business-page">
    <header className="business-header"><div><small>Achats / Gestion fournisseurs</small><h1>Fournisseurs</h1><p>Gérez votre base fournisseurs et suivez leur activité, leur risque et leur performance.</p></div>{data && <span className="business-note">{data.summary.active} actifs · {data.summary.atRisk ?? 'Risque non évalué'} à surveiller dans le périmètre</span>}</header>
    {query.isPending ? <><p role="status">Chargement des fournisseurs…</p><div className="business-kpis supplier-kpis">{[1, 2, 3, 4, 5].map((key) => <div key={key} className="business-card business-skeleton" />)}</div><div className="business-card business-skeleton min-h-80" /></> : !data || !collection ? <><Alert variant="error">Impossible de charger les fournisseurs.</Alert><Button className="business-button mt-4" disabled={query.isFetching} onClick={() => void query.refetch()}>Réessayer</Button></> : <>
      {query.isError && <Alert variant="error">L’actualisation a échoué. Les dernières données restent affichées.</Alert>}
      <SupplierKPIGrid summary={data.summary} />
      <section className="business-card" aria-label="Gestion des fournisseurs" aria-busy={query.isFetching}>
        <SuppliersToolbar permissions={data.permissions} search={filters.search} expanded={expanded} group={group} view={view} exporting={exporting} onSearch={(search) => apply({ ...filters, search })} onFilters={() => setExpanded(!expanded)} onGroup={setGroup} onView={setView} onCreate={() => { setEditor({ supplier: null }); setError(null) }} onExport={() => void exportSuppliers()} onMore={() => setMore(true)} onFavorite={(favorite) => apply({ ...supplierDefaultFilters, buyer: favorite === 'mine' ? data.currentBuyer : '', city: favorite === 'casablanca' ? 'Casablanca' : '', strategic: favorite === 'strategic', quick: ['risk', 'delay'].includes(favorite) ? favorite : '' })} />
        <SupplierFilters filters={filters} expanded={expanded} facets={data.facets} onChange={apply} />
        <div className="business-results"><span>{data.count} fournisseur(s) · {view === 'kanban' ? 'Kanban' : 'Liste'} sur la page courante · KPI sur tous les résultats</span><label>Trier<select aria-label="Trier les fournisseurs" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="name">Nom</option><option value="purchase_desc">Volume achats décroissant</option><option value="balance_desc">Solde décroissant</option><option value="score_desc">Score décroissant</option></select></label><Button variant="ghost" className="business-button" disabled={query.isFetching || busy} onClick={() => void query.refetch()}><RefreshCw size={12} />Actualiser</Button></div>
        {selection.length > 0 && <section className="business-selection" aria-label="Actions sur la sélection"><strong>{selection.length} fournisseur(s) sélectionné(s)</strong>{data.permissions.includes('suppliers.export') && <button disabled={exporting} onClick={() => void exportSuppliers(true)}><Download size={12} />Exporter la sélection</button>}{canArchive && <button disabled={busy} onClick={() => { setArchives(selection); setError(null) }}><Archive size={12} />Archiver la sélection</button>}<button aria-label="Effacer la sélection" onClick={() => setSelection([])}><X size={13} /></button></section>}
        {data.suppliers.length ? view === 'list' ? <SupplierTable {...collection} onSelectPage={() => setSelection((current) => data.suppliers.every((row) => current.some((selected) => selected.id === row.id)) ? current.filter((row) => !data.suppliers.some((item) => item.id === row.id)) : [...current, ...data.suppliers.filter((row) => !current.some((item) => item.id === row.id))])} /> : <SupplierKanban {...collection} /> : <div className="business-state"><h2>{data.totalCount ? 'Aucun fournisseur ne correspond à vos critères' : 'Aucun fournisseur pour le moment'}</h2>{data.totalCount ? <Button variant="secondary" className="business-button" onClick={() => apply({ ...supplierDefaultFilters })}>Réinitialiser les filtres</Button> : data.permissions.includes('suppliers.create') && <Button className="business-button" onClick={() => setEditor({ supplier: null })}>Créer un fournisseur</Button>}</div>}
        <CollectionPagination page={page} pageSize={pageSize} count={data.count} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1) }} />
      </section><p className="business-note">{query.isDemo ? 'Mode démonstration · Scores statiques, sans analyse IA · Modifications en mémoire' : 'Données du serveur · Provenance du score indiquée sur chaque fiche'} · Périmètre au {formatDate(data.asOf)}. Import CSV / Excel : service non connecté.</p>
      {editor && <SupplierDialog supplier={editor.supplier} buyer={data.currentBuyer} isDemo={query.isDemo} busy={busy} error={error} onClose={() => setEditor(null)} onSubmit={(input) => void save(input)} />}
    </>}
    {archives.length > 0 && <Dialog title={`Archiver ${archives.length} fournisseur(s) ?`} className="business-dialog" busy={busy} onClose={() => setArchives([])}><p>L’archivage conserve les achats, paiements et soldes historiques. Le serveur vérifiera l’éligibilité.</p><ul>{archives.map((supplier) => <li key={supplier.id}>{supplier.name} · {supplier.reference}</li>)}</ul>{query.isDemo && <p className="business-info">Archivage simulé dans la démonstration locale.</p>}{error && <p role="alert" className="business-error">{error}</p>}<footer><Button variant="secondary" className="business-button" disabled={busy} onClick={() => setArchives([])} autoFocus>Retour</Button><Button className="business-button" disabled={busy} onClick={() => void archive()}>{busy ? 'Archivage…' : 'Confirmer l’archivage'}</Button></footer></Dialog>}
    {details && <Dialog title={details.name} className="business-dialog" onClose={() => setDetails(null)}><p>{details.reference} · {details.category}</p><dl><div><dt>Contact</dt><dd>{details.contact || '—'}</dd></div><div><dt>E-mail</dt><dd>{details.email || '—'}</dd></div><div><dt>Téléphone</dt><dd>{details.phone || '—'}</dd></div><div><dt>Dernier achat</dt><dd>{details.lastPurchaseAt ? formatDate(details.lastPurchaseAt) : 'Aucun'}</dd></div></dl><p>Score fournisseur : <SupplierScoreBadge supplier={details} /></p><p>{details.scoreSource}. Le risque est un indicateur distinct.</p><Link to={`/suppliers/${details.id}`}>Ouvrir la fiche fournisseur</Link><footer><Button className="business-button" onClick={() => setDetails(null)} autoFocus>Fermer</Button></footer></Dialog>}
    {more && <Dialog title="Gestion des fournisseurs" className="business-dialog" onClose={() => setMore(false)}><p>Sélectionnez des fournisseurs pour exporter ou archiver selon vos droits. Les groupes et le Kanban montrent la page courante ; les indicateurs couvrent tous les résultats filtrés.</p><p>L’import CSV / Excel et la fiche complète seront disponibles après raccordement de leurs services.</p><footer><Button className="business-button" onClick={() => setMore(false)} autoFocus>Fermer</Button></footer></Dialog>}
  </main>
}
