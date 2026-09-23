import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../../../components/ui/Alert'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { useAuthStore } from '../../../store/auth.store'
import { formatDate, formatNumber } from '../../../lib/format'
import { useCustomers } from '../hooks/useCustomers'
import { CustomersSummary } from '../components/CustomersSummary'
import { CustomersToolbar } from '../components/CustomersToolbar'
import { CustomersFilters } from '../components/CustomersFilters'
import { CustomerTable } from '../components/CustomerTable'
import { CustomerKanban } from '../components/CustomerKanban'
import { CustomerSelectionBar } from '../components/CustomerSelectionBar'
import { CustomerDialog } from '../components/CustomerDialog'
import { statusLabels, typeLabels } from '../types/customers.types'
import type {
  Customer,
  CustomerAction,
  CustomerFilters,
  CustomerInput,
  CustomerView,
} from '../types/customers.types'
import '../customers.css'

const defaultFilters: CustomerFilters = {
  search: '',
  status: 'all',
  city: 'all',
  outstanding: false,
  overdue: false,
  salesperson: 'all',
  groupBy: 'none',
}
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function exportCustomers(customers: Customer[], isDemo: boolean) {
  const quote = (value: string | number) => {
    const text = String(value)
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = [
    [
      'Référence',
      'Client',
      'Type',
      'Téléphone',
      'E-mail',
      'Ville',
      'Commercial',
      'CA annuel MAD',
      'Encours MAD',
      'Retard MAD',
      'Dernière activité',
      'Statut',
      'Tags',
      'Source',
    ],
    ...customers.map((customer) => [
      customer.reference,
      customer.name,
      typeLabels[customer.type],
      customer.phone,
      customer.email,
      customer.city,
      customer.salesperson,
      customer.revenue,
      customer.outstanding,
      customer.overdue,
      customer.lastActivity,
      statusLabels[customer.status],
      customer.tags.join(', '),
      isDemo ? 'Démonstration' : 'API',
    ]),
  ]
  const url = URL.createObjectURL(
    new Blob(
      ['\uFEFF' + rows.map((row) => row.map(quote).join(';')).join('\r\n')],
      { type: 'text/csv;charset=utf-8;' },
    ),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `clients${isDemo ? '-demo' : ''}.csv`
  link.click()
  URL.revokeObjectURL(url)
  toast.success(`${customers.length} clients exportés.`)
}

export function CustomersPage() {
  const { data, isPending, isError, isForbidden, isFetching, refetch, isDemo } =
    useCustomers()
  const company = useAuthStore((state) => state.company)
  const [filters, setFilters] = useState<CustomerFilters>(defaultFilters)
  const [viewMode, setViewMode] = useState<CustomerView>('list')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [patches, setPatches] = useState<Record<number, Partial<Customer>>>({})
  const [created, setCreated] = useState<Customer[]>([])
  const [savedView, setSavedView] = useState<{
    filters: CustomerFilters
    view: CustomerView
  } | null>(null)
  const [dialog, setDialog] = useState<{
    action: CustomerAction
    customer?: Customer
  } | null>(null)

  useEffect(() => {
    function closeMenus(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      document
        .querySelectorAll<HTMLDetailsElement>('.customers-page details[open]')
        .forEach((menu) => {
          if (
            event instanceof KeyboardEvent ||
            !menu.contains(event.target as Node)
          )
            menu.open = false
        })
    }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeMenus)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeMenus)
    }
  }, [])

  if (isForbidden || (data && !data.permissions.includes('customers.view')))
    return (
      <main className="dashboard-page">
        <div className="dashboard-card mx-auto mt-14 max-w-xl p-8 text-center">
          <ShieldAlert className="mx-auto size-9 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold text-navy-950">
            Accès non autorisé
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Vous ne disposez pas des permissions nécessaires pour consulter les
            clients.
          </p>
        </div>
      </main>
    )
  if (isPending)
    return (
      <main className="dashboard-page customers-page" aria-busy="true">
        <h1 className="text-2xl font-semibold text-navy-950">Clients</h1>
        <p
          role="status"
          className="my-5 flex items-center gap-2 text-xs text-slate-500"
        >
          <Spinner />
          Chargement des clients…
        </p>
        <div className="dashboard-card p-4" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="my-4 h-9 animate-pulse rounded bg-slate-100"
            />
          ))}
        </div>
      </main>
    )
  if (isError || !data)
    return (
      <main className="dashboard-page customers-page">
        <h1 className="mb-5 text-2xl font-semibold text-navy-950">Clients</h1>
        <Alert variant="error">Impossible de charger les clients.</Alert>
        <Button
          className="customers-button mt-4"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className="size-3.5" />
          Réessayer
        </Button>
      </main>
    )

  const can = {
    create: data.permissions.includes('customers.create'),
    edit: data.permissions.includes('customers.edit'),
    export: data.permissions.includes('customers.export'),
  }
  const customers = [...created, ...data.customers].map((customer) => ({
    ...customer,
    ...patches[customer.id],
  }))
  const search = normalize(filters.search.trim())
  const filtered = customers.filter(
    (customer) =>
      (filters.status === 'all' || customer.status === filters.status) &&
      (filters.city === 'all' || customer.city === filters.city) &&
      (filters.salesperson === 'all' ||
        customer.salesperson === filters.salesperson) &&
      (!filters.outstanding || customer.outstanding > 0) &&
      (!filters.overdue || customer.overdue > 0) &&
      normalize(
        `${customer.name} ${customer.reference} ${customer.email} ${
          customer.phone
        } ${customer.city} ${customer.tags.join(' ')}`,
      ).includes(search),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const pageCustomers = filtered.slice(start, start + pageSize)
  const selected = customers.filter((customer) =>
    selectedIds.includes(customer.id),
  )
  const cities = [...new Set(customers.map((customer) => customer.city))].sort(
    (a, b) => a.localeCompare(b, 'fr'),
  )
  const active = customers.filter((customer) =>
    ['active', 'vip', 'at_risk'].includes(customer.status),
  ).length
  const newThisMonth = customers.filter(
    (customer) =>
      customer.createdAt.slice(0, 7) === data.period.asOf.slice(0, 7),
  ).length

  function applyFilters(update: Partial<CustomerFilters>) {
    setFilters((current) => ({ ...current, ...update }))
    setPage(1)
    setSelectedIds([])
  }
  function toggleCustomer(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }
  function selectPage() {
    const ids = pageCustomers.map((customer) => customer.id)
    setSelectedIds((current) =>
      ids.every((id) => current.includes(id))
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    )
  }
  function archiveCustomers(targets: Customer[], archive: boolean) {
    if (!can.edit) return
    if (!isDemo) {
      toast.info('L’archivage sera disponible dans une prochaine étape.')
      return
    }
    const changed = targets.filter((customer) =>
      archive ? customer.status !== 'archived' : customer.status === 'archived',
    )
    setPatches((current) => {
      const next = { ...current }
      for (const customer of changed) {
        next[customer.id] = {
          ...next[customer.id],
          status: archive ? 'archived' : customer.previousStatus ?? 'active',
          previousStatus:
            customer.status !== 'archived'
              ? customer.status
              : customer.previousStatus,
        }
      }
      return next
    })
    setSelectedIds([])
    toast.success(
      `${changed.length} client(s) ${
        archive ? 'archivé(s)' : 'désarchivé(s)'
      } dans la démonstration.`,
    )
  }
  function saveCustomer(input: CustomerInput) {
    if (!isDemo || !data || !dialog) return
    if (dialog.action === 'edit' && dialog.customer && can.edit) {
      const id = dialog.customer.id
      setPatches((current) => ({
        ...current,
        [id]: { ...current[id], ...input },
      }))
    } else if (dialog.action === 'create' && can.create) {
      const id = Math.max(0, ...customers.map((customer) => customer.id)) + 1
      setCreated((current) => [
        {
          ...input,
          id,
          reference: `CUS-${String(id).padStart(6, '0')}`,
          district: '',
          revenue: 0,
          outstanding: 0,
          overdue: 0,
          lastActivity: data.period.asOf,
          createdAt: data.period.asOf,
          activity: 'Fiche créée',
          status: 'prospect',
          tags: [],
        },
        ...current,
      ])
      applyFilters(defaultFilters)
    }
    setDialog(null)
    toast.success('Fiche client enregistrée dans la démonstration.')
  }
  function updateSelection(update: (customer: Customer) => Partial<Customer>) {
    if (!isDemo || !can.edit) return
    setPatches((current) => {
      const next = { ...current }
      for (const customer of selected)
        next[customer.id] = { ...next[customer.id], ...update(customer) }
      return next
    })
    setDialog(null)
    toast.success(
      `${selected.length} client(s) mis à jour dans la démonstration.`,
    )
  }
  function applyFavorite(name: string) {
    if (name === 'saved' && savedView) {
      applyFilters(savedView.filters)
      setViewMode(savedView.view)
      return
    }
    const favorite =
      name === 'mine'
        ? { salesperson: data?.currentSalesperson ?? 'all' }
        : name === 'top'
        ? { status: 'vip' as const }
        : name === 'overdue'
        ? { overdue: true }
        : name === 'casablanca'
        ? { city: 'Casablanca' }
        : {}
    applyFilters({ ...defaultFilters, ...favorite })
  }

  return (
    <main
      className={`dashboard-page customers-page ${
        selected.length ? 'has-selection' : ''
      }`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] font-semibold tracking-tight text-navy-950">
              Clients
            </h1>
            <Badge tone="info" className="rounded-full">
              {company?.name ?? 'Votre société'}
            </Badge>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Gérez l’ensemble des clients de votre société et suivez leur
            activité commerciale.
          </p>
        </div>
        <div className="text-[10px] sm:text-right">
          <p className="font-semibold text-slate-600">
            {formatNumber(active)} clients actifs{' '}
            <span className="font-normal text-emerald-600">
              · +{newThisMonth} nouveaux ce mois
            </span>
          </p>
          <p className="mt-1.5 text-[9px] text-slate-400">
            {isDemo ? 'Données de démonstration' : 'Dernière synchronisation'} ·{' '}
            {formatDate(data.period.syncedAt.slice(0, 10))}
          </p>
        </div>
      </header>
      <CustomersSummary customers={customers} data={data} />
      <section
        className="dashboard-card mt-4 min-w-0"
        aria-label="Portefeuille clients"
      >
        <CustomersToolbar
          search={filters.search}
          onSearch={(value) => applyFilters({ search: value })}
          viewMode={viewMode}
          onView={setViewMode}
          selectedCount={selected.length}
          canCreate={can.create}
          canEdit={can.edit}
          canExport={can.export}
          onCreate={() => setDialog({ action: 'create' })}
          onImport={() => setDialog({ action: 'import' })}
          onExport={() => {
            if (can.export) exportCustomers(filtered, isDemo)
          }}
          onArchive={(archive) => archiveCustomers(selected, archive)}
          onAssign={() => setDialog({ action: 'assign' })}
        />
        <CustomersFilters
          filters={filters}
          cities={cities}
          salespeople={data.salespeople}
          onChange={applyFilters}
          onReset={() => applyFilters(defaultFilters)}
          onFavorite={applyFavorite}
          onSave={() => {
            setSavedView({ filters: { ...filters }, view: viewMode })
            toast.success('Vue enregistrée pour cette session.')
          }}
          hasSavedView={savedView !== null}
          count={filtered.length}
        />
        {filtered.length === 0 ? (
          <div
            className="border-t border-slate-100 px-4 py-16 text-center"
            role="status"
          >
            <Users className="mx-auto size-9 text-slate-300" />
            <h2 className="mt-4 text-sm font-semibold text-slate-600">
              {customers.length === 0
                ? 'Aucun client pour le moment.'
                : 'Aucun client ne correspond à vos critères.'}
            </h2>
            {customers.length === 0 ? (
              <div className="mt-5 flex justify-center gap-2">
                <Button
                  className="customers-button"
                  disabled={!can.create}
                  onClick={() => setDialog({ action: 'create' })}
                >
                  Créer un client
                </Button>
                <Button
                  variant="secondary"
                  className="customers-button"
                  disabled={!can.create}
                  onClick={() => setDialog({ action: 'import' })}
                >
                  Importer des clients
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="customers-button mt-4"
                onClick={() => applyFilters(defaultFilters)}
              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <CustomerTable
            customers={pageCustomers}
            groupBy={filters.groupBy}
            selectedIds={selectedIds}
            onSelect={toggleCustomer}
            onSelectPage={selectPage}
            onEdit={(customer) => setDialog({ action: 'edit', customer })}
            onArchive={(customer) =>
              archiveCustomers([customer], customer.status !== 'archived')
            }
            onMore={(customer) => setSelectedIds([customer.id])}
            canEdit={can.edit}
          />
        ) : (
          <CustomerKanban
            customers={pageCustomers}
            groupBy={filters.groupBy}
            selectedIds={selectedIds}
            onSelect={toggleCustomer}
            onEdit={(customer) => setDialog({ action: 'edit', customer })}
            canEdit={can.edit}
          />
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-[10px] text-slate-500" aria-live="polite">
            {filtered.length ? start + 1 : 0}–
            {Math.min(start + pageSize, filtered.length)} sur{' '}
            {formatNumber(filtered.length)} clients
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[9px] text-slate-400">
              Par page
              <select
                aria-label="Clients par page"
                className="customers-select"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
            <span className="text-[9px] text-slate-400">
              Page {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              aria-label="Page précédente"
              className="customers-row-action border border-slate-200"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Page suivante"
              className="customers-row-action border border-slate-200"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </footer>
      </section>
      <p className="mt-3 text-[9px] text-slate-400">
        {data.period.label} · Montants en MAD · Les indicateurs couvrent
        l’ensemble du portefeuille.{' '}
        {isDemo &&
          'Les modifications de démonstration sont réinitialisées en quittant cette page.'}
      </p>
      <CustomerSelectionBar
        selected={selected}
        hiddenCount={
          selected.filter(
            (customer) =>
              !pageCustomers.some((item) => item.id === customer.id),
          ).length
        }
        canEdit={can.edit}
        canExport={can.export}
        canCreate={can.create}
        onClear={() => setSelectedIds([])}
        onExport={() => {
          if (can.export) exportCustomers(selected, isDemo)
        }}
        onArchive={() => archiveCustomers(selected, true)}
        onAction={(action) =>
          setDialog({
            action,
            customer: selected.length === 1 ? selected[0] : undefined,
          })
        }
      />
      {dialog && (
        <CustomerDialog
          key={`${dialog.action}-${dialog.customer?.id ?? ''}`}
          action={dialog.action}
          customer={dialog.customer}
          selectedCount={selected.length}
          salespeople={data.salespeople}
          isDemo={isDemo}
          onClose={() => setDialog(null)}
          onSave={saveCustomer}
          onAssign={(salesperson) => updateSelection(() => ({ salesperson }))}
          onTag={(tag) =>
            updateSelection((customer) => ({
              tags: [...new Set([...customer.tags, tag])],
            }))
          }
        />
      )}
    </main>
  )
}
