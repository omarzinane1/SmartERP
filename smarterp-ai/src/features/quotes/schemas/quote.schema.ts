import { z } from 'zod'
import type { QuoteInput, QuoteLine } from '../types/quotes.types'

const text = z.string().trim().max(5000, 'Utilisez au maximum 5 000 caractères.')
const decimal = (max: number, digits: number) => z.number({ error: 'Saisissez un nombre valide.' })
  .min(0, 'La valeur ne peut pas être négative.')
  .max(max, `La valeur doit être inférieure ou égale à ${max}.`)
  .refine((value) => Math.abs(value * 10 ** digits - Math.round(value * 10 ** digits)) < 0.00001,
    `Utilisez au maximum ${digits} décimales.`)

export const quoteSchema: z.ZodType<QuoteInput, QuoteInput> = z.object({
  customerId: z.number({ error: 'Sélectionnez un client.' }).int().positive('Sélectionnez un client.'),
  billingAddress: text,
  salesperson: text.min(1, 'Indiquez le commercial responsable.'),
  issueDate: z.iso.date('Indiquez une date de devis valide.'),
  expiresAt: z.iso.date('Indiquez une date d’expiration valide.'),
  currency: z.literal('MAD', { error: 'La devise prise en charge est MAD.' }),
  paymentTerms: text,
  customerReference: text,
  subject: text,
  deliveryTerms: text,
  commercialTerms: text,
  internalNotes: text,
  customerNotes: text,
  lines: z.array(z.object({
    id: z.string().min(1),
    productId: z.number().int().positive().nullable(),
    description: text,
    quantity: decimal(100_000, 3).refine((value) => value > 0, 'La quantité doit être supérieure à zéro.'),
    unitPrice: decimal(1_000_000, 2),
    discountRate: decimal(100, 2),
    taxRate: decimal(100, 2),
  }).refine((line) => line.productId !== null || line.description.length > 0, {
    path: ['description'], message: 'Sélectionnez un produit ou saisissez une description.',
  })).min(1, 'Ajoutez au moins une ligne.').max(100, 'Un devis peut contenir au maximum 100 lignes.'),
}).refine((input) => input.expiresAt >= input.issueDate, {
  path: ['expiresAt'], message: 'L’expiration ne doit pas précéder la date du devis.',
})

export function newQuoteLine(): QuoteLine {
  return { id: crypto.randomUUID(), productId: null, description: '', quantity: 1, unitPrice: 0, discountRate: 0, taxRate: 0 }
}
export function emptyQuoteInput(asOf: string, salesperson: string): QuoteInput {
  const expires = new Date(`${asOf}T12:00:00Z`)
  expires.setUTCDate(expires.getUTCDate() + 30)
  return {
    customerId: 0, billingAddress: '', salesperson, issueDate: asOf,
    expiresAt: expires.toISOString().slice(0, 10), currency: 'MAD', paymentTerms: '',
    customerReference: '', subject: '', deliveryTerms: '', commercialTerms: '', internalNotes: '', customerNotes: '',
    lines: [newQuoteLine()],
  }
}
// Exclut les métadonnées serveur du formulaire et des écritures API.
export function toQuoteInput(quote: QuoteInput): QuoteInput {
  return {
    customerId: quote.customerId, billingAddress: quote.billingAddress, salesperson: quote.salesperson,
    issueDate: quote.issueDate, expiresAt: quote.expiresAt, currency: quote.currency,
    paymentTerms: quote.paymentTerms, customerReference: quote.customerReference, subject: quote.subject,
    deliveryTerms: quote.deliveryTerms, commercialTerms: quote.commercialTerms,
    internalNotes: quote.internalNotes, customerNotes: quote.customerNotes, lines: quote.lines.map((line) => ({ ...line })),
  }
}
