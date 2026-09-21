import {
  CreditCard,
  FilePlus2,
  FileText,
  PackagePlus,
  Receipt,
  ShoppingCart,
  Sparkles,
  Upload,
  UserPlus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '../../../components/ui/Badge'
import { cn } from '../../../lib/cn'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercentage,
} from '../../../lib/format'
import type { DashboardData, DashboardInvoice } from '../types/dashboard.types'

const invoiceStatuses: Record<
  DashboardInvoice['status'],
  { label: string; tone: 'positive' | 'warning' | 'critical' | 'info' }
> = {
  paid: { label: 'Payée', tone: 'positive' },
  partial: { label: 'Partiellement payée', tone: 'info' },
  sent: { label: 'Envoyée', tone: 'warning' },
  overdue: { label: 'En retard', tone: 'critical' },
}

const quickActions = [
  {
    label: 'Créer une facture',
    description: 'Facture client directe',
    icon: Receipt,
  },
  {
    label: 'Créer un devis',
    description: 'Proposition tarifaire',
    icon: FilePlus2,
  },
  {
    label: 'Ajouter un client',
    description: 'Nouveau compte client',
    icon: UserPlus,
  },
  {
    label: 'Ajouter un produit',
    description: 'Fiche produit ou service',
    icon: PackagePlus,
  },
  {
    label: 'Commande fournisseur',
    description: 'Préparer un achat',
    icon: ShoppingCart,
  },
  {
    label: 'Enregistrer un paiement',
    description: 'Lettrage bancaire',
    icon: CreditCard,
  },
  {
    label: 'Ajouter une dépense',
    description: 'Frais professionnels',
    icon: FileText,
  },
  {
    label: 'Importer un document',
    description: 'Pièce comptable',
    icon: Upload,
  },
]

function comingSoon(module: string) {
  toast.info(`Le module ${module} sera disponible prochainement.`)
}

export function DashboardTables({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <section
          aria-labelledby="top-customers-title"
          className="dashboard-card min-w-0 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="top-customers-title" className="dashboard-title">
                Top 5 clients du mois
              </h2>
              <p className="dashboard-caption">
                Représentent {formatPercentage(data.topCustomersShare)} du CA
                global
              </p>
            </div>
            <button
              type="button"
              className="dashboard-text-link"
              onClick={() => comingSoon('Clients')}
            >
              Voir tous les clients
            </button>
          </div>
          <div
            className="dashboard-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tableau des meilleurs clients"
          >
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col" className="text-right!">
                    CA réalisé
                  </th>
                  <th scope="col" className="text-right!">
                    Commandes
                  </th>
                  <th scope="col" className="text-right!">
                    Encours
                  </th>
                  <th scope="col" className="text-right!">
                    Tendance
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="font-medium text-[#31486c]">
                      {customer.name}
                    </td>
                    <td className="text-right font-mono font-medium">
                      {formatCurrency(customer.revenue, data.currency)}
                    </td>
                    <td className="text-right font-mono">{customer.orders}</td>
                    <td
                      className={cn(
                        'text-right font-mono',
                        customer.outstanding > 40000
                          ? 'text-rose-500'
                          : customer.outstanding > 0
                            ? 'text-amber-600'
                            : 'text-slate-400',
                      )}
                    >
                      {formatCurrency(customer.outstanding, data.currency)}
                    </td>
                    <td
                      className={cn(
                        'text-right font-mono',
                        customer.trend >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-500',
                      )}
                    >
                      {customer.trend > 0 ? '+' : ''}
                      {formatPercentage(customer.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section
          aria-labelledby="top-products-title"
          className="dashboard-card min-w-0 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="top-products-title" className="dashboard-title">
                Top produits &amp; performance
              </h2>
              <p className="dashboard-caption">
                Les références qui contribuent à votre activité
              </p>
            </div>
            <button
              type="button"
              className="dashboard-text-link"
              onClick={() => comingSoon('Produits')}
            >
              Catalogue complet
            </button>
          </div>
          <div
            className="dashboard-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tableau des meilleurs produits"
          >
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th scope="col">Produit / SKU</th>
                  <th scope="col" className="text-right!">
                    CA généré
                  </th>
                  <th scope="col" className="text-right!">
                    Unités
                  </th>
                  <th scope="col" className="text-right!">
                    Marge
                  </th>
                  <th scope="col">Stock</th>
                  <th scope="col" className="text-right!">
                    Tendance
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <span className="font-medium text-[#31486c]">
                        {product.name}
                      </span>
                      <span className="mt-0.5 block text-[8px] text-slate-400">
                        {product.id}
                      </span>
                    </td>
                    <td className="text-right font-mono font-medium">
                      {formatCurrency(product.revenue, data.currency)}
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(product.units)}
                    </td>
                    <td
                      className={cn(
                        'text-right font-mono',
                        product.margin >= 28
                          ? 'text-emerald-600'
                          : 'text-amber-600',
                      )}
                    >
                      {formatPercentage(product.margin)}
                    </td>
                    <td>
                      <Badge
                        tone={product.status}
                        className="whitespace-nowrap text-[8px]"
                      >
                        {product.stockLabel} ({product.stock} u.)
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        'text-right font-mono',
                        product.trend >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-500',
                      )}
                    >
                      {product.trend > 0 ? '+' : ''}
                      {formatPercentage(product.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="recent-invoices-title"
          className="dashboard-card min-w-0 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="recent-invoices-title"
              className="dashboard-title flex items-center gap-2"
            >
              <FileText
                className="size-3.5 text-slate-400"
                aria-hidden="true"
              />
              Dernières factures émises
            </h2>
            <button
              type="button"
              className="dashboard-text-link"
              onClick={() => comingSoon('Facturation')}
            >
              Accéder à la facturation
            </button>
          </div>
          <div
            className="dashboard-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tableau des dernières factures"
          >
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th scope="col">N° facture</th>
                  <th scope="col">Client</th>
                  <th scope="col">Date émission</th>
                  <th scope="col">Échéance</th>
                  <th scope="col" className="text-right!">
                    Montant TTC
                  </th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="font-mono font-medium text-blue-600">
                      {invoice.id}
                    </td>
                    <td>{invoice.customer}</td>
                    <td className="font-mono text-slate-500">
                      {formatDate(invoice.date)}
                    </td>
                    <td
                      className={cn(
                        'font-mono',
                        invoice.status === 'overdue'
                          ? 'text-rose-600'
                          : 'text-slate-500',
                      )}
                    >
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td
                      className={cn(
                        'text-right font-mono font-medium',
                        invoice.status === 'overdue' && 'text-rose-600',
                      )}
                    >
                      {formatCurrency(invoice.amount, data.currency)}
                    </td>
                    <td>
                      <Badge
                        tone={invoiceStatuses[invoice.status].tone}
                        className="whitespace-nowrap text-[8px]"
                      >
                        {invoiceStatuses[invoice.status].label}
                        {invoice.overdueDays
                          ? ` (${invoice.overdueDays} j)`
                          : ''}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section
          aria-labelledby="quick-actions-title"
          className="dashboard-card min-w-0 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="quick-actions-title" className="dashboard-title">
              Actions rapides
            </h2>
            <span className="text-[9px] text-slate-400">
              Raccourcis dirigeant
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {quickActions.map(({ label, description, icon: Icon }) => (
              <button
                  key={label}
                  type="button"
                  aria-label={label}
                onClick={() =>
                  toast.info(
                    `« ${label} » sera disponible avec le module correspondant.`,
                  )
                }
                className="rounded border border-[#e4e9f2] bg-white px-2 py-3 text-center hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Icon
                  className="mx-auto mb-1.5 size-3.5 text-blue-600"
                  aria-hidden="true"
                />
                <span className="block text-[9px] font-semibold text-[#3e5273]">
                  {label}
                </span>
                <span className="mt-0.5 block text-[8px] text-slate-400">
                  {description}
                </span>
              </button>
            ))}
          </div>
          <Link
            to="/ai/control-center"
            className="mt-2 flex min-h-8 items-center justify-center gap-2 rounded border border-indigo-100 bg-indigo-50/60 px-2 py-2 text-[9px] font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Demander à SmartERP AI
          </Link>
        </section>
      </div>
    </div>
  )
}
