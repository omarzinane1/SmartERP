import { useState } from 'react'
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { formatCurrency, formatDate, formatPercentage } from '../../../lib/format'
import type { CustomerAIInsight as AIInsight, CustomerSummary } from '../types/customers.types'

export function CustomerAIInsight({ insight, summary, allowed, loading, error, isDemo, onRequest }: {
  insight?: AIInsight | null; summary?: CustomerSummary; allowed: boolean; loading: boolean; error: boolean; isDemo: boolean; onRequest: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const money = (value: number | null | undefined) => value == null ? '—' : formatCurrency(value)
  return <section className="customer-ai-panel" aria-label="Analyse client SmartERP AI" aria-busy={allowed && loading}>
    <header><div><Sparkles size={16} /><div><h2>Analyse client</h2><p>SmartERP AI <span>· AI ANALYSIS</span></p></div></div><Badge tone="indigo">{allowed && insight ? `Confiance ${insight.confidence} %` : 'AI'}</Badge></header>
    {!allowed ? <div className="customer-restricted">Restricted <span>Accès IA et données financières requis.</span></div> : <>
      {isDemo && <p className="customer-ai-demo">Analyse de démonstration · Données fictives</p>}
      {loading && <div role="status" className="customer-ai-loading"><RefreshCw size={14} className="animate-spin motion-reduce:animate-none" />Analyzing customer data...</div>}
      {error ? <p role="alert" className="customer-ai-error">L’analyse est indisponible. Réessayez.</p> : insight ? <>
        <p className="customer-ai-summary">{insight.summary}</p>
        <div className="customer-ai-block"><h3><span className="customer-ai-dot" />FACT · Faits observés</h3><dl className="customer-ai-facts"><div><dt>CA annuel</dt><dd>{money(summary?.revenue)}</dd></div><div><dt>Encours</dt><dd>{money(summary?.outstanding)}</dd></div><div><dt>Délai paiement</dt><dd>{summary?.paymentDelay == null ? '—' : `${summary.paymentDelay} jours`}</dd></div><div><dt>Croissance achats</dt><dd>{summary?.revenueGrowth == null ? '—' : `+${formatPercentage(summary.revenueGrowth)}`}</dd></div><div><dt>Marge brute</dt><dd>{summary?.profitability == null ? '—' : formatPercentage(summary.profitability)}</dd></div></dl></div>
        <div className="customer-ai-block customer-ai-block--analysis"><h3>AI ANALYSIS · Comportement</h3><p>{insight.analysis}</p></div>
        <div className="customer-ai-block customer-ai-block--risk"><h3>AI ANALYSIS · Risque paiement <Badge tone="warning">{{ Low: 'Faible', Medium: 'Moyen', High: 'Élevé' }[insight.risk.level]}</Badge></h3><ul>{insight.risk.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></div>
        <div className="customer-ai-block customer-ai-block--forecast"><h3>FORECAST · Opportunité commerciale</h3><strong>{formatCurrency(insight.opportunity.value)} <small>potentiel estimé</small></strong><p>{insight.opportunity.evidence}</p></div>
        <div className="customer-ai-block"><h3>RECOMMENDATION · Actions proposées</h3><ol>{insight.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ol></div>
        {expanded && <div className="customer-ai-sources"><h3>Sources & périmètre de l’analyse</h3><ul>{insight.sources.map((source) => <li key={source}>{source}</li>)}</ul><p>Instantané du {formatDate(insight.generatedAt.slice(0, 10))}. Le potentiel commercial est une estimation, sans garantie de réalisation. Les recommandations restent à examiner par l’équipe.</p></div>}
      </> : !loading && <p className="customer-detail-empty">Aucune analyse disponible pour ce client.</p>}
      <footer><Button className="customer-detail-button customer-ai-request" disabled={loading} onClick={onRequest}><Sparkles size={12} />Demander une analyse IA</Button><button className="customer-detail-link" disabled={!insight || error} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Réduire l’analyse' : 'Voir analyse complète'}<ChevronDown size={12} /></button></footer>
    </>}
  </section>
}
