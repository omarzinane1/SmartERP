import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/axios'
import { postIdempotent } from '../../lib/idempotentApi'
import { useBusinessScope, businessQueryOptions } from '../../hooks/useBusinessScope'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

type State = 'pending' | 'sending' | 'retrying' | 'sent' | 'failed' | 'skipped' | 'uncertain'
interface Delivery { id: number; type: string; status: State; recipient: string; createdAt: string; errorMessage: string | null; backend: string | null }
const labels: Record<State, string> = { pending: 'En attente', sending: 'Envoi en cours', retrying: 'Nouvelle tentative prévue', sent: 'Envoyé', failed: 'Échec', skipped: 'Non envoyé', uncertain: 'Résultat incertain' }
const active = (state: State) => ['pending', 'sending', 'retrying'].includes(state)

export function BusinessEmailPanel({ entityType, entityId, revision, canResend = false }: { entityType: 'invoice' | 'quote' | 'purchaseorder'; entityId: number; revision: string | number; canResend?: boolean }) {
  const { scope, key, invalidate } = useBusinessScope()
  const [confirm, setConfirm] = useState(false)
  const query = useQuery({ ...businessQueryOptions, queryKey: [...key('business-emails'), entityType, entityId, revision],
    queryFn: async ({ signal }) => (await apiClient.get<{ emails: Delivery[] }>('/business-emails/', { params: { entity_type: entityType, entity_id: entityId }, signal })).data,
    refetchInterval: (q) => !q.state.error && q.state.data?.emails.some((email) => active(email.status)) ? 3000 : false })
  const path = { invoice: 'invoices', quote: 'quotes', purchaseorder: 'purchase-orders' }[entityType]
  const resend = useMutation({ ...businessQueryOptions, mutationFn: () => postIdempotent(scope, `/${path}/${entityId}/send/`, { resend: true }), onSuccess: async () => { setConfirm(false); await invalidate(['business-emails']) } })
  const emails = query.data?.emails ?? []
  return <section className="business-card p-4" aria-label="Suivi des e-mails"><div className="flex items-center justify-between gap-3"><h2>E-mails</h2><Button variant="ghost" onClick={() => { void query.refetch() }} disabled={query.isFetching}>Actualiser</Button></div>
    {query.isPending && <p role="status">Chargement des envois…</p>}{query.isError && <p role="alert">Historique des e-mails indisponible.</p>}
    {!query.isPending && !query.isError && !emails.length && <p>Aucun e-mail demandé.</p>}
    {emails.slice(0, 5).map((email) => <div key={email.id} className="border-b border-slate-100 py-3 text-sm"><strong>{email.type === 'invoice_reminder' ? 'Relance' : 'Document'} · {email.status === 'sent' && email.backend?.includes('.console.') ? 'Accepté par la console locale' : labels[email.status]}</strong><p>{email.recipient || 'Destinataire indisponible'}</p>{email.errorMessage && <p className="text-red-700">{email.errorMessage}</p>}</div>)}
    {canResend && emails.some((email) => email.type !== 'invoice_reminder') && <Button variant="secondary" disabled={resend.isPending || emails.some((email) => active(email.status))} onClick={() => { resend.reset(); setConfirm(true) }}>Renvoyer le document</Button>}
    {confirm && <Dialog title="Renvoyer le document ?" busy={resend.isPending} onClose={() => setConfirm(false)}><p>Cette action demande un nouvel e-mail au destinataire actuel. Si un précédent envoi a un résultat incertain, vérifiez sa réception avant de confirmer.</p>{resend.isError && <p role="alert">Le renvoi a été refusé. Vérifiez l’adresse, les droits et l’état du document.</p>}<footer><Button variant="secondary" disabled={resend.isPending} onClick={() => setConfirm(false)}>Annuler</Button><Button disabled={resend.isPending} onClick={() => resend.mutate()}>Confirmer le renvoi</Button></footer></Dialog>}
  </section>
}
