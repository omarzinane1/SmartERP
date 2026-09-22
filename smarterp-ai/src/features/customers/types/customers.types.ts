export type CustomerStatus =
  | 'active'
  | 'prospect'
  | 'inactive'
  | 'archived'
  | 'at_risk'
  | 'vip'
export type CustomerPermission =
  | 'customers.view'
  | 'customers.create'
  | 'customers.edit'
  | 'customers.export'
  | 'sales.view'
  | 'invoices.view'
  | 'payments.view'
  | 'ai.use'
export type CustomerView = 'list' | 'kanban'
export type CustomerGroup = 'none' | 'salesperson' | 'city' | 'status' | 'type'

export interface Customer {
  id: number
  reference: string
  name: string
  type: 'company' | 'individual'
  phone: string
  email: string
  city: string
  district: string
  salesperson: string
  revenue: number
  outstanding: number
  overdue: number
  lastActivity: string
  activity: string
  createdAt: string
  status: CustomerStatus
  previousStatus?: Exclude<CustomerStatus, 'archived'>
  tags: string[]
  signal?: { label: string; tone: 'critical' | 'indigo' | 'positive' }
}

export type CustomerInput = Pick<
  Customer,
  'name' | 'type' | 'phone' | 'email' | 'city' | 'salesperson'
>

export interface CustomersData {
  customers: Customer[]
  permissions: CustomerPermission[]
  salespeople: string[]
  currentSalesperson: string
  period: { asOf: string; syncedAt: string; label: string }
  revenueGrowth: number
  dsoDays: number
  dsoTarget: number
}

export interface CustomerFilters {
  search: string
  status: 'all' | CustomerStatus
  city: string
  outstanding: boolean
  overdue: boolean
  salesperson: string
  groupBy: CustomerGroup
}

export type CustomerAction =
  | 'create'
  | 'edit'
  | 'import'
  | 'assign'
  | 'tag'
  | 'statement'
  | 'reminder'
  | 'quote'

export const statusLabels: Record<CustomerStatus, string> = {
  active: 'Actif',
  prospect: 'Prospect',
  inactive: 'Inactif',
  archived: 'Archivé',
  at_risk: 'À risque',
  vip: 'VIP',
}
export const statusTones = {
  active: 'positive',
  prospect: 'info',
  inactive: 'neutral',
  archived: 'neutral',
  at_risk: 'warning',
  vip: 'indigo',
} as const
export const typeLabels = {
  company: 'Entreprise',
  individual: 'Particulier',
} as const

export function customerInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

// Les deux vues utilisent le même regroupement, après filtrage et pagination.
export function groupCustomers(customers: Customer[], groupBy: CustomerGroup) {
  if (groupBy === 'none') return [{ label: 'Tous les clients', customers }]
  const groups = new Map<string, Customer[]>()
  for (const customer of customers) {
    const label =
      groupBy === 'status'
        ? statusLabels[customer.status]
        : groupBy === 'type'
        ? typeLabels[customer.type]
        : customer[groupBy]
    groups.set(label, [...(groups.get(label) ?? []), customer])
  }
  return Array.from(groups, ([label, customers]) => ({ label, customers }))
}

export type CustomerTab = 'overview' | 'sales' | 'invoices' | 'payments' | 'documents' | 'notes' | 'activity'
export type CustomerRecordAction = 'quote' | 'invoice' | 'payment' | 'contact' | 'edit' | 'tag' | 'archive' | 'note' | 'audit'

export interface CustomerSale {
  reference: string
  kind: 'order' | 'quote'
  date: string
  salesperson: string
  amount: number
  margin: number
  status: 'Draft' | 'Confirmed' | 'Processing' | 'Delivered' | 'Invoiced' | 'Cancelled'
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid' | 'Not due'
}
export interface CustomerInvoice {
  reference: string
  date: string
  dueDate: string
  amount: number
  paid: number
  outstanding: number
  status: 'Draft' | 'Sent' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled'
}
export interface CustomerPayment {
  reference: string
  date: string
  invoice: string
  method: 'Bank Transfer' | 'Cash' | 'Card' | 'Cheque'
  amount: number
  status: 'Received' | 'Pending' | 'Cancelled'
  receivedBy: string
}
export interface CustomerDocument {
  id: string
  name: string
  type: string
  uploadedAt: string
  uploadedBy: string
  aiIndexed: boolean
  aiSummary?: string
  // La démo fournit un extrait texte. Django pourra fournir une URL de téléchargement.
  content: string
  downloadUrl?: string
  permission?: CustomerPermission
}
export interface CustomerNote {
  id: string
  author: string
  createdAt: string
  content: string
  pinned: boolean
}
export interface CustomerActivity {
  id: string
  type: 'sale' | 'quote' | 'invoice' | 'payment' | 'call' | 'email' | 'document' | 'note' | 'ai'
  title: string
  description: string
  user: string
  createdAt: string
  record: string
  permissions: CustomerPermission[]
}
export interface CustomerSummary {
  asOf: string
  customerScore: number | null
  paymentReliability: number | null
  revenue: number | null
  revenueGrowth: number | null
  averageOrderValue: number | null
  outstanding: number | null
  overdue: number | null
  paymentDelay: number | null
  previousPaymentDelay: number | null
  profitability: number | null
  totalOrders: number | null
  creditLimit: number | null
}
export interface CustomerAIInsight {
  summary: string
  analysis: string
  confidence: number
  risk: { level: 'Low' | 'Medium' | 'High'; evidence: string[] }
  opportunity: { value: number; evidence: string }
  recommendations: string[]
  generatedAt: string
  sources: string[]
}
export interface CustomerDetail extends Customer {
  country: string
  industry: string
  taxId: string
  website: string
  address: string
  segment: string
  paymentTerms: string
  currency: string
  preferredContact: string
  lastOrder: string | null
  lastPayment: string | null
  primaryContact: { name: string; role: string; phone: string; email: string } | null
  sales: CustomerSale[]
  invoices: CustomerInvoice[]
  payments: CustomerPayment[]
  documents: CustomerDocument[]
  notes: CustomerNote[]
  nextActions: { id: string; title: string; dueDate: string; owner: string; tab: CustomerTab; permission: CustomerPermission }[]
  permissions: CustomerPermission[]
  salespeople: string[]
}

// Les tables gardent leurs statuts métier ; leur présentation est commune.
export const recordStatusLabels = {
  Draft: 'Brouillon', Confirmed: 'Confirmé', Processing: 'En cours', Delivered: 'Livré',
  Invoiced: 'Facturé', Cancelled: 'Annulé', Sent: 'Envoyée', 'Partially Paid': 'Partiellement payée',
  Paid: 'Payé', Overdue: 'En retard', Unpaid: 'Non payé', Partial: 'Partiel', 'Not due': 'Non échu',
  Received: 'Reçu', Pending: 'En attente',
} as const
export function recordStatusTone(status: keyof typeof recordStatusLabels) {
  if (['Paid', 'Received', 'Delivered', 'Invoiced'].includes(status)) return 'positive'
  if (status === 'Overdue') return 'critical'
  if (['Partial', 'Partially Paid', 'Pending', 'Unpaid'].includes(status)) return 'warning'
  if (['Sent', 'Confirmed', 'Processing'].includes(status)) return 'info'
  return 'neutral'
}
