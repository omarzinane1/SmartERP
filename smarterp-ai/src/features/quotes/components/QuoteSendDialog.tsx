import { useEffect, useRef } from 'react'
import { Mail, Send, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { formatDate } from '../../../lib/format'
import { formatQuoteMoney as formatCurrency } from '../utils/quoteCalculations'
import type { Quote } from '../types/quotes.types'

export function QuoteSendDialog({ quotes, isDemo, sending, error, onClose, onConfirm }: {
  quotes: Quote[]; isDemo: boolean; sending: boolean; error: string | null
  onClose: () => void; onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  return <dialog ref={ref} className="quotes-send-dialog" aria-labelledby="quote-send-title" aria-busy={sending}
    onCancel={(event) => { event.preventDefault(); if (!sending) onClose() }}>
    <header className="flex items-start gap-3">
      <span className="rounded bg-primary-soft p-2 text-primary-text"><Mail className="size-4" /></span>
      <div className="flex-1"><h2 id="quote-send-title" className="text-sm font-semibold text-navy-950">
        {quotes.length === 1 ? `Envoyer le devis ${quotes[0].reference} ?` : `Envoyer ${quotes.length} devis ?`}
      </h2><p className="mt-1 text-[11px] text-slate-500">Vérifiez les devis avant de confirmer.</p></div>
      <button type="button" disabled={sending} aria-label="Fermer la confirmation" onClick={onClose}><X className="size-4 text-slate-400" /></button>
    </header>
    <ul className="my-4 max-h-64 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
      {quotes.map((quote) => <li key={quote.id} className="border-b border-slate-200 py-2 text-[11px] first:pt-0 last:border-0 last:pb-0">
        <p className="font-semibold text-slate-700">{quote.reference} · {quote.customerName}</p>
        <p className="mt-1 break-all text-slate-500">Destinataire : {quote.customerEmail || 'À déterminer par le serveur'}</p>
        <p className="mt-1 flex justify-between gap-2 text-slate-500"><span>{formatCurrency(quote.totalAmount)}</span><span>Expiration : {formatDate(quote.expiresAt)}</span></p>
      </li>)}
    </ul>
    <p className="text-[11px] leading-relaxed text-slate-500">{isDemo
      ? 'Mode démonstration : seul le statut local sera mis à jour. Aucun e-mail ne sera envoyé.'
      : 'Le devis sera marqué comme envoyé. Cette action enregistre un envoi effectué séparément ; elle ne transmet pas d’e-mail.'}</p>
    {error && <p role="alert" className="mt-3 text-xs text-danger-text">{error}</p>}
    <footer className="mt-5 flex justify-end gap-2">
      <Button className="quotes-button" variant="secondary" disabled={sending} onClick={onClose}>Annuler</Button>
      <Button className="quotes-button quotes-primary" disabled={sending} onClick={onConfirm}>{sending ? <Spinner /> : <Send className="size-3.5" />}
        {sending ? 'Envoi en cours…' : isDemo ? 'Simuler l’envoi' : 'Marquer comme envoyé'}</Button>
    </footer>
  </dialog>
}
