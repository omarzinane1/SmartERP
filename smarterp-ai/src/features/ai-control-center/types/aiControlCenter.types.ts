export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'opportunity'
export type IntelligenceType =
  | 'fact'
  | 'analysis'
  | 'forecast'
  | 'recommendation'
export type AlertStatus = 'open' | 'investigating' | 'resolved'
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
  confidence: number
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
    score: number
    trend: number
    confidence: number
    departments: {
      name: Department
      score: number
      trend: number
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
    confidence: number
    priorities: string[]
    impacts: string[]
    recommendations: string[]
    sources: string[]
    model: string
  }
  alerts: AIAlert[]
  risks: {
    id: string
    alertId: string
    label: string
    shortLabel: string
    impact: number
    probability: number
    severity: Severity
  }[]
  forecasts: {
    id: string
    title: string
    detail: string
    horizon: string
    confidence: number
    severity: Severity
    assumptions: string
  }[]
  opportunities: {
    id: string
    title: string
    company: string
    detail: string
    potential: string
    confidence: number
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
  resolutionRate: number
  responseMinutes: number
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
}
export const intelligenceLabels: Record<IntelligenceType, string> = {
  fact: 'FACT',
  analysis: 'AI ANALYSIS',
  forecast: 'FORECAST',
  recommendation: 'RECOMMENDATION',
}
