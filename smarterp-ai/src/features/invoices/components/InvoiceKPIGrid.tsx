import { Banknote, CircleDollarSign, Clock3, Wallet } from 'lucide-react'
import { formatMoney } from '../../../lib/money'
import { invoiceKPIs } from '../utils/invoiceCalculations'
import type { AgingBucket, InvoiceSummary } from '../types/invoices.types'

export function InvoiceKPIGrid({ invoices, asOf }: { invoices: InvoiceSummary[]; asOf: string }) {
  const totals = invoiceKPIs(invoices, asOf)
  const cards = [{ label: 'Total facturé', amount: totals.invoiced, note: 'Factures comptabilisées du périmètre', icon: CircleDollarSign, tone: 'blue' }, { label: 'Total payé', amount: totals.paid, note: 'Paiements affectés aux factures émises', icon: Banknote, tone: 'green' }, { label: 'Solde restant', amount: totals.remaining, note: 'Montant restant à recevoir', icon: Wallet, tone: 'indigo' }, { label: 'En retard', amount: totals.overdue, note: `${totals.overdueCount} facture(s) échue(s) avec solde`, icon: Clock3, tone: 'orange' }]
  return <section className="invoice-kpis" aria-label="Indicateurs des factures filtrées">{cards.map(({ label, amount, note, icon: Icon, tone }) => <article className={`invoice-card invoice-kpi invoice-kpi-${tone}`} key={label}><div><h2>{label}</h2><Icon size={15} aria-hidden="true" /></div><strong>{formatMoney(amount)}</strong><p>{note}</p></article>)}</section>
}
export function AgingSummary({ buckets, selected, onSelect }: { buckets: AgingBucket[]; selected: string; onSelect: (key: string) => void }) {
  return <section className="invoice-card invoice-aging" aria-label="Aging des créances"><header><h2>Ancienneté des créances</h2><span>Soldes des factures comptabilisées · date de référence du périmètre</span></header><div>{buckets.map((bucket) => <button type="button" key={bucket.key} aria-pressed={selected === bucket.key} onClick={() => onSelect(selected === bucket.key ? '' : bucket.key)}><span>{bucket.label}</span><strong>{formatMoney(bucket.amount)}</strong><small>{bucket.count} facture(s)</small></button>)}</div></section>
}
