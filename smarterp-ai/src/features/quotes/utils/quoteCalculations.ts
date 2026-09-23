// Les devis et les commandes partagent la même stratégie d'arrondi.
export { calculateTotals as calculateQuoteTotals, calculateLineAmounts as calculateLineTotals, formatMoney as formatQuoteMoney } from '../../../lib/money'
export type { MoneyTotals as QuoteTotals } from '../../../lib/money'
