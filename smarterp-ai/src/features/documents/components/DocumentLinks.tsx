import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Section } from '../../../components/ui/BusinessPresentation'
import { Button } from '../../../components/ui/Button'
import { apiClient } from '../../../lib/axios'
import { useBusinessScope } from '../../../hooks/useBusinessScope'
import type { DocumentDetail } from '../types/documents.types'

export function DocumentLinks({ document }: { document: DocumentDetail }) {
  const types = document.linkTypes ?? [], [kind, setKind] = useState(types[0]?.value ?? ''), [id, setId] = useState(''), { invalidate } = useBusinessScope()
  const refresh = () => invalidate(['documents', 'document', 'entity-documents', 'approvals'])
  const link = useMutation({ mutationFn: () => apiClient.post(`/documents/${document.id}/link/`, { entity_type: kind, entity_id: Number(id) }), onSuccess: refresh })
  const unlink = useMutation({ mutationFn: (linkId: number) => apiClient.delete(`/documents/${document.id}/link/${linkId}/`), onSuccess: refresh })
  const can = document.permissions.includes('documents.upload')
  return <Section title="Liaisons ERP">{document.links?.map((value) => <p key={value.id}><Link className="ops-link" to={value.path}>{value.label} #{value.entityId}</Link>{can && <Button variant="ghost" className="business-button" disabled={unlink.isPending} onClick={() => unlink.mutate(value.id)}>Retirer la liaison</Button>}</p>)}{!document.links?.length && <p>Aucune liaison.</p>}{can && types.length > 0 && <form className="ops-controls" onSubmit={(e) => { e.preventDefault(); link.mutate() }}><label className="ops-filter">Type d’enregistrement<select value={kind} onChange={(e) => setKind(e.target.value)}>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="ops-filter">Identifiant de l’enregistrement<input required type="number" min={1} step={1} value={id} onChange={(e) => setId(e.target.value)} /></label><Button type="submit" className="business-button" disabled={link.isPending}>Lier</Button></form>}{(link.isError || unlink.isError) && <p role="alert">Liaison refusée. Vérifiez l’identifiant, la société et vos droits d’accès.</p>}</Section>
}
