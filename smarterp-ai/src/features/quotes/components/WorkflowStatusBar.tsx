import { Check, ChevronRight } from 'lucide-react'
import { quoteStatusLabels, type QuoteStatus } from '../types/quotes.types'
import { QuoteStatusBadge } from './QuoteStatusBadge'

const steps: QuoteStatus[] = ['draft', 'sent', 'viewed', 'accepted']
export function WorkflowStatusBar({ status }: { status: QuoteStatus }) {
  const current = steps.indexOf(status)
  return <section className="quote-workflow" aria-label="Cycle commercial">
    <span className="quote-workflow-label">Cycle du devis</span>
    <ol>{steps.map((step, index) => <li key={step} aria-current={step === status ? 'step' : undefined} data-complete={current > index}>
      <span className="quote-workflow-dot">{current > index ? <Check className="size-3" /> : index + 1}</span>
      {quoteStatusLabels[step]}{index < steps.length - 1 && <ChevronRight className="size-3 text-slate-300" />}
    </li>)}</ol>
    <div className="quote-workflow-alternatives"><span>Issues alternatives</span>
      {(['rejected', 'expired'] as const).map((step) => <span key={step} className={step === status ? '' : 'opacity-40'} aria-current={step === status ? 'step' : undefined}><QuoteStatusBadge status={step} /></span>)}
    </div>
  </section>
}
