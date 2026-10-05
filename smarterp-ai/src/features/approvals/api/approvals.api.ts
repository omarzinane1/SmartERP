import { getCollection } from '../../../lib/collectionApi'
import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { stockDemoDate } from '../../products/data/products.mock'
import { allowedApprovalTypes, approvalByIdMock, approvalPermissions, approvalSnapshot, decideApprovalMock } from '../data/approvals.mock'
import type { ApprovalDecision, ApprovalRequest, ApprovalsData } from '../types/approvals.types'
export const getApprovals = async (scope: string, signal?: AbortSignal): Promise<ApprovalsData> => env.approvalsUseMock ? { requests: approvalSnapshot(scope), permissions: approvalPermissions, allowedApprovalTypes, asOf: stockDemoDate } : getCollection<ApprovalsData, 'requests'>('/approvals/', 'requests', signal)
export const getApprovalById = async (scope: string, id: number): Promise<ApprovalRequest> => env.approvalsUseMock ? approvalByIdMock(scope, id) : (await apiClient.get(`/approvals/${id}/`)).data
export const approveRequest = async (scope: string, id: number, data: ApprovalDecision): Promise<ApprovalRequest> => env.approvalsUseMock ? decideApprovalMock(scope, id, 'approve', data) : (await apiClient.post(`/approvals/${id}/approve/`, data)).data
export const rejectRequest = async (scope: string, id: number, data: ApprovalDecision): Promise<ApprovalRequest> => env.approvalsUseMock ? decideApprovalMock(scope, id, 'reject', data) : (await apiClient.post(`/approvals/${id}/reject/`, data)).data

export const cancelRequest = async (id: number, data: ApprovalDecision): Promise<ApprovalRequest> => (await apiClient.post(`/approvals/${id}/cancel/`, data)).data
