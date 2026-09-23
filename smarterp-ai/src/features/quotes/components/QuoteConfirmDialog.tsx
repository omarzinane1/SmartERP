import { useEffect, useRef } from 'react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'

export function QuoteConfirmDialog({ title, description, confirmLabel, busy = false, error, onConfirm, onClose }: {
  title: string; description: string; confirmLabel: string; busy?: boolean; error?: string | null
  onConfirm: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  return <dialog ref={ref} className="quote-confirm-dialog" aria-labelledby="quote-confirm-title" aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <h2 id="quote-confirm-title">{title}</h2><p>{description}</p>
    {error && <p role="alert" className="quote-field-error">{error}</p>}
    <footer><Button variant="secondary" className="quotes-button" disabled={busy} onClick={onClose} autoFocus>Annuler</Button>
      <Button className="quotes-button quotes-primary" disabled={busy} onClick={onConfirm}>{busy && <Spinner />}{busy ? 'Traitement…' : confirmLabel}</Button></footer>
  </dialog>
}
