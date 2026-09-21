import { cn } from '../../lib/cn'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)} aria-label="SmartERP AI">
      <span className="grid size-10 place-items-center rounded-xl border border-current/15 bg-current/5">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <path d="m13 2 10 5.5v11L13 24 3 18.5v-11L13 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="m3 7.5 10 5.6 10-5.6M13 13v11M8 4.8l10 5.6v5.9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-[23px] font-semibold tracking-[-0.8px]">SmartERP <span className="ml-0.5 align-middle text-[11px] font-medium tracking-wide opacity-70">AI</span></span>
    </div>
  )
}
