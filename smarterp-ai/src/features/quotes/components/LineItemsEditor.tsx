import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Package, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { newQuoteLine } from '../schemas/quote.schema'
import { calculateLineTotals, formatQuoteMoney } from '../utils/quoteCalculations'
import type { QuoteInput, QuoteProduct } from '../types/quotes.types'

export function LineItemsEditor({ products, disabled }: { products: QuoteProduct[]; disabled: boolean }) {
  const { control, register, setValue, formState: { errors } } = useFormContext<QuoteInput>()
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = useWatch({ control, name: 'lines' })
  return <section className="dashboard-card quote-lines" aria-label="Lignes du devis">
    <div className="quote-section-title"><Package className="size-4" /><h2>Produits & services</h2><span>{fields.length} ligne(s)</span></div>
    <fieldset disabled={disabled}>
      <div className="quote-lines-scroll" tabIndex={0} role="region" aria-label="Tableau des lignes">
        <table><thead><tr><th>Produit / Service</th><th>Description</th><th>Quantité</th><th>Prix unitaire</th><th>Remise %</th><th>TVA %</th><th>Total HT</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{fields.map((field, index) => {
            const error = errors.lines?.[index]
            const line = lines[index]
            return <tr key={field.id}>
              <td><select aria-label={`Produit ligne ${index + 1}`} value={line?.productId ?? ''} onChange={(event) => {
                const product = products.find((item) => item.id === Number(event.target.value))
                setValue(`lines.${index}.productId`, product?.id ?? null, { shouldDirty: true, shouldValidate: true })
                if (product) {
                  setValue(`lines.${index}.description`, product.description, { shouldDirty: true, shouldValidate: true })
                  setValue(`lines.${index}.unitPrice`, product.unitPrice, { shouldDirty: true, shouldValidate: true })
                  setValue(`lines.${index}.taxRate`, product.taxRate, { shouldDirty: true, shouldValidate: true })
                }
              }}><option value="">Ligne libre</option>{products.map((product) => <option key={product.id} value={product.id}>{product.reference} — {product.name}</option>)}
                {line?.productId && !products.some((product) => product.id === line.productId) && <option value={line.productId}>Produit #{line.productId}</option>}
              </select><p className="quote-field-help">{products.find((product) => product.id === line?.productId)?.kind === 'service' ? 'Service' : line?.productId ? 'Produit' : 'Description personnalisée'}</p></td>
              <td><textarea rows={2} aria-label={`Description ligne ${index + 1}`} {...register(`lines.${index}.description`)} aria-invalid={!!error?.description} aria-describedby={`line-${index}-description-error`} /><p id={`line-${index}-description-error`} className="quote-field-error">{error?.description?.message}</p></td>
              {(['quantity', 'unitPrice', 'discountRate', 'taxRate'] as const).map((name) => <td key={name}>
                <input type="number" step={name === 'quantity' ? '0.001' : '0.01'} aria-label={`${({ quantity: 'Quantité', unitPrice: 'Prix unitaire', discountRate: 'Remise', taxRate: 'TVA' })[name]} ligne ${index + 1}`}
                  {...register(`lines.${index}.${name}`, { valueAsNumber: true })} aria-invalid={!!error?.[name]} aria-describedby={`line-${index}-${name}-error`} />
                <p id={`line-${index}-${name}-error`} className="quote-field-error">{error?.[name]?.message}</p>
              </td>)}
              <td className="quote-line-total">{line ? formatQuoteMoney(calculateLineTotals(line).net) : '—'}</td>
              <td><button type="button" className="quote-delete-line" aria-label={`Supprimer la ligne ${index + 1}`} onClick={() => remove(index)}><Trash2 className="size-3.5" /></button></td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <div className="quote-lines-footer"><Button variant="ghost" className="quotes-button text-primary-text" disabled={disabled || fields.length >= 100} onClick={() => append(newQuoteLine())}><Plus className="size-3.5" />Ajouter une ligne</Button>
        <span>Prix en MAD · TVA définie par produit ou saisie manuellement</span></div>
    </fieldset>
    <p role={errors.lines?.root || errors.lines?.message ? 'alert' : undefined} className="quote-field-error px-4 pb-2">{errors.lines?.root?.message ?? errors.lines?.message}</p>
  </section>
}
