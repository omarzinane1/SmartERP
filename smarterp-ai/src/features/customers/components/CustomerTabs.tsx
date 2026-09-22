import { Activity, FileText, Files, LayoutDashboard, MessageSquare, ShoppingCart, Wallet } from 'lucide-react'
import type { CustomerTab } from '../types/customers.types'

const tabs = [
  { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'sales', label: 'Ventes', icon: ShoppingCart },
  { id: 'invoices', label: 'Factures', icon: FileText },
  { id: 'payments', label: 'Paiements', icon: Wallet },
  { id: 'documents', label: 'Documents', icon: Files },
  { id: 'notes', label: 'Notes', icon: MessageSquare },
  { id: 'activity', label: 'Activité', icon: Activity },
] as const

export function CustomerTabs({ activeTab, onChange }: { activeTab: CustomerTab; onChange: (tab: CustomerTab) => void }) {
  return <div role="tablist" aria-label="Sections de la fiche client" className="customer-detail-tabs">{tabs.map(({ id, label, icon: Icon }, index) => <button key={id} role="tab" id={`customer-tab-${id}`} aria-controls="customer-tabpanel" aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1} onClick={() => onChange(id)} onKeyDown={(event) => {
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
    if (nextIndex === null) return
    event.preventDefault()
    onChange(tabs[nextIndex].id)
    document.getElementById(`customer-tab-${tabs[nextIndex].id}`)?.focus()
  }}><Icon size={12} />{label}</button>)}</div>
}
