import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Package, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { calculateLineAmounts, formatMoney } from '../../../lib/money'
import { newInvoiceLine } from '../schemas/invoice.schema'
import type { InvoiceInput } from '../types/invoices.types'

export function InvoiceLines({ disabled }: { disabled: boolean }) {
  const { control, register, formState: { errors } } = useFormContext<InvoiceInput>()
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = useWatch({ control, name: 'lines' })
  return <section className="invoice-card" aria-labelledby="invoice-lines-title"><header className="invoice-section-title"><Package size={15} /><h2 id="invoice-lines-title">Lignes de facture</h2><span>{fields.length} lignes · MAD</span></header><fieldset disabled={disabled}>
    <div className="invoice-table-scroll" tabIndex={0} role="region" aria-label="Lignes de facture, défilement horizontal"><table className="invoice-lines-table"><thead><tr><th>Produit / Service</th><th>Description</th><th>Quantité</th><th>Prix unitaire</th><th>Remise %</th><th>TVA %</th><th>Total HT</th>{!disabled && <th><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{fields.map((field, index) => <tr key={field.id}>
      <td><input aria-label={`Produit ligne ${index + 1}`} {...register(`lines.${index}.productName`)} /><p className="invoice-field-error">{errors.lines?.[index]?.productName?.message}</p></td><td><textarea rows={2} aria-label={`Description ligne ${index + 1}`} {...register(`lines.${index}.description`)} aria-invalid={!!errors.lines?.[index]?.description} /><p className="invoice-field-error">{errors.lines?.[index]?.description?.message}</p></td>
      {(['quantity', 'unitPrice', 'discountRate', 'taxRate'] as const).map((key) => <td key={key}><input type="number" step={key === 'quantity' ? '0.001' : '0.01'} aria-label={`${({ quantity: 'Quantité', unitPrice: 'Prix unitaire', discountRate: 'Remise', taxRate: 'TVA' })[key]} ligne ${index + 1}`} {...register(`lines.${index}.${key}`, { valueAsNumber: true })} aria-invalid={!!errors.lines?.[index]?.[key]} /><p className="invoice-field-error">{errors.lines?.[index]?.[key]?.message}</p></td>)}
      <td className="invoice-money">{lines[index] ? formatMoney(calculateLineAmounts(lines[index]).net) : '—'}</td>{!disabled && <td><button type="button" aria-label={`Supprimer ligne ${index + 1}`} onClick={() => remove(index)}><Trash2 size={13} /></button></td>}
    </tr>)}</tbody></table></div>{!disabled && <footer className="invoice-lines-footer"><Button variant="ghost" className="invoice-button" onClick={() => append(newInvoiceLine())} disabled={fields.length >= 100}><Plus size={13} />Ajouter une ligne</Button><span>TVA propre à chaque ligne · aucune taxe ajoutée automatiquement</span></footer>}
  </fieldset>{(errors.lines?.root?.message || errors.lines?.message) && <p role="alert" className="invoice-field-error invoice-panel-body">{errors.lines?.root?.message ?? errors.lines?.message}</p>}</section>
}
