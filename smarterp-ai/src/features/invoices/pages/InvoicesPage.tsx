import { downloadEntityExport } from '../../../lib/fileDownloads'
import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { formatDate } from '../../../lib/format'
import { formatMoney, sumMoney } from '../../../lib/money'
import { useInvoices } from '../hooks/useInvoices'
import { calculateAging, defaultInvoiceFilters, exportInvoices, filterInvoices, remainingAmount } from '../utils/invoiceCalculations'
import { AgingSummary, InvoiceKPIGrid } from '../components/InvoiceKPIGrid'
import { InvoicesToolbar } from '../components/InvoicesToolbar'
import { AdvancedFilters } from '../components/AdvancedFilters'
import { InvoiceTable } from '../components/InvoiceTable'
import { InvoiceKanban } from '../components/InvoiceKanban'
import type { InvoiceFilters, InvoiceGroup, InvoiceSummary } from '../types/invoices.types'
import '../invoices.css'

export function InvoicesPage() {
  const query = useInvoices()
  const [filters, setFilters] = useState<InvoiceFilters>({ ...defaultInvoiceFilters })
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [expanded, setExpanded] = useState(false)
  const [group, setGroup] = useState<InvoiceGroup>('')
  const [sort, setSort] = useState('date_desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [targets, setTargets] = useState<InvoiceSummary[]>([])
  const [action, setAction] = useState<'send' | 'remind'>('send')
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  const busy = query.send.isPending || query.remind.isPending
  const data = query.data
  const filtered = useMemo(() => {
    const rows = data ? filterInvoices(data.invoices, filters, data.asOf) : []
    return rows.sort((a, b) => (sort === 'amount_desc' ? b.totalAmount - a.totalAmount : sort === 'balance_desc' ? remainingAmount(b) - remainingAmount(a) : sort === 'due_asc' ? a.dueDate.localeCompare(b.dueDate) : sort === 'reference_asc' ? a.reference.localeCompare(b.reference) : sort === 'date_asc' ? a.invoiceDate.localeCompare(b.invoiceDate) : b.invoiceDate.localeCompare(a.invoiceDate)) || b.id - a.id)
  }, [data, filters, sort])
  function applyFilters(next: InvoiceFilters) { setFilters(next); setPage(1); setSelectedIds([]) }
  function toggle(id: number) { setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) }
  async function runAction() {
    if (lock.current || !data) return
    lock.current = true; setError(null)
    const pending = [...targets]
    try {
      for (const invoice of targets) {
        if (action === 'send') await query.send.mutateAsync(invoice.id); else await query.remind.mutateAsync(invoice.id)
        pending.shift()
      }
      setTargets([]); setSelectedIds([])
      toast.success(query.isDemo ? 'Envoi simulé. Aucun e-mail envoyé.' : action === 'send' ? 'Envoi demandé. Consultez le suivi sur la facture.' : 'Relances demandées. Consultez le suivi sur les factures.')
    } catch { setTargets(pending); setError(`L’opération n’a pas été confirmée pour ${pending.length} facture(s). Une nouvelle tentative portera uniquement sur ces factures.`) }
    finally { lock.current = false }
  }
  if (query.isForbidden) return <main className="dashboard-page invoice-page invoice-state"><ShieldAlert size={32} /><h1>Accès non autorisé</h1><p>La consultation nécessite la permission invoices.view.</p></main>
  if (query.isPending) return <main className="dashboard-page invoice-page" aria-busy="true"><h1>Factures clients</h1><p role="status" className="invoice-muted">Chargement des factures…</p><div className="invoice-kpis">{[1, 2, 3, 4].map((key) => <div key={key} aria-hidden="true" className="invoice-card invoice-skeleton h-28" />)}</div><div aria-hidden="true" className="invoice-card invoice-skeleton mt-5 h-80" /></main>
  if (!data) return <main className="dashboard-page invoice-page"><h1>Factures clients</h1><Alert variant="error">Impossible de charger les factures.</Alert><Button onClick={() => void query.refetch()} disabled={query.isFetching}>Réessayer</Button></main>
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selected = filtered.filter((invoice) => selectedIds.includes(invoice.id))
  const canRemindSelection = data.permissions.includes('invoices.remind') && selected.length > 0 && selected.every((invoice) => invoice.capabilities.canRemind && invoice.workflowStatus === 'posted' && remainingAmount(invoice) > 0)
  const exportRows = (rows: InvoiceSummary[]) => query.isDemo ? exportInvoices(rows, data.asOf, true) : data.permissions.includes('reports.export') ? void downloadEntityExport('invoices', rows.map((row) => row.id)) : undefined
  const onSend = (invoice: InvoiceSummary) => { if (!data.permissions.includes('invoices.send') || !invoice.capabilities.canSend || invoice.workflowStatus !== 'posted' || busy) return; setTargets([invoice]); setAction('send'); setError(null) }
  const collectionProps = { invoices: view === 'list' ? pageRows : filtered, asOf: data.asOf, selected: selectedIds, permissions: data.permissions, busy, onSelect: toggle, onSend, onExport: exportRows }
  return <main className="dashboard-page invoice-page"><header className="invoice-page-header"><div><div className="invoice-title-row"><h1>Factures clients</h1><span className="invoice-module-label">Finance / Ventes</span></div><p>Centralisez vos créances clients et suivez les paiements, les soldes et les retards.</p></div><Button variant="secondary" className="invoice-button" disabled={query.isFetching || busy} onClick={() => void query.refetch()}><RefreshCw size={12} />Actualiser</Button></header>
    {query.isError && <Alert variant="error">L’actualisation a échoué. Les dernières données disponibles restent affichées.</Alert>}
    {data.permissions.includes('finance.view') ? <><InvoiceKPIGrid invoices={filtered} asOf={data.asOf} /><AgingSummary buckets={calculateAging(filtered, data.asOf)} selected={filters.aging} onSelect={(aging) => applyFilters({ ...filters, aging })} /></> : <p className="invoice-muted">Indicateurs financiers globaux réservés aux utilisateurs habilités.</p>}
    <section className="invoice-card invoice-list-card" aria-label="Gestion des factures"><InvoicesToolbar permissions={data.permissions} search={filters.search} expanded={expanded} group={group} view={view} onSearch={(search) => applyFilters({ ...filters, search })} onToggleFilters={() => setExpanded((current) => !current)} onGroup={setGroup} onView={setView} onExport={() => exportRows(filtered)} onFavorite={(favorite) => applyFilters({ ...defaultInvoiceFilters, ...(favorite === 'mine' ? { salesperson: data.currentSalesperson } : { quick: favorite }) })} />
      <AdvancedFilters invoices={data.invoices} filters={filters} expanded={expanded} onChange={applyFilters} />
      <div className="invoice-results-bar"><span>{filtered.length} facture(s){view === 'kanban' && ' · Tous les résultats filtrés'}{view === 'list' && group && ' · Regroupement sur la page courante'}</span><label>Trier<select aria-label="Trier les factures" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="date_desc">Date décroissante</option><option value="date_asc">Date croissante</option><option value="due_asc">Échéance croissante</option><option value="amount_desc">Montant décroissant</option><option value="balance_desc">Solde décroissant</option><option value="reference_asc">Référence</option></select></label></div>
      {!!selected.length && <section className="invoice-selection" aria-label="Actions sur la sélection"><span><strong>{selected.length} facture(s) sélectionnée(s)</strong><small>Solde sélectionné : {formatMoney(sumMoney(selected.map(remainingAmount)))} · Sélection conservée entre les vues</small></span><button onClick={() => exportRows(selected)}><Download size={12} />Exporter la sélection</button>{canRemindSelection && <button disabled={busy} onClick={() => { setAction('remind'); setTargets(selected); setError(null) }}>Relancer</button>}{!data.permissions.includes('invoices.remind') && <small>Relance indisponible sans permission dédiée.</small>}<button aria-label="Effacer la sélection" onClick={() => setSelectedIds([])}><X size={14} /></button></section>}
      {filtered.length ? view === 'list' ? <InvoiceTable {...collectionProps} group={group} onSelectPage={() => setSelectedIds((current) => pageRows.every((invoice) => current.includes(invoice.id)) ? current.filter((id) => !pageRows.some((invoice) => invoice.id === id)) : [...new Set([...current, ...pageRows.map((invoice) => invoice.id)])])} /> : <InvoiceKanban {...collectionProps} /> : <div className="invoice-empty" role="status"><h2>{data.invoices.length ? 'Aucune facture ne correspond à vos critères.' : 'Aucune facture pour le moment.'}</h2>{data.invoices.length > 0 && <Button variant="secondary" className="invoice-button" onClick={() => applyFilters({ ...defaultInvoiceFilters })}>Réinitialiser</Button>}</div>}
      <footer className="invoice-pagination"><span>{filtered.length} facture(s) · Montants en MAD</span>{view === 'list' && <><label>Par page<select aria-label="Factures par page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option>25</option><option>50</option><option>100</option></select></label><span>Page {currentPage} / {pageCount}</span><button aria-label="Page précédente" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /></button><button aria-label="Page suivante" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15} /></button></>}</footer>
    </section><p className="invoice-page-note">{query.isDemo ? 'Mode démonstration · Aucun e-mail réel envoyé · Modifications en mémoire jusqu’au rechargement' : 'Données du serveur'} · Référence du calcul de retard : {formatDate(data.asOf)}.</p>
    {targets.length > 0 && <Dialog title={action === 'send' ? `Envoyer la facture ${targets[0].reference} ?` : `Relancer ${targets.length} facture(s) ?`} className="invoice-dialog" busy={busy} onClose={() => { setTargets([]); setError(null) }}><p>{action === 'send' ? 'Confirmez l’envoi du document enregistré au client.' : 'Confirmez explicitement les relances des factures sélectionnées.'}</p><ul className="invoice-confirm-records">{targets.map((invoice) => <li key={invoice.id}><strong>{invoice.reference} · {invoice.customerName}</strong><span>Échéance {formatDate(invoice.dueDate)} · Solde {formatMoney(remainingAmount(invoice))}</span></li>)}</ul>{query.isDemo && <p className="invoice-demo-note">Simulation uniquement. Aucun e-mail envoyé.</p>}{error && <p role="alert" className="invoice-error">{error}</p>}<footer><Button variant="secondary" className="invoice-button" disabled={busy} onClick={() => setTargets([])} autoFocus>Annuler</Button><Button className="invoice-button invoice-primary" disabled={busy} onClick={() => void runAction()}>{busy ? 'Envoi en cours…' : query.isDemo ? 'Simuler l’envoi' : action === 'send' ? 'Envoyer la facture' : 'Confirmer les relances'}</Button></footer></Dialog>}
  </main>
}
