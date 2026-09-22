import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Menu,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuthStore } from '../../store/auth.store'

export function Topbar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const { pathname } = useLocation()
  const user = useAuthStore((state) => state.user)
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const aiPage = pathname.startsWith('/ai/')
  const customersPage = pathname.startsWith('/customers')
  const initials =
    user?.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  return (
    <header className="sticky top-0 z-20 flex h-[62px] min-w-0 items-center gap-3 border-b border-[#e4e9f2] bg-white px-4 lg:px-6">
      <button
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
        onClick={onToggleSidebar}
        className="rounded p-1.5 text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <nav
        aria-label="Fil d’Ariane"
        className="hidden shrink-0 items-center gap-1.5 text-[10px] sm:flex"
      >
        <span className="text-slate-400">
          {aiPage
            ? 'Intelligence'
            : customersPage
            ? 'Ventes'
            : 'Vue d’ensemble'}
        </span>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-navy-950">
          {aiPage
            ? 'AI Control Center'
            : customersPage
            ? 'Customers'
            : 'Tableau de bord'}
        </span>
      </nav>
      <form
        role="search"
        className="min-w-0 flex-1 lg:max-w-[330px]"
        onSubmit={(event) => {
          event.preventDefault()
          toast.info(
            'La recherche globale sera disponible avec les prochains modules.',
          )
        }}
      >
        <Input
          ref={searchRef}
          aria-label="Recherche globale"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher clients, factures, produits…"
          className="h-8 rounded-md border-[#e4e9f2] pl-8 text-[10px] shadow-none [&::placeholder]:text-slate-400"
          leadingIcon={<Search className="size-3" />}
          trailingContent={
            <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] text-slate-400 xl:block">
              Ctrl K
            </kbd>
          }
        />
      </form>
      <Button
        className="hidden min-h-8 shrink-0 rounded-md px-3 text-[10px] sm:inline-flex"
        onClick={() =>
          toast.info(
            'Retrouvez les créations disponibles prochainement dans les actions rapides du tableau de bord.',
          )
        }
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Créer
      </Button>
      <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-slate-100 pl-2">
        <button
          type="button"
          aria-label="SmartERP AI"
          className="topbar-icon hidden text-blue-600 sm:grid"
          onClick={() =>
            toast.info(
              'L’assistant IA sera disponible dans une prochaine étape.',
            )
          }
        >
          <Sparkles className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="topbar-icon"
          onClick={() =>
            toast.info(
              'Les notifications seront connectées aux prochains modules métier.',
            )
          }
        >
          <Bell className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Aide"
          className="topbar-icon hidden sm:grid"
          onClick={() =>
            toast.info('Contactez votre administrateur pour obtenir de l’aide.')
          }
        >
          <CircleHelp className="size-4" />
        </button>
      </div>
      <button
        type="button"
        className="flex min-w-0 shrink-0 items-center gap-2 rounded-md py-1 text-left focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Profil de ${user?.name || 'l’utilisateur'}`}
        onClick={() => toast.info(`${user?.name} · ${user?.email}`)}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#18345e] text-[10px] font-semibold text-white">
          {initials}
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block max-w-28 truncate text-[10px] font-semibold text-navy-950">
            {user?.name}
          </span>
          <span className="block text-[9px] text-slate-400">
            {user?.role === 'admin' ? 'Administrateur' : user?.role}
          </span>
        </span>
        <ChevronDown
          className="hidden size-3 text-slate-400 lg:block"
          aria-hidden="true"
        />
      </button>
    </header>
  )
}
