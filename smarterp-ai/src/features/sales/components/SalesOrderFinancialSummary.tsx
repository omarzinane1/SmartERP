import { Calculator } from 'lucide-react'
import { formatMoney } from '../../../lib/money'
import { orderMargin, salesFinancials } from '../sales.utils'
import type { SalesOrderDetail } from '../types/sales.types'

export function SalesOrderFinancialSummary({ order }: { order: SalesOrderDetail }) {
  const financials = salesFinancials(order)
  const canSeeMargin = order.permissions.includes('sales.margin.view')
  const margin = canSeeMargin ? orderMargin(order) : null
  return <section className="sales-card sales-financial" aria-labelledby="sales-financial-title">
    <header className="sales-card-title"><Calculator size={16} aria-hidden="true" /><h2 id="sales-financial-title">Résumé financier</h2><span>MAD</span></header>
    <dl>{[['Sous-total brut', order.totals.gross], ['Remises', order.totals.discount], ['Total HT', order.totals.net], ['TVA', order.totals.tax]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatMoney(Number(value))}</dd></div>)}
      <div className="sales-total"><dt>Total TTC</dt><dd>{formatMoney(order.totalAmount)}</dd></div>
      <div><dt>Montant facturé</dt><dd>{formatMoney(financials.invoiced)}</dd></div><div><dt>Montant payé</dt><dd>{formatMoney(financials.paid)}</dd></div>
      <div className="sales-balance"><dt>Solde restant à payer</dt><dd>{formatMoney(financials.balance)}</dd></div>
      <div><dt>Reste à facturer</dt><dd>{formatMoney(financials.unbilled)}</dd></div>
      <div className="sales-margin-total"><dt>Marge brute HT</dt><dd>{!canSeeMargin ? 'Accès restreint' : margin === null ? 'Marge indisponible' : formatMoney(margin)}</dd></div>
    </dl><p>Le solde porte sur les factures émises, après déduction des paiements confirmés qui leur sont rattachés.</p>
  </section>
}
