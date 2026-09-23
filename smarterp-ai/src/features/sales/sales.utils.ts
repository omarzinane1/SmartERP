import { calculateLineAmounts, sumMoney } from '../../lib/money'
import type { SalesOrderDetail, SalesOrderLine } from './types/sales.types'

export const remainingQuantity = (line: SalesOrderLine) => Math.max(0, Math.round((line.quantity - line.deliveredQuantity) * 1000) / 1000)
export function salesFinancials(order: SalesOrderDetail) {
  const invoices = order.invoices.filter((invoice) => invoice.status === 'posted')
  const invoiced = sumMoney(invoices.map((invoice) => invoice.amount))
  const paid = sumMoney(order.payments.filter((payment) => payment.status === 'confirmed' && invoices.some((invoice) => invoice.id === payment.invoiceId)).map((payment) => payment.amount))
  return { invoiced, paid, balance: Math.max(0, sumMoney([invoiced, -paid])), unbilled: Math.max(0, sumMoney([order.totalAmount, -invoiced])) }
}
export function lineMargin(line: SalesOrderLine) {
  if (line.unitCost === null) return null
  const cost = calculateLineAmounts({ quantity: line.quantity, unitPrice: line.unitCost, discountRate: 0, taxRate: 0 }).net
  return sumMoney([line.totalExcludingTax, -cost])
}
export function orderMargin(order: SalesOrderDetail) {
  const margins = order.lines.map(lineMargin)
  return margins.some((margin) => margin === null) ? null : sumMoney(margins as number[])
}

export function salesActions(order: SalesOrderDetail) {
  const active = ['confirmed', 'processing'].includes(order.orderStatus)
  const financials = salesFinancials(order)
  return {
    confirm: order.orderStatus === 'draft' && order.permissions.includes('sales.edit') && order.capabilities.canConfirm,
    delivery: active && order.permissions.includes('delivery.create') && order.capabilities.canDeliver && order.lines.some((line) => remainingQuantity(line) > 0),
    invoice: active && order.permissions.includes('invoices.create') && order.capabilities.canInvoice && order.capabilities.invoiceableAmount > 0 && financials.unbilled > 0,
    cancel: ['draft', 'confirmed'].includes(order.orderStatus) && order.permissions.includes('sales.edit') && order.capabilities.canCancel && !order.lines.some((line) => line.deliveredQuantity > 0) && !order.invoices.some((invoice) => invoice.status !== 'cancelled'),
  }
}
