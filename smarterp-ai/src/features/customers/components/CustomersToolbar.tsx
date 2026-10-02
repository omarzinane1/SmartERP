import {
  Archive,
  ArchiveRestore,
  Download,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  UserRoundCheck,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { cn } from '../../../lib/cn'
import type { CustomerView } from '../types/customers.types'

export function CustomersToolbar({
  search,
  onSearch,
  viewMode,
  onView,
  selectedCount,
  canCreate,
  canEdit,
  canExport,
  onCreate,
  onImport,
  onExport,
  onArchive,
  onAssign,
}: {
  search: string
  onSearch: (value: string) => void
  viewMode: CustomerView
  onView: (view: CustomerView) => void
  selectedCount: number
  canCreate: boolean
  canEdit: boolean
  canExport: boolean
  onCreate: () => void
  onImport: () => void
  onExport: () => void
  onArchive: (archive: boolean) => void
  onAssign: () => void
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3"
      aria-label="Outils clients"
    >
      <Button
        className="customers-button"
        onClick={onCreate}
        disabled={!canCreate}
      >
        <Plus className="size-3.5" />
        Nouveau client
      </Button>
      <Button
        variant="secondary"
        className="customers-button"
        onClick={onImport}
        disabled={!canCreate}
      >
        <Upload className="size-3" />
        Importer
      </Button>
      <Button
        variant="secondary"
        className="customers-button"
        onClick={onExport}
        disabled={!canExport}
      >
        <Download className="size-3" />
        Exporter
      </Button>
      <details className="customers-menu relative">
        <summary className="customers-menu-trigger">
          <MoreHorizontal className="size-3.5" />
          Actions groupées
        </summary>
        <div className="customers-menu-panel">
          <button
            type="button"
            disabled={!canEdit || !selectedCount}
            onClick={() => onArchive(true)}
          >
            <Archive className="size-3.5" />
            Archiver la sélection
          </button>
          <button
            type="button"
            disabled={!canEdit || !selectedCount}
            onClick={() => onArchive(false)}
          >
            <ArchiveRestore className="size-3.5" />
            Désarchiver la sélection
          </button>
          <button
            type="button"
            disabled={!canEdit || !selectedCount}
            onClick={onAssign}
          >
            <UserRoundCheck className="size-3.5" />
            Assigner un commercial
          </button>
          <button
            type="button"
            disabled
            title="La suppression sera disponible avec le module métier."
          >
            Supprimer · à venir
          </button>
        </div>
      </details>
      <div className="min-w-[210px] flex-1">
        <Input
          aria-label="Rechercher des clients"
          placeholder="Rechercher par nom, email, téléphone, société, ville…"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          leadingIcon={<Search className="size-3.5" />}
          className="h-8 rounded border-[var(--border)] pl-9 text-[10px] shadow-none"
        />
      </div>
      <div
        className="flex shrink-0 rounded border border-slate-200 p-0.5"
        aria-label="Mode d’affichage"
      >
        <button
          type="button"
          aria-label="Vue liste"
          aria-pressed={viewMode === 'list'}
          onClick={() => onView('list')}
          className={cn(
            'rounded px-2 py-1.5',
            viewMode === 'list' ? 'bg-primary-soft text-primary-text' : 'text-slate-400',
          )}
        >
          <List className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Vue Kanban"
          aria-pressed={viewMode === 'kanban'}
          onClick={() => onView('kanban')}
          className={cn(
            'rounded px-2 py-1.5',
            viewMode === 'kanban'
              ? 'bg-primary-soft text-primary-text'
              : 'text-slate-400',
          )}
        >
          <LayoutGrid className="size-4" />
        </button>
      </div>
    </div>
  )
}
