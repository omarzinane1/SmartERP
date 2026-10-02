import { expect, test } from './fixtures'
import { calculateQuoteTotals } from '../src/features/quotes/utils/quoteCalculations'
import { emptyQuoteInput, quoteSchema } from '../src/features/quotes/schemas/quote.schema'
import type { QuoteLine } from '../src/features/quotes/types/quotes.types'

const line = (values: Partial<QuoteLine>): QuoteLine => ({ id: 'line-1', productId: null, description: 'Prestation', quantity: 1, unitPrice: 0, discountRate: 0, taxRate: 0, ...values })
test('calculates mixed tax rates and discounts, rounding each line to cents', () => {
  expect(calculateQuoteTotals([
    line({ quantity: 10, unitPrice: 1200, discountRate: 5, taxRate: 20 }),
    line({ quantity: 2, unitPrice: 1500, taxRate: 10 }),
  ])).toEqual({ gross: 15000, discount: 600, net: 14400, tax: 2580, total: 16980 })
  expect(calculateQuoteTotals([line({ quantity: 3, unitPrice: 0.1, taxRate: 20 })]).total).toBe(0.36)
  expect(calculateQuoteTotals([line({ quantity: 0.5, unitPrice: 0.67, discountRate: 10, taxRate: 20 })]))
    .toEqual({ gross: 0.34, discount: 0.03, net: 0.31, tax: 0.06, total: 0.37 })
  expect(calculateQuoteTotals([line({ unitPrice: 150, discountRate: 100, taxRate: 20 })]).total).toBe(0)
  expect(calculateQuoteTotals(Array.from({ length: 100 }, () => line({ quantity: 3, unitPrice: 0.1, taxRate: 20 })))).toEqual({ gross: 30, discount: 0, net: 30, tax: 6, total: 36 })
})
test('rejects invalid dates, empty lines, negative values and excessive decimal precision', () => {
  const valid = { ...emptyQuoteInput('2026-09-23', 'Sara'), customerId: 124, lines: [line({ unitPrice: 1.15 })] }
  expect(quoteSchema.safeParse(valid).success).toBe(true)
  for (const patch of [{ customerId: 0 }, { expiresAt: '2026-02-30' }, { expiresAt: '2026-09-22' }, { lines: [] }])
    expect(quoteSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  for (const patch of [{ quantity: 0 }, { quantity: 1.0001 }, { unitPrice: -1 }, { unitPrice: 1.005 }, { discountRate: 101 }, { taxRate: -1 }, { description: '' }])
    expect(quoteSchema.safeParse({ ...valid, lines: [line(patch)] }).success).toBe(false)
  expect(quoteSchema.safeParse({ ...valid, lines: [line({ productId: 104, description: '' })] }).success).toBe(true)
})
