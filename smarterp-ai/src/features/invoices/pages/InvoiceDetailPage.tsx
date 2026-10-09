import { BusinessEmailPanel } from '../../../components/business/BusinessEmailPanel'
import { downloadAPIFile } from '../../../lib/fileDownloads'
import { EntityDocuments } from '../../documents/components/EntityDocuments'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { ArrowLeft, Check, CreditCard, Download, Eye, FileQuestion, ReceiptText, Save, Send, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Badge } from '../../../components/ui/Badge'
import { useAuthStore } from '../../../store/auth.store'
import { formatDate } from '../../../lib/format'
import { calculateTotals, formatMoney } from '../../../lib/money'
import { useInvoiceDetail } from '../hooks/useInvoiceDetail'
import { emptyInvoiceInput, invoiceSchema, toInvoiceInput } from '../schemas/invoice.schema'
import { daysOverdue, remainingAmount } from '../utils/invoiceCalculations'
import { workflowLabels, type InvoiceAction, type InvoiceInput, type InvoicePaymentInput } from '../types/invoices.types'
import { InvoiceStatusBadge, InvoiceWorkflowStatusBar } from '../components/InvoiceStatusBadge'
import { InvoiceForm } from '../components/InvoiceForm'
import { InvoiceLines } from '../components/InvoiceLines'
import { InvoiceTotals } from '../components/InvoiceTotals'
import { InvoicePaymentDialog, InvoicePaymentPanel } from '../components/InvoicePaymentPanel'
import { InvoiceActivityTimeline, InvoiceAIInsightPanel, InvoiceRelatedDocuments, InvoiceSmartButtonBar } from '../components/InvoiceRelatedPanels'
import { CreditNoteDialog } from '../components/CreditNoteDialog'
import { InvoicePreview } from '../components/InvoicePreview'
import '../invoices.css'

export function InvoiceDetailPage() {
  const { id } = useParams()
  const detail = useInvoiceDetail(id)
  const denied = detail.isForbidden || (!id && detail.data && !detail.data.permissions.includes('invoices.create'))
  if (detail.isNotFound || denied) return <main className="dashboard-page invoice-page invoice-state">{denied ? <ShieldAlert size={32} /> : <FileQuestion size={32} />}<h1>{denied ? 'Accès non autorisé' : 'Facture introuvable'}</h1><p>{denied ? 'Vous ne disposez pas des permissions nécessaires.' : 'Cette facture n’existe pas ou n’est plus disponible.'}</p><Link to="/invoices">Retour aux factures</Link></main>
  if (detail.isPending) return <main className="dashboard-page invoice-page" aria-busy="true"><p role="status">Chargement de la facture…</p><div aria-hidden="true" className="invoice-skeleton invoice-card mt-5 h-32" /><div aria-hidden="true" className="invoice-skeleton invoice-card mt-5 h-96" /></main>
  if (!detail.data) return <main className="dashboard-page invoice-page invoice-state"><Alert variant="error">Impossible de charger la facture.</Alert><Button disabled={detail.isFetching} onClick={() => void detail.refetch()}>Réessayer</Button><Link to="/invoices">Retour aux factures</Link></main>
  return <InvoiceRecord key={id ?? 'new'} detail={detail} data={detail.data} />
}

function InvoiceRecord({ detail, data }: { detail: ReturnType<typeof useInvoiceDetail>; data: NonNullable<ReturnType<typeof useInvoiceDetail>['data']> }) {
  const { invoice, permissions } = data
  const company = useAuthStore((state) => state.company)
  const navigate = useNavigate()
  const form = useForm<InvoiceInput>({ resolver: zodResolver(invoiceSchema), mode: 'onBlur', defaultValues: invoice ? toInvoiceInput(invoice) : emptyInvoiceInput(data.asOf, data.salesperson) })
  const values = useWatch({ control: form.control }) as InvoiceInput
  const dirty = form.formState.isDirty
  const editable = invoice ? invoice.workflowStatus === 'draft' && permissions.includes('invoices.edit') && invoice.capabilities.canEdit : permissions.includes('invoices.create')
  const totals = invoice && !dirty ? { ...invoice.totals, total: invoice.totalAmount } : calculateTotals(values.lines)
  const [preview, setPreview] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [action, setAction] = useState<InvoiceAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chosenCustomer, setChosenCustomer] = useState<{ id: number; name: string; email: string } | null>(null)
  const customerName = chosenCustomer?.id === values.customerId ? chosenCustomer.name : invoice?.customerId === values.customerId ? invoice.customerName : ''
  const customerEmail = chosenCustomer?.id === values.customerId ? chosenCustomer.email : invoice?.customerId === values.customerId ? invoice.customerEmail : ''
  const lock = useRef(false)
  const allowNavigation = useRef(false)
  const lastInvoice = useRef(invoice)
  const available = !!invoice && !dirty && !detail.busy
  const allowed = {
    post: !!invoice && invoice.workflowStatus === 'draft' && permissions.includes('invoices.post') && invoice.capabilities.canPost,
    send: !!invoice && invoice.workflowStatus === 'posted' && permissions.includes('invoices.send') && invoice.capabilities.canSend,
    payment: !!invoice && invoice.workflowStatus === 'posted' && permissions.includes('payments.create') && invoice.capabilities.canPay && remainingAmount(invoice) > 0,
    remind: !!invoice && invoice.workflowStatus === 'posted' && permissions.includes('invoices.remind') && invoice.capabilities.canRemind && remainingAmount(invoice) > 0,
  }
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !allowNavigation.current && (dirty || detail.busy) && currentLocation.pathname !== nextLocation.pathname)
  useBeforeUnload(useCallback((event) => { if ((dirty || detail.busy) && !allowNavigation.current) { event.preventDefault(); event.returnValue = '' } }, [dirty, detail.busy]))
  useEffect(() => { if (invoice && invoice !== lastInvoice.current && !dirty && !detail.busy) { form.reset(toInvoiceInput(invoice)); lastInvoice.current = invoice } }, [invoice, dirty, detail.busy, form])
  async function save(input: InvoiceInput) {
    if (!editable || lock.current) return
    lock.current = true; setError(null)
    try {
      const saved = await detail.save.mutateAsync(input)
      form.reset(toInvoiceInput(saved)); lastInvoice.current = saved
      toast.success(detail.isDemo ? 'Brouillon enregistré dans la démonstration locale.' : 'Facture enregistrée.')
      if (!invoice) { allowNavigation.current = true; navigate(`/invoices/${saved.id}`, { replace: true }) }
    } catch (failure) {
      setError(isAxiosError(failure) && failure.response?.status === 400 ? 'Le serveur a refusé les données. Vérifiez les champs indiqués.' : 'Impossible d’enregistrer la facture. Vos modifications sont conservées.')
      if (isAxiosError(failure) && failure.response?.status === 400) {
        const fields: Record<string, keyof InvoiceInput> = { customer_id: 'customerId', invoice_date: 'invoiceDate', due_date: 'dueDate', lines: 'lines', billing_address: 'billingAddress', salesperson: 'salesperson' }
        for (const [field, name] of Object.entries(fields)) if (failure.response.data?.[field]) form.setError(name, { message: 'Vérifiez cette valeur avec les règles du serveur.' })
      }
    } finally { lock.current = false }
  }
  async function requestAction(next: InvoiceAction) {
    if (!available || !allowed[next] || lock.current) return
    if (next === 'post' && !(await form.trigger())) return
    setError(null); setAction(next)
  }
  async function perform(next: InvoiceAction, payment?: InvoicePaymentInput) {
    if (!invoice || dirty || !allowed[next] || lock.current) return
    lock.current = true; setError(null)
    try {
      if (next === 'payment' && payment) await detail.payment.mutateAsync(payment)
      else if (next === 'post') await detail.post.mutateAsync()
      else if (next === 'send') await detail.send.mutateAsync()
      else if (next === 'remind') await detail.remind.mutateAsync()
      toast.success(detail.isDemo ? next === 'post' ? 'Validation simulée localement. Aucune comptabilisation réelle.' : next === 'payment' ? 'Paiement simulé en mémoire. Aucun règlement réel enregistré.' : 'Envoi simulé. Aucun e-mail envoyé.' : next === 'payment' ? 'Paiement confirmé par le serveur.' : next === 'post' ? 'Facture commerciale validée par le serveur.' : next === 'remind' ? 'Relance demandée. Consultez le suivi des e-mails.' : 'Envoi demandé. Consultez le suivi des e-mails.')
      setAction(null)
    } catch (failure) {
      const status = isAxiosError(failure) ? failure.response?.status : undefined
      setError(status === 403 ? 'Vous n’avez plus l’autorisation d’effectuer cette action.' : status === 400 || status === 409 ? 'Le serveur a refusé l’opération. Vérifiez le solde, les données et les règles de la facture.' : 'L’opération n’a pas été confirmée par le serveur. Réessayez.')
    } finally { lock.current = false }
  }
  return <main className="dashboard-page invoice-page invoice-detail-page"><FormProvider {...form}><form noValidate onSubmit={(event) => void form.handleSubmit(save)(event)}>
    <header className="invoice-record-header"><nav aria-label="Fil d’Ariane de la facture"><span>Finance</span><span>/</span><Link to="/invoices">Factures</Link><span>/</span><span>{invoice?.reference ?? 'Nouvelle facture'}</span></nav><div className="invoice-record-identity"><div><div className="invoice-title-row"><span className="invoice-record-icon"><ReceiptText size={22} /></span><h1>{invoice ? `Facture ${invoice.reference}` : 'Nouvelle facture'}</h1>{invoice && <Badge tone={invoice.workflowStatus === 'posted' ? 'info' : 'neutral'}>{workflowLabels[invoice.workflowStatus]}</Badge>}</div>
      <p className="invoice-customer-name">{values.customerId ? <Link to={`/customers/${values.customerId}`}>{customerName || 'Client sélectionné'}</Link> : 'Sélectionnez un client pour préparer la facture'}</p><p className="invoice-record-meta">{values.salesperson} · Échéance : {values.dueDate || 'à définir'}{invoice && daysOverdue(invoice, data.asOf) > 0 && <span className="invoice-late-text"> · {daysOverdue(invoice, data.asOf)} jours de retard</span>}</p>{invoice && <InvoiceStatusBadge invoice={invoice} asOf={data.asOf} />}</div><div className="invoice-record-amount"><span>Montant TTC</span><strong>{formatMoney(totals.total)}</strong><small>{invoice ? `Solde enregistré : ${formatMoney(remainingAmount(invoice))}` : 'Brouillon non enregistré'}</small></div></div>
      <div className="invoice-record-actions"><Link className="invoice-back" to="/invoices"><ArrowLeft size={13} />Retour aux factures</Link>{editable && <Button type="submit" className="invoice-button invoice-primary" disabled={detail.busy || (!!invoice && !dirty)}><Save size={13} />{detail.save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>}{allowed.post && <Button className="invoice-button invoice-primary" disabled={!available} onClick={() => void requestAction('post')}><Check size={13} />Valider</Button>}{allowed.send && <Button variant="secondary" className="invoice-button" disabled={!available} onClick={() => void requestAction('send')}><Send size={13} />Envoyer</Button>}{allowed.payment && <Button className="invoice-button invoice-primary" disabled={!available} onClick={() => void requestAction('payment')}><CreditCard size={13} />Enregistrer paiement</Button>}
        <Button variant="secondary" className="invoice-button" onClick={() => setPreview(true)}><Eye size={13} />Prévisualiser</Button><Button variant="secondary" className="invoice-button" disabled={!available || detail.isDemo} onClick={() => invoice && void downloadAPIFile(`/invoices/${invoice.id}/pdf/`, `${invoice.reference}.pdf`)} title="Télécharger la facture enregistrée"><Download size={13} />Télécharger PDF</Button>{allowed.remind && <Button variant="secondary" className="invoice-button" disabled={!available} onClick={() => void requestAction('remind')}>Relancer</Button>}{permissions.includes('invoices.credit_note') && <Button className="invoice-button" variant="ghost" disabled={!available || !invoice?.capabilities.canCredit || detail.isDemo} onClick={() => { setError(null); setCreditOpen(true) }}>Créer un avoir</Button>}
      </div><p className={`invoice-save-status ${dirty ? 'is-dirty' : ''}`} role="status">{dirty ? 'Modifications non enregistrées — enregistrez avant une action comptable.' : !editable ? 'Lecture seule — document comptabilisé, annulé ou modification non autorisée.' : invoice ? 'Toutes les modifications sont enregistrées.' : 'Nouveau brouillon.'}</p>
    </header>
    {detail.isDemo && <p className="invoice-demo-banner">Mode démonstration · Opérations simulées en mémoire, sans effet comptable réel · {formatDate(data.asOf)}</p>}
    <InvoiceWorkflowStatusBar invoice={invoice} />{invoice && <InvoiceSmartButtonBar invoice={invoice} />}
    {detail.isError && <Alert variant="error">Impossible d’actualiser la facture. <button type="button" onClick={() => void detail.refetch()}>Réessayer</button></Alert>}{error && !action && <Alert variant="error">{error}</Alert>}{!!Object.keys(form.formState.errors).length && <p role="alert" className="invoice-error">Corrigez les champs indiqués avant de poursuivre.</p>}
    <div className="invoice-record-grid"><div className="invoice-main-column"><InvoiceForm invoice={invoice} disabled={!editable || detail.busy} onCustomer={setChosenCustomer} /><InvoiceLines disabled={!editable || detail.busy || !!invoice?.salesOrderId} />
      <section className="invoice-card invoice-notes"><label htmlFor="invoice-notes">Notes destinées au client</label><textarea id="invoice-notes" rows={3} {...form.register('notes')} disabled={!editable || detail.busy} /><p className="invoice-field-error">{form.formState.errors.notes?.message}</p></section>
      {invoice && <><InvoicePaymentPanel invoice={invoice} canPay={allowed.payment} busy={!available} onPay={() => void requestAction('payment')} /><InvoiceActivityTimeline activities={invoice.activities} /></>}
    </div><aside className="invoice-side-column" aria-label="Synthèse de la facture"><InvoiceTotals totals={totals} paid={invoice?.paidAmount ?? 0} credit={invoice?.creditTotal ?? 0} balance={dirty ? undefined : invoice?.balanceDue} preview={dirty || !invoice} />{invoice && <><InvoiceAIInsightPanel allowed={permissions.includes('ai.use')} isDemo={detail.isDemo} pending={detail.insight.isPending} data={detail.insight.data} error={detail.insight.isError} onRequest={() => detail.insight.mutate()} />{detail.isDemo ? <InvoiceRelatedDocuments invoice={invoice} /> : <EntityDocuments entityType="invoice" entityId={invoice.id} permissions={permissions} />}</>}</aside></div>
  </form></FormProvider>
    {invoice && !detail.isDemo && <BusinessEmailPanel entityType="invoice" entityId={invoice.id} revision={invoice.emailDeliveries?.[0]?.id ?? 0} canResend={allowed.send} />}
    {creditOpen && invoice && <CreditNoteDialog invoice={invoice} asOf={data.asOf} busy={detail.busy} onClose={() => setCreditOpen(false)} onSubmit={async (input) => { await detail.credit.mutateAsync(input); setCreditOpen(false); toast.success('Avoir validé et solde actualisé.') }} />}
    {preview && <InvoicePreview input={values} reference={invoice?.reference ?? 'NOUVEAU BROUILLON'} customerName={customerName} customerEmail={customerEmail} companyName={company?.name ?? 'Votre société'} isDemo={detail.isDemo} dirty={dirty || !invoice} savedTotals={invoice?.totals} onClose={() => setPreview(false)} />}
    {action === 'payment' && invoice && <InvoicePaymentDialog invoice={invoice} busy={detail.busy} isDemo={detail.isDemo} error={error} onClose={() => { setAction(null); setError(null) }} onSubmit={(input) => void perform('payment', input)} />}
    {action && action !== 'payment' && invoice && <Dialog className="invoice-dialog" title={action === 'post' ? `Valider la facture ${invoice.reference} ?` : action === 'send' ? `Envoyer la facture ${invoice.reference} ?` : `Enregistrer une demande de relance pour ${invoice.customerName} ?`} busy={detail.busy} onClose={() => { setAction(null); setError(null) }}>
      {action === 'remind' && !detail.isDemo && <p>La relance sera préparée en arrière-plan. Son état sera visible dans le suivi des e-mails.</p>}<p>{action === 'post' ? 'Après validation, la facture commerciale sera figée. Cette action ne crée pas d’écriture dans un grand livre comptable.' : action === 'send' ? 'Confirmez l’envoi de la facture enregistrée au client.' : `${invoice.reference} · Échéance ${formatDate(invoice.dueDate)} · Solde ${formatMoney(remainingAmount(invoice))} · ${daysOverdue(invoice, data.asOf)} jours de retard.`}</p>{detail.isDemo && <p className="invoice-demo-note">{action === 'post' ? 'Validation simulée localement. Aucune comptabilisation réelle.' : 'Envoi simulé. Aucun e-mail envoyé.'}</p>}{error && <p role="alert" className="invoice-error">{error}</p>}<footer><Button variant="secondary" className="invoice-button" disabled={detail.busy} onClick={() => setAction(null)} autoFocus>Annuler</Button><Button className="invoice-button invoice-primary" disabled={detail.busy} onClick={() => void perform(action)}>{detail.busy ? action === 'post' ? 'Validation en cours…' : 'Envoi en cours…' : action === 'post' ? 'Valider la facture' : action === 'send' ? 'Envoyer la facture' : 'Confirmer la relance'}</Button></footer>
    </Dialog>}
    {blocker.state === 'blocked' && <Dialog className="invoice-dialog" title="Quitter la facture ?" busy={detail.busy} onClose={() => blocker.reset()}><p>{detail.busy ? 'Une opération est en cours. Veuillez attendre sa fin.' : 'Vos modifications non enregistrées seront perdues.'}</p><footer><Button variant="secondary" className="invoice-button" onClick={() => blocker.reset()}>Rester</Button><Button className="invoice-button" disabled={detail.busy} onClick={() => blocker.proceed()}>Quitter sans enregistrer</Button></footer></Dialog>}
  </main>
}
