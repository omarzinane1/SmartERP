import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { KPIGrid, ValueChart } from '../../../components/ui/BusinessPresentation'
import { ActionConfirmation } from '../../purchases/components/PurchasingShared'
import { useApprovals } from '../../approvals/hooks/useApprovals'
import { approvalStatusLabels } from '../../approvals/types/approvals.types'
import { formatMoney } from '../../../lib/money'
import type { AIResponseBlock } from '../types/ai.types'

function ActionReview({ block }: { block: Extract<AIResponseBlock, { type: 'action' }> }) {
  const q = useApprovals(), [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const request = q.data?.requests.find((r) => r.id === block.approvalId)
  const allowed = !!request && q.data?.permissions.includes('approvals.view') && q.data.permissions.includes('approvals.approve') && q.data.allowedApprovalTypes.includes(request.type) && request.status === 'pending'
  return <div className="intel-action">
    <strong>{block.title}</strong><p>{block.impact}</p><small>Données utilisées : {block.dataUsed.join(', ') || 'non précisées'}</small>
    {q.isPending && <p role="status">Vérification des droits de validation…</p>}
    {q.isError && <p role="alert">Validation indisponible. <Button variant="ghost" onClick={() => { void q.refetch() }}>Réessayer</Button></p>}
    {request && <p><Badge tone={request.status === 'pending' ? 'warning' : 'neutral'}>{approvalStatusLabels[request.status]}</Badge></p>}
    <div className="ops-actions">
      {allowed && request.capabilities.canApprove && <Button className="business-button" onClick={() => { q.decide.reset(); setDecision('approve') }}>Confirmer</Button>}
      {allowed && request.capabilities.canReject && <Button className="business-button" variant="secondary" onClick={() => { q.decide.reset(); setDecision('reject') }}>Annuler la proposition</Button>}
      {q.data?.permissions.includes('approvals.view') && <Link className="ops-link" to={`/approvals?request=${block.approvalId}`}>Examiner la demande</Link>}
    </div>
    {decision && request && <ActionConfirmation title={decision === 'approve' ? 'Confirmer la validation humaine ?' : 'Refuser cette proposition ?'} demo={q.isDemo} busy={q.decide.isPending} error={q.decide.isError ? 'Décision non confirmée. La demande ou vos droits ont pu changer.' : null} onClose={() => setDecision(null)} onConfirm={() => q.decide.mutate({ id: request.id, decision, data: { version: request.version, comment: decision === 'approve' ? 'Validation humaine après examen dans l’assistant.' : 'Proposition annulée par décision humaine dans l’assistant.' } }, { onSuccess: () => setDecision(null) })}><p>{request.context}</p><p>{request.impact}</p><p>Cette décision est enregistrée dans le centre de validation.</p></ActionConfirmation>}
  </div>
}

export function AIResponse({ blocks, permissions, interactive = true }: { blocks: AIResponseBlock[]; permissions: string[]; interactive?: boolean }) {
  return <>{blocks.map((block) => <section key={block.id} className="intel-response-block"><h3>{block.category}</h3>
    {(block.type === 'text' || block.type === 'risk') && <p className={block.type === 'risk' ? 'business-info' : undefined}>{block.text}</p>}
    {block.type === 'list' && <ul className="list-disc pl-5">{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
    {block.type === 'kpi' && <KPIGrid items={block.items.map((i) => ({ label: i.label, value: i.unit === 'money' ? formatMoney(i.value) : i.value.toLocaleString('fr-FR') }))} />}
    {block.type === 'table' && <div className="intel-block-table"><table className="business-table"><thead><tr>{block.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{block.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{typeof c === 'number' ? c.toLocaleString('fr-FR') : c}</td>)}</tr>)}</tbody></table></div>}
    {block.type === 'chart' && <><p>{block.title}</p><ValueChart data={block.data} /></>}
    {block.type === 'action' && (interactive && block.canOpenApproval && block.approvalId !== null && permissions.includes('approvals.view') ? <ActionReview block={block} /> : <p>{block.title} · {interactive ? 'Validation humaine requise ; action indisponible dans votre périmètre.' : 'Proposition en cours de réception.'}</p>)}
  </section>)}</>
}
