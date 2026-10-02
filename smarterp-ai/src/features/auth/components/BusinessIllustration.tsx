import { ArrowDownLeft, ArrowUpRight, Check, CircleCheck, Ellipsis, Layers3, Sparkles, TrendingUp } from 'lucide-react'

const monthlyBars = [36, 53, 45, 66, 57, 76, 67, 87, 77, 100, 88, 115]

export function BusinessIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[480px] pt-3 pb-10 select-none" aria-hidden="true">
      <div className="absolute top-10 -right-5 bottom-8 left-8 rounded-2xl border border-white/10 bg-surface/5 rotate-3" />
      <div className="relative rounded-xl border border-white/80 bg-[var(--surface-2)] p-5 text-slate-800 shadow-[0_25px_60px_-20px_color-mix(in_srgb,_var(--shadow-color)_66.7%,_transparent)] xl:p-6">
        <div className="flex items-center justify-between border-b border-slate-200/75 pb-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold"><Layers3 className="size-3.5 text-slate-500" /> Vue d’ensemble</div>
          <div className="flex items-center gap-2 text-[9px] text-slate-500"><span className="size-1.5 rounded-full bg-success" /> Tout est à jour <Ellipsis className="ml-2 size-4" /></div>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-slate-500">Chiffre d’affaires</p>
            <p className="mt-1 text-[26px] font-semibold tracking-tight">128 450 <span className="text-[12px] font-normal text-slate-500">MAD</span></p>
          </div>
          <span className="mt-5 flex items-center gap-1 rounded-md bg-success-bg px-2 py-1 text-[10px] font-medium text-success-text"><TrendingUp className="size-3" /> 12,8 %</span>
        </div>
        <div className="mt-3 flex h-[90px] items-end gap-2 border-b border-slate-200/70 px-1 xl:h-[104px]">
          {monthlyBars.map((height, index) => (
            <div key={index} className="flex flex-1 justify-center">
              <div className="w-full max-w-5 rounded-t-[3px] bg-chart-purple last:border-0" style={{ height: `${height * 0.75}px`, backgroundColor: index > 8 ? 'var(--chart-aubergine)' : undefined }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[8px] text-slate-400"><span>JAN.</span><span>JUIN</span><span>DÉC.</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-surface px-2.5 py-2">
            <span className="rounded-md bg-primary-soft p-1.5 text-primary-text"><ArrowDownLeft className="size-3.5" /></span>
            <div><p className="text-[8px] text-slate-500">Factures réglées</p><p className="text-[11px] font-semibold">24 <span className="font-normal text-slate-400">ce mois-ci</span></p></div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-surface px-2.5 py-2">
            <span className="rounded-md bg-success-bg p-1.5 text-success-text"><CircleCheck className="size-3.5" /></span>
            <div><p className="text-[8px] text-slate-500">Commandes</p><p className="text-[11px] font-semibold">38 <span className="font-normal text-slate-400">confirmées</span></p></div>
          </div>
        </div>
      </div>
      <div className="absolute -right-4 -bottom-1 flex w-[278px] items-start gap-3 rounded-xl border border-[var(--border)] bg-surface p-3.5 shadow-[0_8px_30px_color-mix(in_srgb,_var(--shadow-color)_20%,_transparent)] xl:-right-7">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[color:var(--text-muted)]"><Sparkles className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-800">Votre copilote IA</span><ArrowUpRight className="size-3 text-slate-400" /></div>
          <p className="mt-1 text-[9px] leading-relaxed text-slate-500">Les bonnes informations,<br />au bon moment.</p>
          <span className="mt-1.5 flex items-center gap-1 text-[8px] text-success-text"><Check className="size-2.5" /> Une vision claire pour avancer</span>
        </div>
      </div>
      <span className="absolute -bottom-3 left-1 text-[8px] tracking-wide text-slate-400">APERÇU ILLUSTRATIF</span>
    </div>
  )
}
