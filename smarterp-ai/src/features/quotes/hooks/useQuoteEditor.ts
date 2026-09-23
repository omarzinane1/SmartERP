import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/auth.store'
import { acceptQuote, convertQuote, createQuote, duplicateQuote, getQuoteEditorData, QuoteNotFoundError, sendQuote, updateQuote } from '../api/quotes.api'
import type { QuoteConversionTarget, QuoteDetail, QuoteEditorData, QuoteInput, QuotesData } from '../types/quotes.types'

export function useQuoteEditor(id: string | undefined) {
  const userId = useAuthStore((state) => state.user?.id)
  const companyId = useAuthStore((state) => state.company?.id)
  const scope = `${userId}:${companyId}`
  const numericId = id === undefined ? undefined : Number(id)
  const validId = id === undefined || (/^\d+$/.test(id) && Number.isSafeInteger(numericId) && Number(numericId) > 0)
  const client = useQueryClient()
  const prefix = ['quote-editor', userId, companyId, env.quotesUseMock]
  const queryKey = [...prefix, numericId ?? 'new']
  const listKey = ['quotes', userId, companyId, env.quotesUseMock]
  const options = { networkMode: 'always' as const, retry: false }
  const query = useQuery({ ...options, queryKey, enabled: validId,
    queryFn: ({ signal }) => getQuoteEditorData(scope, numericId, signal),
  })
  function cacheQuote(quote: QuoteDetail) {
    client.setQueryData<QuoteEditorData>([...prefix, quote.id], {
      quote, permissions: quote.permissions, products: quote.products, asOf: quote.asOf, salesperson: quote.salesperson,
    })
    client.setQueryData<QuotesData>(listKey, (current) => current && ({ ...current, quotes: [quote, ...current.quotes.filter((item) => item.id !== quote.id)] }))
    void client.invalidateQueries({ queryKey: listKey })
  }
  const refresh = async () => {
    await Promise.all([client.invalidateQueries({ queryKey }), client.invalidateQueries({ queryKey: listKey })])
  }
  const save = useMutation({ ...options,
    mutationFn: (input: QuoteInput) => numericId === undefined ? createQuote(scope, input) : updateQuote(scope, numericId, input),
    onSuccess: cacheQuote,
  })
  const send = useMutation({ ...options, mutationFn: () => sendQuote(scope, numericId!), onSuccess: refresh })
  const accept = useMutation({ ...options, mutationFn: () => acceptQuote(numericId!), onSuccess: cacheQuote })
  const convert = useMutation({ ...options, mutationFn: (target: QuoteConversionTarget) => convertQuote(numericId!, target),
    onSuccess: (document) => {
      const quote = client.getQueryData<QuoteEditorData>(queryKey)?.quote
      if (quote) cacheQuote({ ...quote, convertedTo: document })
    },
  })
  const duplicate = useMutation({ ...options, mutationFn: () => duplicateQuote(scope, numericId!), onSuccess: () => client.invalidateQueries({ queryKey: listKey }) })
  const status = isAxiosError(query.error) ? query.error.response?.status : undefined
  return {
    ...query, save, send, accept, convert, duplicate, isDemo: env.quotesUseMock,
    isNotFound: !validId || status === 404 || query.error instanceof QuoteNotFoundError,
    isForbidden: status === 403 || (!!query.data && !query.data.permissions.includes('quotes.view')),
    busy: save.isPending || send.isPending || accept.isPending || convert.isPending || duplicate.isPending,
  }
}
