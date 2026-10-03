import { z } from 'zod'
import type { PaymentInvoiceOption } from '../types/payments.types'

export function recordPaymentSchema(invoices: PaymentInvoiceOption[], allowUnallocated = false) {
  return z.object({
    direction: z.enum(['incoming', 'outgoing']), partnerId: z.number().int().positive('Sélectionnez un tiers.'), invoiceId: z.number().int().min(0),
    date: z.iso.date('Saisissez une date valide.'), amount: z.number({ error: 'Saisissez un montant.' }).positive('Le montant doit être supérieur à zéro.').max(100_000_000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < .000001, 'Deux décimales maximum.'),
    method: z.enum(['bank_transfer', 'cash', 'card', 'cheque', 'other']), referenceExternal: z.string().max(120), note: z.string().max(2000),
  }).superRefine((input, context) => {
    if (allowUnallocated && input.invoiceId === 0) return
    const invoice = invoices.find((row) => row.id === input.invoiceId && row.direction === input.direction && row.partnerId === input.partnerId)
    if (!invoice) context.addIssue({ code: 'custom', path: ['invoiceId'], message: 'Cette facture ouverte ne correspond pas au tiers et au sens choisis.' })
    else if (input.amount > invoice.remainingAmount) context.addIssue({ code: 'custom', path: ['amount'], message: `Le montant dépasse le solde disponible (${invoice.remainingAmount} MAD).` })
  })
}
