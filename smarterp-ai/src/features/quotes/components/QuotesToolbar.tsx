import { Download, LayoutGrid, List, MoreHorizontal, Plus, RefreshCw, Search } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type { QuoteView } from '../types/quotes.types'

interface Props {
  search: string; onSearch: (search: string) => void
  view: QuoteView; onView: (view: QuoteView) => void
  canCreate: boolean; canExport: boolean; hasResults: boolean
  refreshing: boolean; onRefresh: () => void; onReset: () => void
  onCreate: () => void; onExport: () => void
}
export function QuotesToolbar(props: Props) {
  return <div className="quotes-toolbar">
    {props.canCreate && <Button className="quotes-button quotes-primary" onClick={props.onCreate}><Plus className="size-3.5" />Créer un devis</Button>}
    <div className="min-w-48 flex-1">
      <Input aria-label="Rechercher un devis" placeholder="Rechercher un devis, un client ou une référence…" value={props.search}
        onChange={(event) => props.onSearch(event.target.value)} leadingIcon={<Search className="size-3.5" />}
        className="h-8 rounded border-slate-200 pl-8 text-[11px] shadow-none" />
    </div>
    {props.canExport && <Button className="quotes-button" variant="secondary" disabled={!props.hasResults} onClick={props.onExport}><Download className="size-3.5" />Exporter</Button>}
    <details className="quotes-menu">
      <summary className="quotes-menu-trigger"><MoreHorizontal className="size-3.5" />Plus</summary>
      <div className="quotes-menu-panel right-0">
        <button type="button" disabled={props.refreshing} onClick={props.onRefresh}><RefreshCw className="size-3.5" />Actualiser les devis</button>
        <button type="button" onClick={props.onReset}>Réinitialiser les filtres</button>
      </div>
    </details>
    <div className="quotes-view-switch" role="group" aria-label="Affichage des devis">
      <button type="button" aria-label="Vue Liste" title="Vue Liste" aria-pressed={props.view === 'list'} onClick={() => props.onView('list')}><List className="size-4" /></button>
      <button type="button" aria-label="Vue Kanban" title="Vue Kanban" aria-pressed={props.view === 'kanban'} onClick={() => props.onView('kanban')}><LayoutGrid className="size-4" /></button>
    </div>
  </div>
}
