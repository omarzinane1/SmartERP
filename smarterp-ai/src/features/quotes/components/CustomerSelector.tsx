import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Search, Building2 } from 'lucide-react'
import { Input } from '../../../components/ui/Input'
import { useCustomers } from '../../customers/hooks/useCustomers'
import type { QuoteInput } from '../types/quotes.types'

export function CustomerSelector({ disabled, onChange }: { disabled: boolean; onChange: (customer: { id: number; name: string; email: string } | null) => void }) {
  const { control, setValue, formState: { errors } } = useFormContext<QuoteInput>()
  const customerId = useWatch({ control, name: 'customerId' })
  const [search, setSearch] = useState('')
  const query = useCustomers()
  const canView = query.data?.permissions.includes('customers.view')
  const customers = canView ? query.data?.customers ?? [] : []
  const selected = customers.find((customer) => customer.id === customerId)
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filtered = customers.filter((customer) => customer.id === customerId || normalize(`${customer.name} ${customer.reference} ${customer.email} ${customer.city}`).includes(normalize(search)))
  return <div className="quote-customer-selector">
    <label htmlFor="quote-customer-search">Rechercher un client</label>
    <Input id="quote-customer-search" placeholder="Nom, référence, e-mail ou ville…" leadingIcon={<Search className="size-3.5" />}
      value={search} disabled={disabled || !canView} onChange={(event) => setSearch(event.target.value)} />
    <label htmlFor="quote-customer" className="mt-3">Client <span className="text-danger-text">*</span></label>
    <select id="quote-customer" value={customerId} disabled={disabled || !canView} aria-invalid={!!errors.customerId} aria-describedby="quote-customer-error"
      onChange={(event) => {
        const id = Number(event.target.value)
        const customer = customers.find((item) => item.id === id)
        onChange(customer ?? null)
        setValue('customerId', id, { shouldDirty: true, shouldValidate: true })
        setValue('billingAddress', customer ? [customer.district, customer.city].filter(Boolean).join(', ') : '', { shouldDirty: true })
      }}>
      <option value={0}>Sélectionner un client</option>
      {!!customerId && !selected && <option value={customerId}>Client actuel · {customerId}</option>}
      {filtered.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.reference} · {customer.city}</option>)}
    </select>
    <p id="quote-customer-error" className="quote-field-error">{errors.customerId?.message}</p>
    {query.isPending && <p role="status" className="quote-field-help">Chargement des clients…</p>}
    {query.isError && <p role="alert" className="quote-field-error">Impossible de charger les clients. <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="underline">Réessayer</button></p>}
    {(query.isForbidden || (query.data && !canView)) && <p className="quote-field-help">La sélection des clients nécessite la permission de consultation des clients.</p>}
    {selected && <div className="quote-customer-card"><Building2 className="size-5 text-primary-text" /><div>
      <strong>{selected.name}</strong><p>{selected.reference} · {selected.city}</p><p>{selected.email}</p>
    </div></div>}
    {canView && !filtered.length && <p className="quote-field-help">Aucun client trouvé.</p>}
  </div>
}
