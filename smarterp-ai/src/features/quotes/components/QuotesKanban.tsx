import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Checkbox } from '../../../components/ui/Checkbox'
import { formatDate } from '../../../lib/format'
import { formatQuoteMoney as formatCurrency } from '../utils/quoteCalculations'
import { totalQuotes } from '../quotes.utils'
import { quoteStatuses, quoteStatusLabels, type Quote, type QuoteActionsProps } from '../types/quotes.types'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import { QuoteActions } from './QuoteActions'

interface Props extends QuoteActionsProps {
  quotes: Quote[]; asOf: string; selectedIds: number[]; onSelect: (id: number) => void
}
export function QuotesKanban(props: Props) {
  return <div className="quotes-kanban-scroll" tabIndex={0} role="region" aria-label="Kanban des devis">
    <div className="quotes-kanban">
      {quoteStatuses.map((status) => {
        const quotes = props.quotes.filter((quote) => quote.status === status)
        return <section key={status} aria-label={quoteStatusLabels[status]} className={`quotes-kanban-column quotes-column-${status}`}>
          <header><div className="flex items-center justify-between"><QuoteStatusBadge status={status} /><span className="text-[11px] font-semibold text-slate-500">{quotes.length}</span></div>
            <p className="mt-2 text-[11px] font-semibold text-slate-600">{formatCurrency(totalQuotes(quotes))}</p>
          </header>
          {quotes.map((quote) => <article key={quote.id} className="quotes-kanban-card" data-selected={props.selectedIds.includes(quote.id)}>
            <Checkbox className="relative z-10 float-right" aria-label={`Sélectionner ${quote.reference}`} checked={props.selectedIds.includes(quote.id)} onChange={() => props.onSelect(quote.id)} />
            <Link className="quotes-card-link quotes-reference" to={`/quotes/${quote.id}`}>{quote.reference}</Link>
            <h3 className="mt-2 text-[12px] font-semibold text-slate-700">{quote.customerName}</h3>
            <p className="my-3 text-[15px] font-semibold text-navy-950">{formatCurrency(quote.totalAmount)}</p>
            <p className="text-[10px] text-slate-500">{quote.salesperson}</p>
            <p className="mb-3 mt-1.5 flex items-center gap-1 text-[10px] text-slate-400"><CalendarClock className="size-3" />Échéance · {formatDate(quote.expiresAt)}</p>
            <div className="relative z-10 border-t border-slate-100 pt-2"><QuoteActions quote={quote} asOf={props.asOf} permissions={props.permissions} busy={props.busy} onAction={props.onAction} /></div>
          </article>)}
          {!quotes.length && <p className="py-8 text-center text-[10px] text-slate-400">Aucun devis</p>}
        </section>
      })}
    </div>
  </div>
}
