import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { approveRequest, getApprovalById, getApprovals, rejectRequest } from '../api/approvals.api'
import type { ApprovalDecision } from '../types/approvals.types'
export function useApprovals() {
  const { scope, key, invalidate } = useBusinessScope()
  const query = useQuery({ ...options, queryKey: [...key('approvals'), env.approvalsUseMock], queryFn: ({ signal }) => getApprovals(scope, signal) })
  const detail = useMutation({ ...options, mutationFn: (id: number) => getApprovalById(scope, id) })
  const decide = useMutation({ ...options, mutationFn: ({ id, decision, data }: { id: number; decision: 'approve' | 'reject'; data: ApprovalDecision }) => decision === 'approve' ? approveRequest(scope, id, data) : rejectRequest(scope, id, data), onSuccess: () => invalidate(['approvals', 'expenses', 'audit-logs', 'cash-flow', 'cash-forecast', 'report-analytics']) })
  return { ...query, detail, decide, isDemo: env.approvalsUseMock }
}
