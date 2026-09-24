import { useFormContext } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { useCustomers } from '../../customers/hooks/useCustomers'
import type { InvoiceDetail, InvoiceInput } from '../types/invoices.types'

export function InvoiceForm({ invoice, disabled, onCustomer }: { invoice: InvoiceDetail | null; disabled: boolean; onCustomer: (customer: { id: number; name: string; email: string } | null) => void }) {
  const { register, setValue, formState: { errors } } = useFormContext<InvoiceInput>()
  const customers = useCustomers()
  const canView = customers.data?.permissions.includes('customers.view')
  const rows = canView ? customers.data?.customers ?? [] : []
  return <section className="invoice-card" aria-labelledby="invoice-form-title"><header className="invoice-section-title"><SlidersHorizontal size={15} /><h2 id="invoice-form-title">Informations de facturation</h2><span>MAD</span></header>
    <fieldset disabled={disabled} className="invoice-form-grid"><div className="invoice-field-wide"><label htmlFor="invoice-customer">Client *</label><select id="invoice-customer" {...register('customerId', { valueAsNumber: true, onChange: (event) => {
      const customer = rows.find((item) => item.id === Number(event.target.value))
      onCustomer(customer ?? null)
      setValue('billingAddress', customer ? [customer.district, customer.city].filter(Boolean).join(', ') : '', { shouldDirty: true })
    } })} disabled={disabled || !canView} aria-invalid={!!errors.customerId}><option value={0}>Sélectionner un client</option>{invoice && !rows.some((customer) => customer.id === invoice.customerId) && <option value={invoice.customerId}>{invoice.customerName}</option>}{rows.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.reference}</option>)}</select><p className="invoice-field-error">{errors.customerId?.message}</p>
      {!disabled && customers.isPending && <p className="invoice-muted">Chargement des clients…</p>}{!disabled && customers.isError && <p className="invoice-error">Impossible de charger les clients. <button type="button" onClick={() => void customers.refetch()}>Réessayer</button></p>}{!disabled && customers.data && !canView && <p className="invoice-muted">Sélection indisponible sans accès aux clients.</p>}</div>
      <div className="invoice-field-wide"><label htmlFor="invoice-address">Adresse de facturation</label><textarea id="invoice-address" rows={2} {...register('billingAddress')} /><p className="invoice-field-error">{errors.billingAddress?.message}</p></div>
      <div><label htmlFor="invoice-date">Date facture *</label><input id="invoice-date" type="date" {...register('invoiceDate')} aria-invalid={!!errors.invoiceDate} /><p className="invoice-field-error">{errors.invoiceDate?.message}</p></div>
      <div><label htmlFor="invoice-due">Date échéance *</label><input id="invoice-due" type="date" {...register('dueDate')} aria-invalid={!!errors.dueDate} /><p className="invoice-field-error">{errors.dueDate?.message}</p></div>
      <div><label htmlFor="invoice-salesperson">Commercial *</label><input id="invoice-salesperson" {...register('salesperson')} aria-invalid={!!errors.salesperson} /><p className="invoice-field-error">{errors.salesperson?.message}</p></div>
      <div><label htmlFor="invoice-currency">Devise</label><select id="invoice-currency" {...register('currency')}><option value="MAD">MAD — Dirham marocain</option></select></div>
      <div><label htmlFor="invoice-terms">Conditions de paiement</label><input id="invoice-terms" {...register('paymentTerms')} /><p className="invoice-field-error">{errors.paymentTerms?.message}</p></div>
      <div><label htmlFor="invoice-reference">Référence client</label><input id="invoice-reference" {...register('customerReference')} /><p className="invoice-field-error">{errors.customerReference?.message}</p></div>
      <div className="invoice-field-wide invoice-source-field"><span>Commande source</span>{invoice?.salesOrderId ? <Link to={`/sales/${invoice.salesOrderId}`}>{invoice.salesOrderReference}</Link> : <span>Aucune commande liée</span>}</div>
    </fieldset>
  </section>
}
