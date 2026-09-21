import { useEffect, useRef } from 'react'
import { ClipboardCheck, ShieldCheck, X } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type { SuggestedAction } from '../types/aiControlCenter.types'

export function RecommendedActions({
  actions,
  onReview,
  governance = false,
}: {
  actions: SuggestedAction[]
  onReview: (action: SuggestedAction) => void
  governance?: boolean
}) {
  const Icon = governance ? ShieldCheck : ClipboardCheck
  return (
    <section
      className="dashboard-card p-4"
      aria-label={
        governance ? 'Décisions sous gouvernance' : 'Actions recommandées'
      }
    >
      <h2 className="dashboard-title flex items-center gap-2">
        <Icon
          className={`size-3.5 ${
            governance ? 'text-rose-500' : 'text-blue-600'
          }`}
        />
        {governance ? 'Décisions sous gouvernance' : 'Actions recommandées'}
      </h2>
      <p className="dashboard-caption">
        RECOMMENDATION ·{' '}
        {governance
          ? 'Validation humaine avant toute exécution.'
          : 'Prochaines étapes proposées par SmartERP AI.'}
      </p>
      <div
        className={
          governance ? 'mt-3 space-y-2' : 'mt-3 grid gap-3 md:grid-cols-3'
        }
      >
        {actions.map((action, index) => (
          <article
            key={action.id}
            className="flex flex-col items-start rounded border border-slate-200 bg-[#fafbff] p-3"
          >
            <h3 className="text-[11px] font-semibold">
              {!governance && `${index + 1}. `}
              {action.title}
            </h3>
            <p className="mb-2 mt-1 text-[10px] text-slate-500">
              {action.detail}
            </p>
            {action.approvalRequired && (
              <Badge tone="warning" className="mb-2 text-[8px]">
                <ShieldCheck className="size-2.5" />
                Approval Required
              </Badge>
            )}
            <button
              type="button"
              onClick={() => onReview(action)}
              className="mt-auto text-[10px] font-medium text-blue-600 hover:underline"
            >
              {action.button} →
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ActionReview({
  action,
  isDemo,
  saved,
  onClose,
  onSave,
}: {
  action: SuggestedAction
  isDemo: boolean
  saved: boolean
  onClose: () => void
  onSave: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      dialog?.close()
      previousFocus?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="action-review-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="acc-review m-auto w-[calc(100%-32px)] max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-[#35465f] shadow-xl backdrop:bg-slate-950/30"
    >
      <div className="flex items-center justify-between">
        <Badge tone="indigo">RECOMMENDATION</Badge>
        <button
          type="button"
          aria-label="Fermer la proposition"
          onClick={onClose}
          className="rounded p-1 text-slate-400"
        >
          <X className="size-5" />
        </button>
      </div>
      <h2
        id="action-review-title"
        className="mt-4 text-lg font-semibold text-navy-950"
      >
        {action.title}
      </h2>
      <p className="mt-2 text-xs text-slate-500">{action.detail}</p>
      <ul className="my-5 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-600">
        {action.draft.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {action.approvalRequired && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <Badge tone="warning">
            <ShieldCheck className="size-3" />
            Approval Required
          </Badge>
          <p className="mt-2 text-xs leading-5 text-amber-800">
            Cette proposition nécessite la validation d’un responsable.
            Enregistrer un brouillon ne déclenche aucune opération ERP.
          </p>
        </div>
      )}
      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        {isDemo
          ? 'Démonstration : le brouillon reste dans cette session. Aucun envoi, paiement ou changement métier ne sera effectué.'
          : 'La création de brouillons sera disponible après connexion de l’API d’action Django.'}
      </p>
      {saved && (
        <p role="status" className="mt-3 text-xs font-medium text-emerald-700">
          Brouillon enregistré dans cette session · en attente de validation.
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          className="min-h-9 rounded text-xs"
          onClick={onClose}
        >
          Fermer
        </Button>
        <Button
          className="min-h-9 rounded text-xs"
          disabled={!isDemo || saved}
          onClick={onSave}
        >
          {saved ? 'Brouillon enregistré' : 'Enregistrer le brouillon (démo)'}
        </Button>
      </div>
    </dialog>
  )
}
