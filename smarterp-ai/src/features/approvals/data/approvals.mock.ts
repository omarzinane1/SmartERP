import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { expenseActionMock, expenseSnapshot, rejectExpenseFromApprovalMock } from '../../expenses/data/expenses.mock'
import { appendAuditMock } from '../../admin/data/admin.mock'
import { stockDemoDate } from '../../products/data/products.mock'
import type { ApprovalDecision, ApprovalRequest, ApprovalType } from '../types/approvals.types'
export const approvalPermissions = ['approvals.view', 'approvals.approve', 'ai.use', 'documents.view']
export const allowedApprovalTypes: ApprovalType[] = ['expense', 'purchase', 'ai_action']
const stores = new Map<string, ApprovalRequest[]>()
function store(scope: string) {
  if (!stores.has(scope)) stores.set(scope, [
    { id: 901, reference: 'APR-AI-901', date: stockDemoDate, type: 'ai_action', requester: 'Assistant IA · suggestion', context: 'Examiner un plan de relance des créances ouvertes', amount: null, risk: 'medium', status: 'pending', approver: null, recordId: 413, recordPath: '/invoices/413', canOpenRecord: true, attachments: [], comments: [], aiRecommendation: { analysis: 'Des factures ouvertes nécessitent une revue des échéances.', recommendation: 'Vérifier les soldes et coordonnées avant de relancer.', confidence: null }, impact: 'Validation de la demande de revue uniquement. Aucun e-mail, paiement ou changement financier ne sera exécuté par la simulation.', version: 1, capabilities: { canApprove: true, canReject: true } },
    ...(['discount', 'purchase', 'payment', 'inventory'] as const).map((type, n): ApprovalRequest => ({ id: 910 + n, reference: `APR-${910 + n}`, date: '2026-09-25', type, requester: 'Omar Zinane', context: ['Revue de remise commerciale', 'Contrôle de la commande fournisseur', 'Contrôle préalable à un règlement', 'Revue d’un ajustement de stock'][n], amount: type === 'purchase' ? 86400 : null, risk: n % 2 ? 'medium' : 'low', status: n === 0 ? 'approved' : n === 3 ? 'rejected' : 'pending', approver: n === 0 || n === 3 ? 'Manager démo' : null, recordId: type === 'purchase' ? 321 : type === 'inventory' ? 104 : null, recordPath: type === 'purchase' ? '/purchases/321' : type === 'inventory' ? '/products/104' : null, canOpenRecord: type === 'purchase' || type === 'inventory', attachments: type === 'purchase' ? [{ id: 1, name: 'Conditions Atlas', canOpen: true }] : [], comments: [], aiRecommendation: null, impact: 'La décision approuve la demande de revue ; aucune écriture réelle n’est exécutée dans le navigateur.', version: 1, capabilities: { canApprove: type === 'purchase', canReject: type === 'purchase' } })),
  ])
  return stores.get(scope)!
}
export function approvalSnapshot(scope: string): ApprovalRequest[] {
  const existing = store(scope), expenseRequests = expenseSnapshot(scope).filter((e) => ['submitted', 'approved', 'rejected', 'paid'].includes(e.status)).map((e): ApprovalRequest => {
    const original = existing.find((r) => r.id === 10000 + e.id)
    return { id: 10000 + e.id, reference: `APR-${e.reference}`, date: e.date, type: 'expense', requester: e.employee, context: e.description, amount: e.total, risk: e.total > 3000 ? 'medium' : 'low', status: e.status === 'submitted' ? 'pending' : e.status === 'rejected' ? 'rejected' : 'approved', approver: e.status === 'submitted' ? null : original?.approver ?? 'Manager démo', recordId: e.id, recordPath: '/expenses', canOpenRecord: true, attachments: [], comments: original?.comments ?? [], aiRecommendation: null, impact: 'La décision actualise le statut de la dépense. Aucun paiement n’est déclenché.', version: original?.version ?? 1, capabilities: { canApprove: e.status === 'submitted', canReject: e.status === 'submitted' } }
  })
  return structuredClone([...existing.filter((r) => r.type !== 'expense'), ...expenseRequests])
}
export function approvalByIdMock(scope: string, id: number) { const r = approvalSnapshot(scope).find((r) => r.id === id); if (!r) throw new BusinessNotFoundError(); return r }
const locks = new Set<string>()
export async function decideApprovalMock(scope: string, id: number, decision: 'approve' | 'reject', data: ApprovalDecision) {
  const lock = `${scope}:${id}`; if (locks.has(lock)) throw new Error('Décision déjà en cours.'); locks.add(lock)
  try { await new Promise((r) => setTimeout(r, 200)); const request = approvalByIdMock(scope, id)
    if (request.status !== 'pending' || request.version !== data.version || !allowedApprovalTypes.includes(request.type) || !(decision === 'approve' ? request.capabilities.canApprove : request.capabilities.canReject)) throw new Error('Demande modifiée ou décision non autorisée.')
    if (data.comment.length > 2000 || decision === 'reject' && data.comment.trim().length < 3) throw new Error('Un motif de refus est obligatoire (3 caractères minimum).')
    if (request.type === 'expense' && request.recordId) { if (decision === 'approve') await expenseActionMock(scope, request.recordId, 'approve'); else rejectExpenseFromApprovalMock(scope, request.recordId) }
    const updated = { ...request, status: decision === 'approve' ? 'approved' as const : 'rejected' as const, approver: 'Omar Zinane', version: request.version + 1, capabilities: { canApprove: false, canReject: false }, comments: [...request.comments, ...(data.comment.trim() ? [{ id: crypto.randomUUID(), author: 'Omar Zinane', date: stockDemoDate, text: data.comment.trim() }] : [])] }, state = store(scope), original = state.find((r) => r.id === id)
    if (original) Object.assign(original, updated); else state.push(updated)
    appendAuditMock(scope, { module: 'Validations', action: `${decision}_demo`, entityType: request.type, recordId: request.recordId, reference: request.reference, before: { status: request.status }, after: { status: updated.status, comment: data.comment.trim() } }); return structuredClone(updated)
  } finally { locks.delete(lock) }
}
