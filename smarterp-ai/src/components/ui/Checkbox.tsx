import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

type CheckboxProps = Omit<ComponentProps<'input'>, 'type'>

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[#172c50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}
