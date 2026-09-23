import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Clock3, FileText, LockKeyhole, StickyNote } from 'lucide-react'
import type { QuoteActivity, QuoteInput } from '../types/quotes.types'

const tabs = [{ id: 'conditions', label: 'Conditions', icon: FileText }, { id: 'notes', label: 'Notes', icon: StickyNote }, { id: 'activities', label: 'Activités', icon: Clock3 }] as const
export function QuoteTabs({ activities, disabled, isDemo }: { activities: QuoteActivity[]; disabled: boolean; isDemo: boolean }) {
  const [active, setActive] = useState<typeof tabs[number]['id']>('conditions')
  const { register, control, formState: { errors } } = useFormContext<QuoteInput>()
  const expiration = useWatch({ control, name: 'expiresAt' })
  const paymentTerms = useWatch({ control, name: 'paymentTerms' })
  return <section className="dashboard-card quote-tabs">
    <div role="tablist" aria-label="Informations complémentaires">{tabs.map(({ id, label, icon: Icon }, index) => <button key={id} type="button" role="tab"
      id={`quote-tab-${id}`} aria-controls={`quote-panel-${id}`} aria-selected={active === id} tabIndex={active === id ? 0 : -1} onClick={() => setActive(id)}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3
        setActive(tabs[next].id)
        document.getElementById(`quote-tab-${tabs[next].id}`)?.focus()
      }}><Icon className="size-3.5" />{label}{id === 'activities' && <span>{activities.length}</span>}</button>)}</div>
    <div role="tabpanel" id={`quote-panel-${active}`} aria-labelledby={`quote-tab-${active}`} className="quote-tab-panel">
      {active === 'conditions' && <fieldset disabled={disabled}>
        <div className="quote-fields-grid">
          <div><span className="quote-field-label">Conditions de paiement</span><p className="quote-terms-value">{paymentTerms || 'À définir dans les informations générales'}</p></div>
          <div><label htmlFor="quote-delivery">Délai de livraison</label><input id="quote-delivery" {...register('deliveryTerms')} maxLength={5000} /><p className="quote-field-error">{errors.deliveryTerms?.message}</p></div>
          <div className="col-span-2"><label htmlFor="quote-commercial-terms">Conditions commerciales</label><textarea id="quote-commercial-terms" rows={3} {...register('commercialTerms')} maxLength={5000} /><p className="quote-field-error">{errors.commercialTerms?.message}</p></div>
        </div><p className="quote-field-help mt-3">Validité du devis : jusqu’au {expiration || '—'}. Modifiable dans les informations générales.</p>
      </fieldset>}
      {active === 'notes' && <fieldset disabled={disabled}>
        <label htmlFor="quote-internal-notes" className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" />Notes internes</label>
        <textarea id="quote-internal-notes" rows={3} {...register('internalNotes')} maxLength={5000} placeholder="Informations réservées à votre équipe…" />
        <p className="quote-field-help">Ces notes sont exclues du document destiné au client.</p><p className="quote-field-error">{errors.internalNotes?.message}</p>
        <label htmlFor="quote-customer-notes" className="mt-4">Notes visibles sur le devis</label>
        <textarea id="quote-customer-notes" rows={3} {...register('customerNotes')} maxLength={5000} placeholder="Message ou précision pour le client…" /><p className="quote-field-error">{errors.customerNotes?.message}</p>
      </fieldset>}
      {active === 'activities' && <>
        <p className="quote-field-help mb-4">{isDemo ? 'Historique de démonstration et actions locales. Aucune consultation réelle n’est simulée.' : 'Événements enregistrés par le serveur.'}</p>
        {activities.length ? <ol className="quote-timeline">{activities.map((activity) => <li key={activity.id}>
          <span className="quote-timeline-dot" /><p>{activity.description}</p><small>{activity.user} · {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.date))}</small>
        </li>)}</ol> : <p className="quote-field-help">L’historique sera disponible après le premier enregistrement.</p>}
      </>}
    </div>
  </section>
}
