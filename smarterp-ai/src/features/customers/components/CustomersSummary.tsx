import {
  Banknote,
  CircleDollarSign,
  Clock3,
  TrendingUp,
  Users,
} from 'lucide-react'
import { formatCurrency, formatNumber } from '../../../lib/format'
import type { Customer, CustomersData } from '../types/customers.types'

export function CustomersSummary({
  customers,
  data,
}: {
  customers: Customer[]
  data: CustomersData
}) {
  const active = customers.filter((customer) =>
    ['active', 'vip', 'at_risk'].includes(customer.status),
  ).length
  const outstanding = customers.reduce(
    (sum, customer) => sum + customer.outstanding,
    0,
  )
  const overdue = customers.reduce((sum, customer) => sum + customer.overdue, 0)
  const revenue = customers.reduce((sum, customer) => sum + customer.revenue, 0)
  const cards = [
    {
      title: 'Total clients',
      value: formatNumber(customers.length),
      caption: `${formatNumber(active)} actifs · ${
        customers.length - active
      } non actifs`,
      icon: Users,
      tone: 'text-blue-600 bg-blue-50',
      valueTone: 'text-blue-700',
    },
    {
      title: 'Encours total clients',
      value: formatCurrency(outstanding),
      caption: 'Solde des factures non réglées',
      icon: Banknote,
      tone: 'text-slate-600 bg-slate-100',
      valueTone: 'text-navy-950',
    },
    {
      title: 'Factures en retard',
      value: formatCurrency(overdue),
      caption: 'À prioriser dans les relances',
      icon: CircleDollarSign,
      tone: 'text-amber-600 bg-amber-50',
      valueTone: 'text-amber-700',
    },
    {
      title: 'Chiffre d’affaires annuel',
      value: formatCurrency(revenue),
      caption: `+${formatNumber(data.revenueGrowth, 1)} % vs N−1`,
      icon: TrendingUp,
      tone: 'text-emerald-600 bg-emerald-50',
      valueTone: 'text-navy-950',
    },
    {
      title: 'Délai moyen de paiement',
      value: `${data.dsoDays} jours`,
      caption: `Objectif : moins de ${data.dsoTarget} jours`,
      icon: Clock3,
      tone: 'text-indigo-600 bg-indigo-50',
      valueTone: 'text-navy-950',
    },
  ]
  return (
    <section
      aria-label="Indicateurs clients"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(({ title, value, caption, icon: Icon, tone, valueTone }) => (
        <article
          key={title}
          className="flex min-w-0 items-center justify-between gap-2 rounded border border-[#e5eaf4] bg-white px-3.5 py-3.5"
        >
          <div className="min-w-0">
            <h2 className="text-[9px] font-semibold uppercase tracking-[.04em] text-slate-500">
              {title}
            </h2>
            <p
              className={`mt-1.5 whitespace-nowrap text-[19px] font-semibold leading-6 tracking-tight ${valueTone}`}
            >
              {value}
            </p>
            <p className="mt-1 text-[9px] text-slate-500">{caption}</p>
          </div>
          <span
            className={`grid size-8 shrink-0 place-items-center rounded ${tone}`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </article>
      ))}
    </section>
  )
}
