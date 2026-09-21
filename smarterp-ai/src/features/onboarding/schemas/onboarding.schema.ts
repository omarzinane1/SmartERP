import { z } from 'zod'
import type { FieldPath } from 'react-hook-form'
import { moduleNames, type OnboardingData } from '../types/onboarding.types'

const required = (message: string) => z.string().trim().min(1, message)
const prefix = required('Le préfixe est obligatoire.')
  .max(20, 'Utilisez au maximum 20 caractères.')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Utilisez des lettres, chiffres, tirets ou underscores.',
  )
const sequence = z
  .number({ error: 'Saisissez un numéro valide.' })
  .int('Saisissez un nombre entier.')
  .min(1, 'Le numéro doit être supérieur à zéro.')
  .max(999999999, 'Le numéro est trop grand.')

export const onboardingSchema = z.object({
  company: z.object({
    name: required('Le nom de la société est obligatoire.'),
    legalName: required('La raison sociale est obligatoire.'),
    logo: z.string(),
    taxId: z.string().trim(),
    email: required('L’adresse e-mail est obligatoire.').email(
      'Veuillez saisir une adresse e-mail valide.',
    ),
    phone: z.string().trim(),
    website: z
      .string()
      .trim()
      .refine((value) => {
        if (!value) return true
        try {
          return ['https:', 'http:'].includes(new URL(value).protocol)
        } catch {
          return false
        }
      }, 'Saisissez une URL complète, par exemple https://votre-societe.ma.'),
    address: required('L’adresse est obligatoire.'),
    city: required('La ville est obligatoire.'),
    postalCode: z.string().trim(),
    country: required('Le pays est obligatoire.'),
  }),
  business: z.object({
    industry: required('Choisissez un secteur d’activité.'),
    businessType: required('Choisissez un type d’entreprise.'),
    mainActivity: required('L’activité principale est obligatoire.'),
    size: required('Choisissez la taille de l’entreprise.'),
    employeeCount: z
      .number({ error: 'Saisissez un nombre valide.' })
      .int('Saisissez un nombre entier.')
      .min(0, 'Le nombre ne peut pas être négatif.')
      .optional(),
    description: z.string().trim(),
  }),
  finance: z
    .object({
      currency: required('La devise est obligatoire.'),
      taxSystem: required('Choisissez un système fiscal.'),
      vatRate: z
        .number({ error: 'Saisissez un taux valide.' })
        .min(0, 'Le taux doit être entre 0 et 100 %.')
        .max(100, 'Le taux doit être entre 0 et 100 %.'),
      fiscalYearStart: z.iso.date('Choisissez une date valide.'),
      fiscalYearEnd: z.iso.date('Choisissez une date valide.'),
      paymentTerms: required('Choisissez les conditions de paiement.'),
    })
    .refine((data) => data.fiscalYearEnd >= data.fiscalYearStart, {
      message: 'La fin de l’exercice doit suivre sa date de début.',
      path: ['fiscalYearEnd'],
    }),
  inventory: z
    .object({
      enabled: z.boolean(),
      warehouseName: z.string().trim(),
      warehouseCode: z.string().trim(),
      warehouseAddress: z.string().trim(),
      multiWarehouse: z.boolean(),
      valuationMethod: z.string(),
      lowStockAlerts: z.boolean(),
      defaultUnit: z.string(),
    })
    .superRefine((data, context) => {
      // Les paramètres masqués ne bloquent pas une activité sans stock.
      if (!data.enabled) return
      if (!data.warehouseName)
        context.addIssue({
          code: 'custom',
          path: ['warehouseName'],
          message:
            'Le nom du dépôt est obligatoire lorsque le stock est activé.',
        })
      if (!data.warehouseCode)
        context.addIssue({
          code: 'custom',
          path: ['warehouseCode'],
          message: 'Le code du dépôt est obligatoire.',
        })
    }),
  invoicing: z.object({
    invoicePrefix: prefix,
    invoiceStart: sequence,
    quotePrefix: prefix,
    quoteStart: sequence,
    purchaseOrderPrefix: prefix,
    paymentTerms: required('Renseignez les conditions de paiement.'),
    footer: z.string().trim(),
    language: required('Choisissez une langue.'),
    showVat: z.boolean(),
  }),
  modules: z
    .array(
      z.enum(
        Object.keys(moduleNames) as [
          keyof typeof moduleNames,
          ...Array<keyof typeof moduleNames>,
        ],
      ),
    )
    .min(1, 'Activez au moins un module pour commencer.'),
}) satisfies z.ZodType<OnboardingData>

// On valide uniquement la section visible avant de passer à la suivante.
export const stepFields: FieldPath<OnboardingData>[] = [
  'company',
  'business',
  'finance',
  'inventory',
  'invoicing',
  'modules',
]

export const defaultOnboardingValues: OnboardingData = {
  company: {
    name: '',
    legalName: '',
    logo: '',
    taxId: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'MA',
  },
  business: {
    industry: '',
    businessType: 'products',
    mainActivity: '',
    size: '',
    employeeCount: undefined,
    description: '',
  },
  finance: {
    currency: 'MAD',
    taxSystem: 'standard',
    vatRate: 20,
    fiscalYearStart: `${new Date().getFullYear()}-01-01`,
    fiscalYearEnd: `${new Date().getFullYear()}-12-31`,
    paymentTerms: '30',
  },
  inventory: {
    enabled: true,
    warehouseName: '',
    warehouseCode: '',
    warehouseAddress: '',
    multiWarehouse: false,
    valuationMethod: 'weighted_average',
    lowStockAlerts: true,
    defaultUnit: 'unit',
  },
  invoicing: {
    invoicePrefix: 'INV-',
    invoiceStart: 1,
    quotePrefix: 'QT-',
    quoteStart: 1,
    purchaseOrderPrefix: 'PO-',
    paymentTerms: 'Paiement à 30 jours à compter de la date de facture.',
    footer: 'Merci pour votre confiance.',
    language: 'fr',
    showVat: true,
  },
  modules: [
    'sales',
    'customers',
    'suppliers',
    'purchases',
    'products',
    'inventory',
    'warehouses',
    'invoices',
    'payments',
    'reports',
    'documents',
    'ai_assistant',
  ],
}
