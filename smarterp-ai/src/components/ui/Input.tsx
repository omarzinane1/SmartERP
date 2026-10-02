import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type InputProps = ComponentProps<'input'> & {
  leadingIcon?: ReactNode
  trailingContent?: ReactNode
}

export function Input({
  className,
  leadingIcon,
  trailingContent,
  ...props
}: InputProps) {
  return (
    <div className="relative">
      {leadingIcon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400"
        >
          {leadingIcon}
        </span>
      )}
      <input
        className={cn(
          'h-12 w-full rounded-lg border border-input-border bg-input px-3.5 text-sm text-input-text shadow-[0_1px_2px_color-mix(in_srgb,var(--shadow-color)_2.5%,transparent)] outline-none transition placeholder:text-placeholder hover:border-slate-300 focus:border-primary-border focus:ring-3 focus:ring-primary-focus/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-danger-border aria-invalid:focus:ring-danger-border/10 motion-reduce:transition-none',
          leadingIcon && 'pl-11',
          trailingContent && 'pr-12',
          className,
        )}
        {...props}
      />
      {trailingContent && (
        <span className="absolute inset-y-0 right-1.5 flex items-center">
          {trailingContent}
        </span>
      )}
    </div>
  )
}
