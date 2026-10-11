export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'opportunity'
export type IntelligenceType =
  | 'fact'
  | 'analysis'
  | 'forecast'
  | 'recommendation'
export type AlertStatus = 'open' | 'investigating' | 'resolved' | 'dismissed'
export type Department =
  | 'Finance'
  | 'Ventes'
  | 'Stock'
  | 'Clients'
  | 'Achats'
  | 'Opérations'

export interface Evidence {
  id: string
  kind:
    | 'Commande client'
    | 'Commande fournisseur'
    | 'Produit'
    | 'Facture'
    | 'Client'
  description: string
}

export interface SuggestedAction {
  id: string
  title: string
  detail: string
  button: string
  approvalRequired: boolean
  draft: string[]
}

export interface IntelligenceRun {
  id: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  errorMessage: string | null
}

export interface AIAlert {
  id: string
  title: string
  scope: string
  department: Department
  severity: Severity
  type: IntelligenceType
  metric: string
  currentValue: string
  baseline: string
  deviation: string
  impact: string
  confidence: number | null
  detectedAt: string
  status: AlertStatus
  assignee?: string
  facts: { label: string; value: string; note?: string }[]
  analysis: string
  causes: { title: string; evidence: string }[]
  estimates: { label: string; value: string }[]
  recommendations: SuggestedAction[]
  evidence: Evidence[]
}

export interface AlertFilters {
  search: string
  department: string
  severity: string
  status: string
  type: string
  days: string
  groupBy: string
}

export interface AIControlCenterData {
  period: { label: string; asOf: string; generatedAt: string }
  health: {
    score: number | null
    trend: number | null
    confidence: number | null
    status?: 'healthy' | 'warning' | 'critical' | 'not_available'
    explanation?: string
    departments: {
      name: Department
      score: number | null
      trend: number | null
      alerts: number
      status: string
      tone: 'positive' | 'critical' | 'warning' | 'indigo'
    }[]
  }
  stats: {
    critical: number
    warnings: number
    forecasts: number
    opportunities: number
    resolved: number
  }
  summary: {
    text: string
    confidence: number | null
    priorities: string[]
    impacts: string[]
    recommendations: string[]
    sources: string[]
    model: string
  }
  lastRun?: IntelligenceRun | null
  alertsCount?: number
  alerts: AIAlert[]
  risks: {
    id: string
    alertId: string
    label: string
    shortLabel: string
    impact: number | null
    probability: number | null
    explanation?: string
    severity: Severity
  }[]
  forecasts: {
    id: string
    title: string
    detail: string
    horizon: string
    confidence: number | null
    severity: Severity
    source?: string
    assumptions: string
  }[]
  opportunities: {
    id: string
    title: string
    company: string
    detail: string
    potential: string
    confidence: number | null
    action: SuggestedAction
  }[]
  actions: SuggestedAction[]
  governance: SuggestedAction[]
  anomalyHistory: {
    day: string
    critical: number
    high: number
    medium: number
    resolved: number
  }[]
  resolutionRate: number | null
  responseMinutes: number | null
  assignees: string[]
}

export const severityLabels: Record<Severity, string> = {
  critical: 'Critique',
  high: 'Élevée',
  medium: 'Avert.',
  low: 'Faible',
  opportunity: 'Opportunité',
}
export const severityTones = {
  critical: 'critical',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
  opportunity: 'positive',
} as const
export const statusLabels: Record<AlertStatus, string> = {
  open: 'Ouverte',
  investigating: 'En analyse',
  resolved: 'Résolue',
  dismissed: 'Écartée',
}
export const intelligenceLabels: Record<IntelligenceType, string> = {
  fact: 'FACT',
  analysis: 'AI ANALYSIS',
  forecast: 'FORECAST',
  recommendation: 'RECOMMENDATION',
}
