import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { Dialog } from '../../../components/ui/Dialog'
import { BusinessState, Empty, PageHeading, SearchField, SelectFilter } from '../../../components/ui/BusinessPresentation'
import { CollectionPagination } from '../../../components/ui/CollectionPagination'
import { PurchasingNotice } from '../../purchases/components/PurchasingShared'
import { SourceCitationList } from '../../documents/components/DocumentComponents'
import { useAIOpportunities } from '../hooks/useAIWorkspace'
import { opportunityTypes, opportunityStatuses, opportunityPriorities, opportunityActions, opportunityValue, opportunityValueLabel } from '../opportunityPresentation'
import type { OpportunityFilters } from '../types/ai.types'
import '../intelligence.css'

const choices = (values: Record<string, string>) => Object.entries(values).map(([value, label]) => ({ value, label }))
const date = (value: string) => new Date(value).toLocaleString('fr-FR')

export function AIOpportunitiesPage() {
  const [params, setParams] = useSearchParams()
  const rawId = params.get('opportunity'), selected = rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : null
  const [filters, setFilters] = useState<OpportunityFilters>({ type: '', status: '', priority: '', domain: '', search: '', date_from: '', date_to: '', page: 1, page_size: 25 })
  const q = useAIOpportunities(filters, selected)
  const filter = (name: keyof OpportunityFilters, value: string) => setFilters((f) => ({ ...f, [name]: value, page: 1 }))
  const close = () => { setParams({}); q.action.reset() }
  if (q.isPending || q.isError || !q.data?.permissions.includes('ai.opportunities.view')) return <BusinessState query={q} permission="ai.opportunities.view" />
  const d = q.data, detail = q.detail.data, busy = q.refresh.isPending || ['pending', 'running'].includes(d.lastRun?.status ?? '')
  return <main className="dashboard-page business-page ops-page">
    <PageHeading title="Opportunités IA" description="Des pistes commerciales et opérationnelles fondées sur des éléments vérifiables." />
    <PurchasingNotice demo={false} asOf={d.asOf} />
    <div className="ops-actions"><Button className="business-button" disabled={busy || !d.availableTypes.length} onClick={() => q.refresh.mutate()}>{busy ? 'Analyse en cours…' : 'Actualiser les opportunités'}</Button></div>
    {q.refresh.isError && <p role="alert">Analyse non lancée. Vérifiez vos droits ou attendez la fin de l’analyse en cours.</p>}
    {d.lastRun?.status === 'failed' && <p role="alert">{d.lastRun.errorMessage ?? 'Analyse indisponible. Réessayez.'}</p>}
    {d.lastRun?.completedAt && <p className="ops-note">Dernière analyse : {date(d.lastRun.completedAt)}</p>}
    <section className="business-card"><div className="ops-controls">
      <SearchField value={filters.search} onChange={(v) => filter('search', v)} placeholder="Rechercher une opportunité…" />
      <SelectFilter label="Type" value={filters.type} onChange={(v) => filter('type', v)} options={choices(opportunityTypes).filter((o) => d.availableTypes.includes(o.value as keyof typeof opportunityTypes))} />
      <SelectFilter label="Statut" value={filters.status} onChange={(v) => filter('status', v)} options={choices(opportunityStatuses)} />
      <SelectFilter label="Priorité" value={filters.priority} onChange={(v) => filter('priority', v)} options={choices(opportunityPriorities)} />
      <SelectFilter label="Domaine" value={filters.domain} onChange={(v) => filter('domain', v)} options={choices({ sales: 'Ventes', finance: 'Finance', inventory: 'Stock' })} />
      <label className="ops-filter">Du<input type="date" value={filters.date_from} onChange={(e) => filter('date_from', e.target.value)} /></label>
      <label className="ops-filter">Au<input type="date" value={filters.date_to} onChange={(e) => filter('date_to', e.target.value)} /></label>
    </div>
      {!d.opportunities.length ? <Empty filtered={!!(filters.search || filters.type || filters.status || filters.domain || filters.priority || filters.date_from || filters.date_to)} /> : <div className="ops-card-grid p-4">{d.opportunities.map((o) => <article key={o.id} className="business-card ops-section">
        <Badge tone="indigo">{opportunityTypes[o.type]}</Badge><h2 className="my-3">{o.title}</h2>
        <p>{opportunityValueLabel(o)} : <strong>{opportunityValue(o)}</strong></p>
        <p>Priorité : {opportunityPriorities[o.priority]}</p><p className="my-3">{o.reason}</p><p>{o.recommendation}</p>
        <small>{opportunityStatuses[o.status]}</small><div className="ops-actions mt-3"><Button className="business-button" variant="secondary" onClick={() => { q.action.reset(); setParams({ opportunity: String(o.id) }) }}>Examiner</Button></div>
      </article>)}</div>}
      <CollectionPagination page={filters.page} pageSize={filters.page_size} count={d.count} onPage={(page) => setFilters((f) => ({ ...f, page }))} onPageSize={(page_size) => setFilters((f) => ({ ...f, page_size, page: 1 }))} />
    </section>
    {selected !== null && <Dialog title={detail?.title ?? 'Opportunité'} className="business-dialog ops-drawer" onClose={close}>
      {q.detail.isPending && <p role="status">Chargement…</p>}
      {q.detail.isError && <p role="alert">Opportunité indisponible. <Button onClick={() => q.detail.refetch()}>Réessayer</Button></p>}
      {detail && !q.detail.isError && <>
        <Badge tone="indigo">{opportunityTypes[detail.type]}</Badge><p>{opportunityStatuses[detail.status]} · Priorité {opportunityPriorities[detail.priority]}</p>
        <h3 className="font-semibold mt-4">Faits observés</h3><p>{detail.reason}</p>
        <SourceCitationList sources={detail.evidence} canDocuments={d.permissions.includes('documents.view')} />
        <h3 className="font-semibold mt-4">Recommandation</h3><p>{detail.recommendation}</p>
        <p>{opportunityValueLabel(detail)} : {opportunityValue(detail)}</p><p>Confiance : non applicable à cette règle.</p>
        <p className="ops-note">Source : {detail.source === 'rule_based' ? 'Règle métier' : 'Analyse ERP'} · {detail.detector} · {detail.version}</p>
        <details className="mt-4"><summary>Mesures justificatives</summary><dl>{Object.entries(detail.metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details>
        <p className="ops-note">Détectée le {date(detail.detectedAt)} · Vérifiée le {date(detail.lastSeenAt)} · Validité jusqu’au {date(detail.expiresAt)}</p>
        {detail.acknowledgedAt && <p>Prise en charge le {date(detail.acknowledgedAt)}</p>}
        {detail.completedAt && <p>Terminée le {date(detail.completedAt)}</p>}
        {detail.dismissedAt && <p>Écartée le {date(detail.dismissedAt)}</p>}
        {q.action.isError && <p role="alert">Action non confirmée : vérifiez les droits, le statut ou la validité de l’opportunité.</p>}
        <div className="ops-actions mt-3">{detail.actions.map((action) => <Button key={action} className="business-button" variant="secondary" disabled={q.action.isPending} onClick={() => q.action.mutate({ id: detail.id, action }, { onSuccess: () => toast.success('Statut enregistré') })}>{opportunityActions[action]}</Button>)}</div>
        <p className="ops-note">Ces statuts suivent votre revue. Les opérations commerciales restent à effectuer dans leur écran métier.</p>
      </>}
    </Dialog>}
  </main>
}
