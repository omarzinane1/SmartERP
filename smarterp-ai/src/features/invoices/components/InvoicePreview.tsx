import { Printer, X } from 'lucide-react'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { calculateLineAmounts, calculateTotals, formatMoney, type MoneyTotals } from '../../../lib/money'
import type { InvoiceInput } from '../types/invoices.types'

export function InvoicePreview({ input, reference, customerName, customerEmail, companyName, isDemo, dirty, savedTotals, onClose }: { input: InvoiceInput; reference: string; customerName: string; customerEmail: string; companyName: string; isDemo: boolean; dirty: boolean; savedTotals?: MoneyTotals; onClose: () => void }) {
  const totals = dirty || !savedTotals ? calculateTotals(input.lines) : savedTotals
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : '—'
  return <Dialog title="Prévisualisation de la facture" className="invoice-preview" onClose={onClose}><header className="invoice-preview-controls"><p>Aperçu HTML imprimable · Génération PDF disponible après connexion backend<br />Coordonnées fiscales de la société à compléter depuis sa configuration.</p><Button className="invoice-button" variant="secondary" onClick={() => window.print()}><Printer size={13} />Imprimer</Button><button aria-label="Fermer l’aperçu" onClick={onClose}><X size={20} /></button></header>
    <article className="invoice-paper" aria-label="Aperçu de la facture"><p className="invoice-paper-notice">{isDemo ? 'DOCUMENT DE DÉMONSTRATION — SANS VALEUR COMPTABLE' : dirty ? 'BROUILLON — MODIFICATIONS NON ENREGISTRÉES' : 'APERÇU DU DOCUMENT ENREGISTRÉ'}</p><header><div><BrandLogo /><h3>{companyName}</h3><p>Facturation clients · {input.currency}</p></div><div><h1>FACTURE</h1><strong>{reference}</strong><p>Date : {date(input.invoiceDate)}</p><p>Échéance : {date(input.dueDate)}</p></div></header><section className="invoice-paper-customer"><small>FACTURÉ À</small><h2>{customerName || 'Client à sélectionner'}</h2><p>{input.billingAddress}</p><p>{customerEmail}</p>{input.customerReference && <p>Référence : {input.customerReference}</p>}</section>
      <table><thead><tr><th>Désignation</th><th>Qté</th><th>Prix HT</th><th>Remise</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>{input.lines.map((line) => <tr key={line.id}><td><strong>{line.productName}</strong><p>{line.description}</p></td><td>{Number.isFinite(line.quantity) ? line.quantity : '—'}</td><td>{formatMoney(line.unitPrice)}</td><td>{line.discountRate || 0} %</td><td>{line.taxRate || 0} %</td><td>{formatMoney(calculateLineAmounts(line).net)}</td></tr>)}</tbody></table><dl>{[['Sous-total brut', totals.gross], ['Remises', totals.discount], ['Total HT', totals.net], ['TVA', totals.tax], ['Total TTC', totals.total]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatMoney(Number(value))}</dd></div>)}</dl><section className="invoice-paper-terms"><h3>Conditions de paiement</h3><p>{input.paymentTerms || 'À préciser'}</p>{input.notes && <p>{input.notes}</p>}</section><footer>{companyName} · {reference} · {input.currency}</footer>
    </article>
  </Dialog>
}
