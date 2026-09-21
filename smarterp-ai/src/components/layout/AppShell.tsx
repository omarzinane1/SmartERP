import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <div className="erp-shell min-h-svh bg-[#f6f8fd] text-[#35465f]">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded bg-white p-3 text-blue-600 focus:not-sr-only"
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
          <Outlet />
        </div>
      </div>
    </div>
  )
}
