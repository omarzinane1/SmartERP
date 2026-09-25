import { z } from 'zod'
import { BusinessNotFoundError } from '../../../hooks/useBusinessScope'
import { stockDemoDate } from '../../products/data/products.mock'
import { stockSnapshot } from '../../inventory/data/inventory.mock'
import { expenseSnapshot } from '../../expenses/data/expenses.mock'
import { paymentSnapshot } from '../../payments/data/payments.mock'
import { invoiceSnapshot } from '../../invoices/data/invoices.mock'
import { remainingAmount } from '../../invoices/utils/invoiceCalculations'
import { supplierInvoiceSnapshot } from '../../supplier-invoices/data/supplierInvoices.mock'
import { payableBalance } from '../../supplier-invoices/supplierInvoices.utils'
import { purchaseSnapshot } from '../../purchases/data/purchases.mock'
import { salesSnapshot } from '../../sales/data/sales.mock'
import { cashFlowMock } from '../../finance/data/finance.mock'
import type { GeneratedReport, ReportDefinition, ReportInput } from '../types/reports.types'
const definitions: ReportDefinition[] = [
  { id: 'sales', name: 'Performance des ventes', category: 'Ventes', description: 'Commandes confirmées, clients et montants TTC.', formats: ['csv'], supportsPeriod: true, path: '/sales' },
  { id: 'profit', name: 'Rentabilité par produit', category: 'Rentabilité', description: 'Consultez les marges et prix du catalogue.', formats: [], supportsPeriod: false, path: '/products' },
  { id: 'customers', name: 'Analyse clients', category: 'CRM', description: 'Portefeuille, segmentation et comptes clients.', formats: [], supportsPeriod: false, path: '/customers' },
  { id: 'stock', name: 'Stock et valorisation', category: 'Stock', description: 'Photographie actuelle par produit et dépôt, au coût moyen.', formats: ['csv'], supportsPeriod: false, path: '/inventory' },
  { id: 'turnover', name: 'Rotation du stock', category: 'Stock', description: 'Consultez les mouvements et le stock dormant. Export historique à connecter.', formats: [], supportsPeriod: false, path: '/inventory' },
  { id: 'suppliers', name: 'Performance fournisseurs', category: 'Achats', description: 'Scores, achats et soldes du portefeuille fournisseurs.', formats: [], supportsPeriod: false, path: '/suppliers' },
  { id: 'purchases', name: 'Achats par fournisseur', category: 'Achats', description: 'Détail des commandes fournisseurs confirmées.', formats: ['csv'], supportsPeriod: true, path: '/purchases' },
  { id: 'receivable', name: 'Créances clients', category: 'Finance', description: 'Soldes actuels des factures comptabilisées non réglées.', formats: ['csv'], supportsPeriod: false, path: '/invoices' },
  { id: 'payable', name: 'Dettes fournisseurs', category: 'Finance', description: 'Soldes actuels des factures fournisseurs à payer.', formats: ['csv'], supportsPeriod: false, path: '/supplier-invoices' },
  { id: 'payments', name: 'Paiements', category: 'Finance', description: 'Encaissements et décaissements confirmés sur la période.', formats: ['csv'], supportsPeriod: true, path: '/payments' },
  { id: 'expenses', name: 'Dépenses par catégorie', category: 'Finance', description: 'Détail classé par catégorie, montants HT, taxes et TTC.', formats: ['csv'], supportsPeriod: true, path: '/expenses' },
  { id: 'cash', name: 'Cash Flow', category: 'Finance', description: 'Historique des soldes confirmés, hors projection.', formats: ['csv'], supportsPeriod: true, path: '/finance/cash-flow' },
].map((r) => ({ ...r, canOpen: true, lastGenerated: null, generatedBy: null })) as ReportDefinition[]
const stores = new Map<string, GeneratedReport[]>()
function store(scope: string) { if (!stores.has(scope)) stores.set(scope, []); return stores.get(scope)! }
export const recentReportsMock = (scope: string) => structuredClone(store(scope))
export const reportCatalogMock = (scope: string) => definitions.map((d) => { const latest = store(scope).find((r) => r.reportId === d.id && r.status === 'ready'); return { ...d, lastGenerated: latest?.createdAt ?? null, generatedBy: latest?.generatedBy ?? null } })
export const reportSchema: z.ZodType<ReportInput, ReportInput> = z.object({ reportId: z.string().min(1), dateFrom: z.iso.date(), dateTo: z.iso.date(), filter: z.string().max(150), format: z.enum(['csv', 'pdf', 'xlsx']) }).refine((v) => v.dateFrom <= v.dateTo, { path: ['dateTo'], message: 'La fin doit suivre le début.' })
export async function generateReportMock(scope: string, input: ReportInput): Promise<GeneratedReport> {
  await new Promise((r) => setTimeout(r, 350)); const v = reportSchema.parse(input), definition = definitions.find((d) => d.id === v.reportId)
  if (!definition) throw new BusinessNotFoundError()
  if (!definition.formats.includes(v.format)) throw new Error('Format non pris en charge pour ce rapport.')
  const period = (date: string) => date.slice(0, 10) >= v.dateFrom && date.slice(0, 10) <= v.dateTo
  let rows: (string | number)[][]
  // Exports bornés aux données de chaque feature ; aucun moteur générique de rapports.
  switch (v.reportId) {
    case 'stock': rows = [['Produit', 'SKU', 'Dépôt', 'Physique', 'Réservé', 'Disponible', 'En transit', 'Valeur MAD', 'Date de situation'], ...stockSnapshot(scope).map((r) => [r.productName, r.sku, r.warehouseName, r.onHand, r.reserved, r.available, r.incoming, r.value, stockDemoDate])]; break
    case 'expenses': rows = [['Catégorie', 'Référence', 'Date', 'Description', 'Statut', 'HT MAD', 'Taxe MAD', 'TTC MAD'], ...expenseSnapshot(scope).filter((e) => period(e.date)).sort((a, b) => a.category.localeCompare(b.category)).map((e) => [e.category, e.reference, e.date, e.description, e.status, e.amountHT, e.taxAmount, e.total])]; break
    case 'payments': rows = [['Référence', 'Date', 'Sens', 'Partenaire', 'Facture', 'Montant MAD'], ...paymentSnapshot(scope).filter((p) => p.status === 'completed' && period(p.date)).map((p) => [p.reference, p.date, p.direction, p.partnerName, p.invoiceReference ?? '', p.amount])]; break
    case 'receivable': rows = [['Facture', 'Client', 'Échéance', 'Solde MAD', 'Date de situation'], ...invoiceSnapshot(scope).filter((i) => i.workflowStatus === 'posted' && remainingAmount(i) > 0).map((i) => [i.reference, i.customerName, i.dueDate, remainingAmount(i), stockDemoDate])]; break
    case 'payable': rows = [['Facture', 'Fournisseur', 'Échéance', 'Solde MAD', 'Date de situation'], ...supplierInvoiceSnapshot(scope).filter((i) => i.workflowStatus === 'posted' && payableBalance(i) > 0).map((i) => [i.reference, i.supplierName, i.dueDate, payableBalance(i), stockDemoDate])]; break
    case 'sales': rows = [['Commande', 'Client', 'Date', 'Statut', 'TTC MAD'], ...salesSnapshot(scope).filter((o) => o.orderStatus !== 'draft' && o.orderStatus !== 'cancelled' && period(o.createdAt)).map((o) => [o.reference, o.customerName, o.createdAt, o.orderStatus, o.totalAmount])]; break
    case 'purchases': rows = [['Commande', 'Fournisseur', 'Date', 'TTC MAD'], ...purchaseSnapshot(scope).filter((o) => o.status === 'confirmed' && period(o.date)).map((o) => [o.reference, o.supplierName, o.date, o.total])]; break
    case 'cash': rows = [['Date', 'Solde confirmé MAD'], ...cashFlowMock(scope).history.filter((p) => period(p.date)).map((p) => [p.date, p.actual])]; break
    default: throw new Error('Export non disponible.')
  }
  rows = [rows[0], ...rows.slice(1).filter((r) => r.join(' ').toLocaleLowerCase('fr').includes(v.filter.toLocaleLowerCase('fr')))]
  const result: GeneratedReport = { id: crypto.randomUUID(), reportId: definition.id, name: definition.name, createdAt: new Date().toISOString(), generatedBy: 'Utilisateur démo', format: v.format, status: 'ready', filename: `${definition.id}-${definition.supportsPeriod ? v.dateFrom + '-' + v.dateTo : stockDemoDate}.csv`, downloadUrl: null, rows, dateFrom: definition.supportsPeriod ? v.dateFrom : stockDemoDate, dateTo: definition.supportsPeriod ? v.dateTo : stockDemoDate }
  store(scope).unshift(result); return structuredClone(result)
}
