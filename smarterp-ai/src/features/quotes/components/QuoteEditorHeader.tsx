import { downloadAPIFile } from '../../../lib/fileDownloads'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Copy, Download, Eye, MoreHorizontal, Save, Send, ShoppingCart, Receipt, LockKeyhole } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { Spinner } from '../../../components/ui/Spinner'
import { formatDate } from '../../../lib/format'
import { canSendQuote } from '../quotes.utils'
import { formatQuoteMoney } from '../utils/quoteCalculations'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import type { QuoteDetail, QuoteInput, QuotePermission } from '../types/quotes.types'

export type EditorAction = 'send' | 'accept' | 'sales_order' | 'invoice' | 'duplicate'
export function QuoteEditorHeader({ quote, values, customerName, total, permissions, editable, dirty, busy, saving, isDemo, onPreview, onAction }: {
  quote: QuoteDetail | null; values: QuoteInput; customerName: string; total: number; permissions: QuotePermission[]
  editable: boolean; dirty: boolean; busy: boolean; saving: boolean; isDemo: boolean
  onPreview: () => void; onAction: (action: EditorAction) => void
}) {
  const canSend = !!quote && canSendQuote(quote, quote.asOf)
  const available = !!quote && !dirty && !busy
  return <header className="quote-editor-header">
    <div className="flex flex-wrap justify-between gap-2"><nav aria-label="Fil d’Ariane du devis"><span>Ventes</span><span>/</span><Link to="/quotes">Devis</Link><span>/</span><span>{quote?.reference ?? 'Nouveau devis'}</span></nav>
      <Link className="quote-back-link" to="/quotes"><ArrowLeft className="size-3.5" />Retour aux devis</Link></div>
    <div className="quote-editor-identity"><div><div className="flex flex-wrap items-center gap-2.5"><span className="quote-document-icon"><Receipt className="size-5" /></span>
      <h1>{quote ? `Devis ${quote.reference}` : 'Nouveau devis'}</h1><QuoteStatusBadge status={quote?.status ?? 'draft'} />
      {isDemo && <Badge tone="info">Démonstration</Badge>}</div>
      <p className="quote-editor-customer">{customerName || 'Sélectionnez un client pour préparer votre offre'}</p>
      <p className="quote-editor-meta">{values.salesperson || 'Commercial à définir'}<span>·</span>{quote ? `Créé le ${formatDate(quote.createdAt)}` : 'Nouveau brouillon'}<span>·</span>Expiration : {values.expiresAt || 'à définir'}</p>
    </div><div className="quote-editor-amount"><span>Montant total TTC</span><strong>{formatQuoteMoney(total)}</strong><small>{dirty ? 'Aperçu des modifications' : 'Montant du devis'}</small></div></div>
    <div className="quote-editor-actions">
      {editable && <Button type="submit" className="quotes-button quotes-primary" disabled={busy || (!!quote && !dirty)}>{saving ? <Spinner /> : <Save className="size-3.5" />}{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>}
      {permissions.includes('quotes.send') && <Button variant="secondary" className="quotes-button" disabled={!available || !canSend}
        title={dirty || !quote ? 'Enregistrez le devis avant l’envoi' : !canSend ? 'Ce statut ou cette échéance ne permet pas l’envoi' : 'Confirmer l’envoi du devis enregistré'} onClick={() => onAction('send')}><Send className="size-3.5" />Envoyer</Button>}
      <Button variant="secondary" className="quotes-button" onClick={onPreview}><Eye className="size-3.5" />Prévisualiser</Button>
      {permissions.includes('quotes.export') && <Button variant="secondary" className="quotes-button" disabled={!available || isDemo} onClick={() => quote && void downloadAPIFile(`/quotes/${quote.id}/pdf/`, `${quote.reference}.pdf`)} title="Télécharger le devis enregistré"><Download className="size-3.5" />Télécharger PDF</Button>}
      <details className="quotes-menu"><summary className="quotes-menu-trigger"><MoreHorizontal className="size-3.5" />Plus</summary><div className="quotes-menu-panel">
        {permissions.includes('quotes.create') && <button type="button" disabled={!available} onClick={() => onAction('duplicate')}><Copy className="size-3.5" />Dupliquer le devis enregistré</button>}
        {permissions.includes('quotes.accept') && <button type="button" disabled={!available || isDemo || !quote?.canAccept || !['sent', 'viewed'].includes(quote.status) || !canSend}
          title={isDemo ? 'Acceptation disponible avec Django' : 'Autorisation et statut vérifiés par le serveur'} onClick={() => onAction('accept')}><Check className="size-3.5" />Accepter</button>}
        {permissions.includes('quotes.convert') && <>
          <button type="button" disabled={!available || isDemo || quote?.status !== 'accepted' || !!quote.convertedTo || !quote.conversionTargets.includes('sales_order')} onClick={() => onAction('sales_order')}><ShoppingCart className="size-3.5" />Convertir en commande</button>
          <button type="button" disabled={!available || isDemo || quote?.status !== 'accepted' || !!quote.convertedTo || !quote.conversionTargets.includes('invoice')} onClick={() => onAction('invoice')}><Receipt className="size-3.5" />Convertir en facture</button>
        </>}
        <p className="quote-menu-note">{isDemo ? 'Acceptation et conversion disponibles avec Django.' : 'Les conversions dépendent du workflow autorisé par le serveur.'}</p>
      </div></details>
      <span className={`quote-save-indicator ${dirty ? 'is-dirty' : ''}`} role="status">{dirty ? 'Modifications non enregistrées' : !editable ? <><LockKeyhole className="size-3" />Lecture seule</> : quote ? 'Toutes les modifications sont enregistrées' : 'Brouillon non enregistré'}</span>
    </div>
    <p className="quote-editor-notice">{dirty && 'Enregistrez vos modifications avant toute action commerciale. '}
      {isDemo ? 'Aperçu HTML imprimable de démonstration.' : 'Le PDF reprend les montants enregistrés du devis.'}{isDemo && ' Les sauvegardes restent locales ; aucun e-mail n’est envoyé.'}</p>
  </header>
}
