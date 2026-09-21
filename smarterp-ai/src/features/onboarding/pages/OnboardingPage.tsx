import { useEffect, useRef, useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleHelp,
  Headphones,
  LayoutGrid,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { useAuthStore } from '../../../store/auth.store'
import { OnboardingStepper } from '../components/OnboardingStepper'
import { CompanyStep } from '../components/CompanyStep'
import { BusinessStep } from '../components/BusinessStep'
import { FinanceStep } from '../components/FinanceStep'
import { InventoryStep } from '../components/InventoryStep'
import { InvoicingStep } from '../components/InvoicingStep'
import { ModulesStep } from '../components/ModulesStep'
import { ReviewStep } from '../components/ReviewStep'
import { useOnboarding } from '../hooks/useOnboarding'
import {
  defaultOnboardingValues,
  onboardingSchema,
  stepFields,
} from '../schemas/onboarding.schema'
import { onboardingSteps, type OnboardingData } from '../types/onboarding.types'

export function OnboardingPage() {
  // Un seul formulaire reste monté pendant les sept étapes.
  const company = useAuthStore((state) => state.company)
  const form = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      ...defaultOnboardingValues,
      company: {
        ...defaultOnboardingValues.company,
        name: company?.name ?? '',
      },
    },
    mode: 'onTouched',
  })
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const navigationInProgress = useRef(false)
  const submissionInProgress = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const onboarding = useOnboarding()
  const values = useWatch({ control: form.control })
  const busy = onboarding.isPending || form.formState.isSubmitting
  const step = onboardingSteps[currentStep - 1]
  const progress = Math.round((currentStep / onboardingSteps.length) * 100)

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [currentStep])

  async function goToStep(target: number) {
    if (busy || navigationInProgress.current || target === currentStep) return
    if (target < currentStep) {
      setCurrentStep(target)
      return
    }
    navigationInProgress.current = true
    try {
      // Même un clic dans le menu ne contourne pas une étape obligatoire.
      for (let number = 1; number < target; number += 1) {
        if (
          !(await form.trigger(stepFields[number - 1], { shouldFocus: true }))
        ) {
          setCompletedSteps((previous) =>
            previous.filter((value) => value < number),
          )
          setCurrentStep(number)
          return
        }
      }
      setCompletedSteps(
        Array.from({ length: target - 1 }, (_, index) => index + 1),
      )
      setCurrentStep(target)
    } finally {
      navigationInProgress.current = false
    }
  }

  async function submit(data: OnboardingData) {
    if (submissionInProgress.current) return
    submissionInProgress.current = true
    onboarding.reset()
    try {
      await onboarding.mutateAsync(data)
    } catch {
      // Le hook fournit le message lisible affiché dans la page.
    } finally {
      submissionInProgress.current = false
    }
  }

  const previews = [
    {
      number: 2,
      title: 'Activité',
      value: values.business?.industry || 'Votre secteur d’activité',
      detail: 'Produits, services et opérations',
    },
    {
      number: 3,
      title: 'Finance',
      value: `${values.finance?.currency} · TVA ${values.finance?.vatRate} %`,
      detail: `Paiement à ${values.finance?.paymentTerms} jours`,
    },
    {
      number: 4,
      title: 'Stock',
      value: values.inventory?.enabled
        ? values.inventory.warehouseName || 'Votre dépôt principal'
        : 'Gestion du stock désactivée',
      detail: values.inventory?.enabled
        ? 'Dépôts et mouvements de stock'
        : 'Une activité sans stock',
    },
    {
      number: 6,
      title: 'Modules',
      value: `${values.modules?.length ?? 0} modules sélectionnés`,
      detail: 'Outils métier et assistants IA',
    },
  ]

  return (
    <div className="onboarding-page min-h-svh bg-[#f6f8fd] text-[#34435d]">
      <header className="border-b border-[#e4e9f2] bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-4 px-5 py-5 lg:flex-nowrap lg:px-8">
          <BrandLogo className="shrink-0 text-navy-950 [&>span:first-child]:size-9 [&>span:first-child]:rounded-lg [&>span:last-child]:text-lg" />
          <div className="min-w-0 flex-1 lg:border-l lg:border-slate-200 lg:pl-6">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm font-semibold text-navy-950">
                Configurer votre société
              </h1>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-blue-600 uppercase">
                Guide de démarrage
              </span>
            </div>
            <p className="mt-1 max-w-md text-[11px] leading-4 text-slate-500">
              Configurez les informations essentielles avant de commencer à
              utiliser SmartERP AI.
            </p>
          </div>
          <div className="hidden max-w-44 items-center gap-2 rounded-md border border-blue-100 bg-[#f1f5fd] px-3 py-2.5 xl:flex">
            <Building2
              className="size-4 shrink-0 text-blue-600"
              aria-hidden="true"
            />
            <span className="truncate text-[10px] font-semibold text-[#425575]">
              {values.company?.name || 'Votre société'}
            </span>
          </div>
          <div className="w-full sm:w-48 lg:w-40">
            <div className="mb-2 flex justify-between text-[10px] font-medium">
              <span>Étape {currentStep} sur 7</span>
              <span className="text-blue-600">{progress} %</span>
            </div>
            <div
              role="progressbar"
              aria-label="Progression de la configuration"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-1.5 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                style={{ width: `${progress}%` }}
                className="h-full rounded-full bg-blue-600"
              />
            </div>
          </div>
          <div className="hidden items-center gap-2 border-l border-slate-200 pl-5 text-[10px] leading-4 text-slate-500 2xl:flex">
            <LockKeyhole
              className="size-3.5 text-slate-400"
              aria-hidden="true"
            />
            <span>
              Espace réservé à<br />
              votre organisation
            </span>
          </div>
          <span
            className="hidden rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 lg:block"
            aria-label="Langue : français"
          >
            FR
          </span>
        </div>
      </header>

      <FormProvider {...form}>
        <form
          noValidate
          aria-label="Configuration de la société"
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault()
            if (busy) return
            if (currentStep < 7) {
              void goToStep(currentStep + 1)
              return
            }
            void form.handleSubmit(submit, (errors) => {
              const invalidIndex = stepFields.findIndex(
                (field) => field in errors,
              )
              if (invalidIndex !== -1) {
                setCurrentStep(invalidIndex + 1)
                setCompletedSteps((previous) =>
                  previous.filter((number) => number < invalidIndex + 1),
                )
              }
            })(event)
          }}
          onChange={() => {
            if (onboarding.isError) onboarding.reset()
            setCompletedSteps((previous) =>
              previous.filter((number) => number !== currentStep),
            )
          }}
        >
          <main className="mx-auto grid max-w-[1600px] gap-6 px-5 py-6 lg:min-h-[calc(100svh-168px)] lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8">
            <aside className="flex min-w-0 flex-col justify-between gap-6">
              <OnboardingStepper
                currentStep={currentStep}
                completedSteps={completedSteps}
                onStepChange={(number) => void goToStep(number)}
                disabled={busy}
              />
              <div className="hidden rounded-lg border border-[#e4e9f2] bg-white p-4 lg:block">
                <p className="flex items-center gap-2 text-xs font-semibold text-navy-950">
                  <Headphones
                    className="size-4 text-blue-600"
                    aria-hidden="true"
                  />
                  Besoin d’un coup de main ?
                </p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Votre administrateur peut vous aider à préparer les
                  informations de votre société.
                </p>
                <Button
                  variant="ghost"
                  className="mt-2 min-h-7 gap-1.5 px-0 text-[10px] text-blue-600 hover:bg-transparent"
                  onClick={() =>
                    toast.info(
                      'Contactez votre administrateur pour obtenir de l’aide sur la configuration.',
                    )
                  }
                >
                  <CircleHelp className="size-3" aria-hidden="true" />
                  Aide à la configuration
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Button>
              </div>
            </aside>
            <section
              aria-labelledby="onboarding-step-title"
              className="min-w-0 rounded-lg border border-[#e4e9f2] bg-white shadow-[0_2px_4px_#172c5002]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf0f5] px-5 py-5 sm:px-7">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded bg-blue-50 px-2 py-1 text-[9px] font-semibold text-blue-600">
                      Étape {currentStep}
                    </span>
                    <h2
                      ref={titleRef}
                      tabIndex={-1}
                      id="onboarding-step-title"
                      className="text-base font-semibold tracking-tight text-navy-950 outline-none sm:text-lg"
                    >
                      {currentStep}. {step.heading}
                    </h2>
                  </div>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                    {step.subtitle}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-medium text-emerald-700">
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  Configuration initiale
                </span>
              </div>
              <fieldset disabled={busy} className="min-w-0 px-5 py-6 sm:px-7">
                {currentStep === 1 && <CompanyStep />}
                {currentStep === 2 && <BusinessStep />}
                {currentStep === 3 && <FinanceStep />}
                {currentStep === 4 && <InventoryStep />}
                {currentStep === 5 && <InvoicingStep />}
                {currentStep === 6 && <ModulesStep />}
                {currentStep === 7 && (
                  <ReviewStep onEdit={(number) => void goToStep(number)} />
                )}
                {currentStep === 1 && (
                  <div className="mt-6 border-t border-[#edf0f5] pt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#425575]">
                        <Sparkles
                          className="size-3.5 text-blue-500"
                          aria-hidden="true"
                        />
                        Vos prochains paramètres
                      </p>
                      <span className="text-[10px] text-slate-400">
                        À personnaliser au fil des étapes
                      </span>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                      {previews.map((preview) => (
                        <button
                          type="button"
                          key={preview.number}
                          onClick={() => void goToStep(preview.number)}
                          className="min-w-0 rounded-md border border-[#e4e9f2] bg-[#f8f9fd] p-3 text-left outline-none hover:border-blue-200 focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <span className="flex items-center justify-between text-[9px] text-slate-500">
                            Étape {preview.number} · {preview.title}
                            <ArrowRight className="size-3" aria-hidden="true" />
                          </span>
                          <span className="mt-1.5 block truncate text-[10px] font-semibold text-[#344c71]">
                            {preview.value}
                          </span>
                          <span className="mt-1 block text-[9px] leading-4 text-slate-500">
                            {preview.detail}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>
              {onboarding.errorMessage && (
                <Alert variant="error" className="mx-5 mb-6 sm:mx-7">
                  {onboarding.errorMessage}
                </Alert>
              )}
            </section>
          </main>

          <footer className="sticky bottom-0 z-10 border-t border-[#e4e9f2] bg-white/95 backdrop-blur-sm">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-5 py-3.5 lg:px-8">
              <div
                className="flex items-center gap-2 text-[10px] text-slate-500"
                role="status"
              >
                {busy ? (
                  <Spinner className="size-3.5" />
                ) : onboarding.isSuccess ? (
                  <Check
                    className="size-3.5 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <LayoutGrid
                    className="size-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {busy
                    ? 'Enregistrement...'
                    : onboarding.isSuccess
                      ? 'Enregistré'
                      : 'Brouillon en mémoire'}
                  <span className="ml-2 hidden text-slate-400 sm:inline">
                    · Envoi à la dernière étape
                  </span>
                </span>
              </div>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <Button
                  variant="ghost"
                  disabled={currentStep === 1 || busy}
                  className="min-h-10 px-3 text-xs"
                  onClick={() => void goToStep(currentStep - 1)}
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  Retour
                </Button>
                <Button
                  type="submit"
                  disabled={busy}
                  className="min-h-10 flex-1 rounded-md px-4 text-xs sm:flex-none"
                >
                  {busy ? (
                    <>
                      <Spinner />
                      Enregistrement...
                    </>
                  ) : currentStep === 7 ? (
                    <>
                      Terminer la configuration
                      <Check className="size-4" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Enregistrer et continuer
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </footer>
        </form>
      </FormProvider>
    </div>
  )
}
