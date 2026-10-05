import { useMutation } from '@tanstack/react-query'
import { Button } from '../../../components/ui/Button'
import { apiClient } from '../../../lib/axios'
import { useBusinessScope } from '../../../hooks/useBusinessScope'

export function RequestPurchaseReview({ orderId }: { orderId: number }) {
  const { invalidate } = useBusinessScope()
  const request = useMutation({ mutationFn: () => apiClient.post('/approvals/', { type: 'purchase', record_id: orderId }), onSuccess: () => invalidate(['approvals']) })
  return <><Button className="business-button" variant="secondary" disabled={request.isPending || request.isSuccess} onClick={() => request.mutate()}>{request.isSuccess ? 'Revue demandée' : 'Demander une revue'}</Button>{request.isError && <p role="alert">Demande refusée : une revue peut déjà être en attente.</p>}</>
}
