import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { Input, type InputProps } from '../../../components/ui/Input'

type PasswordInputProps = Omit<
  InputProps,
  'type' | 'leadingIcon' | 'trailingContent'
>

export function PasswordInput({ disabled, id, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  const VisibilityIcon = isVisible ? EyeOff : Eye

  return (
    <Input
      id={id}
      type={isVisible ? 'text' : 'password'}
      disabled={disabled}
      leadingIcon={<LockKeyhole className="size-[18px]" strokeWidth={1.7} />}
      trailingContent={
        <button
          type="button"
          aria-label={
            isVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
          }
          aria-controls={id}
          aria-pressed={isVisible}
          disabled={disabled}
          onClick={() => setIsVisible((visible) => !visible)}
          className="inline-flex size-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <VisibilityIcon aria-hidden="true" className="size-[18px]" strokeWidth={1.7} />
        </button>
      }
      {...props}
    />
  )
}
