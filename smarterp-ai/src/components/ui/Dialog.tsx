import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Dialog({ title, children, className = '', busy = false, onClose }: { title: string; children: ReactNode; className?: string; busy?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  return createPortal(<dialog ref={ref} className={className} aria-labelledby={titleId} aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}><h2 id={titleId}>{title}</h2>{children}</dialog>, document.body)
}
