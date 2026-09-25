import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { stockDemoDate } from '../../products/data/products.mock'
import { createExpenseMock, expenseActionMock, expenseCategories, expensePermissions, expenseSnapshot } from '../data/expenses.mock'
import type { Expense, ExpenseInput, ExpensesData } from '../types/expenses.types'
export const getExpenses = async (scope: string, signal?: AbortSignal): Promise<ExpensesData> => env.expensesUseMock ? { expenses: expenseSnapshot(scope), permissions: expensePermissions, asOf: stockDemoDate, suppliers: supplierSnapshot(scope).map(({ id, name }) => ({ id, name })), categories: expenseCategories } : (await apiClient.get('/expenses/', { signal })).data
export const createExpense = async (scope: string, v: ExpenseInput): Promise<Expense> => env.expensesUseMock ? createExpenseMock(scope, v) : (await apiClient.post('/expenses/', { date: v.date, description: v.description, category: v.category, supplier_id: v.supplierId, employee: v.employee, amount_ht: v.amountHT, tax_rate: v.taxRate, note: v.note })).data
export const submitExpense = async (scope: string, id: number): Promise<Expense> => env.expensesUseMock ? expenseActionMock(scope, id, 'submit') : (await apiClient.post(`/expenses/${id}/submit/`)).data
export const approveExpense = async (scope: string, id: number): Promise<Expense> => env.expensesUseMock ? expenseActionMock(scope, id, 'approve') : (await apiClient.post(`/expenses/${id}/approve/`)).data
