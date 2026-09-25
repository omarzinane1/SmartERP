import { z } from 'zod'
import { calculateTotals } from '../../../lib/money'
import type { PurchaseInput, PurchaseLine, ReceiptInput, PurchaseOrder } from '../types/purchases.types'
export const decimal = (max: number, digits: number) => z.number({ error: 'Saisissez un nombre valide.' }).min(0, 'Valeur négative interdite.').max(max).refine((v) => Math.abs(v * 10 ** digits - Math.round(v * 10 ** digits)) < 0.00001, `${digits} décimales maximum.`)
export const commercialLineSchema = z.object({ id: z.string().min(1), productName: z.string().trim().min(1, 'Produit ou charge obligatoire.').max(200), description: z.string().max(2000), quantity: decimal(100000, 3).positive('Quantité supérieure à zéro requise.'), unitPrice: decimal(1000000, 2), discountRate: decimal(100, 2), taxRate: decimal(100, 2) })
export const purchaseSchema: z.ZodType<PurchaseInput, PurchaseInput> = z.object({ supplierId: z.number().int().positive('Sélectionnez un fournisseur.'), date: z.iso.date('Date invalide.'), expectedDate: z.iso.date('Date de livraison invalide.'), buyer: z.string().trim().min(1, 'Acheteur obligatoire.').max(100), warehouse: z.string().trim().min(1, 'Dépôt obligatoire.').max(120), notes: z.string().max(5000), lines: z.array(commercialLineSchema.extend({ receivedQuantity: decimal(100000, 3), previousPrice: z.number().nullable(), averagePrice: z.number().nullable() })).min(1).max(100) }).refine((v) => v.expectedDate >= v.date, { path: ['expectedDate'], message: 'La livraison ne peut pas précéder la commande.' }).refine((v) => calculateTotals(v.lines).total > 0, { path: ['lines'], message: 'Le montant TTC doit être positif.' })
export const newPurchaseLine = (): PurchaseLine => ({ id: crypto.randomUUID(), productName: '', description: '', quantity: 1, receivedQuantity: 0, unitPrice: 0, discountRate: 0, taxRate: 20, previousPrice: null, averagePrice: null })
export function receiptSchema(order: PurchaseOrder): z.ZodType<ReceiptInput, ReceiptInput> {
  return z.object({ date: z.iso.date('Date invalide.'), warehouse: z.string().trim().min(1, 'Dépôt obligatoire.'), lines: z.array(z.object({ lineId: z.string(), quantity: decimal(100000, 3) })).min(1) }).superRefine((v, ctx) => {
    if (v.date < order.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'La réception ne peut pas précéder la commande.' })
    if (!v.lines.some((line) => line.quantity > 0)) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Saisissez au moins une quantité positive.' })
    const seen = new Set<string>()
    v.lines.forEach((line, index) => {
      const original = order.lines.find((l) => l.id === line.lineId)
      if (!original || seen.has(line.lineId) || line.quantity > Math.round((original.quantity - original.receivedQuantity) * 1000) / 1000) ctx.addIssue({ code: 'custom', path: ['lines', index, 'quantity'], message: 'La quantité dépasse le restant disponible ou la ligne est invalide.' })
      seen.add(line.lineId)
    })
  })
}
