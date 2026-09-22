import { useState } from 'react'
import { Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import type { CustomerNote } from '../types/customers.types'

export function CustomerNotes({ notes, canEdit, isDemo, author, onChange, onAdded, startAdding = false }: {
  notes: CustomerNote[]; canEdit: boolean; isDemo: boolean; author: string
  onChange: (notes: CustomerNote[]) => void; onAdded: (note: CustomerNote) => void
  startAdding?: boolean
}) {
  const [editor, setEditor] = useState<{ id: string | null; content: string } | null>(startAdding && canEdit && isDemo ? { id: null, content: '' } : null)
  const writable = canEdit && isDemo
  return <div className="customer-notes"><div className="customer-table-toolbar"><h2>Notes internes <span>{notes.length}</span></h2><Button className="customer-detail-button" disabled={!writable} onClick={() => setEditor({ id: null, content: '' })}><Plus size={12} />Ajouter une note</Button></div>
    <p className="customer-detail-caption">{isDemo ? 'Les modifications sont conservées pendant votre visite de cette fiche.' : 'La gestion des notes sera disponible avec le service CRM.'}</p>
    {editor && <form className="customer-note-editor" onSubmit={(event) => {
      event.preventDefault()
      if (!writable || !editor.content.trim()) return
      if (editor.id) onChange(notes.map((note) => note.id === editor.id ? { ...note, content: editor.content.trim() } : note))
      else {
        const note = { id: crypto.randomUUID(), author, createdAt: new Date().toISOString(), content: editor.content.trim(), pinned: false }
        onChange([note, ...notes]); onAdded(note)
      }
      setEditor(null)
    }}><label htmlFor="customer-note-content">{editor.id ? 'Modifier la note' : 'Nouvelle note'}</label><textarea autoFocus id="customer-note-content" required maxLength={3000} rows={4} value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} /><div className="flex justify-end gap-2"><Button variant="secondary" className="customer-detail-button" onClick={() => setEditor(null)}>Annuler</Button><Button type="submit" className="customer-detail-button" disabled={!editor.content.trim()}>Enregistrer la note</Button></div></form>}
    <div className="customer-notes-list">{[...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned)).map((note) => <article key={note.id}><header><div><strong>{note.author}</strong><time dateTime={note.createdAt}>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Casablanca' }).format(new Date(note.createdAt))}</time></div>{note.pinned && <Badge tone="info"><Pin size={9} />Épinglée</Badge>}</header><p>{note.content}</p><footer><button disabled={!writable} onClick={() => setEditor({ id: note.id, content: note.content })}><Pencil size={11} />Modifier</button><button disabled={!writable} onClick={() => onChange(notes.map((entry) => entry.id === note.id ? { ...entry, pinned: !entry.pinned } : entry))}><Pin size={11} />{note.pinned ? 'Désépingler' : 'Épingler'}</button><button disabled={!writable} onClick={() => { onChange(notes.filter((entry) => entry.id !== note.id)); if (editor?.id === note.id) setEditor(null) }}><Trash2 size={11} />Supprimer</button></footer></article>)}</div>
    {!notes.length && !editor && <p className="customer-table-empty">Aucune note pour ce client.</p>}
  </div>
}
