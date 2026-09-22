import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  Pencil,
  MoreHorizontal,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Checkbox } from '../../../components/ui/Checkbox'
import { formatCurrency, formatDate } from '../../../lib/format'
import {
  customerInitials,
  groupCustomers,
  statusLabels,
  statusTones,
  typeLabels,
} from '../types/customers.types'
import type { Customer, CustomerGroup } from '../types/customers.types'

export function CustomerTable({
  customers,
  groupBy,
  selectedIds,
  onSelect,
  onSelectPage,
  onEdit,
  onArchive,
  onMore,
  canEdit,
}: {
  customers: Customer[]
  groupBy: CustomerGroup
  selectedIds: number[]
  onSelect: (id: number) => void
  onSelectPage: () => void
  onEdit: (customer: Customer) => void
  onArchive: (customer: Customer) => void
  onMore: (customer: Customer) => void
  canEdit: boolean
}) {
  const navigate = useNavigate()
  const groups = groupCustomers(customers, groupBy)
  const selectedOnPage = customers.filter((customer) =>
    selectedIds.includes(customer.id),
  ).length
  return (
    <div
      className="customers-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Liste des clients"
    >
      <table className="customers-table">
        <thead>
          <tr>
            <th scope="col" className="w-8">
              <Checkbox
                aria-label="Sélectionner tous les clients de cette page"
                checked={
                  customers.length > 0 && selectedOnPage === customers.length
                }
                ref={(element) => {
                  if (element)
                    element.indeterminate =
                      selectedOnPage > 0 && selectedOnPage < customers.length
                }}
                onChange={onSelectPage}
                className="size-3.5"
              />
            </th>
            {[
              'Client / référence',
              'Type',
              'Téléphone',
              'E-mail',
              'Ville / région',
              'Commercial',
              'CA annuel',
              'Encours client',
              'Dernière activité',
              'Statut / signaux IA',
              'Actions',
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.label}>
            {groupBy !== 'none' && (
              <tr className="customers-group-row">
                <th scope="rowgroup" colSpan={12}>
                  {group.label}
                  <span className="ml-2 font-normal text-slate-400">
                    {group.customers.length} sur cette page
                  </span>
                </th>
              </tr>
            )}
            {group.customers.map((customer) => (
              <tr
                key={customer.id}
                data-selected={selectedIds.includes(customer.id)}
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                <td onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    aria-label={`Sélectionner ${customer.name}`}
                    checked={selectedIds.includes(customer.id)}
                    onChange={() => onSelect(customer.id)}
                    className="size-3.5"
                  />
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span
                      className={`customers-avatar ${
                        customer.type === 'individual'
                          ? 'bg-violet-100 text-violet-700'
                          : customer.status === 'vip'
                          ? 'bg-indigo-700 text-white'
                          : 'bg-[#18263e] text-white'
                      }`}
                    >
                      {customerInitials(customer.name)}
                    </span>
                    <div>
                      <Link
                        to={`/customers/${customer.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-semibold leading-4 text-navy-950 hover:text-blue-600 hover:underline"
                      >
                        {customer.name}
                      </Link>
                      <p className="mt-1 font-mono text-[8px] text-slate-400">
                        {customer.reference}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge
                    tone={customer.type === 'company' ? 'neutral' : 'indigo'}
                    className="text-[8px]"
                  >
                    {typeLabels[customer.type]}
                  </Badge>
                </td>
                <td className="whitespace-nowrap font-mono text-[8px] text-slate-500">
                  {customer.phone}
                </td>
                <td>
                  <a
                    href={`mailto:${customer.email}`}
                    onClick={(event) => event.stopPropagation()}
                    className="block max-w-[132px] truncate text-[9px] text-slate-500 hover:text-blue-600"
                    title={customer.email}
                  >
                    {customer.email}
                  </a>
                </td>
                <td>
                  <p>{customer.city}</p>
                  <p className="mt-1 text-[8px] text-slate-400">
                    {customer.district}
                  </p>
                </td>
                <td>
                  <span className="flex items-center gap-1.5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-violet-50 text-[7px] font-semibold text-violet-600">
                      {customerInitials(customer.salesperson)}
                    </span>
                    <span className="max-w-20 text-[9px]">
                      {customer.salesperson}
                    </span>
                  </span>
                </td>
                <td className="text-right font-mono text-[9px] font-medium">
                  {formatCurrency(customer.revenue)}
                </td>
                <td
                  className={`text-right font-mono text-[9px] ${
                    customer.outstanding ? 'text-amber-700' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrency(customer.outstanding)}
                  {customer.overdue > 0 && (
                    <p className="mt-1 text-[8px] text-rose-500">
                      {formatCurrency(customer.overdue)} en retard
                    </p>
                  )}
                </td>
                <td>
                  <time
                    dateTime={customer.lastActivity}
                    className="text-[9px] text-slate-500"
                  >
                    {formatDate(customer.lastActivity)}
                  </time>
                  <p className="mt-1 text-[8px] leading-3.5 text-slate-400">
                    {customer.activity}
                  </p>
                </td>
                <td>
                  <Badge
                    tone={statusTones[customer.status]}
                    className="text-[8px]"
                  >
                    {statusLabels[customer.status]}
                  </Badge>
                  {customer.signal && (
                    <Badge
                      tone={customer.signal.tone}
                      className="mt-1 block w-fit text-[8px]"
                    >
                      {customer.signal.label}
                    </Badge>
                  )}
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-1">
                    <Link
                      to={`/customers/${customer.id}`}
                      aria-label={`Ouvrir ${customer.name}`}
                      title="Ouvrir"
                      className="customers-row-action"
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                    <button
                      type="button"
                      className="customers-row-action"
                      aria-label={`Modifier ${customer.name}`}
                      title="Modifier"
                      disabled={!canEdit}
                      onClick={() => onEdit(customer)}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      className="customers-row-action"
                      aria-label={`${
                        customer.status === 'archived'
                          ? 'Désarchiver'
                          : 'Archiver'
                      } ${customer.name}`}
                      title={
                        customer.status === 'archived'
                          ? 'Désarchiver'
                          : 'Archiver'
                      }
                      disabled={!canEdit}
                      onClick={() => onArchive(customer)}
                    >
                      {customer.status === 'archived' ? (
                        <ArchiveRestore className="size-3" />
                      ) : (
                        <Archive className="size-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="customers-row-action"
                      aria-label={`Plus d’actions pour ${customer.name}`}
                      title="Plus d’actions"
                      onClick={() => onMore(customer)}
                    >
                      <MoreHorizontal className="size-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
