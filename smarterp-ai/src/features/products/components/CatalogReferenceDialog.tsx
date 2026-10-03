import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { apiClient } from '../../../lib/axios'
import { businessQueryOptions, useBusinessScope } from '../../../hooks/useBusinessScope'

export function CatalogReferenceDialog({ kind, onClose }: { kind: 'category' | 'unit'; onClose: () => void }) {
  const [name, setName] = useState(''), [code, setCode] = useState('')
  const { invalidate } = useBusinessScope()
  const save = useMutation({ ...businessQueryOptions, mutationFn: () => apiClient.post(kind === 'category' ? '/product-categories/' : '/units/', { name: name.trim(), code: code.trim() || name.trim() }), onSuccess: async () => { await invalidate(['products', 'product']); onClose() } })
  return <Dialog title={kind === 'category' ? 'Créer une catégorie' : 'Créer une unité'} className="business-dialog" busy={save.isPending} onClose={onClose}>
    <form onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <div className="business-form-grid">
        <label>Nom<input required maxLength={kind === 'unit' ? 30 : 80} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Code<input maxLength={kind === 'unit' ? 30 : 80} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Identique au nom si vide" /></label>
      </div>
      {kind === 'unit' && <p className="business-info">Unité propre à cette société. Aucune conversion automatique entre unités.</p>}
      {save.isError && <p role="alert" className="ops-error">{save.error.message}</p>}
      <footer><Button variant="secondary" disabled={save.isPending} onClick={onClose}>Annuler</Button><Button type="submit" disabled={save.isPending || !name.trim()}>{save.isPending ? 'Création…' : 'Créer'}</Button></footer>
    </form>
  </Dialog>
}
