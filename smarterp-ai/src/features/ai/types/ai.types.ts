import type { DocumentSource } from '../../documents/types/documents.types'
export type AICategory = 'FACT' | 'AI ANALYSIS' | 'FORECAST' | 'RECOMMENDATION'
export type AIResponseBlock =
  | { id: string; category: AICategory; type: 'text' | 'risk'; text: string }
  | { id: string; category: AICategory; type: 'list'; items: string[] }
  | { id: string; category: AICategory; type: 'kpi'; items: { label: string; value: number; unit: 'money' | 'number' }[] }
  | { id: string; category: AICategory; type: 'table'; columns: string[]; rows: (string | number)[][] }
  | { id: string; category: AICategory; type: 'chart'; title: string; data: { name: string; value: number }[] }
  | { id: string; category: 'RECOMMENDATION'; type: 'action'; title: string; impact: string; dataUsed: string[]; approvalId: number | null; status: 'awaiting_approval'; canOpenApproval: boolean }
export interface AIMessage { id: string; role: 'user' | 'assistant'; text: string; blocks: AIResponseBlock[]; sources: DocumentSource[]; createdAt: string; tools: string[]; period: string | null; simulated: boolean }
export interface Conversation { id: string; title: string; createdAt: string; messages: AIMessage[] }
export interface ConversationsData { canChat?: boolean; policyReason?: string | null; conversations: Conversation[]; permissions: string[]; asOf: string; availableTools: { id: string; label: string }[] }
export type ChatEvent = { type: 'status'; status: 'streaming' | 'tool_running'; tool?: string } | { type: 'block'; block: AIResponseBlock } | { type: 'done'; message: AIMessage } | { type: 'error'; message: string }
export const forecastDomains = ['revenue', 'sales', 'demand', 'inventory', 'cash-flow', 'payments'] as const
export type ForecastDomain = typeof forecastDomains[number]
export interface ForecastResult { domain: ForecastDomain; permissions: string[]; asOf: string; status: 'ready' | 'low_confidence' | 'insufficient_data' | 'disabled'; horizon: number; confidence: number | null; dataQuality: string; generatedAt: string; historyFrom: string | null; historyTo: string | null; projected: number | null; unit: 'money' | 'number'; series: { date: string; historical: number | null; forecast: number | null; lower: number | null; upper: number | null }[]; risks: string[]; source: string }
export interface ForecastDriver { label: string; explanation: string; relationship: 'observed' | 'correlation' | 'assumption' }
export type OpportunityType = 'customer_reactivation' | 'high_value_customer' | 'receivable_collection' | 'stock_replenishment' | 'dormant_stock'
export type OpportunityStatus = 'open' | 'acknowledged' | 'completed' | 'dismissed' | 'expired'
export type OpportunityAction = 'acknowledge' | 'dismiss' | 'complete'
export interface AIOpportunity {
  id: number; type: OpportunityType; domain: string; title: string; description: string; reason: string;
  potentialValue: string | null; valueKind: 'outstanding_receivable' | 'book_inventory_value' | null; currency: string;
  confidence: null; evidence: DocumentSource[]; recommendation: string; priority: 'low' | 'medium' | 'high' | 'critical';
  status: OpportunityStatus; source: string; detector: string; version: string; metrics: Record<string, string | number>;
  entity: { type: string; id: number; name: string; path: string }; actions: OpportunityAction[];
  detectedAt: string; lastSeenAt: string; expiresAt: string; acknowledgedAt: string | null;
  dismissedAt: string | null; completedAt: string | null; expiredAt: string | null;
  acknowledgedBy: number | null; dismissedBy: number | null; completedBy: number | null;
}
export interface OpportunityFilters { type: string; status: string; priority: string; domain: string; search: string; date_from: string; date_to: string; page: number; page_size: number }
export interface OpportunitiesData {
  opportunities: AIOpportunity[]; permissions: string[]; asOf: string; count: number; next: string | null; previous: string | null;
  availableTypes: OpportunityType[]; lastRun: import('../../ai-control-center/types/aiControlCenter.types').IntelligenceRun | null;
}
