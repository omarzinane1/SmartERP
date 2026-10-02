import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { onboardingSteps } from '../types/onboarding.types'

interface OnboardingStepperProps {
  currentStep: number
  completedSteps: number[]
  onStepChange: (step: number) => void
  disabled: boolean
}

export function OnboardingStepper({
  currentStep,
  completedSteps,
  onStepChange,
  disabled,
}: OnboardingStepperProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const activeStepRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const list = listRef.current
    const active = activeStepRef.current
    if (list && active && list.scrollWidth > list.clientWidth) {
      list.scrollLeft =
        active.offsetLeft - (list.clientWidth - active.clientWidth) / 2
    }
  }, [currentStep])

  return (
    <nav
      aria-label="Étapes de configuration"
      className="rounded-lg border border-[var(--border)] bg-surface p-3 lg:p-4"
    >
      <div className="mb-4 hidden items-center justify-between px-2 lg:flex">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
          Votre parcours
        </span>
        <span className="text-[10px] font-medium text-primary-text">7 étapes</span>
      </div>
      <ol
        ref={listRef}
        className="relative flex gap-1 overflow-x-auto lg:block lg:space-y-1"
      >
        {onboardingSteps.map((step, index) => {
          const number = index + 1
          const active = number === currentStep
          const completed = completedSteps.includes(number)
          return (
            <li key={step.title} className="min-w-[105px] shrink-0 lg:min-w-0">
              <button
                ref={active ? activeStepRef : undefined}
                type="button"
                disabled={disabled}
                aria-current={active ? 'step' : undefined}
                onClick={() => onStepChange(number)}
                className={cn(
                  'relative flex w-full items-start gap-3 rounded-md px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-focus disabled:opacity-60',
                  active ? 'bg-[var(--surface-2)]' : 'hover:bg-slate-50',
                )}
              >
                {active && (
                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" />
                )}
                <span
                  className={cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold',
                    active
                      ? 'border-primary-border bg-primary text-white'
                      : completed
                        ? 'border-success-border bg-success-bg text-success-text'
                        : 'border-slate-200 text-slate-400',
                  )}
                >
                  {completed && !active ? (
                    <Check aria-label="Terminée" className="size-3.5" />
                  ) : (
                    number
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-xs font-semibold',
                      active ? 'text-primary-text' : 'text-slate-600',
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="mt-1 hidden text-[10px] leading-4 text-slate-500 lg:block">
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
