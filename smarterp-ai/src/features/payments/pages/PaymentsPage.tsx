import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { CollectionPagination } from '../../../components/ui/CollectionPagination'
import { downloadCSV } from '../../../lib/csv'
import { formatDate } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { usePayments } from '../hooks/usePayments'
import { paymentDefaultFilters } from '../payments.utils'
import { PaymentKPIGrid } from '../components/PaymentKPIGrid'
import { PaymentsToolbar } from '../components/PaymentsToolbar'
import { PaymentFilters } from '../components/PaymentFilters'
import { PaymentTable, PaymentStatusBadge } from '../components/PaymentTable'
import { RecordPaymentModal } from '../components/RecordPaymentModal'
import { paymentDirectionLabels, paymentMethodLabels, type Payment, type PaymentFilters as Filters, type PaymentGroup, type PaymentInput } from '../types/payments.types'
import '../../../components/ui/business.css'

export function PaymentsPage() {
  const [filters, setFilters] = useState<Filters>({ ...paymentDefaultFilters })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState('date_desc')
  const [group, setGroup] = useState<PaymentGroup>('')
  const [expanded, setExpanded] = useState(false)
  const [record, setRecord] = useState(false)
  const [cancel, setCancel] = useState<Payment | null>(null)
  const [opened, setOpened] = useState<Payment | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const lock = useRef(false)
  const query = usePayments({ ...filters, page, pageSize, sort })
  const data = query.data
  const busy = query.create.isPending || query.cancel.isPending
  function apply(next: Filters) { setFilters(next); setPage(1) }
  async function save(input: PaymentInput) {
    if (lock.current || !data?.permissions.includes('payments.create')) return
    lock.current = true; setError(null)
    try { await query.create.mutateAsync(input); setRecord(false); toast.success(query.isDemo ? 'Paiement simulé en mémoire. Aucun règlement réel.' : 'Paiement enregistré par le serveur.') }
    catch { setError('Le serveur a refusé le paiement ou n’a pas confirmé l’opération. Vérifiez le solde et réessayez.') }
    finally { lock.current = false }
  }
  async function cancelPayment() {
    if (lock.current || !cancel || !data?.permissions.includes('payments.cancel') || !cancel.canCancel) return
    lock.current = true; setError(null)
    try { await query.cancel.mutateAsync(cancel.id); setCancel(null); toast.success(query.isDemo ? 'Annulation simulée. Historique et soldes actualisés localement.' : 'Annulation confirmée par le serveur.') }
    catch { setError('Impossible d’annuler ce paiement. Aucun succès confirmé ; vérifiez son éligibilité puis réessayez.') }
    finally { lock.current = false }
  }
  async function exportPayments() {
    if (exporting || !data?.permissions.includes('payments.export')) return
    setExporting(true)
    try {
      const rows = await query.exportRows()
      downloadCSV(`paiements${query.isDemo ? '-demo' : ''}.csv`, [['Référence', 'Date', 'Direction', 'Tiers', 'Facture', 'Méthode', 'Montant MAD', 'Statut', 'Référence externe', 'Source'], ...rows.map((row) => [row.reference, row.date, row.direction, row.partnerName, row.invoiceReference ?? '', row.method, row.amount, row.status, row.referenceExternal, query.isDemo ? 'Démonstration' : 'Serveur'])])
    } catch { toast.error('Impossible d’exporter tous les résultats autorisés.') }
    finally { setExporting(false) }
  }
  if (query.isForbidden) return <main className="dashboard-page business-page business-state"><ShieldAlert className="mx-auto" /><h1>Accès non autorisé</h1><p>La consultation nécessite payments.view.</p></main>
  return <main className="dashboard-page business-page">
    <header className="business-header"><div><small>Finance / Transactions</small><h1>Paiements</h1><p>Suivez les encaissements clients et les décaissements fournisseurs reliés à vos factures.</p></div><select aria-label="Période des paiements" value={filters.period} onChange={(event) => apply({ ...filters, period: event.target.value })}><option value="month">Ce mois</option><option value="week">Cette semaine</option><option value="today">Aujourd’hui</option><option value="">Toutes les dates</option><option value="custom">Personnalisée</option></select></header>
    {query.isPending ? <><p role="status">Chargement des paiements…</p><div className="business-kpis">{[1, 2, 3, 4].map((key) => <div key={key} className="business-card business-skeleton" />)}</div><div className="business-card business-skeleton min-h-80" /></> : !data ? <><Alert variant="error">Impossible de charger les paiements.</Alert><Button className="business-button mt-4" disabled={query.isFetching} onClick={() => void query.refetch()}>Réessayer</Button></> : <>
      {query.isError && <Alert variant="error">L’actualisation a échoué. Les dernières données restent affichées.</Alert>}
      {query.summary.isError && query.summary.data && <Alert variant="error">Impossible d’actualiser les indicateurs. Les derniers montants disponibles restent affichés.</Alert>}
      {query.summary.data ? <PaymentKPIGrid summary={query.summary.data} /> : query.summary.isError ? <Alert variant="error">Impossible de charger les indicateurs. <button onClick={() => void query.summary.refetch()}>Réessayer les indicateurs</button></Alert> : <div className="business-kpis" aria-label="Chargement des indicateurs">{[1, 2, 3, 4].map((key) => <div className="business-card business-skeleton" key={key} />)}</div>}
      <section className="business-card" aria-label="Gestion des paiements">
        <PaymentsToolbar permissions={data.permissions} search={filters.search} expanded={expanded} group={group} exporting={exporting} onSearch={(search) => apply({ ...filters, search })} onFilters={() => setExpanded(!expanded)} onGroup={setGroup} onFavorite={(favorite) => apply({ ...paymentDefaultFilters, direction: ['incoming', 'outgoing'].includes(favorite) ? favorite : '', status: favorite === 'pending' ? 'pending' : '', method: favorite === 'bank_transfer' ? favorite : '' })} onCreate={() => { setError(null); setRecord(true) }} onExport={() => void exportPayments()} onMore={() => setMore(true)} />
        <PaymentFilters filters={filters} expanded={expanded || filters.period === 'custom'} partners={data.partners} onChange={apply} />
        <div className="business-results"><span>{data.count} paiement(s) · KPI sur tous les résultats filtrés{group && ' · Groupes sur la page courante'}</span><label>Trier<select aria-label="Trier les paiements" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="date_desc">Date décroissante</option><option value="date_asc">Date croissante</option><option value="amount_desc">Montant décroissant</option><option value="reference">Référence</option></select></label><Button variant="ghost" className="business-button" disabled={query.isFetching || busy} onClick={() => { void query.refetch(); void query.summary.refetch() }}><RefreshCw size={12} />Actualiser</Button></div>
        {data.payments.length ? <PaymentTable payments={data.payments} group={group} permissions={data.permissions} busy={busy} onOpen={setOpened} onCancel={(payment) => { setError(null); setCancel(payment) }} /> : <div className="business-state"><h2>{data.totalCount ? 'Aucun paiement ne correspond à vos critères.' : 'Aucun paiement enregistré.'}</h2>{data.totalCount > 0 && <Button variant="secondary" className="business-button" onClick={() => apply({ ...paymentDefaultFilters, period: '' })}>Réinitialiser les filtres</Button>}</div>}
        <CollectionPagination page={page} pageSize={pageSize} count={data.count} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1) }} />
      </section><p className="business-note">{query.isDemo ? 'Mode démonstration · Paiements simulés en mémoire, sans effet bancaire ou comptable réel' : 'Données du serveur'} · Périodes calculées au {formatDate(data.asOf)}.</p>
      {record && <RecordPaymentModal invoices={data.openInvoices} asOf={data.asOf} isDemo={query.isDemo} busy={busy} error={error} onClose={() => setRecord(false)} onSubmit={(input) => void save(input)} />}
    </>}
    {cancel && <Dialog title={`Annuler le paiement ${cancel.reference} ?`} className="business-dialog" busy={busy} onClose={() => setCancel(null)}><p>Cette action peut modifier le solde de la facture associée. Le paiement restera dans l’historique avec le statut Annulé.</p><p>{cancel.partnerName} · {formatMoney(cancel.amount)} · {cancel.invoiceReference}</p>{query.isDemo && <p className="business-info">Annulation simulée localement, sans opération bancaire.</p>}{error && <p role="alert" className="business-error">{error}</p>}<footer><Button variant="secondary" className="business-button" disabled={busy} onClick={() => setCancel(null)} autoFocus>Retour</Button><Button className="business-button" disabled={busy} onClick={() => void cancelPayment()}>{busy ? 'Annulation…' : 'Annuler le paiement'}</Button></footer></Dialog>}
    {opened && <Dialog title={opened.reference} className="business-dialog" onClose={() => setOpened(null)}><PaymentStatusBadge status={opened.status} /><dl className="mt-5"><div><dt>Type</dt><dd>{paymentDirectionLabels[opened.direction]}</dd></div><div><dt>Montant</dt><dd>{formatMoney(opened.amount)}</dd></div><div><dt>Tiers</dt><dd>{opened.partnerName}</dd></div><div><dt>Date</dt><dd>{formatDate(opened.date)}</dd></div><div><dt>Méthode</dt><dd>{paymentMethodLabels[opened.method]}</dd></div><div><dt>Référence externe</dt><dd>{opened.referenceExternal || '—'}</dd></div></dl><p>{opened.note || 'Aucune note.'}</p>{opened.invoiceId && opened.direction === 'incoming' ? <Link to={`/invoices/${opened.invoiceId}`}>Ouvrir {opened.invoiceReference}</Link> : <p>{opened.invoiceReference} · Fiche facture fournisseur à venir.</p>}<footer><Button className="business-button" onClick={() => setOpened(null)} autoFocus>Fermer</Button></footer></Dialog>}
    {more && <Dialog title="Lecture des paiements" className="business-dialog" onClose={() => setMore(false)}><p>Les KPI portent sur tous les résultats filtrés. Reçus et Envoyés comptent uniquement les paiements confirmés ; les annulations et échecs sont exclus.</p><p>Le délai moyen est la moyenne simple des jours entre émission de facture et encaissement confirmé, lorsque les deux dates sont disponibles et cohérentes.</p><footer><Button className="business-button" onClick={() => setMore(false)} autoFocus>Fermer</Button></footer></Dialog>}
  </main>
}
