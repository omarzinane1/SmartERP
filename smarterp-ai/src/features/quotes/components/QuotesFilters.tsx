import { ChevronDown, Filter, Layers3, Star, X } from 'lucide-react'
import { quoteStatusLabels, quoteStatuses, defaultQuoteFilters, type Quote, type QuoteFilters, type QuoteGroup, type QuoteView } from '../types/quotes.types'

interface Props {
  filters: QuoteFilters; group: QuoteGroup; view: QuoteView; quotes: Quote[]; currentSalesperson: string
  onChange: (filters: Partial<QuoteFilters>) => void; onGroup: (group: QuoteGroup) => void
  onReset: () => void; count: number
}
export function QuotesFilters({ filters, group, view, quotes, currentSalesperson, onChange, onGroup, onReset, count }: Props) {
  const clients = [...new Map(quotes.map((quote) => [quote.customerId, quote.customerName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  const salespeople = [...new Set(quotes.map((quote) => quote.salesperson))].sort()
  const favorites: { label: string; filters: Partial<QuoteFilters> }[] = [
    { label: 'Mes devis', filters: { salesperson: currentSalesperson } },
    { label: 'Devis à relancer', filters: { followUp: true } },
    { label: 'Devis acceptés', filters: { status: 'accepted' } },
    { label: 'Devis expirant bientôt', filters: { expiring: true } },
  ]
  const chips: { label: string; reset: Partial<QuoteFilters> }[] = []
  if (filters.status !== 'all') chips.push({ label: `Statut : ${quoteStatusLabels[filters.status]}`, reset: { status: 'all' } })
  if (filters.customer !== 'all') chips.push({ label: `Client : ${clients.find(([id]) => String(id) === filters.customer)?.[1] ?? filters.customer}`, reset: { customer: 'all' } })
  if (filters.salesperson !== 'all') chips.push({ label: `Commercial : ${filters.salesperson}`, reset: { salesperson: 'all' } })
  if (filters.expiring) chips.push({ label: 'Expire sous 7 jours', reset: { expiring: false } })
  if (filters.followUp) chips.push({ label: 'À relancer', reset: { followUp: false } })
  if (filters.search) chips.push({ label: `Recherche : ${filters.search}`, reset: { search: '' } })
  return <div className="quotes-filters">
    <div className="flex flex-wrap items-center gap-2">
      <details className="quotes-menu">
        <summary className="quotes-menu-trigger"><Filter className="size-3" />Filtres<ChevronDown className="size-3" /></summary>
        <div className="quotes-menu-panel quotes-filter-panel">
          <label>Statut<select value={filters.status} onChange={(event) => onChange({ status: event.target.value as QuoteFilters['status'] })}>
            <option value="all">Tous les statuts</option>{quoteStatuses.map((status) => <option key={status} value={status}>{quoteStatusLabels[status]}</option>)}
          </select></label>
          <label>Client<select value={filters.customer} onChange={(event) => onChange({ customer: event.target.value })}>
            <option value="all">Tous les clients</option>{clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>Commercial<select value={filters.salesperson} onChange={(event) => onChange({ salesperson: event.target.value })}>
            <option value="all">Tous les commerciaux</option>{salespeople.map((name) => <option key={name}>{name}</option>)}
          </select></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={filters.expiring} onChange={(event) => onChange({ expiring: event.target.checked })} />Devis expirant bientôt</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={filters.followUp} onChange={(event) => onChange({ followUp: event.target.checked })} />À relancer</label>
        </div>
      </details>
      <label className="quotes-menu-trigger"><Layers3 className="size-3" /><span className="sr-only">Regrouper par</span>
        <select className="quotes-group-select" aria-label="Regrouper par" disabled={view === 'kanban'} title={view === 'kanban' ? 'Le Kanban est regroupé par statut' : 'Regroupement de la liste'}
          value={view === 'kanban' ? 'status' : group} onChange={(event) => onGroup(event.target.value as QuoteGroup)}>
          <option value="none">Regrouper par</option><option value="status">Statut</option><option value="customerName">Client</option>
          <option value="salesperson">Commercial</option><option value="month">Mois de création</option>
        </select>
      </label>
      <details className="quotes-menu">
        <summary className="quotes-menu-trigger text-warning-text"><Star className="size-3" />Favoris<ChevronDown className="size-3" /></summary>
        <div className="quotes-menu-panel">
          {favorites.map((favorite) => <button key={favorite.label} type="button" onClick={(event) => {
            onChange({ ...defaultQuoteFilters, period: filters.period, ...favorite.filters })
            event.currentTarget.closest('details')?.removeAttribute('open')
          }}><Star className="size-3 text-warning-text" />{favorite.label}</button>)}
        </div>
      </details>
      <div className="quotes-quick-filters" role="group" aria-label="Filtres rapides">
        <button type="button" aria-pressed={filters.salesperson === currentSalesperson} onClick={() => onChange({ salesperson: filters.salesperson === currentSalesperson ? 'all' : currentSalesperson })}>Mes devis</button>
        {(['draft', 'sent', 'accepted', 'expired'] as const).map((status) => <button key={status} type="button" aria-pressed={filters.status === status}
          onClick={() => onChange({ status: filters.status === status ? 'all' : status })}>{({ draft: 'Brouillons', sent: 'Envoyés', accepted: 'Acceptés', expired: 'Expirés' })[status]}</button>)}
        <button type="button" aria-pressed={filters.followUp} onClick={() => onChange({ followUp: !filters.followUp })}>À relancer</button>
      </div>
      <span className="ml-auto text-[10px] text-slate-400" aria-live="polite">{count} devis</span>
    </div>
    {chips.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
      <span className="mr-1 text-slate-400">Filtres actifs :</span>
      {chips.map((chip) => <button className="quotes-filter-chip" type="button" key={chip.label} onClick={() => onChange(chip.reset)} aria-label={`Retirer ${chip.label}`}>
        {chip.label}<X className="size-3 shrink-0" />
      </button>)}
      <button className="ml-1 text-slate-500 hover:text-primary-text" type="button" onClick={onReset}>Effacer tous les filtres</button>
    </div>}
  </div>
}
