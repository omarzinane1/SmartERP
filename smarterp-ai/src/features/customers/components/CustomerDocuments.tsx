import { useState } from 'react'
import { Download, Eye, Sparkles, X } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { formatDate } from '../../../lib/format'
import type { CustomerDocument, CustomerPermission } from '../types/customers.types'

export function CustomerDocuments({ documents, permissions, canAI, isDemo }: {
  documents: CustomerDocument[]; permissions: CustomerPermission[]; canAI: boolean; isDemo: boolean
}) {
  const [selected, setSelected] = useState<{ id: string; ai: boolean } | null>(null)
  const document = documents.find((entry) => entry.id === selected?.id && (!entry.permission || permissions.includes(entry.permission)))
  function download(entry: CustomerDocument) {
    if (!isDemo) {
      if (entry.downloadUrl && /^https?:\/\//.test(entry.downloadUrl)) window.open(entry.downloadUrl, '_blank', 'noopener,noreferrer')
      return
    }
    const url = URL.createObjectURL(new Blob([entry.content], { type: 'text/plain;charset=utf-8' }))
    const link = window.document.createElement('a')
    link.href = url
    link.download = `${entry.name}-demo.txt`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <><div className="customer-table-toolbar"><h2>Documents <span>{documents.length}</span></h2><span>{isDemo ? 'Extraits de démonstration' : 'Pièces jointes du client'}</span></div><div className="customer-detail-table-scroll"><table className="customer-detail-table" aria-label="Documents du client"><thead><tr><th>Document</th><th>Type</th><th>Ajouté le</th><th>Ajouté par</th><th>Indexé IA</th><th>Actions</th></tr></thead><tbody>
    {documents.map((entry) => entry.permission && !permissions.includes(entry.permission) ? <tr key={entry.id}><td colSpan={6} className="customer-table-empty">Restricted</td></tr> : <tr key={entry.id}><td className="font-medium text-navy-950">{entry.name}</td><td>{entry.type}</td><td>{formatDate(entry.uploadedAt)}</td><td>{entry.uploadedBy}</td><td><Badge tone={entry.aiIndexed ? 'positive' : 'neutral'}>{entry.aiIndexed ? 'Indexé' : 'En attente'}</Badge></td><td><div className="customer-document-actions"><button aria-label={`Aperçu : ${entry.name}`} onClick={() => setSelected({ id: entry.id, ai: false })}><Eye size={13} />Aperçu</button><button disabled={!isDemo && !/^https?:\/\//.test(entry.downloadUrl ?? '')} aria-label={`Télécharger : ${entry.name}`} onClick={() => download(entry)}><Download size={13} /></button><button disabled={!canAI || !entry.aiIndexed} aria-label={`Demander à l’IA : ${entry.name}`} onClick={() => setSelected({ id: entry.id, ai: true })}><Sparkles size={13} /></button></div></td></tr>)}
    {!documents.length && <tr><td colSpan={6} className="customer-table-empty">Aucun document disponible.</td></tr>}
  </tbody></table></div>
  {document && <section className="customer-document-preview" aria-label="Aperçu du document"><div className="customer-section-heading"><h2>{document.name}</h2><button aria-label="Fermer l’aperçu" onClick={() => setSelected(null)}><X size={15} /></button></div><Badge tone={selected?.ai ? 'indigo' : 'info'}>{selected?.ai ? 'AI ANALYSIS' : 'FACT · DOCUMENT'}</Badge>{selected?.ai ? <p>{document.aiSummary ?? 'Aucune analyse disponible pour ce document. L’analyse documentaire sera disponible avec le service IA.'}</p> : <pre>{document.content || 'Aucun aperçu texte disponible.'}</pre>}{isDemo && <small>Extrait fictif · Le téléchargement fournit ce contenu au format TXT.</small>}</section>}
  </>
}
