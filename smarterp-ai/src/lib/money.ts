import { formatNumber } from './format'
export interface MoneyLine { quantity: number; unitPrice: number; discountRate: number; taxRate: number }

export interface MoneyTotals {
  gross: number
  discount: number
  net: number
  tax: number
  total: number
}
// Prix : 2 décimales ; quantités : 3 ; taux : 2 (validés par Zod).
// Les multiplications sont exactes en BigInt. Chaque montant de ligne est
// arrondi au centime, à la moitié supérieure ; les totaux additionnent ces centimes.
const scaled = (value: number, digits: number, max: number) =>
  BigInt(Math.round(Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0)) * 10 ** digits))
const roundDivide = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor

function lineCents(line: MoneyLine) {
  const gross = roundDivide(scaled(line.quantity, 3, 100_000) * scaled(line.unitPrice, 2, 1_000_000), 1000n)
  const discount = roundDivide(gross * scaled(line.discountRate, 2, 100), 10_000n)
  const net = gross - discount
  const tax = roundDivide(net * scaled(line.taxRate, 2, 100), 10_000n)
  return { gross, discount, net, tax, total: net + tax }
}
export function calculateTotals(lines: MoneyLine[]): MoneyTotals {
  const cents = { gross: 0n, discount: 0n, net: 0n, tax: 0n, total: 0n }
  for (const line of lines) {
    const amounts = lineCents(line)
    for (const key of Object.keys(cents) as (keyof MoneyTotals)[]) cents[key] += amounts[key]
  }
  return {
    gross: Number(cents.gross) / 100, discount: Number(cents.discount) / 100,
    net: Number(cents.net) / 100, tax: Number(cents.tax) / 100, total: Number(cents.total) / 100,
  }
}
export const calculateLineAmounts = (line: MoneyLine) => calculateTotals([line])
export const formatMoney = (amount: number | null, currency = 'MAD') => typeof amount === 'number' && Number.isFinite(amount) ? `${formatNumber(amount, 2)} ${currency}` : '—'
export const sumMoney = (values: number[]) => values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100
