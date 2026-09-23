import { Package } from 'lucide-react'
import { formatNumber } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { lineMargin, remainingQuantity } from '../sales.utils'
import type { SalesOrderDetail } from '../types/sales.types'

export function SalesOrderLineItems({ order }: { order: SalesOrderDetail }) {
  const showMargin = order.permissions.includes('sales.margin.view')
  return <section className="sales-card sales-lines" aria-labelledby="sales-lines-title">
    <header className="sales-card-title"><Package size={16} aria-hidden="true" /><h2 id="sales-lines-title">Produits & services</h2><span>{order.lines.length} lignes · MAD</span></header>
    <div className="sales-table-scroll" tabIndex={0} role="region" aria-label="Lignes de la commande, défilement horizontal">
      <table><caption className="sr-only">Quantités, prix et marges des lignes de commande</caption><thead><tr>
        <th>Produit / Service</th><th>Description</th><th>Commandée</th><th>Livrée</th><th>Restante</th><th>Prix unitaire</th><th>Remise</th><th>TVA</th><th>Total HT</th><th>Marge</th>
      </tr></thead><tbody>{order.lines.map((line) => {
        const remaining = remainingQuantity(line)
        const margin = showMargin ? lineMargin(line) : null
        return <tr key={line.id}><td><strong>{line.productName}</strong><small>{line.productReference}</small>
          <span className={`sales-delivery-indicator ${remaining === 0 ? 'is-complete' : line.deliveredQuantity > 0 ? 'is-partial' : ''}`}>{remaining === 0 ? 'Totalement livrée' : line.deliveredQuantity > 0 ? 'Partiellement livrée' : 'Non livrée'}</span>
        </td><td className="sales-line-description">{line.description}</td><td>{formatNumber(line.quantity, 3)}</td><td>{formatNumber(line.deliveredQuantity, 3)}</td><td className={remaining ? 'sales-remaining' : ''}>{formatNumber(remaining, 3)}</td>
          <td>{formatMoney(line.unitPrice)}</td><td>{formatNumber(line.discountRate, 2)} %</td><td>{formatNumber(line.taxRate, 2)} %</td><td><strong>{formatMoney(line.totalExcludingTax)}</strong></td>
          <td className="sales-margin">{!showMargin ? 'Accès restreint' : margin === null ? 'Marge indisponible' : formatMoney(margin)}</td>
        </tr>
      })}</tbody></table>
    </div>
    {!order.lines.length && <p className="sales-empty">Aucune ligne sur cette commande.</p>}
  </section>
}
