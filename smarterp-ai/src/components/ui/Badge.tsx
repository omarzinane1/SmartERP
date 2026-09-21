import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

const tones = {
  positive: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  critical: 'border-rose-100 bg-rose-50 text-rose-600',
  neutral: 'border-slate-100 bg-slate-100 text-slate-500',
  info: 'border-blue-100 bg-blue-50 text-blue-700',
  indigo: 'border-indigo-100 bg-indigo-50 text-indigo-600',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium leading-tight',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
