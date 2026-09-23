import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { duplicateQuote, getQuotes, sendQuote } from '../api/quotes.api'
import type { Quote, QuotesData } from '../types/quotes.types'

export function useQuotes() {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const scope = `${userId}:${companyId}`
  const queryKey = ['quotes', userId, companyId, env.quotesUseMock]
  const client = useQueryClient()
  const query = useQuery({
    queryKey, queryFn: ({ signal }) => getQuotes(scope, {}, signal),
    retry: false, networkMode: 'always',
  })
  function updateCache(quote: Quote) {
    client.setQueryData<QuotesData>(queryKey, (current) => current && ({
      ...current, quotes: [quote, ...current.quotes.filter((item) => item.id !== quote.id)],
    }))
  }
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey }),
      client.invalidateQueries({ queryKey: ['quote-editor', userId, companyId, env.quotesUseMock] }),
    ])
  }
  const send = useMutation({ mutationFn: (id: number) => sendQuote(scope, id), networkMode: 'always', onSuccess: updateCache, onSettled: refresh })
  const duplicate = useMutation({ mutationFn: (id: number) => duplicateQuote(scope, id), networkMode: 'always', onSuccess: updateCache, onSettled: refresh })
  return {
    ...query, send, duplicate, isDemo: env.quotesUseMock,
    isForbidden: isAxiosError(query.error) && query.error.response?.status === 403,
  }
}
