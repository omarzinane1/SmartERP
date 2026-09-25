import { formatMoney, sumMoney } from '../../../lib/money'
import { expenseSnapshot } from '../../expenses/data/expenses.mock'
import { invoiceSnapshot } from '../../invoices/data/invoices.mock'
import { calculateAging, remainingAmount } from '../../invoices/utils/invoiceCalculations'
import { paymentSnapshot } from '../../payments/data/payments.mock'
import { supplierInvoiceSnapshot } from '../../supplier-invoices/data/supplierInvoices.mock'
import { payableAging, payableBalance } from '../../supplier-invoices/supplierInvoices.utils'
import { stockDemoDate } from '../../products/data/products.mock'
import type { CashFlowData, CashForecast, CashInsight, CashUpcoming } from '../types/finance.types'
export const cashPermissions = ['finance.view', 'cashflow.view', 'ai.use', 'invoices.view', 'supplier_invoices.view', 'payments.view', 'expenses.view']
export function cashLedgerMock(scope: string) {
  const payments = paymentSnapshot(scope).filter((p) => p.status === 'completed').map((p) => ({ id: `payment:${p.id}`, date: p.date, amount: p.direction === 'incoming' ? p.amount : -p.amount }))
  // Dépenses payées distinctes du journal clients/fournisseurs : une écriture par dépense.
  const expenses = expenseSnapshot(scope).filter((e) => e.status === 'paid' && e.paidDate).map((e) => ({ id: `expense:${e.id}`, date: e.paidDate!, amount: -e.total }))
  return [...payments, ...expenses].filter((m) => m.date >= '2026-01-01' && m.date <= stockDemoDate).sort((a, b) => a.date.localeCompare(b.date))
}
export function cashUpcomingMock(scope: string): CashUpcoming { return { customers: invoiceSnapshot(scope).filter((i) => i.workflowStatus === 'posted' && remainingAmount(i) > 0).map((i) => ({ id: i.id, reference: i.reference, partnerName: i.customerName, dueDate: i.dueDate, amount: remainingAmount(i), path: `/invoices/${i.id}` })).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), suppliers: supplierInvoiceSnapshot(scope).filter((i) => i.workflowStatus === 'posted' && payableBalance(i) > 0).map((i) => ({ id: i.id, reference: i.reference, partnerName: i.supplierName, dueDate: i.dueDate, amount: payableBalance(i), path: `/supplier-invoices/${i.id}` })).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) } }
export function cashFlowMock(scope: string): CashFlowData {
  const ledger = cashLedgerMock(scope), opening = 1800000, month = ledger.filter((m) => m.date.startsWith(stockDemoDate.slice(0, 7))), upcoming = cashUpcomingMock(scope)
  let actual = opening; const history = new Map<string, { date: string; actual: number }>(); history.set('2026-01-01', { date: '2026-01-01', actual })
  for (const m of ledger) { actual = sumMoney([actual, m.amount]); history.set(m.date, { date: m.date, actual }) }
  history.set(stockDemoDate, { date: stockDemoDate, actual })
  return { permissions: cashPermissions, asOf: stockDemoDate, opening, openingDate: '2026-01-01', cash: actual, incoming: sumMoney(month.filter((m) => m.amount > 0).map((m) => m.amount)), outgoing: -sumMoney(month.filter((m) => m.amount < 0).map((m) => m.amount)), receivable: sumMoney(upcoming.customers.map((i) => i.amount)), payable: sumMoney(upcoming.suppliers.map((i) => i.amount)), history: [...history.values()], receivableAging: calculateAging(invoiceSnapshot(scope), stockDemoDate), payableAging: payableAging(supplierInvoiceSnapshot(scope), stockDemoDate), source: 'Solde initial de démonstration au 01/01/2026 + paiements confirmés clients/fournisseurs − dépenses payées distinctes. Période des flux : septembre 2026. Aucun raccordement bancaire.' }
}
const plusDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
export function cashForecastMock(scope: string, horizon: number): CashForecast {
  const flow = cashFlowMock(scope), upcoming = cashUpcomingMock(scope), end = plusDays(stockDemoDate, horizon)
  const events = [...upcoming.customers.map((i) => ({ date: i.dueDate <= stockDemoDate ? plusDays(stockDemoDate, 7) : i.dueDate, amount: i.amount })), ...upcoming.suppliers.map((i) => ({ date: i.dueDate <= stockDemoDate ? plusDays(stockDemoDate, 7) : i.dueDate, amount: -i.amount }))].filter((e) => e.date <= end).sort((a, b) => a.date.localeCompare(b.date))
  let forecast = flow.cash ?? 0; const series = new Map<string, { date: string; forecast: number }>(); series.set(stockDemoDate, { date: stockDemoDate, forecast })
  for (const event of events) { forecast = sumMoney([forecast, event.amount]); series.set(event.date, { date: event.date, forecast }) }
  series.set(end, { date: end, forecast })
  return { horizon, generatedAt: stockDemoDate, confidence: null, lowConfidence: true, projected: forecast, series: [...series.values()], assumptions: 'Scénario de démonstration : 100 % des soldes ouverts réglés à échéance ; retards reportés à J+7. Aucune vente, charge ou dépense future additionnelle. Sans probabilités calibrées ni garantie de réalisation.' }
}
export function cashInsightMock(scope: string, horizon: number): CashInsight { const f = cashFlowMock(scope), projection = cashForecastMock(scope, horizon); return { facts: [`Cash observé dans la simulation : ${formatMoney(f.cash ?? 0)}.`, `Créances : ${formatMoney(f.receivable)} ; dettes : ${formatMoney(f.payable)}.`], forecast: `${formatMoney(projection.projected ?? 0)} à ${horizon} jours selon les hypothèses affichées.`, analysis: 'La projection est sensible aux dates d’encaissement effectives. Les créances ne sont pas du cash disponible.', risk: (projection.projected ?? 0) < 0 ? 'Risque élevé : le scénario passe sous zéro.' : 'Risque non calibré : le scénario dépend du règlement intégral des échéances.', recommendations: ['Confirmer les dates des factures les plus importantes.', 'Rapprocher le solde avec les comptes bancaires avant toute décision.'], source: 'Démonstration déterministe ; aucun modèle prédictif exécuté.', horizon, generatedAt: stockDemoDate, confidence: null } }
