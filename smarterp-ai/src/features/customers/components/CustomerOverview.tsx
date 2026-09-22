import { Building2, Mail, Pencil, Phone, ShoppingCart, Receipt, UserRound, BriefcaseBusiness, Landmark } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { formatCurrency, formatDate, formatPercentage } from '../../../lib/format'
import { typeLabels } from '../types/customers.types'
import type { CustomerDetail, CustomerSummary, CustomerTab } from '../types/customers.types'
import { CustomerSalesTable } from './CustomerSalesTable'
import { CustomerInvoicesTable } from './CustomerInvoicesTable'

export function CustomerOverview({ customer, summary, canSales, canInvoices, canPayments, onNavigate, onEdit, onOpen }: {
  customer: CustomerDetail; summary?: CustomerSummary; canSales: boolean; canInvoices: boolean; canPayments: boolean
  onNavigate: (tab: CustomerTab) => void; onEdit: () => void; onOpen: (title: string, content: string) => void
}) {
  const money = (value: number | null | undefined, allowed: boolean) => !allowed ? 'Restricted' : value == null ? '—' : formatCurrency(value)
  const date = (value: string | null) => value ? formatDate(value) : '—'
  const fields = [
    ['Dénomination sociale', customer.name], ['Type de client', typeLabels[customer.type]],
    ['Secteur d’activité', customer.industry], ['Identifiant fiscal', customer.taxId],
    ['Téléphone', customer.phone], ['E-mail', customer.email], ['Site internet', customer.website],
    ['Adresse', customer.address], ['Ville', customer.city], ['Pays', customer.country],
    ['Commercial', customer.salesperson], ['Conditions de paiement', canInvoices ? customer.paymentTerms : 'Restricted'], ['Devise', customer.currency],
  ]
  const profile = [
    ['Client depuis', date(customer.createdAt)], ['Segment', customer.segment],
    ['Plafond de crédit', money(summary?.creditLimit, canInvoices)], ['Conditions de paiement', canInvoices ? customer.paymentTerms : 'Restricted'],
    ['Contact préféré', customer.preferredContact], ['Dernière commande', canSales ? date(customer.lastOrder) : 'Restricted'],
    ['Dernier paiement', canPayments ? date(customer.lastPayment) : 'Restricted'], ['Dernière activité', date(customer.lastActivity)],
  ]
  const finance = [
    ['CA annuel', money(summary?.revenue, canSales)], ['Encours', money(summary?.outstanding, canInvoices)],
    ['En retard', money(summary?.overdue, canInvoices)], ['Marge moyenne', !canSales ? 'Restricted' : summary?.profitability == null ? '—' : formatPercentage(summary.profitability)],
    ['Délai moyen', !canPayments ? 'Restricted' : summary?.paymentDelay == null ? '—' : `${summary.paymentDelay} jours`], ['Plafond de crédit', money(summary?.creditLimit, canInvoices)],
  ]
  return <div className="customer-overview">
    <section className="customer-detail-section"><div className="customer-section-heading"><h2><Building2 size={13} />Informations entreprise & fiscales</h2><button className="customer-detail-link" disabled={!customer.permissions.includes('customers.edit')} onClick={onEdit}><Pencil size={10} />Modifier</button></div>
      <dl className="customer-information-grid">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
      {customer.primaryContact ? <div className="customer-contact-card"><div className="customer-contact-avatar"><UserRound size={20} /></div><div><div className="flex flex-wrap items-center gap-2"><strong>{customer.primaryContact.name}</strong><Badge tone="info">Contact principal</Badge></div><p>{customer.primaryContact.role}</p><p>{customer.primaryContact.phone}<span> · </span>{customer.primaryContact.email}</p><div className="customer-contact-actions"><a href={`tel:${customer.primaryContact.phone.replace(/\s/g, '')}`}><Phone size={11} />Appeler</a><a href={`mailto:${customer.primaryContact.email}`}><Mail size={11} />Envoyer un e-mail</a></div></div></div> : <p className="customer-detail-empty">Aucun contact principal renseigné.</p>}
    </section>
    <div className="customer-overview-tables">
      <section className="customer-detail-section"><div className="customer-section-heading"><h2><ShoppingCart size={13} />Dernières commandes</h2><button className="customer-detail-link" onClick={() => onNavigate('sales')}>Tout voir</button></div><CustomerSalesTable sales={customer.sales} allowed={canSales} compact onOpen={onOpen} /></section>
      <section className="customer-detail-section"><div className="customer-section-heading"><h2><Receipt size={13} />Factures ouvertes</h2><button className="customer-detail-link" onClick={() => onNavigate('invoices')}>Tout voir</button></div><CustomerInvoicesTable invoices={customer.invoices.filter((invoice) => invoice.outstanding > 0)} allowed={canInvoices} compact onOpen={onOpen} /></section>
    </div>
    <section className="customer-detail-section"><div className="customer-section-heading"><h2><BriefcaseBusiness size={13} />Profil commercial</h2><Badge>CRM</Badge></div><dl className="customer-information-grid">{profile.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></section>
    <section className="customer-detail-section"><div className="customer-section-heading"><h2><Landmark size={13} />Synthèse financière</h2><Badge tone="info">FACT</Badge></div><dl className="customer-finance-grid">{finance.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
  </div>
}
