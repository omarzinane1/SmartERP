import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiClient } from '../../../lib/axios'
import { getCollection } from '../../../lib/collectionApi'
import { useBusinessScope, businessQueryOptions } from '../../../hooks/useBusinessScope'
import { Section } from '../../../components/ui/BusinessPresentation'
import type { DocumentList } from '../types/documents.types'
import { documentURL } from '../documents.utils'

export function EntityDocuments({ entityType, entityId, permissions }: { entityType: string; entityId: number; permissions: readonly string[] }) {
  const { key, invalidate } = useBusinessScope(), canView = permissions.includes('documents.view'), canUpload = permissions.includes('documents.upload')
  const query = useQuery({ ...businessQueryOptions, queryKey: [...key('entity-documents'), entityType, entityId], enabled: canView,
    queryFn: ({ signal }) => getCollection<DocumentList, 'documents'>(`/documents/?entity_type=${encodeURIComponent(entityType)}&entity_id=${entityId}`, 'documents', signal) })
  const upload = useMutation({ mutationFn: async (file: File) => {
    if (file.size > 15 * 1024 * 1024) throw new Error('Le fichier dépasse 15 Mo.')
    const body = new FormData(); body.append('file', file); body.append('category', 'Justificatif'); body.append('department', ''); body.append('visibility', 'Public entreprise'); body.append('entity_type', entityType); body.append('entity_id', String(entityId))
    return apiClient.post('/documents/', body)
  }, onSuccess: () => invalidate(['entity-documents', 'documents', 'document', 'approvals']) })
  if (!canView && !canUpload) return null
  return <Section title="Documents liés">{query.isFetching && <p role="status">Chargement…</p>}{query.isError && <p role="alert">Documents indisponibles.</p>}{query.data?.documents.map((d) => <p key={d.id}><Link className="ops-link" to={`/documents/${d.id}`}>{d.name}</Link>{documentURL(d.url) && <> · <a className="ops-link" href={documentURL(d.url)!} download={d.name}>Télécharger</a></>}</p>)}{query.data && !query.data.documents.length && <p>Aucun document lié.</p>}{canUpload && <label className="ops-filter">Ajouter un justificatif (15 Mo maximum)<input type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.webp" disabled={upload.isPending} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.target.value = '' }} /></label>}{upload.isPending && <p role="status">Enregistrement du fichier…</p>}{upload.isError && <p role="alert">Fichier refusé. Vérifiez son type, son contenu, sa taille et vos droits.</p>}</Section>
}
