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
export interface ConversationsData { conversations: Conversation[]; permissions: string[]; asOf: string; availableTools: { id: string; label: string }[] }
export type ChatEvent = { type: 'status'; status: 'streaming' | 'tool_running'; tool?: string } | { type: 'block'; block: AIResponseBlock } | { type: 'done'; message: AIMessage } | { type: 'error'; message: string }
export const forecastDomains = ['revenue', 'sales', 'demand', 'inventory', 'cash-flow', 'payments'] as const
export type ForecastDomain = typeof forecastDomains[number]
export interface ForecastResult { domain: ForecastDomain; permissions: string[]; asOf: string; status: 'ready' | 'low_confidence' | 'insufficient_data'; horizon: number; confidence: number | null; dataQuality: string; generatedAt: string; historyFrom: string | null; historyTo: string | null; projected: number | null; unit: 'money' | 'number'; series: { date: string; historical: number | null; forecast: number | null; lower: number | null; upper: number | null }[]; risks: string[]; source: string }
export interface ForecastDriver { label: string; explanation: string; relationship: 'observed' | 'correlation' | 'assumption' }
export interface AIOpportunity { id: number; type: 'upsell' | 'growth' | 'margin' | 'supplier' | 'inventory'; title: string; potentialValue: number | null; confidence: number | null; confidenceLevel: 'high' | 'medium' | 'low' | null; evidence: DocumentSource[]; recommendation: string; status: 'open' | 'assigned' | 'dismissed'; assignedTo: { id: number; name: string } | null; canAssign: boolean; source: string }
export interface OpportunitiesData { opportunities: AIOpportunity[]; permissions: string[]; asOf: string; assignees: { id: number; name: string; role: string }[] }
