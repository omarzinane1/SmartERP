import { useMutation, useQuery } from '@tanstack/react-query'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { env } from '../../../config/env'
import * as api from '../api/documents.api'
import type { DocumentAction, DocumentMetadata } from '../types/documents.types'
export function useDocuments() {
  const { scope, key, invalidate } = useBusinessScope(), refresh = () => invalidate(['documents', 'document', 'document-pages'])
  const query = useQuery({ ...options, queryKey: [...key('documents'), env.documentsUseMock], queryFn: ({ signal }) => api.getDocuments(scope, signal), refetchInterval: (q) => !env.documentsUseMock && q.state.data?.documents.some((d) => d.status === 'processing') ? 2500 : false })
  const upload = useMutation({ ...options, mutationFn: ({ file, metadata, progress }: { file: File; metadata: DocumentMetadata; progress: (v: number) => void }) => api.uploadDocument(scope, file, metadata, progress), onSuccess: refresh })
  const remove = useMutation({ ...options, mutationFn: (id: number) => api.deleteDocument(scope, id), onSuccess: refresh })
  const index = useMutation({ ...options, mutationFn: (id: number) => api.indexDocument(scope, id), onSuccess: refresh })
  return { ...query, upload, remove, index, isDemo: env.documentsUseMock }
}
export function useDocumentDetail(id: number, valid: boolean) {
  const { scope, key, invalidate } = useBusinessScope()
  const detail = useQuery({ ...options, queryKey: [...key('document'), env.documentsUseMock, id], enabled: valid, queryFn: ({ signal }) => api.getDocumentById(scope, id, signal), refetchInterval: (q) => !env.documentsUseMock && q.state.data?.status === 'processing' ? 2500 : false })
  const can = (p: string) => detail.data?.canView === true && detail.data.permissions.includes(p)
  const pages = useQuery({ ...options, queryKey: [...key('document-pages'), env.documentsUseMock, id], enabled: can('documents.view'), queryFn: ({ signal }) => api.getDocumentPages(scope, id, signal) })
  const analyze = useMutation({ ...options, mutationFn: (action: DocumentAction) => api.analyzeDocument(scope, id, action) })
  const ask = useMutation({ ...options, mutationFn: (question: string) => api.queryDocument(scope, id, question) })
  const index = useMutation({ ...options, mutationFn: () => api.indexDocument(scope, id), onSuccess: () => invalidate(['documents', 'document', 'document-pages']) })
  return { detail, pages, analyze, ask, index, can, isDemo: env.documentsUseMock }
}
