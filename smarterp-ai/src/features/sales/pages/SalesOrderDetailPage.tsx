import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, FileQuestion, Files, ReceiptText, RefreshCw, ShieldAlert, ShoppingBag, Truck, UserRound } from 'lucide-react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { formatDate } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { useSalesOrderDetail } from '../hooks/useSalesOrderDetail'
import { salesActions } from '../sales.utils'
import { orderStatusLabels, type SalesActionResult, type SalesDeliveryInput, type SalesInvoiceInput, type SalesOrderDetail } from '../types/sales.types'
import { SalesOrderWorkflow } from '../components/SalesOrderWorkflow'
import { SalesOrderSmartButtons } from '../components/SalesOrderSmartButtons'
import { SalesOrderLineItems } from '../components/SalesOrderLineItems'
import { SalesOrderFinancialSummary } from '../components/SalesOrderFinancialSummary'
import { SalesOrderDeliveryPanel } from '../components/SalesOrderDeliveryPanel'
import { SalesOrderInvoicePanel, SalesOrderPaymentPanel } from '../components/SalesOrderPaymentPanel'
import { SalesOrderActivityTimeline } from '../components/SalesOrderActivityTimeline'
import { SalesOrderAIInsight } from '../components/SalesOrderAIInsight'
import { SalesOrderActionDialog, type SalesDialogAction } from '../components/SalesOrderActionDialog'
import '../sales.css'

export function SalesOrderDetailPage() {
  const { id } = useParams()
  const detail = useSalesOrderDetail(id)
  if (detail.isNotFound || detail.isForbidden) return <main className="dashboard-page sales-state">{detail.isForbidden ? <ShieldAlert /> : <FileQuestion />}<h1>{detail.isForbidden ? 'Accès non autorisé' : 'Commande introuvable'}</h1><p>{detail.isForbidden ? 'Vous ne disposez pas des permissions nécessaires.' : 'Cette commande n’existe pas ou n’est plus disponible.'}</p><Link to="/sales">Retour aux commandes</Link></main>
  if (detail.isPending) return <main className="dashboard-page sales-state" aria-busy="true"><Spinner /><p role="status">Chargement de la commande…</p></main>
  if (!detail.data) return <main className="dashboard-page sales-state"><Alert variant="error">Impossible de charger la commande.</Alert><Button disabled={detail.isFetching} onClick={() => void detail.refetch()}><RefreshCw size={16} />Réessayer</Button><Link to="/sales">Retour aux commandes</Link></main>
  return <SalesOrderRecord key={id} order={detail.data} detail={detail} />
}

function SalesOrderRecord({ order, detail }: { order: SalesOrderDetail; detail: ReturnType<typeof useSalesOrderDetail> }) {
  const [action, setAction] = useState<SalesDialogAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  const allowed = salesActions(order)
  function openAction(next: SalesDialogAction) { if (allowed[next] && !detail.busy) { setError(null); setAction(next) } }
  async function perform(kind: SalesDialogAction, input?: SalesDeliveryInput | SalesInvoiceInput) {
    if (lock.current || !allowed[kind]) return
    lock.current = true; setError(null)
    try {
      let result: SalesActionResult
      if (kind === 'confirm') result = await detail.confirm.mutateAsync()
      else if (kind === 'delivery') result = await detail.delivery.mutateAsync(input as SalesDeliveryInput)
      else result = await detail.invoice.mutateAsync(input as SalesInvoiceInput)
      toast.success(result.simulated ? kind === 'confirm' ? 'Confirmation simulée localement. Aucun enregistrement serveur.' : 'Préparation vérifiée en démonstration. Aucun document créé.' : kind === 'confirm' ? 'Commande confirmée par le serveur.' : `${kind === 'delivery' ? 'Livraison' : 'Facture'} créée${result.reference ? ` : ${result.reference}` : ''}.`)
      setAction(null)
    } catch (failure) {
      const status = isAxiosError(failure) ? failure.response?.status : undefined
      setError(status === 403 ? 'Vous n’avez plus l’autorisation d’effectuer cette action.' : status === 400 || status === 409 ? 'Le serveur a refusé cette opération. Vérifiez les quantités, les stocks et les règles de la commande.' : 'L’opération n’a pas été confirmée par le serveur. Veuillez réessayer.')
    } finally { lock.current = false }
  }
  return <main className="dashboard-page sales-page">
    <header className="sales-record-header">
      <nav aria-label="Fil d’Ariane de la commande"><span>Ventes</span><span>/</span><Link to="/sales">Commandes clients</Link><span>/</span><span>{order.reference}</span></nav>
      <div className="sales-record-identity"><div><div className="sales-record-heading"><span className="sales-record-icon"><ShoppingBag size={21} /></span><h1>Commande {order.reference}</h1><span className={`sales-badge sales-badge-${order.orderStatus}`}>{orderStatusLabels[order.orderStatus] ?? order.orderStatus}</span></div>
        <Link className="sales-customer-link" to={`/customers/${order.customerId}`}>{order.customerName}</Link><p className="sales-record-meta">Créée le {formatDate(order.createdAt)} <span>·</span> {order.salesperson}</p></div>
        <div className="sales-record-amount"><span>Montant de la commande TTC</span><strong>{formatMoney(order.totalAmount)}</strong><small>{order.currency} · {order.lines.length} lignes</small></div>
      </div>
      <div className="sales-actions"><Link to="/sales" className="sales-back"><ArrowLeft size={13} />Retour</Link>
        {allowed.confirm && <Button className="sales-button sales-primary" disabled={detail.busy} onClick={() => openAction('confirm')}><Check size={14} />Confirmer</Button>}
        {allowed.delivery && <Button className="sales-button sales-primary" disabled={detail.busy} onClick={() => openAction('delivery')}><Truck size={14} />Créer une livraison</Button>}
        {allowed.invoice && <Button className="sales-button" variant="secondary" disabled={detail.busy} onClick={() => openAction('invoice')}><ReceiptText size={14} />Créer une facture</Button>}
        {allowed.cancel && <Button className="sales-button" variant="ghost" disabled={detail.isDemo || detail.busy} onClick={() => { if (window.confirm(`Annuler la commande ${order.reference} ?`)) detail.cancel.mutate(undefined, { onSuccess: () => toast.success('Commande annulée.'), onError: () => toast.error('Annulation refusée. Rechargez la commande.') }) }}>Annuler la commande</Button>}
      </div>
      {allowed.cancel && detail.isDemo && <p className="sales-action-note">Annulation disponible en mode serveur.</p>}
    </header>
    {detail.isDemo && <p className="sales-demo-banner">Mode démonstration · Données au {formatDate(order.asOf)} · Les préparations ne créent aucun document réel.</p>}
    {!order.permissions.includes('sales.edit') && <p className="sales-muted">Lecture seule pour les informations de commande. Les opérations liées dépendent de leurs autorisations propres.</p>}
    {detail.isError && <Alert variant="error">Impossible d’actualiser les données. <button className="underline" onClick={() => void detail.refetch()}>Réessayer</button></Alert>}
    <SalesOrderWorkflow status={order.orderStatus} /><SalesOrderSmartButtons order={order} />
    <div className="sales-record-layout"><div className="sales-main-column">
      <section className="sales-card" aria-labelledby="sales-customer-title"><header className="sales-card-title"><UserRound size={16} aria-hidden="true" /><h2 id="sales-customer-title">Informations client</h2><Link to={`/customers/${order.customerId}`}>Voir la fiche client →</Link></header>
        <div className="sales-customer-grid"><div><Link to={`/customers/${order.customerId}`} className="sales-customer-name">{order.customerName}</Link><p>{order.customer.reference} · {order.customer.contactName}</p><p>{order.customer.phone}</p><p className="sales-break">{order.customer.email}</p></div>
          <div><h3>Adresse de facturation</h3><p>{order.customer.billingAddress}</p><h3>Adresse de livraison</h3><p>{order.customer.deliveryAddress}</p></div>
          <dl><div><dt>Commercial</dt><dd>{order.salesperson}</dd></div><div><dt>Paiement</dt><dd>{order.paymentTerms || 'Non renseigné'}</dd></div><div><dt>Référence client</dt><dd>{order.customerReference || '—'}</dd></div><div><dt>Confirmation</dt><dd>{order.confirmedAt ? formatDate(order.confirmedAt.slice(0, 10)) : 'Non confirmée'}</dd></div><div><dt>Devis source</dt><dd>{order.quoteId ? <Link to={`/quotes/${order.quoteId}`}>{order.quoteReference ?? `Devis #${order.quoteId}`}</Link> : 'Aucun'}</dd></div></dl>
        </div>
      </section>
      <SalesOrderLineItems order={order} />
      <SalesOrderDeliveryPanel order={order} canCreate={allowed.delivery} busy={detail.busy} onCreate={() => openAction('delivery')} />
      <SalesOrderInvoicePanel order={order} canCreate={allowed.invoice} busy={detail.busy} onCreate={() => openAction('invoice')} />
      <SalesOrderPaymentPanel order={order} />
      <SalesOrderActivityTimeline activities={order.activities} />
    </div><aside className="sales-side-column" aria-label="Synthèse de la commande"><SalesOrderFinancialSummary order={order} />
      <SalesOrderAIInsight allowed={order.permissions.includes('ai.use')} isDemo={detail.isDemo} pending={detail.insight.isPending} data={detail.insight.data} error={detail.insight.isError} onRequest={() => detail.insight.mutate()} />
      <section id="sales-documents" tabIndex={-1} className="sales-card" aria-labelledby="sales-documents-title"><header className="sales-card-title"><Files size={16} /><h2 id="sales-documents-title">Documents</h2><span>{order.documents.length}</span></header>
        <ul className="sales-document-list">{order.documents.map((document) => <li key={document.id}><Files size={16} aria-hidden="true" /><div><strong>{document.name}</strong><small>{document.type}</small></div><span title="Téléchargement non connecté">À venir</span></li>)}</ul>
        <p className="sales-muted sales-panel-body">{order.documents.length ? 'Métadonnées disponibles. Le téléchargement des documents sera connecté au service documentaire.' : 'Aucun document associé.'}</p>
      </section>
    </aside></div>
    {action && <SalesOrderActionDialog action={action} order={order} busy={detail.busy} isDemo={detail.isDemo} error={error} onClose={() => { setAction(null); setError(null) }} onConfirm={() => void perform('confirm')} onDelivery={(input) => void perform('delivery', input)} onInvoice={(input) => void perform('invoice', input)} />}
  </main>
}
