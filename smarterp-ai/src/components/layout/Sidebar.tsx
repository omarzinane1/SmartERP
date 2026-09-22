import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Bot,
  Boxes,
  ChevronDown,
  CirclePlus,
  CircleUserRound,
  LayoutDashboard,
  Landmark,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { BrandLogo } from './BrandLogo'
import { Button } from '../ui/Button'
import { useAuthStore } from '../../store/auth.store'
import { cn } from '../../lib/cn'

const groups = [
  {
    label: 'Ventes',
    icon: ShoppingBag,
    links: ['Clients', 'Devis', 'Commandes clients', 'Factures', 'Paiements'],
  },
  {
    label: 'Achats',
    icon: Truck,
    links: ['Fournisseurs', 'Commandes fournisseurs', 'Factures fournisseurs'],
  },
  {
    label: 'Stock',
    icon: Boxes,
    links: [
      'Produits & services',
      'Inventaire',
      'Dépôts',
      'Transferts de stock',
    ],
  },
  {
    label: 'Finance',
    icon: Landmark,
    links: ['Dépenses', 'Trésorerie', 'Rapports'],
  },
  {
    label: 'Intelligence',
    icon: Sparkles,
    links: ['Documents', 'AI Assistant', 'Forecasting', 'Opportunités IA'],
  },
  {
    label: 'Administration',
    icon: ShieldCheck,
    links: [
      'Centre d’approbation',
      'Utilisateurs',
      'Rôles & permissions',
      'Journal d’audit',
      'Modules',
      'Paramètres',
    ],
  },
]

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const company = useAuthStore((state) => state.company)
  const user = useAuthStore((state) => state.user)
  const { pathname } = useLocation()
  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
          aria-label="Fermer la navigation"
          onClick={onClose}
        />
      )}
      <aside
        id="app-sidebar"
        aria-label="Menu principal"
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-[232px] flex-col border-r border-[#e1e6f0] bg-[#f8faff] px-3 py-4 lg:flex',
          open ? 'flex' : 'hidden',
        )}
      >
        <div className="flex items-center gap-1 rounded-md border border-[#e3e8f1] bg-white px-3 py-3">
          <div className="min-w-0 flex-1">
            <BrandLogo className="gap-2 text-navy-950 [&>span:first-child]:size-7 [&>span:first-child]:rounded-md [&>span:first-child]:bg-blue-600 [&>span:first-child]:text-white [&>span:first-child>svg]:size-5 [&>span:last-child]:text-[15px]" />
            <p className="mt-1 truncate pl-9 text-[9px] text-slate-500">
              {company?.name || 'Votre société'}
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Fermer le menu"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <Button
          variant="secondary"
          className="my-3 min-h-8 justify-between rounded-md px-3 font-normal"
          onClick={() =>
            toast.info(
              'Les créations seront disponibles avec les prochains modules métier.',
            )
          }
        >
          <span className="flex items-center gap-2">
            <CirclePlus className="size-3.5 text-blue-600" aria-hidden="true" />
            Nouvel enregistrement
          </span>
          <ArrowUpRight className="size-3 text-slate-400" aria-hidden="true" />
        </Button>
        <nav
          aria-label="Navigation ERP"
          className="min-h-0 flex-1 overflow-y-auto pb-4"
        >
          <p className="sidebar-section-title">Vue d’ensemble</p>
          <NavLink
            to="/dashboard"
            onClick={onClose}
            className={({ isActive }) =>
              cn('sidebar-link', isActive && 'sidebar-link-active')
            }
          >
            <LayoutDashboard className="size-4" aria-hidden="true" />
            <span className="flex-1">Tableau de bord</span>
            <span className="size-1.5 rounded-full bg-blue-600" />
          </NavLink>
          <NavLink
            to="/ai/control-center"
            onClick={onClose}
            className={({ isActive }) =>
              cn('sidebar-link', isActive && 'sidebar-link-active')
            }
          >
            <Bot className="size-4" aria-hidden="true" />
            <span className="flex-1">AI Control Center</span>
            <span className="rounded bg-indigo-50 px-1 text-[8px] text-indigo-600">
              IA
            </span>
          </NavLink>
          <p className="sidebar-section-title mt-5">Opérations</p>
          {groups.map(({ label, icon: Icon, links }, index) => (
            <div key={label}>
              {index === 4 && (
                <p className="sidebar-section-title mt-5">Intelligence</p>
              )}
              {index === 5 && (
                <p className="sidebar-section-title mt-5">Configuration</p>
              )}
              <details
                className="group"
                open={
                  label === 'Ventes' && pathname.startsWith('/customers')
                    ? true
                    : undefined
                }
              >
                <summary className="sidebar-link list-none">
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {index === 4 && (
                    <span className="rounded bg-indigo-600 px-1 py-0.5 text-[8px] font-semibold text-white">
                      AI PRO
                    </span>
                  )}
                  <ChevronDown
                    className="size-3 text-slate-400 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="ml-5 border-l border-slate-200 py-1 pl-3">
                  {links.map((label) =>
                    label === 'Clients' ? (
                      <NavLink
                        key={label}
                        to="/customers"
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'sidebar-link text-[10px]',
                            isActive && 'sidebar-link-active',
                          )
                        }
                      >
                        Customers
                      </NavLink>
                    ) : (
                      <button
                        key={label}
                        type="button"
                        disabled
                        className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-[10px] text-slate-400"
                        title="Module à venir"
                      >
                        <span>{label}</span>
                        <span className="text-[8px]">À venir</span>
                      </button>
                    ),
                  )}
                </div>
              </details>
            </div>
          ))}
        </nav>
        <div className="border-t border-[#e4e9f2] pt-3">
          <div className="flex items-center justify-between rounded bg-[#edf3ff] px-2 py-1.5 text-[9px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Activity className="size-3 text-blue-500" aria-hidden="true" />
              Espace de travail
            </span>
            <span className="flex items-center gap-1 text-emerald-600">
              <span className="size-1 rounded-full bg-emerald-500" />
              Connecté
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 px-1">
            <CircleUserRound
              className="size-6 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold text-slate-600">
                {user?.name}
              </p>
              <p className="truncate text-[9px] text-slate-400">
                {user?.email}
              </p>
            </div>
            <Package
              className="ml-auto size-3.5 shrink-0 text-slate-300"
              aria-hidden="true"
            />
          </div>
        </div>
      </aside>
    </>
  )
}
