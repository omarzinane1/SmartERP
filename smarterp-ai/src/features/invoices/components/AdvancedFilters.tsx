import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { defaultInvoiceFilters } from '../utils/invoiceCalculations'
import { paymentLabels, workflowLabels, type InvoiceFilters, type InvoiceSummary } from '../types/invoices.types'

const quickInvoiceFilters = [['all', 'Toutes'], ['draft', 'Brouillons'], ['unpaid', 'Impayées'], ['partial', 'Partiellement payées'], ['overdue', 'En retard'], ['paid', 'Payées'], ['soon', 'Échéance sous 7 jours']]
const labels: Record<keyof InvoiceFilters, string> = { search: 'Recherche', quick: 'Vue', customerId: 'Client', salesperson: 'Commercial', workflow: 'Statut comptable', payment: 'Paiement', dateFrom: 'Date depuis', dateTo: 'Date jusqu’au', dueFrom: 'Échéance depuis', dueTo: 'Échéance jusqu’au', minAmount: 'TTC min.', maxAmount: 'TTC max.', aging: 'Ancienneté' }
export function AdvancedFilters({ invoices, filters, expanded, onChange }: { invoices: InvoiceSummary[]; filters: InvoiceFilters; expanded: boolean; onChange: (filters: InvoiceFilters) => void }) {
  const customers = [...new Map(invoices.map((invoice) => [invoice.customerId, invoice.customerName])).entries()]
  const update = (key: keyof InvoiceFilters, value: string) => onChange({ ...filters, [key]: value })
  const active = (Object.keys(filters) as (keyof InvoiceFilters)[]).filter((key) => filters[key] !== defaultInvoiceFilters[key])
  function valueLabel(key: keyof InvoiceFilters) {
    const value = filters[key]
    return key === 'customerId' ? customers.find(([id]) => String(id) === value)?.[1] ?? value : key === 'workflow' ? workflowLabels[value as keyof typeof workflowLabels] : key === 'payment' ? paymentLabels[value as keyof typeof paymentLabels] : key === 'quick' ? quickInvoiceFilters.find(([id]) => id === value)?.[1] : value
  }
  return <><div className="invoice-quick-filters" aria-label="Filtres rapides">{quickInvoiceFilters.map(([key, label]) => <button key={key} aria-pressed={filters.quick === key} onClick={() => update('quick', key)}>{label}</button>)}</div>
    {expanded && <section id="invoice-advanced-filters" className="invoice-advanced" aria-label="Filtres avancés">
      <label>Statut comptable<select value={filters.workflow} onChange={(event) => update('workflow', event.target.value)}><option value="">Tous</option>{Object.entries(workflowLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Client<select value={filters.customerId} onChange={(event) => update('customerId', event.target.value)}><option value="">Tous les clients</option>{customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Commercial<select value={filters.salesperson} onChange={(event) => update('salesperson', event.target.value)}><option value="">Tous les commerciaux</option>{[...new Set(invoices.map((invoice) => invoice.salesperson))].map((name) => <option key={name}>{name}</option>)}</select></label>
      <label>Paiement<select value={filters.payment} onChange={(event) => update('payment', event.target.value)}><option value="">Tous les paiements</option>{Object.entries(paymentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {(['dateFrom', 'dateTo', 'dueFrom', 'dueTo'] as const).map((key) => <label key={key}>{labels[key]}<input type="date" value={filters[key]} onChange={(event) => update(key, event.target.value)} /></label>)}
      {(['minAmount', 'maxAmount'] as const).map((key) => <label key={key}>{labels[key]} (MAD)<input type="number" min="0" step="0.01" value={filters[key]} onChange={(event) => update(key, event.target.value)} /></label>)}
      <label>Tranche d’aging<select value={filters.aging} onChange={(event) => update('aging', event.target.value)}><option value="">Toutes</option><option value="current">Non échues</option>{['1-30', '31-60', '61-90', '90+'].map((key) => <option key={key} value={key}>{key} jours</option>)}</select></label>
    </section>}
    {!!active.length && <div className="invoice-filter-chips" aria-label="Filtres actifs">{active.map((key) => <button key={key} aria-label={`Retirer le filtre ${labels[key]}`} onClick={() => update(key, defaultInvoiceFilters[key])}>{labels[key]} : {valueLabel(key)}<X size={10} aria-hidden="true" /></button>)}<Button variant="ghost" className="invoice-button" onClick={() => onChange({ ...defaultInvoiceFilters })}>Réinitialiser</Button></div>}
  </>
}
