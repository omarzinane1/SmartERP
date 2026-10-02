import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

const tones = {
  positive: 'border-success-border bg-success-bg text-success-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  critical: 'border-danger-border bg-danger-bg text-danger-text',
  neutral: 'border-neutral-border bg-neutral-bg text-neutral-text',
  info: 'border-info-border bg-info-bg text-info-text',
  indigo: 'border-primary-border bg-primary-soft text-primary-text',
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
