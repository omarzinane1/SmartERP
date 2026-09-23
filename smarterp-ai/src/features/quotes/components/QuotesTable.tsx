import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react'
import { Checkbox } from '../../../components/ui/Checkbox'
import { formatDate } from '../../../lib/format'
import { formatQuoteMoney as formatCurrency } from '../utils/quoteCalculations'
import { daysUntilExpiration, isExpiringQuote, totalQuotes } from '../quotes.utils'
import { quoteStatusLabels, type Quote, type QuoteActionsProps, type QuoteGroup, type QuoteSort, type QuoteSortKey } from '../types/quotes.types'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import { QuoteActions } from './QuoteActions'

interface Props extends QuoteActionsProps {
  quotes: Quote[]; asOf: string; group: QuoteGroup; sort: QuoteSort; onSort: (key: QuoteSortKey) => void
  selectedIds: number[]; onSelect: (id: number) => void; onSelectPage: () => void
}
const columns: { key: QuoteSortKey; label: string }[] = [
  { key: 'reference', label: 'Référence' }, { key: 'customerName', label: 'Client' },
  { key: 'createdAt', label: 'Date' }, { key: 'expiresAt', label: 'Expiration' },
  { key: 'salesperson', label: 'Commercial' }, { key: 'totalAmount', label: 'Montant TTC' }, { key: 'status', label: 'Statut' },
]
function groupLabel(quote: Quote, group: QuoteGroup) {
  if (group === 'none') return ''
  if (group === 'status') return quoteStatusLabels[quote.status]
  if (group === 'month') return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${quote.createdAt.slice(0, 7)}-01T12:00:00`))
  return quote[group]
}
export function QuotesTable(props: Props) {
  const { quotes, group, selectedIds, onSelect, asOf, sort } = props
  const groups = new Map<string, Quote[]>()
  for (const quote of quotes) {
    const label = groupLabel(quote, group)
    groups.set(label, [...(groups.get(label) ?? []), quote])
  }
  const allSelected = quotes.length > 0 && quotes.every((quote) => selectedIds.includes(quote.id))
  const someSelected = quotes.some((quote) => selectedIds.includes(quote.id))
  return <div className="quotes-table-scroll" tabIndex={0} role="region" aria-label="Liste des devis">
    <table className="quotes-table">
      <thead><tr>
        <th><Checkbox aria-label="Sélectionner tous les devis de cette page" checked={allSelected}
          ref={(node) => { if (node) node.indeterminate = !allSelected && someSelected }} onChange={props.onSelectPage} /></th>
        {columns.map(({ key, label }) => <th key={key} aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
          <button type="button" onClick={() => props.onSort(key)}>{label}{sort.key !== key ? <ArrowUpDown /> : sort.direction === 'asc' ? <ArrowUp /> : <ArrowDown />}</button>
        </th>)}
        <th>Actions</th>
      </tr></thead>
      <tbody>{[...groups].map(([label, rows]) => <Fragment key={label}>
        {group !== 'none' && <tr className="quotes-group-row"><th colSpan={9} scope="rowgroup"><span className="inline-flex items-center gap-2"><ChevronDown className="size-3" />{label}<span className="font-normal">{rows.length} devis · {formatCurrency(totalQuotes(rows))} · cette page</span></span></th></tr>}
        {rows.map((quote) => <tr key={quote.id} data-selected={selectedIds.includes(quote.id)}>
          <td><Checkbox aria-label={`Sélectionner ${quote.reference}`} checked={selectedIds.includes(quote.id)} onChange={() => onSelect(quote.id)} /></td>
          <td><Link to={`/quotes/${quote.id}`} className="quotes-reference">{quote.reference}</Link></td>
          <td><Link to={`/quotes/${quote.id}`} className="font-semibold text-slate-700 hover:text-blue-600">{quote.customerName}</Link><span className="quotes-subtext">CUS-{String(quote.customerId).padStart(6, '0')}</span></td>
          <td className="quotes-date">{formatDate(quote.createdAt)}</td>
          <td className="quotes-date"><span className={isExpiringQuote(quote, asOf) ? 'text-amber-700' : ''}>{formatDate(quote.expiresAt)}</span>
            {isExpiringQuote(quote, asOf) && <span className="quotes-expiration">{daysUntilExpiration(quote, asOf) === 0 ? 'Expire aujourd’hui' : `Dans ${daysUntilExpiration(quote, asOf)} jours`}</span>}</td>
          <td><span className="quotes-salesperson"><span className="quotes-avatar">{quote.salesperson.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>{quote.salesperson}</span></td>
          <td className="quotes-amount">{formatCurrency(quote.totalAmount)}</td>
          <td><QuoteStatusBadge status={quote.status} /></td>
          <td><QuoteActions quote={quote} asOf={asOf} permissions={props.permissions} busy={props.busy} onAction={props.onAction} /></td>
        </tr>)}
      </Fragment>)}</tbody>
    </table>
  </div>
}
