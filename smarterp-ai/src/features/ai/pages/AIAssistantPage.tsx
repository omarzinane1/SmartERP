import { useState } from 'react'
import { useBusinessScope } from '../../../hooks/useBusinessScope'
import { Send, Plus, Square, Sparkles } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { BusinessState, Empty, PageHeading, SearchField } from '../../../components/ui/BusinessPresentation'
import { PurchasingNotice } from '../../purchases/components/PurchasingShared'
import { SourceCitationList } from '../../documents/components/DocumentComponents'
import { AIResponse } from '../components/AIResponse'
import { useAIAssistant } from '../hooks/useAIWorkspace'
import '../intelligence.css'

export function AIAssistantPage() {
  const { scope } = useBusinessScope()
  return <AssistantWorkspace key={scope} />
}

function AssistantWorkspace() {
  const q = useAIAssistant(), [selected, setSelected] = useState<string | null>(null), [search, setSearch] = useState(''), [question, setQuestion] = useState(''), [sourceMessage, setSourceMessage] = useState<string | null>(null)
  if (q.isPending || q.isError || !q.data?.permissions.includes('ai.use')) return <BusinessState query={q} permission="ai.use" />
  const d = q.data, conversation = d.conversations.find((c) => c.id === selected) ?? (selected === null ? d.conversations[0] : undefined), stream = q.stream?.conversationId === conversation?.id ? q.stream : null, last = [...(conversation?.messages ?? [])].reverse().find((m) => m.role === 'assistant'), canDocuments = d.permissions.includes('documents.view')
  const busy = q.send.isPending || q.create.isPending, chatDisabled = d.canChat === false
  const send = async () => { if (!question.trim() || busy || chatDisabled) return; const text = question.trim(); try { const target = conversation ?? await q.create.mutateAsync(); setSelected(target.id); q.send.reset(); q.sources.reset(); setSourceMessage(null); await q.send.mutateAsync({ conversationId: target.id, question: text }); setQuestion('') } catch { /* Inline errors preserve the question for retry. */ } }
  const choose = (id: string) => { q.stop(); q.send.reset(); q.sources.reset(); setSourceMessage(null); setSelected(id) }
  const activeSources = sourceMessage === last?.id && q.sources.isSuccess ? q.sources.data : last?.sources ?? []
  return <main className="dashboard-page business-page ops-page"><PageHeading title="AI Assistant" description="Un espace de travail pour examiner les faits, leurs sources et les propositions IA." /><PurchasingNotice demo={q.isDemo} asOf={d.asOf} />{d.policyReason && <p className="business-info">{d.policyReason}</p>}
    <div className="intel-workspace"><aside className="business-card intel-conversations"><Button className="business-button" disabled={busy || chatDisabled} onClick={() => q.create.mutate(undefined, { onSuccess: (c) => choose(c.id) })}><Plus size={14} />Nouvelle conversation</Button><SearchField value={search} onChange={setSearch} placeholder="Rechercher une conversation…" />{d.conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())).map((c) => <button key={c.id} aria-current={c.id === conversation?.id} disabled={busy || chatDisabled} onClick={() => choose(c.id)}>{c.title}</button>)}{!d.conversations.length && <p className="ops-note">Vos conversations apparaîtront ici.</p>}</aside>
      <section className="business-card intel-conversation" aria-label="Conversation"><div className="intel-messages" aria-live="polite" aria-busy={q.send.isPending}>
        {!conversation?.messages.length && !stream && <div className="ops-empty"><Sparkles size={26} className="mx-auto mb-3 text-ai-text" /><h2>Interroger votre activité</h2><p>Choisissez une suggestion ou posez une question.</p><div className="ops-actions mt-4">{['Quelle est la situation de trésorerie ?', 'Quels produits sont en rupture de stock ?'].map((s) => <Button key={s} variant="secondary" className="business-button" disabled={busy || chatDisabled} onClick={() => setQuestion(s)}>{s}</Button>)}</div></div>}
        {conversation?.messages.map((m) => <article className={`intel-message ${m.role}`} key={m.id}><strong>{m.role === 'user' ? 'Vous' : 'SmartERP AI'}</strong>{m.simulated && m.role === 'assistant' && <Badge tone="indigo">Simulation</Badge>}{m.text && <p>{m.text}</p>}{m.role === 'assistant' && <><AIResponse blocks={m.blocks} permissions={d.permissions} /><SourceCitationList sources={sourceMessage === m.id && q.sources.isSuccess ? q.sources.data : m.sources} canDocuments={canDocuments} /><Button variant="ghost" className="business-button" disabled={q.sources.isPending} onClick={() => { setSourceMessage(m.id); q.sources.mutate(m.id) }}>Vérifier les sources</Button>{sourceMessage === m.id && q.sources.isError && <p role="alert">Sources indisponibles. Réessayez leur vérification.</p>}</>}</article>)}
        {stream && <article className="intel-message assistant"><p role="status">{q.send.isPending ? stream.status === 'tool_running' ? `Consultation des données autorisées · ${stream.tool ?? 'outil'}` : 'Réponse en cours…' : 'Réponse interrompue · contenu partiel non validé'}</p><AIResponse blocks={stream.blocks} permissions={d.permissions} interactive={false} /></article>}
      </div><form className="intel-composer" onSubmit={(e) => { e.preventDefault(); void send() }}><label><span className="sr-only">Votre question</span><textarea aria-label="Votre question" value={question} maxLength={4000} rows={3} disabled={busy || chatDisabled} placeholder="Interrogez vos ventes, vos stocks ou votre trésorerie…" onChange={(e) => setQuestion(e.target.value)} /></label><div className="ops-actions mt-2"><Button type="submit" className="business-button" disabled={busy || chatDisabled || !question.trim()}><Send size={14} />Envoyer</Button>{q.send.isPending && <Button className="business-button" variant="secondary" onClick={q.stop}><Square size={12} />Arrêter</Button>}<small>{question.length} / 4000</small></div>{(q.send.isError || q.create.isError) && <p role="alert" className="intel-inline-error">Réponse non finalisée. Votre question est conservée ; vous pouvez réessayer.</p>}<p className="ops-note">Les propositions sensibles nécessitent une décision humaine. Les outils et les sources restent soumis à vos droits.</p></form></section>
      <aside className="business-card intel-context"><h2>Contexte et sources</h2><h3 className="font-semibold">Outils disponibles</h3>{d.availableTools.map((t) => <p key={t.id} className="mt-2">{t.label}</p>)}<h3 className="font-semibold mt-5">Dernière réponse</h3>{last ? <><p>Période : {last.period ?? 'non précisée'}</p><p>Outils utilisés : {last.tools.filter((t) => d.availableTools.some((a) => a.id === t)).join(', ') || 'aucun outil autorisé déclaré'}</p><SourceCitationList sources={activeSources} canDocuments={canDocuments} /></> : <Empty />}<p className="ops-note">FACT : faits ERP. AI ANALYSIS : interprétation. FORECAST : projection. RECOMMENDATION : proposition à examiner.</p></aside>
    </div></main>
}
