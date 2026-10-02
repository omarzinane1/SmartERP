import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

const variants = {
  primary:
    'bg-primary text-on-primary shadow-sm hover:bg-primary-hover active:bg-primary-active',
  secondary:
    'border border-button-secondary-border bg-button-secondary text-button-secondary-text hover:bg-ghost-hover',
  ghost: 'text-secondary hover:bg-ghost-hover hover:text-foreground',
}

export function Button({
  className,
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
