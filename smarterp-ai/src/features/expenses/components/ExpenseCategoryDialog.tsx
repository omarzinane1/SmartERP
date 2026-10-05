import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Dialog } from '../../../components/ui/Dialog'
import { Button } from '../../../components/ui/Button'
import { apiClient } from '../../../lib/axios'
import { useBusinessScope } from '../../../hooks/useBusinessScope'

export function ExpenseCategoryDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(''), [code, setCode] = useState(''), { invalidate } = useBusinessScope()
  const save = useMutation({ mutationFn: () => apiClient.post('/expense-categories/', { name, ...(code ? { code } : {}) }), onSuccess: () => { void invalidate(['expenses']); onClose() } })
  return <Dialog title="Créer une catégorie de dépense" className="business-dialog" onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); save.mutate() }}><label className="ops-filter">Nom<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label><label className="ops-filter">Code (facultatif)<input maxLength={80} value={code} onChange={(e) => setCode(e.target.value)} /></label>{save.isError && <p role="alert">Création refusée. Vérifiez l’unicité du nom et du code.</p>}<Button type="submit" className="business-button" disabled={save.isPending}>Enregistrer</Button></form></Dialog>
}
