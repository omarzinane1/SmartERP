import { Copy, Download, ExternalLink, Send } from 'lucide-react'
import { canSendQuote } from '../quotes.utils'
import type { Quote, QuoteActionsProps } from '../types/quotes.types'

// Les mêmes règles d'action pour les lignes et les cartes.
export function QuoteActions({ quote, asOf, permissions, busy, onAction }: QuoteActionsProps & { quote: Quote; asOf: string }) {
  return <div className="quotes-row-actions" aria-label={`Actions ${quote.reference}`}>
    <button type="button" onClick={() => onAction('open', quote)} aria-label={`Ouvrir ${quote.reference}`} title="Ouvrir"><ExternalLink className="size-3" /><span>Ouvrir</span></button>
    {permissions.includes('quotes.send') && canSendQuote(quote, asOf) && <button type="button" disabled={busy}
      onClick={() => onAction('send', quote)} aria-label={`Envoyer ${quote.reference}`} title={quote.status === 'draft' ? 'Envoyer' : 'Renvoyer'}><Send className="size-3" /></button>}
    {permissions.includes('quotes.create') && <button type="button" disabled={busy} onClick={() => onAction('duplicate', quote)} aria-label={`Dupliquer ${quote.reference}`} title="Dupliquer"><Copy className="size-3" /></button>}
    {permissions.includes('quotes.export') && <button type="button" onClick={() => onAction('pdf', quote)} aria-label={`Exporter PDF ${quote.reference}`} title="Exporter PDF · à venir"><Download className="size-3" /></button>}
  </div>
}
