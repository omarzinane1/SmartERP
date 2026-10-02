import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
import { env } from '../../config/env'
import { useLogout } from '../../features/auth/hooks/useLogout'

export function Topbar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const { pathname } = useLocation()
  const { signOut, isPending: logoutPending } = useLogout()
  const navigate = useNavigate(), [profileMenu, setProfileMenu] = useState(false), profileMenuRef = useRef<HTMLDivElement>(null)
  const user = useAuthStore((state) => state.user)
  const company = useAuthStore((state) => state.company)
  const canAssistant = (user?.permissions ? user.permissions.includes('ai.use') : env.aiWorkspaceUseMock) && (!company?.enabledModules || company.enabledModules.includes('ai_assistant'))
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const aiPage = pathname.startsWith('/ai/')
  const customersPage = pathname.startsWith('/customers')
  const quotesPage = pathname.startsWith('/quotes')
  const salesPage = pathname.startsWith('/sales')
  const invoicesPage = pathname.startsWith('/invoices')
  const paymentsPage = pathname.startsWith('/payments')
  const purchasesPage = pathname.startsWith('/purchases')
  const supplierInvoicesPage = pathname.startsWith('/supplier-invoices')
  const suppliersPage = pathname.startsWith('/suppliers')
  const stockPage = /^\/(products|inventory|warehouses)(\/|$)/.test(pathname)
  const expensePage = pathname === '/expenses'
  const cashPage = pathname === '/finance/cash-flow'
  const reportsPage = pathname.startsWith('/reports')
  const configurationPage = pathname.startsWith('/admin/') || ['/approvals', '/modules', '/settings'].includes(pathname)
  const documentsPage = pathname.startsWith('/documents'), profilePage = pathname === '/profile'
  const configurationLabel = pathname === '/admin/users' ? 'Utilisateurs' : pathname === '/admin/roles' ? 'Rôles & permissions' : pathname === '/admin/audit-logs' ? 'Journal d’audit' : pathname === '/approvals' ? 'Centre de validation' : pathname === '/modules' ? 'Modules' : 'Paramètres société'
  const aiLabel = pathname === '/ai/assistant' ? 'AI Assistant' : pathname === '/ai/forecasting' ? 'Forecasting' : pathname === '/ai/opportunities' ? 'Opportunités IA' : 'AI Control Center'
  const stockLabel = pathname.startsWith('/products') ? 'Produits & Services' : pathname.startsWith('/warehouses') ? 'Dépôts' : pathname.startsWith('/inventory/movements') ? 'Mouvements de stock' : pathname.startsWith('/inventory/transfers') ? 'Transferts de stock' : 'Dashboard Stock'
  const initials =
    user?.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenu(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileMenu(false) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [])

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
    <header className="sticky top-0 z-20 flex h-[62px] min-w-0 items-center gap-3 border-b border-[var(--border)] bg-surface px-4 lg:px-6">
      <button
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
        onClick={onToggleSidebar}
        className="rounded p-1.5 text-slate-500 focus-visible:ring-2 focus-visible:ring-primary-focus lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <nav
        aria-label="Fil d’Ariane"
        className="hidden shrink-0 items-center gap-1.5 text-[10px] sm:flex"
      >
        <span className="text-slate-400">
          {configurationPage ? 'Administration' : documentsPage ? 'Intelligence' : profilePage ? 'Mon compte' : stockPage ? 'Stock' : reportsPage ? 'BI / Reporting' : expensePage || cashPage ? 'Finance' : aiPage
            ? 'Intelligence'
            : suppliersPage || purchasesPage
            ? 'Achats'
            : invoicesPage || paymentsPage || supplierInvoicesPage
            ? 'Finance'
            : customersPage || quotesPage || salesPage
            ? 'Ventes'
            : 'Vue d’ensemble'}
        </span>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-navy-950">
          {configurationPage ? configurationLabel : documentsPage ? 'Documents' : profilePage ? 'Profil' : stockPage ? stockLabel : reportsPage ? 'Rapports' : expensePage ? 'Dépenses' : cashPage ? 'Trésorerie' : aiPage
            ? aiLabel
            : supplierInvoicesPage
            ? 'Factures fournisseurs'
            : purchasesPage
            ? 'Commandes fournisseurs'
            : paymentsPage
            ? 'Paiements'
            : suppliersPage
            ? 'Fournisseurs'
            : invoicesPage
            ? 'Factures clients'
            : customersPage
            ? 'Customers'
            : quotesPage
            ? 'Devis'
            : salesPage
            ? 'Commandes clients'
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
          className="h-8 rounded-md border-[var(--border)] pl-8 text-[10px] shadow-none [&::placeholder]:text-slate-400"
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
        {canAssistant && <button
          type="button"
          aria-label="SmartERP AI"
          className="topbar-icon hidden text-primary-text sm:grid"
          onClick={() => { void navigate('/ai/assistant') }}
        >
          <Sparkles className="size-4" />
        </button>}
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
      <div className="relative" ref={profileMenuRef}><button
        type="button"
        className="flex min-w-0 shrink-0 items-center gap-2 rounded-md py-1 text-left focus-visible:ring-2 focus-visible:ring-primary-focus"
        aria-label={`Profil de ${user?.name || 'l’utilisateur'}`}
        aria-expanded={profileMenu}
        aria-controls="profile-menu"
        onClick={() => setProfileMenu((value) => !value)}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[10px] font-semibold text-white">
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
      </button>{profileMenu && <nav id="profile-menu" aria-label="Menu utilisateur" className="absolute right-0 top-full mt-3 w-52 rounded-lg border border-slate-200 bg-surface p-2 text-xs text-slate-600 shadow-lg"><Link className="block rounded px-3 py-2 hover:bg-slate-50" to="/profile" onClick={() => setProfileMenu(false)}>Mon profil</Link><Link className="block rounded px-3 py-2 hover:bg-slate-50" to="/profile?tab=preferences" onClick={() => setProfileMenu(false)}>Paramètres personnels</Link><button type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-slate-50" disabled={logoutPending} onClick={() => void signOut()}>Se déconnecter</button></nav>}</div>
    </header>
  )
}
