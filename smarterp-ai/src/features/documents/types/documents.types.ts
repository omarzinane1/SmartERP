export type IndexStatus = 'uploaded' | 'uploading' | 'processing' | 'indexed' | 'index_error'
export interface DocumentSource { id: string; documentId: number | null; documentName: string; page: number | null; section: string | null; excerpt: string; recordPath: string | null; period: string | null; authorized: boolean }
export interface DocumentRecord { id: number; name: string; mime: string; category: string; department: string; author: string; size: number; createdAt: string; status: IndexStatus; visibility: string; url: string | null; previewUrl?: string; pageCount: number; canView: boolean; capabilities: { canDelete: boolean; canIndex: boolean; canDownload: boolean; canAnalyze: boolean }; indexError: string | null }
export interface DocumentPage { number: number; title: string; text: string | null; imageUrl: string | null; thumbnailUrl: string | null; simulated: boolean }
export interface DocumentList { documents: DocumentRecord[]; permissions: string[]; asOf: string; acceptedTypes: { extension: string; mime: string }[]; maxBytes: number; visibilityOptions: string[] }
export interface DocumentDetail extends DocumentRecord { permissions: string[]; asOf: string; policyReason?: string | null; links?: { id: number; entityType: string; entityId: number; label: string; path: string }[]; linkTypes?: { value: string; label: string }[] }
export interface DocumentMetadata { category: string; department: string; visibility: string }
export interface DocumentAnswer { answer: string; sources: DocumentSource[]; verified: boolean; generatedAt: string; confidence: number | null; simulated: boolean }
export interface DocumentAnalysis { summary: string; keyInformation: string[]; dates: string[]; paymentTerms: string[]; risks: string[]; sources: DocumentSource[]; generatedAt: string; confidence: number | null; simulated: boolean }
export type DocumentAction = 'summary' | 'risks' | 'dates' | 'payment_terms'
export const indexStatusLabels: Record<IndexStatus, string> = { uploaded: 'Enregistré', uploading: 'Upload…', processing: 'Traitement…', indexed: 'Indexé', index_error: 'Erreur indexation' }
