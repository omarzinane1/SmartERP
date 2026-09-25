import { z } from 'zod'
import { decimal } from '../../purchases/schemas/purchase.schema'
import type { ExpenseInput } from '../types/expenses.types'
export const expenseSchema: z.ZodType<ExpenseInput, ExpenseInput> = z.object({ date: z.iso.date(), description: z.string().trim().min(3).max(300), category: z.string().trim().min(1).max(80), supplierId: z.number().int().positive().nullable(), employee: z.string().trim().min(2).max(120), amountHT: decimal(1000000, 2).positive(), taxRate: decimal(100, 2), note: z.string().max(3000) })
