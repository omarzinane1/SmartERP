import { BusinessEmailPanel } from '../../../components/business/BusinessEmailPanel'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { FileQuestion, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { useAuthStore } from '../../../store/auth.store'
import { useQuoteEditor } from '../hooks/useQuoteEditor'
import { emptyQuoteInput, quoteSchema, toQuoteInput } from '../schemas/quote.schema'
import { calculateQuoteTotals } from '../utils/quoteCalculations'
import { canSendQuote } from '../quotes.utils'
import { QuoteEditorHeader, type EditorAction } from '../components/QuoteEditorHeader'
import { QuoteGeneralInformation } from '../components/QuoteGeneralInformation'
import { WorkflowStatusBar } from '../components/WorkflowStatusBar'
import { LineItemsEditor } from '../components/LineItemsEditor'
import { TotalsPanel } from '../components/TotalsPanel'
import { QuoteTabs } from '../components/QuoteTabs'
import { PdfPreviewDrawer } from '../components/PdfPreviewDrawer'
import { QuoteSendDialog } from '../components/QuoteSendDialog'
import { QuoteConfirmDialog } from '../components/QuoteConfirmDialog'
import type { QuoteEditorData, QuoteInput } from '../types/quotes.types'
import '../quotes.css'
import '../quote-editor.css'

export function QuoteEditorPage() {
  const { id } = useParams()
  const editor = useQuoteEditor(id)
  const denied = editor.isForbidden || (!id && editor.data && !editor.data.permissions.includes('quotes.create'))
  if (editor.isNotFound || denied) return <main className="dashboard-page quote-editor-state">
    {denied ? <ShieldAlert /> : <FileQuestion />}<h1>{denied ? 'Accès non autorisé' : 'Devis introuvable'}</h1>
    <p>{denied ? 'Vous ne disposez pas des permissions nécessaires.' : 'Ce devis n’existe pas ou n’est plus disponible.'}</p><Link to="/quotes">Retour aux devis</Link>
  </main>
  if (editor.isPending) return <main className="dashboard-page quote-editor-state" aria-busy="true"><Spinner /><p role="status">Chargement du devis…</p></main>
  if (!editor.data) return <main className="dashboard-page quote-editor-state"><Alert variant="error">Impossible de charger le devis.</Alert>
    <Button disabled={editor.isFetching} onClick={() => void editor.refetch()}><RefreshCw className="size-4" />Réessayer</Button><Link to="/quotes">Retour aux devis</Link></main>
  return <QuoteEditorForm key={id ?? 'new'} editor={editor} data={editor.data} />
}

function QuoteEditorForm({ editor, data }: { editor: ReturnType<typeof useQuoteEditor>; data: QuoteEditorData }) {
  const { quote, permissions } = data
  const navigate = useNavigate()
  const company = useAuthStore((state) => state.company)
  const form = useForm<QuoteInput>({ resolver: zodResolver(quoteSchema), mode: 'onBlur',
    defaultValues: quote ? toQuoteInput(quote) : emptyQuoteInput(data.asOf, data.salesperson),
  })
  const values = useWatch({ control: form.control }) as QuoteInput
  const dirty = form.formState.isDirty
  const editable = quote ? quote.status === 'draft' && permissions.includes('quotes.edit') : permissions.includes('quotes.create')
  const totals = calculateQuoteTotals(values.lines)
  const [preview, setPreview] = useState(false)
  const [confirmation, setConfirmation] = useState<EditorAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chosenCustomer, setChosenCustomer] = useState<{ id: number; name: string; email: string } | null>(null)
  const customerName = chosenCustomer?.id === values.customerId ? chosenCustomer.name : quote?.customerId === values.customerId ? quote.customerName : ''
  const customerEmail = chosenCustomer?.id === values.customerId ? chosenCustomer.email : quote?.customerId === values.customerId ? quote.customerEmail : ''
  const actionLock = useRef(false)
  const allowNavigation = useRef(false)
  const lastQuote = useRef(quote)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !allowNavigation.current && (dirty || editor.busy) && currentLocation.pathname !== nextLocation.pathname)
  useBeforeUnload(useCallback((event) => {
    if ((dirty || editor.busy) && !allowNavigation.current) { event.preventDefault(); event.returnValue = '' }
  }, [dirty, editor.busy]))
  useEffect(() => {
    if (quote && quote !== lastQuote.current && !dirty && !editor.busy) {
      form.reset(toQuoteInput(quote))
      lastQuote.current = quote
    }
  }, [quote, dirty, editor.busy, form])

  function goToQuote(id: number) {
    allowNavigation.current = true
    if (blocker.state === 'blocked') blocker.reset()
    navigate(`/quotes/${id}`, { replace: !quote })
  }
  async function save(input: QuoteInput) {
    if (!editable || actionLock.current) return
    actionLock.current = true; setError(null)
    try {
      const saved = await editor.save.mutateAsync(input)
      form.reset(toQuoteInput(saved)); lastQuote.current = saved
      toast.success(editor.isDemo ? 'Devis enregistré dans la démonstration locale.' : 'Devis enregistré.')
      if (!quote) goToQuote(saved.id)
    } catch (failure) {
      const message = isAxiosError(failure) && failure.response?.status === 400
        ? 'Le serveur a refusé les données. Vérifiez les champs indiqués.' : 'Impossible d’enregistrer le devis. Vos modifications sont conservées.'
      setError(message)
      // Les messages techniques du serveur ne sont jamais exposés dans le formulaire.
      if (isAxiosError(failure) && failure.response?.status === 400) {
        const fields: Record<string, keyof QuoteInput> = { customer_id: 'customerId', expires_at: 'expiresAt', issue_date: 'issueDate', salesperson: 'salesperson', billing_address: 'billingAddress', lines: 'lines' }
        for (const [serverField, field] of Object.entries(fields)) {
          if (failure.response.data?.[serverField]) form.setError(field, { message: 'Vérifiez cette valeur avec les règles du serveur.' })
        }
      }
    } finally { actionLock.current = false }
  }
  function requestAction(action: EditorAction) {
    if (!quote || dirty || editor.busy || actionLock.current) return
    const allowed = action === 'send' ? permissions.includes('quotes.send') && canSendQuote(quote, data.asOf)
      : action === 'duplicate' ? permissions.includes('quotes.create')
      : action === 'accept' ? !editor.isDemo && permissions.includes('quotes.accept') && quote.canAccept && ['sent', 'viewed'].includes(quote.status) && canSendQuote(quote, data.asOf)
      : !editor.isDemo && permissions.includes('quotes.convert') && quote.status === 'accepted' && !quote.convertedTo && quote.conversionTargets.includes(action)
    if (!allowed) return
    setError(null)
    if (action === 'duplicate') void performAction(action)
    else setConfirmation(action)
  }
  async function performAction(action: EditorAction) {
    if (!quote || dirty || actionLock.current) return
    actionLock.current = true; setError(null)
    try {
      if (action === 'send') {
        await editor.send.mutateAsync()
        toast.success(editor.isDemo ? 'Envoi simulé. Aucun e-mail envoyé.' : 'Envoi du devis demandé. Consultez le suivi des e-mails.')
      } else if (action === 'accept') {
        await editor.accept.mutateAsync(); toast.success('Acceptation confirmée par le serveur.')
      } else if (action === 'duplicate') {
        const copy = await editor.duplicate.mutateAsync()
        toast.success(editor.isDemo ? 'Copie créée dans la démonstration.' : 'Devis dupliqué.'); goToQuote(copy.id)
      } else {
        const result = await editor.convert.mutateAsync(action)
        toast.success(`Conversion confirmée : ${result.reference}.`)
      }
      setConfirmation(null)
    } catch {
      setError('Impossible de terminer cette action. Le serveur n’a pas confirmé sa réussite. Veuillez réessayer.')
    } finally { actionLock.current = false }
  }

  return <main className="dashboard-page quotes-page quote-editor-page">
    <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(save)}>
      <QuoteEditorHeader quote={quote} values={values} customerName={customerName} total={totals.total} permissions={permissions}
        editable={editable} dirty={dirty} busy={editor.busy} saving={editor.save.isPending} isDemo={editor.isDemo} onPreview={() => setPreview(true)} onAction={requestAction} />
      <WorkflowStatusBar status={quote?.status ?? 'draft'} />
      {editor.isError && <Alert variant="error">Impossible d’actualiser le devis. <button type="button" onClick={() => void editor.refetch()} className="underline">Réessayer</button></Alert>}
      {error && !confirmation && <Alert variant="error">{error}</Alert>}
      {!!Object.keys(form.formState.errors).length && <p role="alert" className="quote-validation-summary">Veuillez corriger les champs indiqués avant d’enregistrer.</p>}
      {!editable && <p className="quote-readonly-note">Lecture seule : {quote?.status !== 'draft' ? 'seuls les brouillons peuvent être modifiés.' : 'vous ne disposez pas de la permission de modification.'}</p>}
      {quote?.convertedTo && <Alert>Conversion confirmée par le serveur : <Link className="underline" to={`/${quote.convertedTo.target === 'sales_order' ? 'sales' : 'invoices'}/${quote.convertedTo.id}`}>{quote.convertedTo.reference}</Link>.</Alert>}
      <QuoteGeneralInformation quote={quote} editable={editable} busy={editor.busy} onCustomerChange={setChosenCustomer} />
      <LineItemsEditor products={data.products} disabled={!editable || editor.busy} />
      <div className="quote-editor-bottom"><QuoteTabs activities={quote?.activities ?? []} disabled={!editable || editor.busy} isDemo={editor.isDemo} /><TotalsPanel totals={totals} /></div>
      <p className="quotes-page-note">{editor.isDemo ? 'Données et sauvegardes de démonstration, conservées jusqu’au rechargement.' : 'Données du serveur.'} Les totaux frontend constituent un aperçu ; Django valide les montants et les opérations commerciales.</p>
    </form></FormProvider>
    {preview && <PdfPreviewDrawer input={values} reference={quote?.reference ?? 'NOUVEAU BROUILLON'} companyName={company?.name ?? 'Votre société'}
      customerName={customerName} customerEmail={customerEmail} products={data.products} dirty={dirty || !quote} isDemo={editor.isDemo} onClose={() => setPreview(false)} />}
    {confirmation === 'send' && quote && <QuoteSendDialog quotes={[quote]} isDemo={editor.isDemo} sending={editor.busy} error={error}
      onClose={() => { setConfirmation(null); setError(null) }} onConfirm={() => void performAction('send')} />}
    {confirmation && confirmation !== 'send' && <QuoteConfirmDialog
      title={confirmation === 'accept' ? `Accepter ${quote?.reference} ?` : `Convertir ${quote?.reference} en ${confirmation === 'sales_order' ? 'commande' : 'facture'} ?`}
      description={confirmation === 'accept' ? 'Cette action demande au serveur de confirmer l’acceptation du devis. Elle ne crée aucun autre document.' : 'Cette action demande au serveur de créer le document commercial et de le lier à ce devis.'}
      confirmLabel="Confirmer" busy={editor.busy} error={error} onClose={() => { setConfirmation(null); setError(null) }} onConfirm={() => void performAction(confirmation)} />}
    {blocker.state === 'blocked' && <QuoteConfirmDialog title="Quitter le devis ?" description={editor.busy ? 'Une opération est en cours. Veuillez attendre sa fin.' : 'Vos modifications non enregistrées seront perdues.'}
      confirmLabel="Quitter sans enregistrer" busy={editor.busy} onClose={() => blocker.reset()} onConfirm={() => blocker.proceed()} />}
  {quote && !editor.isDemo && <BusinessEmailPanel entityType="quote" entityId={quote.id} revision={quote.status} canResend={permissions.includes('quotes.send') && ['sent', 'viewed'].includes(quote.status)} />}
</main>
}
