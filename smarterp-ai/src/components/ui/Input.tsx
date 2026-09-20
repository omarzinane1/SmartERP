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
          'h-12 w-full rounded-lg border border-[#dce2eb] bg-white px-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.025)] outline-none transition placeholder:text-slate-500 hover:border-slate-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-red-400 aria-invalid:focus:ring-red-500/10 motion-reduce:transition-none',
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
