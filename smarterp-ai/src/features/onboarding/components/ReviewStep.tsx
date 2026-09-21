import { useFormContext } from 'react-hook-form'
import {
  Building2,
  BriefcaseBusiness,
  Landmark,
  Warehouse,
  FileText,
  LayoutGrid,
  Pencil,
  CircleCheck,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { moduleNames, type OnboardingData } from '../types/onboarding.types'

export function ReviewStep({ onEdit }: { onEdit: (step: number) => void }) {
  const { getValues } = useFormContext<OnboardingData>()
  const data = getValues()
  const country =
    new Intl.DisplayNames(['fr'], { type: 'region' }).of(
      data.company.country,
    ) || data.company.country
  const date = (value: string) =>
    new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T12:00:00`))
  const sections = [
    {
      title: 'Société',
      icon: Building2,
      rows: [
        ['Nom', data.company.name],
        ['Raison sociale', data.company.legalName],
        ['ICE / Identifiant fiscal', data.company.taxId],
        ['Email', data.company.email],
        ['Téléphone', data.company.phone],
        ['Site web', data.company.website],
        [
          'Adresse',
          `${data.company.address}, ${data.company.postalCode} ${data.company.city}, ${country}`,
        ],
      ],
    },
    {
      title: 'Activité',
      icon: BriefcaseBusiness,
      rows: [
        ['Secteur', data.business.industry],
        [
          'Type',
          (
            {
              products: 'Produits',
              services: 'Services',
              both: 'Produits & Services',
            } as Record<string, string>
          )[data.business.businessType],
        ],
        ['Activité principale', data.business.mainActivity],
        [
          'Taille',
          (
            {
              solo: 'Indépendant',
              micro: 'Très petite entreprise',
              small: 'Petite entreprise',
              medium: 'Moyenne entreprise',
              large: 'Grande entreprise',
            } as Record<string, string>
          )[data.business.size],
        ],
        ['Employés', data.business.employeeCount?.toString()],
        ['Description', data.business.description],
      ],
    },
    {
      title: 'Finance',
      icon: Landmark,
      rows: [
        ['Devise', data.finance.currency],
        [
          'Système fiscal',
          (
            {
              standard: 'Régime standard',
              simplified: 'Régime simplifié',
              exempt: 'Exonéré de TVA',
            } as Record<string, string>
          )[data.finance.taxSystem],
        ],
        ['TVA par défaut', `${data.finance.vatRate} %`],
        [
          'Exercice fiscal',
          `${date(data.finance.fiscalYearStart)} — ${date(data.finance.fiscalYearEnd)}`,
        ],
        [
          'Paiement',
          data.finance.paymentTerms === '0'
            ? 'À réception'
            : `${data.finance.paymentTerms} jours`,
        ],
      ],
    },
    {
      title: 'Stock',
      icon: Warehouse,
      rows: data.inventory.enabled
        ? [
            ['Gestion du stock', 'Activée'],
            ['Dépôt principal', data.inventory.warehouseName],
            ['Code dépôt', data.inventory.warehouseCode],
            ['Adresse', data.inventory.warehouseAddress],
            ['Multi-dépôts', data.inventory.multiWarehouse ? 'Oui' : 'Non'],
            [
              'Valorisation',
              (
                {
                  weighted_average: 'CUMP',
                  fifo: 'FIFO',
                  standard: 'Coût standard',
                } as Record<string, string>
              )[data.inventory.valuationMethod],
            ],
            [
              'Alertes stock faible',
              data.inventory.lowStockAlerts ? 'Activées' : 'Désactivées',
            ],
            [
              'Unité',
              (
                {
                  unit: 'Unité / pièce',
                  kg: 'Kilogramme',
                  litre: 'Litre',
                  metre: 'Mètre',
                  box: 'Carton',
                } as Record<string, string>
              )[data.inventory.defaultUnit],
            ],
          ]
        : [
            ['Gestion du stock', 'Désactivée'],
            ['Dépôt principal', 'Aucun dépôt à créer'],
          ],
    },
    {
      title: 'Facturation',
      icon: FileText,
      rows: [
        [
          'Factures',
          `${data.invoicing.invoicePrefix}${new Date().getFullYear()}-${String(data.invoicing.invoiceStart).padStart(4, '0')}`,
        ],
        [
          'Devis',
          `${data.invoicing.quotePrefix}${new Date().getFullYear()}-${String(data.invoicing.quoteStart).padStart(4, '0')}`,
        ],
        ['Préfixe commande fournisseur', data.invoicing.purchaseOrderPrefix],
        ['Conditions de paiement', data.invoicing.paymentTerms],
        ['Pied de page', data.invoicing.footer],
        [
          'Langue',
          (
            { fr: 'Français', en: 'Anglais', ar: 'Arabe' } as Record<
              string,
              string
            >
          )[data.invoicing.language],
        ],
        ['Affichage TVA', data.invoicing.showVat ? 'Oui' : 'Non'],
      ],
    },
    {
      title: 'Modules',
      icon: LayoutGrid,
      rows: [
        ['Modules actifs', String(data.modules.length)],
        [
          'Votre sélection',
          data.modules.map((id) => moduleNames[id]).join(' · '),
        ],
      ],
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-start gap-3 rounded-md border border-emerald-100 bg-emerald-50/70 p-4">
        <CircleCheck
          className="mt-0.5 size-5 shrink-0 text-emerald-600"
          aria-hidden="true"
        />
        <div>
          <p className="text-xs font-semibold text-emerald-800">
            Tout est prêt pour la dernière étape
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-700">
            Vérifiez ces informations, puis cliquez sur « Terminer la
            configuration » pour les enregistrer.
          </p>
        </div>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2">
        {sections.map(({ title, icon: Icon, rows }, index) => (
          <section
            key={title}
            aria-label={`Résumé ${title}`}
            className="min-w-0 rounded-lg border border-[#e4e9f2]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#edf0f5] bg-[#fafbfe] px-4 py-2.5">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-navy-950">
                <Icon className="size-4 text-slate-500" aria-hidden="true" />
                {title}
              </h3>
              <Button
                variant="ghost"
                className="min-h-7 gap-1 px-2 text-[10px] text-blue-600"
                onClick={() => onEdit(index + 1)}
                aria-label={`Modifier ${title}`}
              >
                <Pencil className="size-3" aria-hidden="true" />
                Modifier
              </Button>
            </div>
            {index === 0 && data.company.logo && (
              <img
                src={data.company.logo}
                alt="Logo de la société"
                className="m-4 mb-0 size-12 rounded border border-slate-100 object-contain"
              />
            )}
            <dl className="space-y-3 p-4">
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 text-[11px] leading-5"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="wrap-anywhere font-medium text-slate-700">
                    {value || 'Non renseigné'}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
