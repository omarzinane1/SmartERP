import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FileBarChart } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { BusinessState, Empty, PageHeading, SearchField, Section, SelectFilter, SubQueryState } from '../../../components/ui/BusinessPresentation'
import { PurchasingNotice } from '../../purchases/components/PurchasingShared'
import { downloadAsyncReport } from '../api/reports.api'
import { useReports } from '../hooks/useReports'
import { GenerateReportModal } from '../components/GenerateReportModal'
import type { GeneratedReport, ReportDefinition } from '../types/reports.types'
import { downloadCSV } from '../../../lib/csv'
import { formatDate } from '../../../lib/format'
const allowedPath = (path: string | null) => !!path && (/^\/reports\/(sales|profitability|customers|products|inventory|purchases|suppliers|invoices|payments|expenses|cash-flow)$/.test(path) || /^\/(sales|products|customers|inventory|suppliers|purchases|invoices|supplier-invoices|payments|expenses|finance\/cash-flow)(\/\d+)?$/.test(path))
async function downloadReport(r: GeneratedReport) {
  if (r.status !== 'ready') return
  if (r.jobId) {
    try {
      const blob = await downloadAsyncReport(r.jobId), url = URL.createObjectURL(blob), anchor = document.createElement('a')
      anchor.href = url; anchor.download = r.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast.error('Téléchargement indisponible. Vérifiez vos droits ou actualisez la liste.') }
    return
  }
  if (r.format === 'csv' && r.rows) { downloadCSV(r.filename, r.rows); return }
  if (r.downloadUrl) { try { const url = new URL(r.downloadUrl, window.location.origin); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); const a = document.createElement('a'); a.href = url.href; a.download = r.filename; a.target = '_blank'; a.rel = 'noreferrer'; a.click(); return } catch { toast.error('Adresse de téléchargement invalide'); return } }
  toast.error('Le serveur n’a pas fourni de fichier téléchargeable.')
}
export function ReportsLibraryPage() {
  const q = useReports(), [search, setSearch] = useState(''), [category, setCategory] = useState(''), [report, setReport] = useState<ReportDefinition | null>(null)
  if (q.catalog.isPending || q.catalog.isError || !q.catalog.data?.permissions.includes('reports.view')) return <BusinessState query={q.catalog} permission="reports.view" />
  const d = q.catalog.data, canGenerate = d.permissions.includes('reports.generate'), rows = d.reports.filter((r) => (!category || r.category === category) && `${r.name} ${r.description} ${r.category}`.toLowerCase().includes(search.toLowerCase()))
  return <main className="dashboard-page business-page ops-page"><PageHeading title="Rapports" description="Centralisez, générez et consultez les rapports métier de votre entreprise." /><PurchasingNotice demo={q.isDemo} asOf={d.asOf} /><section className="business-card"><div className="ops-controls"><SearchField value={search} onChange={setSearch} placeholder="Rechercher un rapport…" /><SelectFilter label="Catégorie" value={category} onChange={setCategory} options={[...new Set(d.reports.map((r) => r.category))].map((v) => ({ value: v, label: v }))} /><span>{rows.length} rapports</span></div>{!rows.length ? <Empty filtered={d.reports.length > 0} /> : <div className="ops-grid">{rows.map((r) => <article key={r.id} className="ops-card ops-reports-card"><div className="ops-actions"><FileBarChart size={19} className="text-primary-text" /><Badge tone="info">{r.category}</Badge></div><h2>{r.name}</h2><p className="text-xs text-slate-500">{r.description}</p><small>Dernière génération : {r.lastGenerated ? formatDate(r.lastGenerated) : 'Aucune'}{r.generatedBy && ` · ${r.generatedBy}`}</small><small>Formats : {r.formats.length ? r.formats.map((f) => f === 'xlsx' ? 'Excel' : f.toUpperCase()).join(', ') : 'Export à connecter'}</small><div className="ops-actions">{r.canOpen && allowedPath(r.path) && <Link className="ops-link" to={r.path!}>Ouvrir</Link>}{canGenerate && <Button className="business-button" variant="secondary" disabled={!r.formats.length} title={!r.formats.length ? 'Aucun format de génération disponible' : undefined} onClick={() => { q.generate.reset(); setReport(r) }}>Générer</Button>}</div></article>)}</div>}</section><Section title="Rapports récents" action={<Button variant="ghost" className="business-button" onClick={() => { void q.recent.refetch() }}>Actualiser</Button>}><SubQueryState pending={q.recent.isPending} error={q.recent.isError} retry={q.recent.refetch} />{q.recent.data && (!q.recent.data.length ? <Empty /> : <div className="business-table-scroll"><table className="business-table"><thead><tr><th>Rapport</th><th>Généré le</th><th>Par</th><th>Période / situation</th><th>Format</th><th>Statut</th><th>Fichier</th></tr></thead><tbody>{q.recent.data.map((r) => <tr key={r.id}><td>{r.name}</td><td>{formatDate(r.createdAt)}</td><td>{r.generatedBy}</td><td>{r.dateFrom && r.dateTo ? `${formatDate(r.dateFrom)} – ${formatDate(r.dateTo)}` : 'Situation à la génération'}</td><td>{r.format.toUpperCase()}</td><td><Badge tone={r.status === 'ready' ? 'positive' : r.status === 'failed' ? 'critical' : 'warning'}>{r.status === 'ready' ? 'Disponible' : r.status === 'failed' ? 'Échec' : r.status === 'pending' ? 'En attente' : 'En cours'}</Badge>{r.errorMessage && <p className="text-xs text-red-700">{r.errorMessage}</p>}</td><td>{r.status === 'failed' && r.jobId && <Button className="business-button" variant="secondary" disabled={q.retry.isPending} onClick={() => q.retry.mutate(r.jobId!, { onError: () => toast.error('Relance impossible. Actualisez la liste.') })}>Réessayer</Button>}<Button className="business-button" variant="ghost" disabled={r.status !== 'ready' || !r.downloadUrl && !r.rows} onClick={() => { void downloadReport(r) }}>Télécharger</Button></td></tr>)}</tbody></table></div>)}</Section>{report && <GenerateReportModal report={report} asOf={d.asOf} busy={q.generate.isPending} error={q.generate.isError ? q.generate.error.message : null} demo={q.isDemo} onClose={() => setReport(null)} onGenerate={(v) => q.generate.mutate(v, { onSuccess: (r) => { if (r.status === 'failed') { toast.error('La génération a échoué'); return } setReport(null); if (r.status === 'ready') { toast.success('Rapport généré'); void downloadReport(r) } else toast.info('Traitement demandé. Le statut se mettra à jour automatiquement.') } })} />}</main>
}
