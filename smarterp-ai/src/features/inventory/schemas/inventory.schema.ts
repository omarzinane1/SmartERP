import { z } from 'zod'
import { decimal } from '../../purchases/schemas/purchase.schema'
import type { InventoryRow, MovementInput, TransferInput } from '../types/inventory.types'
export const movementSchema: z.ZodType<MovementInput, MovementInput> = z.object({ productId: z.number().int().positive('Produit obligatoire.'), warehouseId: z.number().int().positive('Dépôt obligatoire.'), quantity: decimal(1000000, 3).positive('Quantité supérieure à zéro requise.'), type: z.enum(['in', 'out', 'adjustment', 'return']), date: z.iso.date('Date invalide.'), sourceReference: z.string().max(120), note: z.string().max(2000), unitCost: decimal(1000000, 6).optional(), adjustmentDirection: z.enum(['increase', 'decrease']) })
export function transferSchema(stock: InventoryRow[]): z.ZodType<TransferInput, TransferInput> {
  return z.object({ sourceId: z.number().int().positive('Dépôt source obligatoire.'), destinationId: z.number().int().positive('Dépôt destination obligatoire.'), date: z.iso.date('Date invalide.'), referenceExternal: z.string().max(120), notes: z.string().max(2000), lines: z.array(z.object({ productId: z.number().int().positive('Produit obligatoire.'), quantity: decimal(1000000, 3).positive('Quantité positive requise.') })).min(1, 'Ajoutez un produit.').max(100) }).superRefine((v, context) => {
    if (v.sourceId === v.destinationId) context.addIssue({ code: 'custom', path: ['destinationId'], message: 'La source et la destination doivent être différentes.' })
    const seen = new Set<number>()
    v.lines.forEach((l, n) => {
      const row = stock.find((r) => r.productId === l.productId && r.warehouseId === v.sourceId)
      if (seen.has(l.productId)) context.addIssue({ code: 'custom', path: ['lines', n, 'productId'], message: 'Produit déjà présent.' })
      if (!row || l.quantity > row.available) context.addIssue({ code: 'custom', path: ['lines', n, 'quantity'], message: 'Quantité supérieure au disponible source.' })
      seen.add(l.productId)
    })
  })
}
