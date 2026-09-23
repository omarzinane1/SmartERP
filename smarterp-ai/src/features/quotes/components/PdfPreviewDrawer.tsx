import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { calculateLineTotals, calculateQuoteTotals, formatQuoteMoney } from '../utils/quoteCalculations'
import type { QuoteInput, QuoteProduct } from '../types/quotes.types'

export function PdfPreviewDrawer({ input, companyName, customerName, customerEmail, reference, products, isDemo, dirty, onClose }: {
  input: QuoteInput; companyName: string; customerName: string; customerEmail: string; reference: string
  products: QuoteProduct[]; isDemo: boolean; dirty: boolean; onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  const totals = calculateQuoteTotals(input.lines)
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : '—'
  return createPortal(<dialog ref={ref} className="quote-preview" aria-labelledby="quote-preview-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header className="quote-preview-controls"><div><h2 id="quote-preview-title">Prévisualisation du devis</h2><p>Aperçu HTML imprimable · aucun fichier PDF généré{dirty ? ' · Modifications non enregistrées' : ''}</p></div>
      <Button variant="secondary" className="quotes-button" onClick={() => window.print()}><Printer className="size-3.5" />Imprimer</Button>
      <button type="button" aria-label="Fermer l’aperçu" onClick={onClose}><X className="size-5" /></button>
    </header>
    <article className="quote-paper" aria-label="Document destiné au client">
      {isDemo && <p className="quote-paper-demo">DOCUMENT DE DÉMONSTRATION — SANS VALEUR COMMERCIALE</p>}
      {dirty && <p className="quote-paper-draft">APERÇU NON ENREGISTRÉ</p>}
      <header className="quote-paper-header"><div><BrandLogo className="text-navy-950" /><h3>{companyName}</h3><p>Proposition commerciale · {input.currency}</p></div>
        <div className="text-right"><h1>DEVIS</h1><strong>{reference}</strong><p>Date : {date(input.issueDate)}</p><p>Valable jusqu’au : {date(input.expiresAt)}</p></div></header>
      <section className="quote-paper-customer"><small>À L’ATTENTION DE</small><h2>{customerName || 'Client à sélectionner'}</h2><p>{input.billingAddress}</p><p>{customerEmail}</p>
        {input.customerReference && <p>Votre référence : {input.customerReference}</p>}</section>
      {input.subject && <h2 className="quote-paper-subject">{input.subject}</h2>}
      <table><thead><tr><th>Désignation</th><th>Qté</th><th>Prix HT</th><th>Remise</th><th>TVA</th><th>Total HT</th></tr></thead>
        <tbody>{input.lines.map((line) => <tr key={line.id}><td>{line.productId && <strong>{products.find((product) => product.id === line.productId)?.name ?? `Produit #${line.productId}`}</strong>}<p>{line.description || 'Description à compléter'}</p></td>
          <td>{Number.isFinite(line.quantity) ? line.quantity : '—'}</td><td>{formatQuoteMoney(line.unitPrice)}</td><td>{line.discountRate || 0} %</td><td>{line.taxRate || 0} %</td><td>{formatQuoteMoney(calculateLineTotals(line).net)}</td></tr>)}</tbody>
      </table>
      <dl className="quote-paper-totals"><div><dt>Sous-total brut</dt><dd>{formatQuoteMoney(totals.gross)}</dd></div><div><dt>Remises</dt><dd>− {formatQuoteMoney(totals.discount)}</dd></div>
        <div><dt>Total HT</dt><dd>{formatQuoteMoney(totals.net)}</dd></div><div><dt>TVA</dt><dd>{formatQuoteMoney(totals.tax)}</dd></div><div><dt>Total TTC</dt><dd>{formatQuoteMoney(totals.total)}</dd></div></dl>
      <section className="quote-paper-conditions"><h3>Conditions de l’offre</h3>
        {input.paymentTerms && <p><strong>Paiement :</strong> {input.paymentTerms}</p>}{input.deliveryTerms && <p><strong>Livraison :</strong> {input.deliveryTerms}</p>}
        <p>{input.commercialTerms}</p>{input.customerNotes && <p className="mt-4">{input.customerNotes}</p>}
      </section><footer>{companyName} · {reference} · Document valable jusqu’au {date(input.expiresAt)}</footer>
    </article>
  </dialog>, document.body)
}
