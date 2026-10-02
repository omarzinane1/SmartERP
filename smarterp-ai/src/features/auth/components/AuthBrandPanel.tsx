import { ChartNoAxesCombined, Layers3, Sparkles } from 'lucide-react'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { BusinessIllustration } from './BusinessIllustration'

export function AuthBrandPanel() {
  return (
    <aside className="brand-panel relative hidden min-h-[800px] overflow-hidden rounded-[18px] px-10 py-10 text-white lg:flex lg:flex-col xl:px-[58px] xl:py-11">
      <div className="brand-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative"><BrandLogo /></div>
      <div className="relative my-auto pt-12 pb-14">
        <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-surface/5 px-3 py-1.5 text-[10px] font-medium tracking-[1.4px] text-[color:var(--brand-secondary)]">
          <Sparkles className="size-3 text-[color:var(--brand-accent)]" aria-hidden="true" /> L’INTELLIGENCE AU SERVICE DE VOTRE ENTREPRISE
        </div>
        <h2 className="max-w-[520px] text-[40px] leading-[1.14] font-semibold tracking-[-1.7px] xl:text-[46px]">Votre entreprise,<br />pilotée avec<br /><span className="text-[color:var(--brand-secondary)]">intelligence.</span></h2>
        <p className="mt-5 max-w-[395px] text-[14px] leading-[1.85] text-[color:var(--brand-secondary)]">Centralisez vos opérations, simplifiez votre quotidien et prenez les bonnes décisions. Tout commence ici.</p>
        <div className="mx-3 mt-10 xl:mt-11"><BusinessIllustration /></div>
      </div>
      <div className="relative mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-t border-white/10 pt-5 text-[10px] text-[color:var(--brand-secondary)]">
        <span className="flex items-center gap-2"><Layers3 className="size-3.5 text-[color:var(--brand-secondary)]" aria-hidden="true" /> Une gestion unifiée</span>
        <span className="flex items-center gap-2"><ChartNoAxesCombined className="size-3.5 text-[color:var(--brand-secondary)]" aria-hidden="true" /> Une vision à 360°</span>
        <span className="flex items-center gap-2"><Sparkles className="size-3.5 text-[color:var(--brand-accent)]" aria-hidden="true" /> L’IA à vos côtés</span>
      </div>
    </aside>
  )
}
