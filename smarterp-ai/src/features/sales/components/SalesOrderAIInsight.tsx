import { Sparkles } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import type { SalesAIInsight } from '../types/sales.types'

export function SalesOrderAIInsight({ allowed, isDemo, pending, data, error, onRequest }: { allowed: boolean; isDemo: boolean; pending: boolean; data?: SalesAIInsight; error: boolean; onRequest: () => void }) {
  return <section className="sales-card sales-ai" aria-labelledby="sales-ai-title" aria-busy={pending}>
    <header className="sales-card-title"><Sparkles size={16} aria-hidden="true" /><h2 id="sales-ai-title">SmartERP AI — Analyse de la commande</h2></header>
    <div className="sales-panel-body">
      <p className="sales-ai-intro">Comprendre les quantités restantes, le suivi financier et les prochaines actions.</p>
      {!allowed ? <p className="sales-muted">Accès restreint à l’analyse IA.</p> : <>
        <p className="sales-muted">{isDemo ? 'Analyse de démonstration préparée à partir des données de la commande. Aucun modèle IA connecté.' : 'L’analyse sera disponible après connexion du service IA des commandes.'}</p>
        <Button className="sales-button" variant="secondary" disabled={pending || !isDemo} onClick={onRequest}>{pending ? <Spinner /> : <Sparkles size={13} />}{pending ? 'Analyse en cours…' : data ? 'Actualiser l’analyse' : 'Demander à l’IA'}</Button>
      </>}
      {error && <p role="alert" className="sales-error">L’analyse n’a pas pu être chargée. Réessayez.</p>}
      {allowed && data && <div className="sales-ai-result" role="status"><h3>Faits de la commande</h3><ul>{data.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul><h3>Analyse IA · démonstration</h3><p>{data.analysis}</p><h3>Risques potentiels</h3><ul>{data.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul><h3>Recommandations</h3><ul>{data.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul></div>}
    </div>
  </section>
}
