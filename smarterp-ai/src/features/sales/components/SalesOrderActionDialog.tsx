import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { formatNumber } from '../../../lib/format'
import { formatMoney } from '../../../lib/money'
import { remainingQuantity, salesFinancials } from '../sales.utils'
import type { SalesDeliveryInput, SalesInvoiceInput, SalesOrderDetail } from '../types/sales.types'

export type SalesDialogAction = 'confirm' | 'delivery' | 'invoice'
export function SalesOrderActionDialog({ action, order, busy, isDemo, error, onClose, onConfirm, onDelivery, onInvoice }: {
  action: SalesDialogAction; order: SalesOrderDetail; busy: boolean; isDemo: boolean; error: string | null; onClose: () => void
  onConfirm: () => void; onDelivery: (input: SalesDeliveryInput) => void; onInvoice: (input: SalesInvoiceInput) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const lines = order.lines.filter((line) => remainingQuantity(line) > 0)
  const maxInvoice = Math.min(order.capabilities.invoiceableAmount, salesFinancials(order).unbilled)
  const [warehouse, setWarehouse] = useState(order.warehouses[0] ?? '')
  const [quantities, setQuantities] = useState<Record<number, string>>(() => Object.fromEntries(lines.map((line) => [line.id, String(remainingQuantity(line))])))
  const [amount, setAmount] = useState(String(maxInvoice))
  const [validationError, setValidationError] = useState<string | null>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  const title = action === 'confirm' ? `Confirmer la commande ${order.reference} ?` : action === 'delivery' ? 'Préparer une livraison' : 'Préparer une facture'
  function submit() {
    if (busy) return
    setValidationError(null)
    if (action === 'confirm') { onConfirm(); return }
    if (action === 'delivery') {
      const proposed = lines.map((line) => ({ lineId: line.id, quantity: Number(quantities[line.id]) }))
      if (!order.warehouses.includes(warehouse) || proposed.some((line, index) => !Number.isFinite(line.quantity) || line.quantity < 0 || line.quantity > remainingQuantity(lines[index]) || Math.abs(line.quantity * 1000 - Math.round(line.quantity * 1000)) > 0.00001) || !proposed.some((line) => line.quantity > 0)) {
        setValidationError('Choisissez un entrepôt et au moins une quantité positive, dans la limite du restant à livrer.'); return
      }
      onDelivery({ warehouse, lines: proposed.filter((line) => line.quantity > 0) })
    } else {
      const value = Number(amount)
      if (!Number.isFinite(value) || value <= 0 || value > maxInvoice || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) {
        setValidationError('Indiquez un montant positif, avec deux décimales au maximum, dans la limite facturable.'); return
      }
      onInvoice({ amount: value })
    }
  }
  return <dialog ref={ref} className="sales-dialog" aria-labelledby="sales-dialog-title" aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <form noValidate onSubmit={(event) => { event.preventDefault(); submit() }}>
      <h2 id="sales-dialog-title">{title}</h2>
      <p>{action === 'confirm' ? 'Cette action validera la commande et permettra de poursuivre son traitement selon les règles de l’entreprise.' : action === 'delivery' ? 'Sélectionnez les quantités à préparer. Les stocks et disponibilités seront vérifiés par Django.' : 'Le montant proposé reste soumis aux règles de facturation de l’entreprise.'}</p>
      {isDemo && <p className="sales-demo-note">{action === 'confirm' ? 'Démonstration : confirmation simulée localement, sans enregistrement serveur.' : 'Démonstration : préparation uniquement. Aucun document enregistré, aucun stock modifié.'}</p>}
      <fieldset disabled={busy}>
        {action === 'delivery' && <><div className="sales-dialog-lines">{lines.map((line) => <label key={line.id} htmlFor={`delivery-quantity-${line.id}`}><span><strong>{line.productName}</strong><small>{formatNumber(remainingQuantity(line), 3)} restant(s) à livrer</small></span><input id={`delivery-quantity-${line.id}`} type="number" step="0.001" min="0" max={remainingQuantity(line)} value={quantities[line.id]} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))} /></label>)}</div>
          <label className="sales-dialog-field" htmlFor="delivery-warehouse">Entrepôt<select id="delivery-warehouse" value={warehouse} onChange={(event) => setWarehouse(event.target.value)}><option value="">Choisir un entrepôt</option>{order.warehouses.map((value) => <option key={value}>{value}</option>)}</select></label>
          {!order.warehouses.length && <p className="sales-error">Aucun entrepôt disponible. La préparation nécessite un entrepôt fourni par le serveur.</p>}
        </>}
        {action === 'invoice' && <label className="sales-dialog-field" htmlFor="invoice-amount">Montant TTC à facturer (MAD)<input id="invoice-amount" readOnly={order.capabilities.invoiceMode === 'full_order'} type="number" min="0.01" max={maxInvoice} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /><small>Montant facturable autorisé : {formatMoney(maxInvoice)}{order.capabilities.invoiceMode === 'full_order' && ' · La facture reprend toutes les lignes de la commande.'}</small></label>}
      </fieldset>
      {(error || validationError) && <p role="alert" className="sales-error">{error || validationError}</p>}
      <footer><Button variant="secondary" className="sales-button" disabled={busy} onClick={onClose} autoFocus>Annuler</Button><Button type="submit" className="sales-button sales-primary" disabled={busy || (action === 'delivery' && !order.warehouses.length)}>{busy && <Spinner />}{busy ? action === 'confirm' ? 'Confirmation en cours…' : 'Traitement…' : action === 'confirm' ? 'Confirmer la commande' : isDemo ? 'Vérifier la préparation' : action === 'delivery' ? 'Créer la livraison' : 'Créer la facture'}</Button></footer>
    </form>
  </dialog>
}
