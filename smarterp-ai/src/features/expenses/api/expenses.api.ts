import { getCollection } from '../../../lib/collectionApi'
import { postIdempotent } from '../../../lib/idempotentApi'
import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { stockDemoDate } from '../../products/data/products.mock'
import { createExpenseMock, expenseActionMock, expenseCategories, expensePermissions, expenseSnapshot } from '../data/expenses.mock'
import type { Expense, ExpenseInput, ExpensesData } from '../types/expenses.types'
export const getExpenses = async (scope: string, signal?: AbortSignal): Promise<ExpensesData> => env.expensesUseMock ? { expenses: expenseSnapshot(scope), permissions: expensePermissions, asOf: stockDemoDate, suppliers: supplierSnapshot(scope).map(({ id, name }) => ({ id, name })), categories: expenseCategories } : getCollection<ExpensesData, 'expenses'>('/expenses/', 'expenses', signal)
export const createExpense = async (scope: string, v: ExpenseInput): Promise<Expense> => env.expensesUseMock ? createExpenseMock(scope, v) : postIdempotent<Expense>(scope, '/expenses/', { date: v.date, description: v.description, category: v.category, supplier_id: v.supplierId, employee: v.employee, amount_ht: v.amountHT, tax_rate: v.taxRate, note: v.note })
export const submitExpense = async (scope: string, id: number): Promise<Expense> => env.expensesUseMock ? expenseActionMock(scope, id, 'submit') : (await apiClient.post(`/expenses/${id}/submit/`)).data
export const approveExpense = async (scope: string, id: number): Promise<Expense> => env.expensesUseMock ? expenseActionMock(scope, id, 'approve') : (await apiClient.post(`/expenses/${id}/approve/`)).data

export async function rejectExpense(scope: string, id: number, reason: string): Promise<Expense> { void scope; if (env.expensesUseMock) throw new Error('Refus disponible en mode API.'); return (await apiClient.post(`/expenses/${id}/reject/`, { reason })).data }
