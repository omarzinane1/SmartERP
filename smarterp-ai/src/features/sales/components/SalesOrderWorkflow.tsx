import { Check, ChevronRight } from 'lucide-react'
import { orderStatusLabels, type SalesOrderDetail } from '../types/sales.types'

export function SalesOrderWorkflow({ status }: { status: SalesOrderDetail['orderStatus'] }) {
  const steps = ['draft', 'confirmed', 'processing', 'completed']
  const current = steps.indexOf(status)
  return <section className="sales-workflow" aria-label="Cycle de la commande">
    <span className="sales-eyebrow">Cycle commercial</span>
    <ol>{steps.map((step, index) => <li key={step} aria-current={step === status ? 'step' : undefined} data-complete={index < current}>
      <span className="sales-step-dot">{index < current ? <Check size={12} /> : index + 1}</span>{orderStatusLabels[step]}
      {index < steps.length - 1 && <ChevronRight size={12} aria-hidden="true" />}
    </li>)}</ol>
    {current === -1 && <span className={`sales-badge sales-badge-${status}`}>{orderStatusLabels[status] ?? status}</span>}
  </section>
}
