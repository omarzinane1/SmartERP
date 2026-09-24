import { CreditCard, Files, FileText, ReceiptText, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { SalesOrderDetail } from '../types/sales.types'

export function SalesOrderSmartButtons({ order }: { order: SalesOrderDetail }) {
  const items = [
    { label: 'Livraisons', count: order.deliveries.length, target: 'sales-deliveries', icon: Truck },
    { label: 'Factures', count: order.invoices.length, target: 'sales-invoices', icon: ReceiptText },
    { label: 'Paiements', count: order.payments.length, target: 'sales-payments', icon: CreditCard },
    { label: 'Documents', count: order.documents.length, target: 'sales-documents', icon: Files },
  ]
  return <nav className="sales-smart-buttons" aria-label="Documents liés à la commande">
    {items.map(({ label, count, target, icon: Icon }) => <Link key={target} to={`#${target}`} onClick={() => document.getElementById(target)?.focus()}><Icon size={17} aria-hidden="true" /><span>{label}</span><strong>{count}</strong></Link>)}
    {order.quoteId ? <Link to={`/quotes/${order.quoteId}`}><FileText size={17} aria-hidden="true" /><span>Devis source</span><strong>1</strong></Link>
      : <span className="sales-smart-disabled" title="Aucun devis source"><FileText size={17} aria-hidden="true" /><span>Devis source</span><strong>0</strong></span>}
  </nav>
}
