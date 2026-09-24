import { z } from 'zod'
import type { InvoiceInput, InvoiceLine, InvoicePaymentInput } from '../types/invoices.types'
const text = z.string().trim().max(5000, 'Maximum 5 000 caractères.')
const decimal = (max: number, digits: number) => z.number({ error: 'Saisissez un nombre valide.' }).min(0, 'Valeur négative interdite.').max(max, `Maximum ${max}.`).refine((value) => Math.abs(value * 10 ** digits - Math.round(value * 10 ** digits)) < 0.00001, `Maximum ${digits} décimales.`)
export const invoiceSchema: z.ZodType<InvoiceInput, InvoiceInput> = z.object({
  customerId: z.number().int().positive('Sélectionnez un client.'), billingAddress: text, invoiceDate: z.iso.date('Date invalide.'), dueDate: z.iso.date('Échéance invalide.'), salesperson: text.min(1, 'Indiquez le commercial.'), currency: z.literal('MAD'), paymentTerms: text, customerReference: text, notes: text,
  lines: z.array(z.object({ id: z.string().min(1), productId: z.number().int().positive().nullable(), productName: text, description: text,
    quantity: decimal(100000, 3).positive('Quantité supérieure à zéro requise.'), unitPrice: decimal(1000000, 2), discountRate: decimal(100, 2), taxRate: decimal(100, 2),
  }).refine((line) => !!line.productName || !!line.description, { path: ['description'], message: 'Indiquez un produit ou une description.' })).min(1, 'Ajoutez au moins une ligne.').max(100, 'Maximum 100 lignes.'),
}).refine((input) => input.dueDate >= input.invoiceDate, { path: ['dueDate'], message: 'L’échéance ne peut pas précéder la date facture.' })
export const paymentSchema = (balance: number): z.ZodType<InvoicePaymentInput, InvoicePaymentInput> => z.object({ date: z.iso.date('Date invalide.'), amount: decimal(balance, 2).positive('Le paiement doit être supérieur à zéro.'), method: z.enum(['Virement bancaire', 'Espèces', 'Carte', 'Chèque']), reference: text, note: text })
export const newInvoiceLine = (): InvoiceLine => ({ id: crypto.randomUUID(), productId: null, productName: '', description: '', quantity: 1, unitPrice: 0, discountRate: 0, taxRate: 0 })
export function emptyInvoiceInput(asOf: string, salesperson: string): InvoiceInput {
  const date = new Date(`${asOf}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 30)
  return { customerId: 0, billingAddress: '', invoiceDate: asOf, dueDate: date.toISOString().slice(0, 10), salesperson, currency: 'MAD', paymentTerms: '', customerReference: '', notes: '', lines: [newInvoiceLine()] }
}
export function toInvoiceInput(invoice: InvoiceInput): InvoiceInput {
  return { customerId: invoice.customerId, billingAddress: invoice.billingAddress, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate, salesperson: invoice.salesperson, currency: invoice.currency, paymentTerms: invoice.paymentTerms, customerReference: invoice.customerReference, notes: invoice.notes, lines: invoice.lines.map((line) => ({ ...line })) }
}
