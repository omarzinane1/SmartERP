import {
  Archive,
  Download,
  MoreHorizontal,
  Plus,
  Tag,
  UserRoundCheck,
  X,
} from 'lucide-react'
import type { Customer, CustomerAction } from '../types/customers.types'

export function CustomerSelectionBar({
  selected,
  hiddenCount,
  canEdit,
  canExport,
  canCreate,
  onClear,
  onExport,
  onArchive,
  onAction,
}: {
  selected: Customer[]
  hiddenCount: number
  canEdit: boolean
  canExport: boolean
  canCreate: boolean
  onClear: () => void
  onExport: () => void
  onArchive: () => void
  onAction: (action: CustomerAction) => void
}) {
  if (!selected.length) return null
  return (
    <section
      aria-label="Actions sur la sélection"
      className="customers-selection-bar"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2" role="status">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-blue-600 text-[10px] font-semibold">
          {selected.length}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold">
            {selected.length === 1
              ? `Client sélectionné : ${selected[0].name}`
              : `${selected.length} clients sélectionnés`}
          </p>
          {hiddenCount > 0 && (
            <p className="mt-0.5 text-[8px] text-slate-400">
              Dont {hiddenCount} hors de cette page
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onAction('assign')}
          disabled={!canEdit}
        >
          <UserRoundCheck className="size-3" />
          Assigner
        </button>
        <button type="button" onClick={onExport} disabled={!canExport}>
          <Download className="size-3" />
          Exporter
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={!canEdit}
          className="text-amber-300"
        >
          <Archive className="size-3" />
          Archiver
        </button>
        <button
          type="button"
          onClick={() => onAction('tag')}
          disabled={!canEdit}
        >
          <Tag className="size-3" />
          Ajouter un tag
        </button>
        {selected.length === 1 && (
          <details className="customers-menu relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded border border-white/10 px-2 py-1.5 text-[9px]">
              <MoreHorizontal className="size-3.5" />
              Plus
            </summary>
            <div className="customers-menu-panel bottom-full right-0 mb-2 text-slate-600">
              <button type="button" onClick={() => onAction('statement')}>
                Préparer un relevé
              </button>
              <button type="button" onClick={() => onAction('reminder')}>
                Préparer une relance
              </button>
              <button
                type="button"
                onClick={() => onAction('quote')}
                disabled={!canCreate}
              >
                <Plus className="size-3" />
                Créer un devis
              </button>
            </div>
          </details>
        )}
        <button
          type="button"
          aria-label="Effacer la sélection"
          title="Effacer la sélection"
          onClick={onClear}
          className="border-transparent! px-1!"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </section>
  )
}
