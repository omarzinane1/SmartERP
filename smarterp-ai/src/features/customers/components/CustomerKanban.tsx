import { Link } from 'react-router-dom'
import { MapPin, Pencil } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Checkbox } from '../../../components/ui/Checkbox'
import { formatCurrency, formatDate } from '../../../lib/format'
import {
  customerInitials,
  groupCustomers,
  statusLabels,
  statusTones,
} from '../types/customers.types'
import type { Customer, CustomerGroup } from '../types/customers.types'

export function CustomerKanban({
  customers,
  groupBy,
  selectedIds,
  onSelect,
  onEdit,
  canEdit,
}: {
  customers: Customer[]
  groupBy: CustomerGroup
  selectedIds: number[]
  onSelect: (id: number) => void
  onEdit: (customer: Customer) => void
  canEdit: boolean
}) {
  return (
    <section
      aria-label="Vue Kanban des clients"
      className="customers-kanban-scroll border-t border-slate-100 bg-[var(--surface-2)] p-4"
    >
      {groupCustomers(customers, groupBy).map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          {groupBy !== 'none' && (
            <h2 className="mb-3 text-xs font-semibold text-slate-600">
              {group.label}
              <span className="ml-2 text-[10px] font-normal text-slate-400">
                {group.customers.length} sur cette page
              </span>
            </h2>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.customers.map((customer) => (
              <article
                key={customer.id}
                data-selected={selectedIds.includes(customer.id)}
                className="customers-kanban-card rounded-md border border-slate-200 bg-surface p-3.5"
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    aria-label={`Sélectionner ${customer.name}`}
                    checked={selectedIds.includes(customer.id)}
                    onChange={() => onSelect(customer.id)}
                    className="mt-1 size-3.5"
                  />
                  <span className="customers-avatar bg-[var(--primary)] text-white">
                    {customerInitials(customer.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="text-[11px] font-semibold text-navy-950 hover:text-primary-text"
                    >
                      {customer.name}
                    </Link>
                    <p className="mt-1 font-mono text-[8px] text-slate-400">
                      {customer.reference}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Modifier ${customer.name}`}
                    title="Modifier"
                    className="customers-row-action"
                    disabled={!canEdit}
                    onClick={() => onEdit(customer)}
                  >
                    <Pencil className="size-3" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-1">
                  <p className="flex items-center gap-1 text-[9px] text-slate-500">
                    <MapPin className="size-3" />
                    {customer.city}
                  </p>
                  <Badge tone={statusTones[customer.status]}>
                    {statusLabels[customer.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-[9px] text-slate-500">
                  Commercial : {customer.salesperson}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 border-y border-slate-100 py-2.5">
                  <div>
                    <dt className="text-[8px] uppercase text-slate-400">
                      CA annuel
                    </dt>
                    <dd className="mt-1 text-[11px] font-semibold">
                      {formatCurrency(customer.revenue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[8px] uppercase text-slate-400">
                      Encours
                    </dt>
                    <dd
                      className={`mt-1 text-[11px] font-semibold ${
                        customer.outstanding
                          ? 'text-warning-text'
                          : 'text-success-text'
                      }`}
                    >
                      {formatCurrency(customer.outstanding)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[9px] text-slate-400">
                  {formatDate(customer.lastActivity)} · {customer.activity}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {customer.tags.map((tag) => (
                    <Badge key={tag} tone="neutral" className="text-[8px]">
                      {tag}
                    </Badge>
                  ))}
                  {customer.signal && (
                    <Badge tone={customer.signal.tone} className="text-[8px]">
                      {customer.signal.label}
                    </Badge>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
