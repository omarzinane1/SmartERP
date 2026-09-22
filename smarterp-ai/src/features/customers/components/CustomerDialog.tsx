import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type {
  Customer,
  CustomerAction,
  CustomerInput,
} from '../types/customers.types'

const titles: Record<CustomerAction, string> = {
  create: 'Nouveau client',
  edit: 'Modifier le client',
  import: 'Importer des clients',
  assign: 'Assigner un commercial',
  tag: 'Ajouter un tag',
  statement: 'Préparer un relevé',
  reminder: 'Préparer une relance',
  quote: 'Créer un devis',
}

export function CustomerDialog({
  action,
  customer,
  selectedCount,
  salespeople,
  isDemo,
  onClose,
  onSave,
  onAssign,
  onTag,
}: {
  action: CustomerAction
  customer?: Customer
  selectedCount: number
  salespeople: string[]
  isDemo: boolean
  onClose: () => void
  onSave: (input: CustomerInput) => void
  onAssign: (salesperson: string) => void
  onTag: (tag: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<CustomerInput>({
    name: customer?.name ?? '',
    type: customer?.type ?? 'company',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    city: customer?.city ?? '',
    salesperson: customer?.salesperson ?? salespeople[0] ?? '',
  })
  const [person, setPerson] = useState(salespeople[0] ?? '')
  const [tag, setTag] = useState('')
  const [format, setFormat] = useState('csv')
  const [fileName, setFileName] = useState('')
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      dialog?.close()
      previous?.focus()
    }
  }, [])
  const editing = action === 'create' || action === 'edit'
  return (
    <dialog
      ref={ref}
      aria-labelledby="customer-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="customers-dialog m-auto w-[calc(100%-32px)] max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-xl backdrop:bg-slate-950/30"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-600">
            Sales / CRM
          </p>
          <h2
            id="customer-dialog-title"
            className="mt-1 text-lg font-semibold text-navy-950"
          >
            {titles[action]}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Fermer la fenêtre"
          className="rounded p-1 text-slate-400"
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
      </header>
      {editing ? (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (isDemo && form.name.trim() && form.city.trim())
              onSave({
                ...form,
                name: form.name.trim(),
                city: form.city.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
              })
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="customers-filter-label sm:col-span-2">
              Nom ou raison sociale <span className="text-rose-500">*</span>
              <Input
                required
                maxLength={120}
                minLength={2}
                pattern=".*\S.*"
                aria-label="Nom ou raison sociale"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className="mt-1 h-9 rounded text-xs"
              />
            </label>
            <label className="customers-filter-label">
              Type
              <select
                aria-label="Type de client"
                className="customers-select mt-1 w-full"
                value={form.type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    type: event.target.value as CustomerInput['type'],
                  })
                }
              >
                <option value="company">Entreprise</option>
                <option value="individual">Particulier</option>
              </select>
            </label>
            <label className="customers-filter-label">
              Ville <span className="text-rose-500">*</span>
              <Input
                required
                maxLength={60}
                pattern=".*\S.*"
                aria-label="Ville du client"
                value={form.city}
                onChange={(event) =>
                  setForm({ ...form, city: event.target.value })
                }
                className="mt-1 h-9 rounded text-xs"
              />
            </label>
            <label className="customers-filter-label">
              E-mail <span className="text-rose-500">*</span>
              <Input
                required
                type="email"
                maxLength={150}
                aria-label="E-mail du client"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                className="mt-1 h-9 rounded text-xs"
              />
            </label>
            <label className="customers-filter-label">
              Téléphone
              <Input
                type="tel"
                maxLength={30}
                aria-label="Téléphone du client"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                className="mt-1 h-9 rounded text-xs"
              />
            </label>
            <label className="customers-filter-label sm:col-span-2">
              Commercial
              <select
                aria-label="Commercial du client"
                required
                className="customers-select mt-1 w-full"
                value={form.salesperson}
                onChange={(event) =>
                  setForm({ ...form, salesperson: event.target.value })
                }
              >
                {salespeople.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-4 text-[10px] leading-5 text-slate-400">
            {isDemo
              ? 'Démonstration : les changements sont conservés pendant votre visite de cette page.'
              : 'L’enregistrement des fiches sera disponible dans une prochaine étape.'}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              className="customers-button"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="customers-button"
              disabled={!isDemo}
            >
              Enregistrer{isDemo ? ' (démo)' : ''}
            </Button>
          </div>
        </form>
      ) : action === 'import' ? (
        <div className="mt-5">
          <p className="text-xs leading-5 text-slate-500">
            Préparez votre liste de clients au format CSV ou Excel. L’import
            sera disponible dans une prochaine étape.
          </p>
          <div className="mt-4 flex gap-2">
            {['csv', 'excel'].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={format === value}
                onClick={() => {
                  setFormat(value)
                  setFileName('')
                }}
                className={`flex items-center gap-2 rounded border px-4 py-2 text-xs ${
                  format === value
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200'
                }`}
              >
                <FileSpreadsheet className="size-4" />
                {value === 'csv' ? 'CSV' : 'Excel'}
              </button>
            ))}
          </div>
          <label className="mt-4 block rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <Upload className="mx-auto mb-2 size-6 text-slate-400" />
            <span className="block text-xs">
              Sélectionner un fichier {format === 'csv' ? 'CSV' : 'Excel'}
            </span>
            <input
              key={format}
              aria-label="Fichier clients"
              type="file"
              accept={format === 'csv' ? '.csv' : '.xlsx,.xls'}
              className="mt-3 max-w-full text-[10px]"
              onChange={(event) =>
                setFileName(event.target.files?.[0]?.name ?? '')
              }
            />
          </label>
          {fileName && (
            <p role="status" className="mt-3 break-all text-xs">
              Fichier sélectionné : {fileName}
            </p>
          )}
          <p className="mt-3 text-[10px] text-slate-400">
            Aucun fichier n’est envoyé ni importé à cette étape.
          </p>
          <div className="mt-5 flex justify-end">
            <Button
              variant="secondary"
              className="customers-button"
              onClick={onClose}
            >
              Fermer
            </Button>
          </div>
        </div>
      ) : action === 'assign' || action === 'tag' ? (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!isDemo) return
            if (action === 'assign' && person) onAssign(person)
            if (action === 'tag' && tag.trim()) onTag(tag.trim())
          }}
        >
          <p className="mb-4 text-xs">
            {selectedCount} client{selectedCount > 1 ? 's' : ''} dans la
            sélection.
          </p>
          {action === 'assign' ? (
            <label className="customers-filter-label">
              Commercial
              <select
                required
                aria-label="Commercial à assigner"
                className="customers-select mt-1 w-full"
                value={person}
                onChange={(event) => setPerson(event.target.value)}
              >
                {salespeople.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="customers-filter-label">
              Tag
              <Input
                required
                maxLength={40}
                aria-label="Nouveau tag"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                className="mt-1 h-9 rounded text-xs"
              />
            </label>
          )}
          <p className="mt-3 text-[10px] leading-5 text-slate-400">
            {isDemo
              ? 'Modification locale de démonstration uniquement.'
              : 'Cette action sera disponible dans une prochaine étape.'}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              className="customers-button"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isDemo}
              className="customers-button"
            >
              Appliquer (démo)
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-5">
          <p className="text-sm font-medium">{customer?.name}</p>
          <p className="mt-3 text-xs leading-6 text-slate-500">
            Cette action sera disponible avec le module{' '}
            {action === 'quote' ? 'Devis' : 'Facturation'}. Aucun document ni
            message n’a été envoyé.
          </p>
          <Button
            variant="secondary"
            className="customers-button mt-5"
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>
      )}
    </dialog>
  )
}
