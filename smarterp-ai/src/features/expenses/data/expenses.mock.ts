import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { calculateTotals } from '../../../lib/money'
import { supplierSnapshot } from '../../suppliers/data/suppliers.mock'
import { expenseSchema } from '../schemas/expense.schema'
import type { Expense, ExpenseInput } from '../types/expenses.types'
export const expenseCategories = ['Déplacements', 'Fournitures', 'Télécommunications', 'Maintenance', 'Loyer', 'Marketing']
export const expensePermissions = ['expenses.view', 'expenses.create', 'expenses.approve', 'expenses.export', 'suppliers.view']
export const expenseTotals = (amountHT: number, taxRate: number) => { const totals = calculateTotals([{ quantity: 1, unitPrice: amountHT, discountRate: 0, taxRate }]); return { taxAmount: totals.tax, total: totals.total } }
const stores = new Map<string, Expense[]>()
function store(scope: string) {
  if (!stores.has(scope)) stores.set(scope, Array.from({ length: 42 }, (_, n): Expense => {
    const status = (['draft', 'submitted', 'approved', 'rejected', 'paid'] as const)[n % 5], amountHT = 350 + n * 85, taxRate = n % 4 === 0 ? 0 : 20, date = `2026-${n < 26 ? '09' : '08'}-${String(1 + n % 25).padStart(2, '0')}`, supplier = supplierSnapshot(scope)[n % 3], category = expenseCategories[n % expenseCategories.length]
    return { id: 800 + n, reference: `EXP-2026-${800 + n}`, date, description: `${category} · ${n % 2 ? 'Équipe commerciale' : 'Exploitation'}`, category, supplierId: n % 3 === 0 ? supplier.id : null, supplierName: n % 3 === 0 ? supplier.name : null, employee: n % 2 ? 'Sara El Mansouri' : 'Omar Zinane', amountHT, taxRate, ...expenseTotals(amountHT, taxRate), note: '', status, paidDate: status === 'paid' ? date : null, receipt: n % 3 === 0 ? { id: `receipt-${n}`, name: `justificatif-${800 + n}.pdf`, mime: 'application/pdf', url: null } : null, capabilities: { canSubmit: status === 'draft', canApprove: status === 'submitted' } }
  }))
  return stores.get(scope)!
}
export const expenseSnapshot = (scope: string) => structuredClone(store(scope))
export async function createExpenseMock(scope: string, input: ExpenseInput) { await new Promise((r) => setTimeout(r, 250)); const v = expenseSchema.parse(input), supplier = v.supplierId ? supplierSnapshot(scope).find((s) => s.id === v.supplierId) : null; if (v.supplierId && !supplier) throw new Error('Fournisseur inconnu.'); const id = Math.max(0, ...store(scope).map((e) => e.id)) + 1; const expense: Expense = { ...v, id, reference: `EXP-DEMO-${id}`, supplierName: supplier?.name ?? null, ...expenseTotals(v.amountHT, v.taxRate), status: 'draft', paidDate: null, receipt: null, capabilities: { canSubmit: true, canApprove: false } }; store(scope).unshift(expense); return structuredClone(expense) }
export async function expenseActionMock(scope: string, id: number, action: 'submit' | 'approve') { await new Promise((r) => setTimeout(r, 250)); const expense = store(scope).find((e) => e.id === id); if (!expense) throw new BusinessNotFoundError(); if (action === 'submit' ? expense.status !== 'draft' : expense.status !== 'submitted') throw new Error('Transition non autorisée.'); expense.status = action === 'submit' ? 'submitted' : 'approved'; expense.capabilities = { canSubmit: false, canApprove: action === 'submit' }; return structuredClone(expense) }
// Le refus est accessible uniquement via le contrat du Centre de validation.
export function rejectExpenseFromApprovalMock(scope: string, id: number) { const expense = store(scope).find((e) => e.id === id); if (!expense || expense.status !== 'submitted') throw new Error('La dépense ne peut plus être refusée.'); expense.status = 'rejected'; expense.capabilities = { canSubmit: false, canApprove: false }; return structuredClone(expense) }
