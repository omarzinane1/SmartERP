import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { Checkbox } from '../../../components/ui/Checkbox'
import { Input } from '../../../components/ui/Input'
import { Spinner } from '../../../components/ui/Spinner'
import { useLogin } from '../hooks/useLogin'
import { useRememberedEmail } from '../hooks/useRememberedEmail'
import { loginSchema, type LoginFormValues } from '../schemas/login.schema'
import { AuthError } from './AuthError'
import { PasswordInput } from './PasswordInput'

export function LoginForm() {
  const login = useLogin()
  const submissionInProgress = useRef(false)
  const {
    initialEmail,
    rememberEmail,
    toggleRememberEmail,
    saveRememberedEmail,
  } = useRememberedEmail()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: initialEmail, password: '' },
    mode: 'onTouched',
  })
  const isPending = login.isPending || isSubmitting

  async function onSubmit(values: LoginFormValues) {
    if (submissionInProgress.current) return

    submissionInProgress.current = true
    login.reset()

    try {
      await login.mutateAsync(values)
      saveRememberedEmail(values.email)
    } catch {
      // The mutation exposes a normalized, user-facing error below the form.
    } finally {
      submissionInProgress.current = false
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <header className="mb-9">
        <div className="mb-5 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.17em] text-slate-500 uppercase">
          <span aria-hidden="true" className="h-px w-6 bg-[#8797b4]" />
          Votre espace professionnel
        </div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.035em] text-[#172c50] sm:text-[32px]">
          Bon retour parmi nous
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Connectez-vous à votre espace SmartERP AI.
        </p>
      </header>

      <form
        noValidate
        aria-label="Connexion à SmartERP AI"
        aria-busy={isPending}
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        onChange={() => {
          if (login.error) login.reset()
        }}
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="mb-2 block text-[13px] font-semibold text-[#34435d]"
            >
              Adresse e-mail
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="nom@entreprise.com"
              required
              disabled={isPending}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              leadingIcon={<Mail className="size-[18px]" strokeWidth={1.7} />}
              {...register('email')}
            />
            {errors.email && (
              <p id="login-email-error" role="alert" className="mt-2 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-[13px] font-semibold text-[#34435d]"
            >
              Mot de passe
            </label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              required
              disabled={isPending}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <p id="login-password-error" role="alert" className="mt-2 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <label
            htmlFor="remember-email"
            className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#66748a]"
          >
            <Checkbox
              id="remember-email"
              checked={rememberEmail}
              disabled={isPending}
              aria-describedby="remember-email-hint"
              onChange={(event) => toggleRememberEmail(event.target.checked)}
            />
            Se souvenir de moi
          </label>
          <button
            type="button"
            disabled={isPending}
            onClick={() => toast.info('Contactez votre administrateur pour réinitialiser votre mot de passe.')}
            className="rounded-sm py-1 text-xs font-semibold text-[#304d79] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Mot de passe oublié ?
          </button>
        </div>
        <p id="remember-email-hint" className="mt-2 text-[11px] leading-4 text-slate-500">
          Seule votre adresse e-mail est mémorisée sur cet appareil.
        </p>

        {login.error && (
          <div className="mt-5">
            <AuthError error={login.error} />
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="mt-7 h-12 w-full gap-3 text-[13px]"
        >
          {isPending ? (
            <>
              <Spinner />
              Connexion...
            </>
          ) : (
            <>
              Se connecter
              <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 border-t border-[#edf0f5] pt-7 text-center">
        <p className="text-xs text-slate-500">
          Votre espace de travail, en toute confiance.
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium tracking-wide text-slate-500">
          <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
          Accès réservé à votre organisation
        </div>
      </div>
    </div>
  )
}
