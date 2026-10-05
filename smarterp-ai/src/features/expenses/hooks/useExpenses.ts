import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../../../config/env'
import { businessQueryOptions as options, useBusinessScope } from '../../../hooks/useBusinessScope'
import { approveExpense, createExpense, getExpenses, submitExpense, rejectExpense, cancelExpense } from '../api/expenses.api'
import type { ExpenseInput } from '../types/expenses.types'
export function useExpenses() {
  const { scope, key, invalidate } = useBusinessScope(), refresh = () => invalidate(['expenses', 'finance-kpis', 'cash-flow', 'cash-forecast', 'cash-upcoming', 'reports', 'report-analytics', 'forecast', 'forecast-drivers', 'ai-opportunities', 'approvals', 'reports-recent'])
  const query = useQuery({ ...options, queryKey: [...key('expenses'), env.expensesUseMock], queryFn: ({ signal }) => getExpenses(scope, signal) })
  const create = useMutation({ ...options, mutationFn: (v: ExpenseInput) => createExpense(scope, v), onSuccess: refresh })
  const action = useMutation({ ...options, mutationFn: ({ id, action, reason }: { id: number; action: 'submit' | 'approve' | 'reject' | 'cancel'; reason?: string }) => action === 'cancel' ? cancelExpense(id) : action === 'submit' ? submitExpense(scope, id) : action === 'reject' ? rejectExpense(scope, id, reason ?? '') : approveExpense(scope, id), onSuccess: refresh })
  return { ...query, create, action, isDemo: env.expensesUseMock }
}
