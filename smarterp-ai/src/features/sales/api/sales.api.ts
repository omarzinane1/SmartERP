import { env } from '../../../config/env'
import { apiClient } from '../../../lib/axios'
import { confirmSalesOrderMock, getSalesInsightMock, getSalesOrderMock, getSalesOrdersMock } from '../data/sales.mock'
import type { SalesActionResult, SalesDeliveryInput, SalesInvoiceInput, SalesOrderDetail, SalesOrdersData } from '../types/sales.types'

export const SALES_ENDPOINT = '/sales-orders/'
export class SalesOrderNotFoundError extends Error {}
function fromAPI(order: Omit<SalesOrderDetail, 'capabilities'> & { capabilities?: Partial<SalesOrderDetail['capabilities']> }): SalesOrderDetail {
  return { ...order,
    capabilities: { canConfirm: false, canCancel: false, canDeliver: false, canInvoice: false, invoiceableAmount: 0, ...order.capabilities },
    lines: order.lines.map((line) => ({ ...line, unitCost: typeof line.unitCost === 'number' && Number.isFinite(line.unitCost) ? line.unitCost : null })),
  }
}
// Contrat initial camelCase, adapté ici lorsque le contrat Django sera finalisé.
export async function getSalesOrders(scope: string, signal?: AbortSignal): Promise<SalesOrdersData> {
  if (env.salesUseMock) return getSalesOrdersMock(scope)
  const { data } = await apiClient.get<SalesOrdersData>(SALES_ENDPOINT, { signal })
  return data
}
export async function getSalesOrderById(scope: string, id: number, signal?: AbortSignal): Promise<SalesOrderDetail> {
  if (env.salesUseMock) {
    const order = await getSalesOrderMock(scope, id)
    if (!order) throw new SalesOrderNotFoundError('Commande introuvable')
    return order
  }
  const { data } = await apiClient.get<SalesOrderDetail>(`${SALES_ENDPOINT}${id}/`, { signal })
  return fromAPI(data)
}
export async function confirmSalesOrder(scope: string, id: number): Promise<SalesActionResult> {
  if (env.salesUseMock) return confirmSalesOrderMock(scope, id)
  const { data } = await apiClient.post<SalesOrderDetail>(`${SALES_ENDPOINT}${id}/confirm/`)
  return { simulated: false, order: fromAPI(data) }
}
export async function createSalesOrderDelivery(id: number, input: SalesDeliveryInput): Promise<SalesActionResult> {
  // Préparation uniquement : aucun stock, document ou compteur n'est modifié localement.
  if (env.salesUseMock) { await new Promise((resolve) => setTimeout(resolve, 400)); return { simulated: true } }
  const { data } = await apiClient.post<{ order: SalesOrderDetail; reference: string }>(`${SALES_ENDPOINT}${id}/delivery/`, {
    warehouse: input.warehouse, lines: input.lines.map((line) => ({ line_id: line.lineId, quantity: line.quantity })),
  })
  return { ...data, order: fromAPI(data.order), simulated: false }
}
export async function createSalesOrderInvoice(id: number, input: SalesInvoiceInput): Promise<SalesActionResult> {
  if (env.salesUseMock) { await new Promise((resolve) => setTimeout(resolve, 400)); return { simulated: true } }
  const { data } = await apiClient.post<{ order: SalesOrderDetail; reference: string }>(`${SALES_ENDPOINT}${id}/invoice/`, input)
  return { ...data, order: fromAPI(data.order), simulated: false }
}
export async function requestSalesOrderInsight(scope: string, id: number) {
  if (env.salesUseMock) return getSalesInsightMock(scope, id)
  // Aucun endpoint IA de commande ni d'annulation n'est défini : aucun appel inventé.
  throw new Error('Service d’analyse de commande non connecté')
}
