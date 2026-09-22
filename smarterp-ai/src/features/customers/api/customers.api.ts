import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { customersMock, getCustomerDetailMock, getCustomerSummaryMock, customerActivitiesMock, customerAIInsightMock } from '../data/customers.mock'
import type {
  Customer,
  CustomerInput,
  CustomersData,
  CustomerDetail,
  CustomerSummary,
  CustomerActivity,
  CustomerAIInsight,
} from '../types/customers.types'

export const CUSTOMERS_ENDPOINT = '/customers/'

export async function getCustomers(
  signal?: AbortSignal,
): Promise<CustomersData> {
  if (env.customersUseMock) return customersMock
  // Contrat initial : portefeuille complet et permissions, pagination côté frontend.
  const { data } = await apiClient.get<CustomersData>(CUSTOMERS_ENDPOINT, {
    signal,
  })
  return data
}

// Points d’entrée préparés pour Django. Les formulaires démo utilisent un état local.
export async function createCustomer(
  customer: CustomerInput,
): Promise<Customer> {
  const { data } = await apiClient.post<Customer>(CUSTOMERS_ENDPOINT, customer)
  return data
}

export async function updateCustomer(
  id: number,
  customer: Partial<CustomerInput & Pick<Customer, 'status' | 'tags'>>,
): Promise<Customer> {
  const { data } = await apiClient.patch<Customer>(
    `${CUSTOMERS_ENDPOINT}${id}/`,
    customer,
  )
  return data
}

export async function importCustomers(
  file: File,
): Promise<{ imported: number }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<{ imported: number }>(
    `${CUSTOMERS_ENDPOINT}import/`,
    form,
  )
  return data
}

export class CustomerNotFoundError extends Error {}

export async function getCustomerById(id: number, signal?: AbortSignal): Promise<CustomerDetail> {
  if (env.customersUseMock) {
    const customer = getCustomerDetailMock(id)
    if (!customer) throw new CustomerNotFoundError('Client introuvable')
    return customer
  }
  const { data } = await apiClient.get<CustomerDetail>(`/customers/${id}/`, { signal })
  return data
}

export async function getCustomerSummary(id: number, signal?: AbortSignal): Promise<CustomerSummary> {
  if (env.customersUseMock) {
    const summary = getCustomerSummaryMock(id)
    if (!summary) throw new CustomerNotFoundError('Client introuvable')
    return summary
  }
  const { data } = await apiClient.get<CustomerSummary>(`/customers/${id}/summary/`, { signal })
  return data
}

export async function getCustomerActivity(id: number, signal?: AbortSignal): Promise<CustomerActivity[]> {
  if (env.customersUseMock) return id === 124 ? customerActivitiesMock : []
  const { data } = await apiClient.get<CustomerActivity[]>(`/customers/${id}/activity/`, { signal })
  return data
}

export async function getCustomerAIInsight(id: number, signal?: AbortSignal): Promise<CustomerAIInsight | null> {
  if (env.customersUseMock) {
    // Délai perceptible pour présenter le chargement, sans prétendre exécuter un modèle.
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason); return }
      const onAbort = () => { clearTimeout(timer); reject(signal?.reason) }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, 700)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
    return id === 124 ? customerAIInsightMock : null
  }
  const { data } = await apiClient.get<CustomerAIInsight | null>(`/ai/customers/${id}/insight/`, { signal })
  return data
}

// Pour l'instant, demander une analyse recharge le même endpoint de lecture.
export const requestCustomerAIInsight = getCustomerAIInsight
