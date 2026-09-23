import { Link } from 'react-router-dom'
import { ArrowUpRight, ShoppingBag } from 'lucide-react'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { formatDate } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { useSalesOrders } from '../hooks/useSalesOrders'
import { orderStatusLabels } from '../types/sales.types'
import '../sales.css'

// Entrée minimale du module : la liste complète n'existait pas dans le dépôt.
export function SalesOrdersPage() {
  const query = useSalesOrders()
  const denied = query.isForbidden || (!!query.data && !query.data.permissions.includes('sales.view'))
  return <main className="dashboard-page sales-page"><header className="sales-list-heading"><span className="sales-record-icon"><ShoppingBag size={22} /></span><div><h1>Commandes clients</h1><p>Consultez vos commandes et suivez leur exécution.</p></div>{query.data && !denied && <span>{query.data.orders.length} commandes</span>}</header>
    {query.isDemo && <p className="sales-demo-banner">Mode démonstration · Données locales pour explorer les fiches commandes.</p>}
    {denied ? <Alert variant="error">Accès non autorisé aux commandes clients.</Alert> : query.isPending ? <div className="sales-state" role="status"><Spinner />Chargement des commandes…</div> : query.isError ? <Alert variant="error">Impossible de charger les commandes. <Button variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>Réessayer</Button></Alert> : query.data && <section className="sales-card"><div className="sales-table-scroll"><table className="sales-list-table"><caption className="sr-only">Liste des commandes clients</caption><thead><tr><th>Commande</th><th>Client</th><th>Date</th><th>Commercial</th><th>Montant TTC</th><th>Statut</th><th>Action</th></tr></thead><tbody>{query.data.orders.map((order) => <tr key={order.id}><td><Link to={`/sales/${order.id}`}>{order.reference}</Link></td><td>{order.customerName}</td><td>{formatDate(order.createdAt)}</td><td>{order.salesperson}</td><td>{formatMoney(order.totalAmount)}</td><td><span className={`sales-badge sales-badge-${order.orderStatus}`}>{orderStatusLabels[order.orderStatus] ?? order.orderStatus}</span></td><td><Link to={`/sales/${order.id}`} aria-label={`Ouvrir ${order.reference}`} className="sales-list-open">Ouvrir<ArrowUpRight size={12} /></Link></td></tr>)}</tbody></table></div>{!query.data.orders.length && <p className="sales-empty">Aucune commande disponible.</p>}</section>}
  </main>
}
