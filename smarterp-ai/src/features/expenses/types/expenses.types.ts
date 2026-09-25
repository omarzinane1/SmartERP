import type { BusinessDocument } from '../../purchases/types/purchases.types'
export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
export interface ExpenseInput { date: string; description: string; category: string; supplierId: number | null; employee: string; amountHT: number; taxRate: number; note: string }
export interface Expense extends ExpenseInput { id: number; reference: string; supplierName: string | null; taxAmount: number; total: number; status: ExpenseStatus; paidDate: string | null; receipt: BusinessDocument | null; capabilities: { canSubmit: boolean; canApprove: boolean } }
export interface ExpensesData { expenses: Expense[]; permissions: string[]; asOf: string; suppliers: { id: number; name: string }[]; categories: string[] }
export const expenseStatusLabels = { draft: 'Brouillon', submitted: 'Soumise', approved: 'Approuvée', rejected: 'Rejetée', paid: 'Payée' }
