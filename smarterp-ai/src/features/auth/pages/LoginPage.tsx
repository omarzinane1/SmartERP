import { ArrowUpRight, Headphones, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { AuthBrandPanel } from '../components/AuthBrandPanel'
import { LoginForm } from '../components/LoginForm'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../../store/auth.store'
import { getPostLoginPath } from '../hooks/useLogin'

export function LoginPage() {
  const auth = useAuthStore()
  if (auth.status === 'authenticated') return <Navigate to={getPostLoginPath(auth.company)} replace />
  return (
    <main className="grid min-h-svh bg-surface p-0 lg:grid-cols-[1fr_1fr] lg:gap-2 lg:p-4">
      <AuthBrandPanel />
      <section className="flex min-h-svh min-w-0 flex-col px-6 py-7 sm:px-12 lg:min-h-0 lg:px-10 lg:py-6 xl:px-16" aria-label="Connexion à votre espace">
        <header className="flex items-center justify-between gap-4 lg:justify-end">
          <BrandLogo className="text-navy-950 lg:hidden [&>span:last-child]:text-lg [&>span:first-child]:size-8" />
          <button type="button" onClick={() => toast.info('Contactez votre administrateur pour obtenir de l’aide.')} className="flex shrink-0 items-center gap-2 rounded text-[11px] text-slate-500 transition-colors hover:text-navy-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-focus">
            <Headphones className="size-3.5" aria-hidden="true" /><span>Besoin d’aide ?</span><ArrowUpRight className="size-3" aria-hidden="true" />
          </button>
        </header>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-14 lg:py-16">
          <div className="mb-7 grid size-12 place-items-center rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] text-[color:var(--text-secondary)] shadow-[0_2px_3px_color-mix(in_srgb,_var(--shadow-color)_1.6%,_transparent)]" aria-hidden="true"><LockKeyhole className="size-[22px]" strokeWidth={1.6} /></div>
          <LoginForm />
        </div>
        <footer className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] text-slate-500">
          <span>© {new Date().getFullYear()} SmartERP AI</span><span aria-hidden="true">·</span><span>Conçu pour faire avancer votre entreprise.</span>
        </footer>
      </section>
    </main>
  )
}
