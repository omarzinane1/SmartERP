import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Button } from '../../../components/ui/Button'
import type { CreditNoteInput } from '../api/invoices.api'
import type { InvoiceDetail } from '../types/invoices.types'
import { formatMoney } from '../../../lib/money'
import { remainingAmount } from '../utils/invoiceCalculations'

export function CreditNoteDialog({ invoice, asOf, busy, onClose, onSubmit }: { invoice: InvoiceDetail; asOf: string; busy: boolean; onClose: () => void; onSubmit: (input: CreditNoteInput) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [partial, setPartial] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  async function save(event: React.FormEvent) {
    event.preventDefault()
    const lines = invoice.lines.flatMap((l) => Number(quantities[l.id]) > 0 ? [{ line_id: Number(l.id), quantity: Number(quantities[l.id]) }] : [])
    if (!reason.trim() || partial && !lines.length) { setError('Indiquez un motif et au moins une quantité positive pour un avoir partiel.'); return }
    try { await onSubmit({ date: asOf, reason: reason.trim(), ...(partial ? { lines } : {}) }) }
    catch { setError('Avoir refusé ou non confirmé. Vérifiez les quantités déjà créditées et le solde non réglé.') }
  }
  return <Dialog title={`Créer un avoir sur ${invoice.reference}`} className="invoice-dialog" busy={busy} onClose={onClose}>
    <p>Solde non réglé : {formatMoney(remainingAmount(invoice))}. Le serveur contrôle les quantités restantes et calcule le montant. Aucun remboursement de paiement n’est créé.</p>
    <form onSubmit={(event) => void save(event)}><fieldset disabled={busy}>
      <label>Motif *<textarea required maxLength={5000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <label>Type d’avoir<select value={partial ? 'partial' : 'full'} onChange={(event) => setPartial(event.target.value === 'partial')}><option value="full">Toutes les quantités non créditées</option><option value="partial">Quantités partielles</option></select></label>
      {partial && invoice.lines.map((line) => <label key={line.id}>{line.productName || line.description}<input aria-label={`Quantité créditée ${line.productName || line.description}`} type="number" min="0" step="0.001" max={line.quantity} value={quantities[line.id] ?? ''} onChange={(event) => setQuantities({ ...quantities, [line.id]: event.target.value })} /></label>)}
    </fieldset>{error && <p role="alert" className="invoice-error">{error}</p>}<footer><Button variant="secondary" className="invoice-button" disabled={busy} onClick={onClose}>Retour</Button><Button type="submit" className="invoice-button invoice-primary" disabled={busy}>{busy ? 'Validation…' : 'Valider l’avoir'}</Button></footer></form>
  </Dialog>
}
