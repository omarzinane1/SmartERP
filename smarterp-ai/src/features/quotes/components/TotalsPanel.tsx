import { Calculator } from 'lucide-react'
import { formatQuoteMoney, type QuoteTotals } from '../utils/quoteCalculations'

export function TotalsPanel({ totals }: { totals: QuoteTotals }) {
  return <section className="dashboard-card quote-totals" aria-label="Totaux du devis">
    <div className="quote-section-title"><Calculator className="size-4" /><h2>Récapitulatif</h2><span>MAD</span></div>
    <dl>
      <div><dt>Sous-total brut</dt><dd>{formatQuoteMoney(totals.gross)}</dd></div>
      <div><dt>Remises</dt><dd className="text-success-text">− {formatQuoteMoney(totals.discount)}</dd></div>
      <div className="quote-total-net"><dt>Total HT</dt><dd>{formatQuoteMoney(totals.net)}</dd></div>
      <div><dt>TVA</dt><dd>{formatQuoteMoney(totals.tax)}</dd></div>
      <div className="quote-total-ttc"><dt>Total TTC</dt><dd><output aria-label="Total TTC">{formatQuoteMoney(totals.total)}</output></dd></div>
    </dl><p>Montants arrondis au centime par ligne. Les montants définitifs seront validés à l’enregistrement.</p>
  </section>
}
