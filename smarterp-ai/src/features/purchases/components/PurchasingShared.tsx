import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Sparkles } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { formatDate } from '../../../lib/format'
import type { Activity } from '../types/purchases.types'
import type { PurchasingInsight } from '../../suppliers/types/supplierDetail.types'

export function PurchasingState({ forbidden, notFound, loading, error, onRetry, back }: { forbidden?: boolean; notFound?: boolean; loading?: boolean; error: string; onRetry: () => void; back?: string }) {
  return <main className="dashboard-page business-page"><section className="business-card business-state">{forbidden && <ShieldAlert className="mx-auto" />}<h1>{forbidden ? 'Accès non autorisé' : notFound ? 'Enregistrement introuvable' : loading ? 'Chargement…' : error}</h1>{loading ? <div className="business-skeleton mt-6" role="status" aria-label="Chargement des données" /> : !forbidden && !notFound && <Button className="business-button mt-4" onClick={onRetry}>Réessayer</Button>}{back && <p><Link to={back}>Retour à la liste</Link></p>}</section></main>
}
export function PurchasingTimeline({ activities }: { activities: Activity[] }) {
  return <section className="business-card purchasing-panel" aria-label="Activité"><h2>Activité</h2>{!activities.length && <p>Aucune activité enregistrée.</p>}<ol className="purchasing-timeline">{activities.map((a) => <li key={a.id}><time>{formatDate(a.date)}</time><strong>{a.title}</strong><p>{a.detail}</p></li>)}</ol></section>
}
export function PurchasingNotice({ demo, asOf }: { demo: boolean; asOf: string }) {
  return <p className="business-note">{demo ? 'Mode démonstration · Simulations en mémoire, sans effet comptable, bancaire ou stock réel.' : 'Données confirmées par le serveur.'} Référence : {formatDate(asOf)}.</p>
}
export function ActionConfirmation({ title, children, busy, error, demo, onClose, onConfirm }: { title: string; children?: ReactNode; busy: boolean; error: string | null; demo: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Dialog title={title} className="business-dialog" busy={busy} onClose={onClose}>{children}{demo && <p className="business-info">Simulation locale uniquement. Aucun document, e-mail, mouvement de stock ou écriture réelle.</p>}{error && <p role="alert" className="business-error">{error}</p>}<footer><Button variant="secondary" className="business-button" disabled={busy} onClick={onClose} autoFocus>Retour</Button><Button className="business-button" disabled={busy} onClick={onConfirm}>{busy ? 'Traitement…' : 'Confirmer'}</Button></footer></Dialog>
}
export function PurchasingInsightPanel({ insight, busy, error, onAnalyze, label = 'Analyser avec IA' }: { insight?: PurchasingInsight; busy: boolean; error: boolean; onAnalyze: () => void; label?: string }) {
  return <section className="business-card purchasing-panel purchasing-insight"><header><h2><Sparkles size={16} /> Analyse et recommandations</h2><Button variant="secondary" className="business-button" disabled={busy} onClick={onAnalyze}>{busy ? 'Analyse en cours…' : label}</Button></header>{busy && <p role="status">Analyse en cours…</p>}{error && <p role="alert">L’analyse est indisponible. Réessayez.</p>}{insight ? <><small>{insight.source}</small><h3>FACTS</h3><ul>{insight.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul><h3>AI ANALYSIS</h3><p>{insight.analysis}</p><h3>RISK</h3><p>{insight.risk}</p>{insight.opportunity && <><h3>OPPORTUNITY</h3><p>{insight.opportunity}</p></>}<h3>RECOMMENDATION</h3><ul>{insight.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></> : <p>Analyse à la demande. Les recommandations ne modifient aucune donnée.</p>}</section>
}
