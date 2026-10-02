import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuthStore } from '../../store/auth.store'
import { moduleForPath } from './moduleNavigation'

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation(), company = useAuthStore((s) => s.company), theme = useAuthStore((s) => s.user?.preferences?.theme ?? 'system'), module = moduleForPath(pathname), disabled = !!module && !!company?.enabledModules && !company.enabledModules.includes(module)
  useEffect(() => { const media = window.matchMedia('(prefers-color-scheme: dark)'), apply = () => { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme }; apply(); media.addEventListener('change', apply); return () => { media.removeEventListener('change', apply); delete document.documentElement.dataset.theme } }, [theme])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <div className="erp-shell min-h-svh bg-[var(--surface-2)] text-[color:var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded bg-surface p-3 text-primary-text focus:not-sr-only"
      >
        Aller au contenu principal
      </a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 lg:ml-[232px]">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <div id="main-content" tabIndex={-1} className="outline-none">
          {disabled ? <main className="dashboard-page"><section className="rounded-xl border border-slate-200 bg-surface p-10 text-center"><h1 className="text-xl font-semibold">Module désactivé pour cette société</h1><p className="mt-3 text-sm text-slate-500">Contactez un administrateur pour vérifier sa disponibilité. Vos données sont conservées.</p></section></main> : <Outlet />}
        </div>
      </div>
    </div>
  )
}
