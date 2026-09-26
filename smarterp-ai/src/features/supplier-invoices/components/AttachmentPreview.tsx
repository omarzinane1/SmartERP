import { formatDate } from '../../../lib/format'
import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import type { BusinessDocument } from '../../purchases/types/purchases.types'

function allowedURL(value: string | null) {
  if (!value) return null
  try { const url = new URL(value, window.location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}
export function AttachmentPreview({ documents, canAttach }: { documents: BusinessDocument[]; canAttach: boolean }) {
  const [selected, setSelected] = useState<BusinessDocument | null>(null)
  const [local, setLocal] = useState<{ file: File; url: string; addedAt: string } | null>(null)
  const localUrl = local?.url ?? null
  const [error, setError] = useState('')
  useEffect(() => () => { if (local) URL.revokeObjectURL(local.url) }, [local])
  const url = selected?.id === 'local' ? localUrl : allowedURL(selected?.url ?? null)
  return <section className="business-card purchasing-panel"><h2>Documents et pièces jointes</h2>{canAttach && <label className="block mt-4 text-xs">Joindre document <input type="file" className="mt-2 block" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { setError('Choisissez un PDF ou une image de moins de 15 Mo.'); return } setError(''); setLocal({ file, url: URL.createObjectURL(file), addedAt: new Date().toISOString() }) }} /></label>}{canAttach && <p className="business-info">Aperçu local uniquement. Aucun endpoint d’upload défini ; aucun fichier n’est envoyé ou enregistré.</p>}{error && <p role="alert">{error}</p>}{[...documents, ...(local ? [{ id: 'local', name: local.file.name, mime: local.file.type, url: localUrl, size: local.file.size, uploadedAt: local.addedAt }] : [])].map((doc) => <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3" key={doc.id}><span>{doc.name}<small className="block text-slate-400">{doc.mime} · {doc.size === undefined ? 'Taille non fournie' : `${(doc.size / 1024).toFixed(1)} Ko`} · {doc.uploadedAt ? formatDate(doc.uploadedAt) : 'Date non fournie'}</small>{!doc.url && <small className="block text-slate-400">Fichier non fourni</small>}</span><div className="purchasing-actions"><Button variant="secondary" className="business-button" disabled={doc.id === 'local' ? !localUrl : !allowedURL(doc.url)} onClick={() => setSelected(doc)}>Prévisualiser</Button>{(doc.id === 'local' ? localUrl : allowedURL(doc.url)) && <a href={(doc.id === 'local' ? localUrl : allowedURL(doc.url))!} download={doc.name} target="_blank" rel="noreferrer">Télécharger</a>}</div></div>)}{!documents.length && !local && <p>Aucun document joint.</p>}{selected && <Dialog title={selected.name} className="business-dialog purchasing-dialog" onClose={() => setSelected(null)}>{url && (selected.mime.startsWith('image/') ? <img src={url} alt={selected.name} className="attachment-preview" /> : selected.mime === 'application/pdf' ? <iframe title={`Aperçu ${selected.name}`} src={url} className="attachment-preview" sandbox="" /> : <p>Aperçu indisponible pour ce format.</p>)}<footer><Button className="business-button" onClick={() => setSelected(null)}>Fermer</Button></footer></Dialog>}</section>
}
