import type { ComponentProps } from 'react'
import { CircleAlert, Info } from 'lucide-react'
import { cn } from '../../lib/cn'

type AlertProps = ComponentProps<'div'> & {
  variant?: 'error' | 'info'
}

export function Alert({
  children,
  className,
  variant = 'info',
  ...props
}: AlertProps) {
  const Icon = variant === 'error' ? CircleAlert : Info

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-5',
        variant === 'error'
          ? 'border-danger-border bg-danger-bg text-danger-text'
          : 'border-info-border bg-info-bg text-info-text',
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
