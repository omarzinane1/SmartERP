import { ArrowLeft, ChevronDown, FilePlus2, Mail, Pencil, Receipt, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { customerInitials, statusLabels, statusTones, typeLabels } from '../types/customers.types'
import type { CustomerDetail, CustomerRecordAction, CustomerSummary } from '../types/customers.types'

export function CustomerRecordHeader({ customer, summary, canSales, canPayments, canInvoices, onAction }: {
  customer: CustomerDetail; summary?: CustomerSummary; canSales: boolean; canPayments: boolean; canInvoices: boolean
  onAction: (action: CustomerRecordAction) => void
}) {
  const canEdit = customer.permissions.includes('customers.edit')
  const since = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${customer.createdAt}T12:00:00`))
  return <header className="customer-record-header">
    <Link to="/customers" className="customer-detail-back"><ArrowLeft size={12} /> Retour aux clients <span>/</span> {customer.reference}</Link>
    <div className="customer-record-identity">
      <div className="customer-record-avatar">{customerInitials(customer.name)}</div>
      <div className="customer-record-name">
        <div className="flex flex-wrap items-center gap-2"><h1>{customer.name}</h1><Badge tone="info">{customer.reference}</Badge><Badge tone={statusTones[customer.status]}>{statusLabels[customer.status]}</Badge>{customer.tags.includes('VIP') && customer.status !== 'vip' && <Badge tone="indigo">VIP</Badge>}<Badge>{typeLabels[customer.type]}</Badge></div>
        <p>Commercial : <strong>{customer.salesperson}</strong><span>•</span> Client depuis {since}<span>•</span> {customer.city}, {customer.country}</p>
        <div className="flex flex-wrap gap-1">{customer.tags.filter((tag) => tag !== 'VIP').map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
      </div>
      <div className="customer-record-scores" aria-label="Scores client">
        <div className="customer-record-score customer-record-score--green"><span>Score client</span><strong>{canSales && canInvoices && canPayments ? summary?.customerScore ?? '—' : 'Restricted'} {canSales && canInvoices && canPayments && summary?.customerScore != null && <small>/100</small>}</strong><span>Relation commerciale</span></div>
        <div className="customer-record-score customer-record-score--amber"><span>Fiabilité paiement</span><strong>{canPayments && canInvoices ? summary?.paymentReliability ?? '—' : 'Restricted'} {canPayments && canInvoices && summary?.paymentReliability != null && <small>/100</small>}</strong><span>Historique des règlements</span></div>
      </div>
    </div>
    <div className="customer-record-actions">
      <Button className="customer-detail-button" disabled={!canSales} onClick={() => onAction('quote')}><FilePlus2 size={12} />Créer un devis</Button>
      <Button variant="secondary" className="customer-detail-button" disabled={!canInvoices} onClick={() => onAction('invoice')}><Receipt size={12} />Créer une facture</Button>
      <Button variant="secondary" className="customer-detail-button" disabled={!canPayments} onClick={() => onAction('payment')}><Wallet size={12} />Enregistrer un paiement</Button>
      <Button variant="secondary" className="customer-detail-button" onClick={() => onAction('contact')}><Mail size={12} />Contacter</Button>
      <Button variant="secondary" className="customer-detail-button" disabled={!canEdit} onClick={() => onAction('edit')}><Pencil size={12} />Modifier</Button>
      <details className="customer-record-menu"><summary>Actions <ChevronDown size={12} /></summary><div>
        <button disabled={!canEdit} onClick={() => onAction('archive')}>{customer.status === 'archived' ? 'Désarchiver' : 'Archiver'}</button>
        <button disabled={!canEdit} onClick={() => onAction('tag')}>Ajouter un tag</button>
        <button disabled={!canEdit} onClick={() => onAction('note')}>Ajouter une note</button>
        <button onClick={() => onAction('audit')}>Voir l’historique d’audit</button>
      </div></details>
    </div>
  </header>
}
