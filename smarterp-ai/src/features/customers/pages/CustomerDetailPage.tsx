import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, ChevronRight, Mail, Phone, RefreshCw, ShieldAlert, UserRoundX, X } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { formatDate } from '../../../lib/format'
import { useAuthStore } from '../../../store/auth.store'
import { useCustomerDetail } from '../hooks/useCustomerDetail'
import { updateCustomer } from '../api/customers.api'
import { CustomerRecordHeader } from '../components/CustomerRecordHeader'
import { CustomerSmartButtons } from '../components/CustomerSmartButtons'
import { CustomerKPIGrid } from '../components/CustomerKPIGrid'
import { CustomerTabs } from '../components/CustomerTabs'
import { CustomerOverview } from '../components/CustomerOverview'
import { CustomerSalesTable } from '../components/CustomerSalesTable'
import { CustomerInvoicesTable } from '../components/CustomerInvoicesTable'
import { CustomerPaymentsTable } from '../components/CustomerPaymentsTable'
import { CustomerDocuments } from '../components/CustomerDocuments'
import { CustomerNotes } from '../components/CustomerNotes'
import { CustomerActivityTimeline } from '../components/CustomerActivityTimeline'
import { CustomerAIInsight } from '../components/CustomerAIInsight'
import { CustomerDialog } from '../components/CustomerDialog'
import type { CustomerActivity, CustomerDetail, CustomerRecordAction, CustomerTab } from '../types/customers.types'
import '../customers.css'

export function CustomerDetailPage() {
  const { id } = useParams()
  const query = useCustomerDetail(id)
  if (query.isNotFound || query.isForbidden) return <main className="customer-detail-page"><div className="customer-detail-state">{query.isNotFound ? <UserRoundX size={32} /> : <ShieldAlert size={32} />}<h1>{query.isNotFound ? 'Client introuvable' : 'Accès non autorisé'}</h1><p>{query.isNotFound ? 'Ce client n’existe pas ou n’est plus disponible.' : 'Vous ne disposez pas des permissions nécessaires pour consulter cette fiche.'}</p><Link to="/customers"><ArrowLeft size={14} />Retour aux clients</Link></div></main>
  if (query.customer.isPending) return <main className="customer-detail-page" aria-busy="true" aria-label="Chargement de la fiche client"><p role="status" className="sr-only">Chargement de la fiche client…</p><div className="customer-detail-skeleton customer-skeleton-header" /><div className="customer-kpi-grid">{Array.from({ length: 6 }, (_, index) => <div key={index} className="customer-detail-skeleton customer-skeleton-kpi" />)}</div><div className="customer-detail-columns"><div><div className="customer-detail-skeleton customer-skeleton-tabs" /><div className="customer-detail-skeleton customer-skeleton-content" /></div><div className="customer-detail-skeleton customer-skeleton-ai" /></div></main>
  if (query.customer.isError || !query.customer.data) return <main className="customer-detail-page"><Link to="/customers" className="customer-detail-back"><ArrowLeft size={12} />Retour aux clients</Link><Alert>Impossible de charger la fiche client.</Alert><Button className="customer-detail-button mt-3" onClick={() => void query.customer.refetch()}><RefreshCw size={12} />Réessayer</Button></main>
  return <CustomerRecord key={query.customer.data.id} data={query.customer.data} query={query} />
}

function CustomerRecord({ data, query }: { data: CustomerDetail; query: ReturnType<typeof useCustomerDetail> }) {
  const [activeTab, setActiveTab] = useState<CustomerTab>('overview')
  const [quotes, setQuotes] = useState(false)
  const [patch, setPatch] = useState<Partial<CustomerDetail>>({})
  const [notes, setNotes] = useState(data.notes)
  const [localActivity, setLocalActivity] = useState<CustomerActivity[]>([])
  const [noteRequest, setNoteRequest] = useState(0)
  const [form, setForm] = useState<'edit' | 'tag' | null>(null)
  const [dialog, setDialog] = useState<{ title: string; content: string; contact?: boolean } | null>(null)
  const author = useAuthStore((state) => state.user?.name ?? 'Utilisateur')
  const customer = { ...data, ...patch }
  const { canSales, canInvoices, canPayments, canAI, isDemo } = query
  const summary = query.summary.data
  const activities = [...localActivity, ...(query.activity.data ?? [])]
  const canEdit = customer.permissions.includes('customers.edit')
  const openRecord = (title: string, content: string) => setDialog({ title, content })
  async function persist(update: Parameters<typeof updateCustomer>[1]) {
    await updateCustomer(customer.id, update)
    await Promise.all([query.customer.refetch(), query.summary.refetch(), query.activity.refetch()])
    setForm(null)
    toast.success('Fiche client enregistrée.')
  }
  function navigate(tab: CustomerTab, showQuotes = false) {
    setActiveTab(tab)
    if (tab === 'sales') setQuotes(showQuotes)
  }
  function action(value: CustomerRecordAction) {
    if (value === 'audit') { setActiveTab('activity'); return }
    if (value === 'note') { setActiveTab('notes'); setNoteRequest((count) => count + 1); return }
    if (value === 'edit' || value === 'tag') { if (canEdit) setForm(value); return }
    if (value === 'archive') {
      if (!canEdit) return
      if (!isDemo) { void persist({ status: customer.status === 'archived' ? customer.previousStatus ?? 'active' : 'archived' }).catch(() => toast.error('Modification refusée.')); return }
      setPatch({ ...patch, status: customer.status === 'archived' ? customer.previousStatus ?? 'active' : 'archived', previousStatus: customer.status === 'archived' ? undefined : customer.status })
      toast.success(customer.status === 'archived' ? 'Client désarchivé (démo).' : 'Client archivé (démo).')
      return
    }
    if (value === 'contact') { setDialog({ title: 'Contacter le client', content: 'Choisissez le contact à utiliser.', contact: true }); return }
    if ((value === 'quote' && !canSales) || (value === 'invoice' && !canInvoices) || (value === 'payment' && !canPayments)) return
    const titles = { quote: 'Créer un devis', invoice: 'Créer une facture', payment: 'Enregistrer un paiement' }
    openRecord(titles[value], `${customer.name} · ${customer.reference}\nCette action sera disponible avec le module ${value === 'quote' ? 'Ventes' : value === 'invoice' ? 'Facturation' : 'Paiements'}.`)
  }
  return <main className="customer-detail-page">
    <CustomerRecordHeader customer={customer} summary={summary} canSales={canSales} canInvoices={canInvoices} canPayments={canPayments} onAction={action} />
    <div className="customer-detail-period"><span><i />{isDemo ? 'Données de démonstration' : 'Fiche client'}{summary && ` · Instantané du ${formatDate(summary.asOf)}`}</span><span>{customer.reference} · {customer.currency}</span></div>
    <CustomerSmartButtons customer={customer} summary={summary} canSales={canSales} canInvoices={canInvoices} canPayments={canPayments} onNavigate={navigate} />
    <CustomerKPIGrid summary={summary} canSales={canSales} canInvoices={canInvoices} canPayments={canPayments} loading={query.summary.isPending} />
    {query.summary.isError && <div className="customer-detail-inline-error" role="alert">Les indicateurs sont indisponibles.<button onClick={() => void query.summary.refetch()}>Réessayer les indicateurs</button></div>}
    <div className="customer-detail-columns">
      <div className="customer-detail-main">
        <CustomerTabs activeTab={activeTab} onChange={setActiveTab} />
        <div id="customer-tabpanel" role="tabpanel" aria-labelledby={`customer-tab-${activeTab}`} tabIndex={0} className="customer-detail-tabpanel">
          {activeTab === 'overview' && <CustomerOverview customer={customer} summary={summary} canSales={canSales} canInvoices={canInvoices} canPayments={canPayments} onNavigate={navigate} onEdit={() => action('edit')} onOpen={openRecord} />}
          {activeTab === 'sales' && <CustomerSalesTable sales={customer.sales} allowed={canSales} quotes={quotes} onQuotesChange={setQuotes} onOpen={openRecord} />}
          {activeTab === 'invoices' && <CustomerInvoicesTable invoices={customer.invoices} allowed={canInvoices} onOpen={openRecord} />}
          {activeTab === 'payments' && <CustomerPaymentsTable payments={customer.payments} allowed={canPayments} />}
          {activeTab === 'documents' && <CustomerDocuments documents={customer.documents} permissions={customer.permissions} canAI={canAI} isDemo={isDemo} />}
          {activeTab === 'notes' && <CustomerNotes key={noteRequest} startAdding={noteRequest > 0} notes={notes} canEdit={canEdit} isDemo={isDemo} author={author} onChange={setNotes} onAdded={(note) => setLocalActivity((events) => [{ id: `activity-${note.id}`, type: 'note', title: 'Note ajoutée (démo)', description: note.content, user: author, createdAt: note.createdAt, record: customer.reference, permissions: [] }, ...events])} />}
          {activeTab === 'activity' && (query.activity.isPending ? <p role="status" className="customer-detail-empty">Chargement de l’activité…</p> : query.activity.isError ? <div className="customer-detail-inline-error" role="alert">L’activité est indisponible.<button onClick={() => void query.activity.refetch()}>Réessayer l’activité</button></div> : <CustomerActivityTimeline activities={activities} permissions={customer.permissions} />)}
        </div>
      </div>
      <aside className="customer-detail-sidebar" aria-label="Intelligence et suivi du client">
        <CustomerAIInsight insight={query.ai.data} summary={summary} allowed={canAI} loading={query.ai.isFetching} error={query.ai.isError} isDemo={isDemo} onRequest={() => { if (canAI) void query.ai.refetch() }} />
        <section className="customer-next-actions"><div className="customer-section-heading"><h2><CalendarClock size={13} />Prochaines actions</h2><Badge tone="info">À planifier</Badge></div>{customer.nextActions.map((next) => <button key={next.id} disabled={!customer.permissions.includes(next.permission)} onClick={() => navigate(next.tab, next.tab === 'sales')}>
          {customer.permissions.includes(next.permission) ? <><span><strong>{next.title}</strong><small>{formatDate(next.dueDate)}{summary && next.dueDate < summary.asOf ? ' · En retard' : ''} · {next.owner}</small></span><ChevronRight size={13} /></> : <span>Restricted</span>}
        </button>)}{!customer.nextActions.length && <p className="customer-detail-empty">Aucune action planifiée.</p>}</section>
        <div className="customer-recent-activity">{query.activity.isPending ? <p role="status" className="customer-detail-empty">Chargement de l’activité…</p> : query.activity.isError ? <div className="customer-detail-inline-error" role="alert">L’activité est indisponible.<button onClick={() => void query.activity.refetch()}>Réessayer l’activité</button></div> : <CustomerActivityTimeline activities={activities} permissions={customer.permissions} compact />}<button className="customer-detail-link customer-activity-all" onClick={() => setActiveTab('activity')}>Voir tout l’historique <ChevronRight size={11} /></button></div>
      </aside>
    </div>
    {form && <CustomerDialog action={form} customer={customer} selectedCount={1} salespeople={customer.salespeople} isDemo={isDemo} onClose={() => setForm(null)} onSave={(input) => { if (!isDemo) return persist(input); setPatch({ ...patch, ...input }); setForm(null); toast.success('Coordonnées mises à jour (démo).') }} onAssign={() => {}} onTag={(tag) => { const tags = Array.from(new Set([...customer.tags, tag])); if (!isDemo) return persist({ tags }); setPatch({ ...patch, tags }); setForm(null) }} />}
    {dialog && <CustomerRecordDialog title={dialog.title} onClose={() => setDialog(null)}><p className="customer-record-dialog-copy">{dialog.content}</p>{dialog.contact && <div className="customer-dialog-contacts">{[customer.primaryContact, { name: customer.name, role: 'Entreprise', phone: customer.phone, email: customer.email }].filter((contact) => contact !== null).map((contact) => <article key={contact.email}><h3>{contact.name}</h3><p>{contact.role}</p><a href={`tel:${contact.phone.replace(/\s/g, '')}`}><Phone size={12} />{contact.phone}</a><a href={`mailto:${contact.email}`}><Mail size={12} />{contact.email}</a></article>)}</div>}</CustomerRecordDialog>}
  </main>
}

function CustomerRecordDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  return <dialog ref={ref} className="customer-record-dialog" aria-labelledby="customer-record-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}><header><div><span>SALES / CRM</span><h2 id="customer-record-dialog-title">{title}</h2></div><button onClick={onClose} aria-label="Fermer la fenêtre"><X size={18} /></button></header>{children}<Button variant="secondary" className="customer-detail-button" onClick={onClose}>Fermer</Button></dialog>
}
