import { Badge } from '../../../components/ui/Badge'
import { quoteStatusLabels, type QuoteStatus } from '../types/quotes.types'

const tones = { draft: 'neutral', sent: 'info', viewed: 'indigo', accepted: 'positive', rejected: 'critical', expired: 'warning' } as const
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={tones[status]}><span className="size-1 rounded-full bg-current" />{quoteStatusLabels[status]}</Badge>
}
