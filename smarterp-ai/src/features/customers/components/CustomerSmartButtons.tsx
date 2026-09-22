import { FileText, Files, Receipt, ShoppingCart, Wallet, Landmark } from 'lucide-react'
import { formatCurrency } from '../../../lib/format'
import type { CustomerDetail, CustomerSummary, CustomerTab } from '../types/customers.types'

export function CustomerSmartButtons({ customer, summary, canSales, canInvoices, canPayments, onNavigate }: {
  customer: CustomerDetail; summary?: CustomerSummary; canSales: boolean; canInvoices: boolean; canPayments: boolean
  onNavigate: (tab: CustomerTab, quotes?: boolean) => void
}) {
  const buttons = [
    { label: 'Commandes', value: customer.sales.filter((sale) => sale.kind === 'order').length, icon: ShoppingCart, tab: 'sales' as const, allowed: canSales, caption: 'Récentes' },
    { label: 'Devis', value: customer.sales.filter((sale) => sale.kind === 'quote').length, icon: FileText, tab: 'sales' as const, allowed: canSales, caption: 'À consulter', quotes: true },
    { label: 'Factures', value: customer.invoices.length, icon: Receipt, tab: 'invoices' as const, allowed: canInvoices, caption: 'Historique' },
    { label: 'Paiements', value: customer.payments.length, icon: Wallet, tab: 'payments' as const, allowed: canPayments, caption: 'Règlements' },
    { label: 'Documents', value: customer.documents.length, icon: Files, tab: 'documents' as const, allowed: true, caption: 'Pièces jointes' },
    { label: 'Encours', value: summary?.outstanding == null ? '—' : formatCurrency(summary.outstanding), icon: Landmark, tab: 'invoices' as const, allowed: canInvoices, caption: 'Solde ouvert' },
  ]
  return <nav className="customer-smart-buttons" aria-label="Raccourcis du client">{buttons.map(({ label, value, icon: Icon, tab, allowed, caption, quotes }) => <button key={label} disabled={!allowed} onClick={() => onNavigate(tab, quotes)} className={label === 'Encours' ? 'customer-smart-balance' : ''}><Icon size={16} /><span><span className="customer-smart-label">{label}</span><strong>{allowed ? value : 'Restricted'}</strong><small>{caption}</small></span></button>)}</nav>
}
