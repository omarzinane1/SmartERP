import { downloadEntityExport, downloadAPIFile } from '../../../lib/fileDownloads'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Download, FileText, RefreshCw, Send, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { formatDate } from '../../../lib/format'
import { formatQuoteMoney as formatCurrency } from '../utils/quoteCalculations'
import { useQuotes } from '../hooks/useQuotes'
import { QuotesKPIGrid } from '../components/QuotesKPIGrid'
import { QuotesToolbar } from '../components/QuotesToolbar'
import { QuotesFilters } from '../components/QuotesFilters'
import { QuotesTable } from '../components/QuotesTable'
import { QuotesKanban } from '../components/QuotesKanban'
import { QuoteSendDialog } from '../components/QuoteSendDialog'
import { canSendQuote, exportQuotes, filterQuotes, sortQuotes, totalQuotes } from '../quotes.utils'
import { defaultQuoteFilters, type Quote, type QuoteAction, type QuoteFilters, type QuoteGroup, type QuoteSort, type QuoteSortKey, type QuoteView } from '../types/quotes.types'
import '../quotes.css'

export function QuotesPage() {
  const { data, isPending, isError, isForbidden, isFetching, refetch, isDemo, send, duplicate } = useQuotes()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<QuoteFilters>(defaultQuoteFilters)
  const [view, setView] = useState<QuoteView>('list')
  const [group, setGroup] = useState<QuoteGroup>('none')
  const [sort, setSort] = useState<QuoteSort>({ key: 'createdAt', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [sendTargets, setSendTargets] = useState<Quote[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const actionLock = useRef(false)

  useEffect(() => {
    function closeMenus(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      document.querySelectorAll<HTMLDetailsElement>('.quotes-page details[open]').forEach((menu) => {
        if (event instanceof KeyboardEvent || !menu.contains(event.target as Node)) menu.open = false
      })
    }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeMenus)
    return () => { document.removeEventListener('pointerdown', closeMenus); document.removeEventListener('keydown', closeMenus) }
  }, [])

  if (isForbidden || (data && !data.permissions.includes('quotes.view'))) return <main className="dashboard-page quotes-page">
    <div className="dashboard-card mx-auto mt-14 max-w-xl p-8 text-center"><ShieldAlert className="mx-auto size-9 text-warning-text" />
      <h1 className="mt-4 text-xl font-semibold">Accès non autorisé</h1><p className="mt-3 text-sm text-slate-500">Vous ne disposez pas des permissions nécessaires pour consulter les devis.</p></div>
  </main>
  if (isPending) return <main className="dashboard-page quotes-page" aria-busy="true"><h1 className="text-2xl font-semibold">Devis</h1>
    <p role="status" className="my-5 flex items-center gap-2 text-xs text-slate-500"><Spinner />Chargement des devis…</p>
    <div aria-hidden="true" className="dashboard-card p-4">{Array.from({ length: 7 }, (_, index) => <div key={index} className="my-4 h-10 animate-pulse rounded bg-slate-100" />)}</div>
  </main>
  if (!data) return <main className="dashboard-page quotes-page"><h1 className="mb-5 text-2xl font-semibold">Devis</h1>
    <Alert variant="error">Impossible de charger les devis.</Alert><Button className="quotes-button mt-4" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="size-3.5" />Réessayer</Button>
  </main>

  const can = { create: data.permissions.includes('quotes.create'), send: data.permissions.includes('quotes.send'), export: data.permissions.includes('quotes.export') }
  const filtered = sortQuotes(filterQuotes(data.quotes, filters, data.asOf), sort)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const pageQuotes = filtered.slice(start, start + pageSize)
  const selected = filtered.filter((quote) => selectedIds.includes(quote.id))
  const salespeople = [...new Set(data.quotes.map((quote) => quote.salesperson))].sort()
  const busy = working || send.isPending || duplicate.isPending
  const canSendSelection = can.send && selected.length > 0 && selected.every((quote) => canSendQuote(quote, data.asOf))

  function applyFilters(update: Partial<QuoteFilters>) {
    setFilters((current) => ({ ...current, ...update })); setPage(1); setSelectedIds([])
  }
  function toggleQuote(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }
  function selectPage() {
    const ids = pageQuotes.map((quote) => quote.id)
    setSelectedIds((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])])
  }
  function changeSort(key: QuoteSortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1)
  }
  function exportRows(quotes: Quote[]) {
    if (!can.export || !quotes.length) return
    if (!isDemo) { void downloadEntityExport('quotes', quotes.map((q) => q.id)); return }
    exportQuotes(quotes, isDemo); toast.success(`${quotes.length} devis exporté(s) en CSV.`)
  }
  function requestSend(quotes: Quote[]) {
    if (!can.send || busy || !quotes.length || !quotes.every((quote) => canSendQuote(quote, data!.asOf))) return
    setActionError(null); setSendTargets(quotes)
  }
  async function runAction(action: 'send' | 'duplicate', quotes: Quote[]) {
    if (actionLock.current || !quotes.length || (action === 'send' ? !can.send : !can.create)) return
    actionLock.current = true; setWorking(true); setActionError(null)
    let completed = 0
    try {
      // Séquentiel : en cas d'échec, les devis restants peuvent être réessayés sans renvoyer les précédents.
      for (const quote of quotes) {
        await (action === 'send' ? send.mutateAsync(quote.id) : duplicate.mutateAsync(quote.id))
        completed += 1
      }
      if (action === 'send') {
        setSendTargets([]); setSelectedIds([])
        toast.success(isDemo ? `${completed} envoi(s) simulé(s). Aucun e-mail envoyé.` : `${completed} devis envoyé(s).`)
      } else {
        applyFilters(defaultQuoteFilters); setSort({ key: 'createdAt', direction: 'desc' })
        toast.success(`${completed} devis dupliqué(s)${isDemo ? ' dans la démonstration' : ''}.`)
      }
    } catch {
      const message = `Impossible de ${action === 'send' ? 'terminer l’envoi' : 'terminer la duplication'}. ${completed ? `${completed} devis déjà traité(s). ` : ''}Veuillez réessayer.`
      setActionError(message); toast.error(message)
      if (action === 'send') setSendTargets(quotes.slice(completed))
      setSelectedIds(quotes.slice(completed).map((quote) => quote.id))
    } finally { actionLock.current = false; setWorking(false) }
  }
  function onAction(action: QuoteAction, quote: Quote) {
    if (action === 'open') navigate(`/quotes/${quote.id}`)
    if (action === 'send') requestSend([quote])
    if (action === 'duplicate') void runAction('duplicate', [quote])
    if (action === 'pdf') { if (isDemo) toast.info('PDF disponible en mode API.'); else void downloadAPIFile(`/quotes/${quote.id}/pdf/`, `${quote.reference}.pdf`) }
  }

  return <main className="dashboard-page quotes-page">
    <header className="quotes-page-header">
      <div><div className="flex items-center gap-2.5"><h1>Devis</h1><Badge tone="info">Sales / CRM</Badge></div>
        <p>Créez, suivez et gérez vos devis commerciaux, de l’envoi à l’acceptation.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="quotes-period"><CalendarDays className="size-3.5" /><select aria-label="Période" value={filters.period} onChange={(event) => applyFilters({ period: event.target.value as QuoteFilters['period'] })}>
          <option value="month">Ce mois · {new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(new Date(`${data.asOf}T12:00:00`))}</option><option value="previous_month">Mois précédent</option><option value="all">Toutes les périodes</option>
        </select></label>
        <select className="quotes-select" aria-label="Filtrer par commercial" value={filters.salesperson} onChange={(event) => applyFilters({ salesperson: event.target.value })}>
          <option value="all">Tous les commerciaux</option>{salespeople.map((name) => <option key={name}>{name}</option>)}
        </select>
      </div>
    </header>
    {isError && <div className="mb-4 flex flex-wrap items-center gap-2"><Alert variant="error">Impossible d’actualiser les devis. Les dernières données disponibles restent affichées.</Alert>
      <Button className="quotes-button" variant="secondary" disabled={isFetching} onClick={() => void refetch()}>Réessayer</Button></div>}
    <QuotesKPIGrid quotes={filtered} asOf={data.asOf} period={filters.period} />
    <section className="dashboard-card mt-4 min-w-0" aria-label="Gestion des devis">
      <QuotesToolbar search={filters.search} onSearch={(search) => applyFilters({ search })} view={view} onView={setView}
        canCreate={can.create} canExport={can.export} hasResults={filtered.length > 0} onCreate={() => navigate('/quotes/new')}
        onExport={() => exportRows(filtered)} refreshing={isFetching || busy} onRefresh={() => void refetch()} onReset={() => applyFilters(defaultQuoteFilters)} />
      <QuotesFilters filters={filters} group={group} view={view} quotes={data.quotes} currentSalesperson={data.currentSalesperson} onChange={applyFilters}
        onGroup={setGroup} onReset={() => applyFilters(defaultQuoteFilters)} count={filtered.length} />
      {selected.length > 0 && <section className="quotes-selection" aria-label="Actions sur la sélection">
        <div className="mr-auto"><p className="font-semibold">{selected.length} devis sélectionné(s) <span className="ml-3 font-normal opacity-80">Total : {formatCurrency(totalQuotes(selected))}</span></p>
          <p className="mt-1 text-[9px] opacity-60">{view === 'list' ? `${selected.filter((quote) => !pageQuotes.some((item) => item.id === quote.id)).length} hors de cette page · ` : ''}Sélection conservée entre les vues</p></div>
        {canSendSelection && <button type="button" disabled={busy} onClick={() => requestSend(selected)}><Send />Envoyer</button>}
        {can.create && <button type="button" disabled={busy} onClick={() => void runAction('duplicate', selected)}><Copy />Dupliquer</button>}
        {can.export && <button type="button" onClick={() => exportRows(selected)}><Download />Exporter CSV</button>}
        <button type="button" aria-label="Effacer la sélection" onClick={() => setSelectedIds([])}><X /></button>
      </section>}
      {actionError && !sendTargets.length && <div className="px-4 py-2"><Alert variant="error">{actionError}</Alert></div>}
      {busy && <p role="status" className="flex items-center gap-2 px-4 py-2 text-[11px] text-primary-text"><Spinner />{send.isPending ? 'Envoi en cours…' : 'Duplication en cours…'}</p>}
      {filtered.length === 0 ? <div role="status" className="px-4 py-16 text-center"><FileText className="mx-auto size-9 text-slate-300" />
        <h2 className="mt-4 text-sm font-semibold text-slate-600">{data.quotes.length === 0 ? 'Aucun devis pour le moment.' : 'Aucun devis ne correspond à vos critères.'}</h2>
        {data.quotes.length > 0 ? <Button className="quotes-button mt-4" variant="secondary" onClick={() => applyFilters({ ...defaultQuoteFilters, period: 'all' })}>Réinitialiser les filtres</Button>
          : can.create && <Button className="quotes-button mt-4" onClick={() => navigate('/quotes/new')}>Créer un devis</Button>}
      </div> : view === 'list' ? <QuotesTable quotes={pageQuotes} asOf={data.asOf} group={group} sort={sort} onSort={changeSort}
        selectedIds={selectedIds} onSelect={toggleQuote} onSelectPage={selectPage} permissions={data.permissions} busy={busy} onAction={onAction} />
        : <QuotesKanban quotes={filtered} asOf={data.asOf} selectedIds={selectedIds} onSelect={toggleQuote} permissions={data.permissions} busy={busy} onAction={onAction} />}
      <footer className="quotes-pagination">
        <p aria-live="polite">{view === 'list' ? `${filtered.length ? start + 1 : 0}–${Math.min(start + pageSize, filtered.length)} sur ${filtered.length} devis` : `${filtered.length} devis · Regroupés par statut`}</p>
        {view === 'list' && <div className="flex items-center gap-3">
          <select className="quotes-select" aria-label="Devis par page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
            {[25, 50, 100].map((size) => <option key={size} value={size}>{size} éléments</option>)}
          </select><span>Page {currentPage} / {pageCount}</span>
          <button type="button" aria-label="Page précédente" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-3.5" /></button>
          <button type="button" aria-label="Page suivante" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-3.5" /></button>
        </div>}
      </footer>
    </section>
    <p className="quotes-page-note">{isDemo ? 'Données de démonstration' : 'Données synchronisées'} · {formatDate(data.asOf)} · Montants TTC en MAD.
      {isDemo && ' Les modifications restent en mémoire jusqu’au rechargement.'}</p>
    {sendTargets.length > 0 && <QuoteSendDialog quotes={sendTargets} isDemo={isDemo} sending={busy} error={actionError}
      onClose={() => { setSendTargets([]); setActionError(null) }} onConfirm={() => void runAction('send', sendTargets)} />}
  </main>
}
