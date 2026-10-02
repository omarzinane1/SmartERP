import { useEffect, useRef, useState } from 'react'
import {
  BrainCircuit,
  Check,
  ExternalLink,
  FileText,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import {
  intelligenceLabels,
  severityLabels,
  severityTones,
  statusLabels,
} from '../types/aiControlCenter.types'
import type {
  AIAlert,
  Evidence,
  SuggestedAction,
} from '../types/aiControlCenter.types'

export function AlertDetailDrawer({
  alert,
  assignees,
  isDemo,
  asOf,
  onClose,
  onAssign,
  onResolve,
  onReview,
}: {
  alert: AIAlert
  assignees: string[]
  isDemo: boolean
  asOf: string
  onClose: () => void
  onAssign: (name: string) => void
  onResolve: () => void
  onReview: (action: SuggestedAction) => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  const analysisRef = useRef<HTMLDivElement>(null)
  const evidenceRef = useRef<HTMLDivElement>(null)
  const [assigning, setAssigning] = useState(false)
  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 1023px)').matches,
  )
  const minutesAgo = Math.max(
    0,
    Math.floor((Date.parse(asOf) - Date.parse(alert.detectedAt)) / 60000),
  )
  const detectedAgo =
    minutesAgo < 60
      ? `${minutesAgo} min`
      : minutesAgo < 1440
      ? `${Math.floor(minutesAgo / 60)} h`
      : `${Math.floor(minutesAgo / 1440)} j`

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    if (mobile) {
      document.body.style.overflow = 'hidden'
      panelRef.current?.focus()
    }
    function handleKey(event: KeyboardEvent) {
      // Un dialogue de proposition possède son propre focus et sa propre touche Échap.
      if (document.querySelector('dialog[open]')) return
      if (event.key === 'Escape') onClose()
      if (!mobile || event.key !== 'Tab') return
      const controls = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select, a[href], [tabindex="0"]',
      )
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panelRef.current)
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === panelRef.current)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      if (mobile) {
        document.body.style.overflow = previousOverflow
        previousFocus?.focus()
      }
    }
  }, [mobile, onClose])

  return (
    <aside
      ref={panelRef}
      id="alert-detail"
      tabIndex={-1}
      role={mobile ? 'dialog' : 'complementary'}
      aria-modal={mobile || undefined}
      aria-labelledby="alert-detail-title"
      className="acc-drawer dashboard-card min-w-0 border-ai-border p-4 outline-none"
    >
      <header>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={severityTones[alert.severity]}>
            {severityLabels[alert.severity]}
          </Badge>
          <Badge tone="neutral">{alert.department}</Badge>
          <Badge tone={alert.status === 'resolved' ? 'positive' : 'info'}>
            {statusLabels[alert.status]}
          </Badge>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le détail de l’alerte"
            className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2
          id="alert-detail-title"
          className="mt-2.5 text-[14px] font-semibold leading-5 text-navy-950"
        >
          {alert.title}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-slate-400">
          <span>Confiance {alert.confidence} %</span>
          <time dateTime={alert.detectedAt} title={alert.detectedAt}>
            Détectée il y a {detectedAgo} ·{' '}
            {new Date(alert.detectedAt).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'UTC',
            })}{' '}
            UTC
          </time>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="acc-button"
            onClick={() => setAssigning(!assigning)}
            aria-expanded={assigning}
            disabled={!isDemo || alert.status === 'resolved'}
          >
            <UserRound className="size-3" />
            {alert.assignee ? alert.assignee.split(' ')[0] : 'Assigner'}
          </Button>
          <Button
            variant="secondary"
            className="acc-button text-success-text"
            onClick={onResolve}
            disabled={!isDemo || alert.status === 'resolved'}
          >
            <Check className="size-3" />
            {alert.status === 'resolved' ? 'Résolue' : 'Résoudre'}
          </Button>
          <Button
            variant="secondary"
            className="acc-button text-ai-text"
            onClick={() => {
              analysisRef.current?.scrollIntoView({
                block: 'center',
                behavior: 'smooth',
              })
              analysisRef.current?.focus({ preventScroll: true })
            }}
          >
            <BrainCircuit className="size-3" />
            Demander à l’IA
          </Button>
          <Button
            variant="secondary"
            className="acc-button"
            onClick={() =>
              evidenceRef.current?.scrollIntoView({
                block: 'center',
                behavior: 'smooth',
              })
            }
          >
            <ExternalLink className="size-3" />
            Données liées
          </Button>
        </div>
        {assigning && (
          <label className="mt-3 block text-[10px]">
            Responsable
            <select
              aria-label="Responsable de l’alerte"
              className="acc-select mt-1 w-full"
              value={alert.assignee || ''}
              onChange={(event) => {
                if (event.target.value) {
                  onAssign(event.target.value)
                  setAssigning(false)
                }
              }}
            >
              <option value="">Choisir un responsable</option>
              {assignees.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-2 text-[8px] text-slate-400">
          {isDemo
            ? 'Assignation et résolution simulées pour cette session.'
            : 'Assignation et résolution disponibles après connexion des API d’action.'}
        </p>
      </header>

      <section
        className="mt-4 rounded border border-slate-200 bg-[var(--surface-1)] p-3"
        aria-labelledby="alert-facts-title"
      >
        <h3 id="alert-facts-title" className="acc-section-label text-slate-600">
          FACT · Faits observés {isDemo ? '(démonstration)' : '(ERP)'}
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
          {alert.facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-[9px] leading-4 text-slate-400">
                {fact.label}
              </dt>
              <dd className="mt-0.5 font-mono text-[11px] font-semibold text-slate-700">
                {fact.value}
              </dd>
              {fact.note && (
                <dd className="mt-0.5 text-[8px] text-slate-400">
                  {fact.note}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </section>

      <div
        ref={analysisRef}
        tabIndex={-1}
        className="mt-3 scroll-mt-20 rounded border border-ai-border bg-ai-soft/60 p-3 focus-visible:ring-2 focus-visible:ring-ai-border"
      >
        <h3 className="acc-section-label flex items-center gap-1 text-ai-text">
          <BrainCircuit className="size-3" />
          AI ANALYSIS · Diagnostic
        </h3>
        <p className="mt-2 text-[10px] leading-[1.7] text-slate-600">
          {alert.analysis}
        </p>
        <p className="mt-2 text-[9px] font-medium text-ai-text">
          Confiance {alert.confidence} % · Hypothèse à vérifier
        </p>
      </div>

      <section className="mt-4" aria-label="Causes probables">
        <h3 className="acc-section-label">
          Causes probables hiérarchisées{' '}
          <span className="font-normal text-ai-text">· AI ANALYSIS</span>
        </h3>
        <ol className="mt-2 space-y-2">
          {alert.causes.map((cause, index) => (
            <li
              key={cause.title}
              className="flex gap-2 rounded border border-slate-100 bg-slate-50/60 p-2.5"
            >
              <span className="grid size-4 shrink-0 place-items-center rounded bg-ai-soft text-[9px] text-ai-text">
                {index + 1}
              </span>
              <div>
                <p className="text-[10px] font-semibold">{cause.title}</p>
                <p className="mt-1 text-[9px] leading-4 text-slate-500">
                  Preuve : {cause.evidence}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4" aria-label="Impact prévisionnel">
        <h3 className="acc-section-label text-warning-text">
          FORECAST / ESTIMATE · Impact potentiel
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 rounded border border-slate-200 bg-[var(--surface-1)] p-3">
          {alert.estimates.map((estimate) => (
            <div key={estimate.label}>
              <dt className="text-[9px] leading-4 text-slate-400">
                {estimate.label}
              </dt>
              <dd className="mt-1 font-mono text-[11px] font-semibold text-danger-text">
                {estimate.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-4" aria-label="Recommandations pour cette alerte">
        <h3 className="acc-section-label text-success-text">
          RECOMMENDATION · Actions proposées
        </h3>
        <ol className="mt-2 space-y-2">
          {alert.recommendations.map((action, index) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onReview(action)}
                className="w-full rounded border border-ai-border bg-ai-soft/40 p-2.5 text-left hover:border-ai-border"
              >
                <span className="block text-[10px] font-semibold">
                  {index + 1}. {action.title}
                </span>
                <span className="mt-1 block text-[9px] text-slate-500">
                  {action.detail}
                </span>
                {action.approvalRequired && (
                  <Badge tone="warning" className="mt-1.5 text-[8px]">
                    <ShieldCheck className="size-2.5" />
                    Approval Required
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div
        ref={evidenceRef}
        className="mt-4 scroll-mt-20 border-t border-slate-100 pt-3"
      >
        <h3 className="acc-section-label flex items-center gap-1.5">
          <FileText className="size-3" />
          Pièces ERP liées · traçabilité
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {alert.evidence.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-label={`Ouvrir ${item.id}`}
              onClick={() => setEvidence(item)}
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1 font-mono text-[9px] text-slate-600 hover:border-ai-border hover:text-ai-text"
            >
              {item.id}
            </button>
          ))}
        </div>
        {evidence && (
          <div
            role="status"
            className="mt-2 rounded border border-ai-border bg-ai-soft p-3 text-[10px]"
          >
            <p className="font-semibold">
              {evidence.kind} · {evidence.id}
            </p>
            <p className="mt-1 leading-4">{evidence.description}</p>
            <p className="mt-2 text-[9px] text-slate-500">
              Aperçu {isDemo ? 'de démonstration' : 'de la preuve'}. L’ouverture
              du document complet nécessite le module métier.
            </p>
          </div>
        )}
      </div>
      <p className="mt-3 text-[8px] text-slate-400">
        Type de signal : {intelligenceLabels[alert.type]} · L’IA propose, vous
        validez.
      </p>
    </aside>
  )
}
