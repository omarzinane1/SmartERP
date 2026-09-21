export const onboardingSteps = [
  {
    title: 'Société',
    description: 'Identité, coordonnées et adresse',
    heading: 'Informations de la société',
    subtitle:
      'Renseignez l’identité de votre entreprise, ses informations légales et son adresse principale.',
  },
  {
    title: 'Activité',
    description: 'Secteur, taille et opérations',
    heading: 'Votre activité',
    subtitle:
      'Décrivez votre entreprise pour adapter votre espace de travail à vos besoins.',
  },
  {
    title: 'Finance',
    description: 'Devise, TVA et exercice fiscal',
    heading: 'Finance et fiscalité',
    subtitle:
      'Définissez les paramètres financiers utilisés par défaut dans votre organisation.',
  },
  {
    title: 'Stock',
    description: 'Dépôts et gestion des stocks',
    heading: 'Gestion du stock',
    subtitle:
      'Configurez votre dépôt principal ou désactivez le stock si vous proposez uniquement des services.',
  },
  {
    title: 'Facturation',
    description: 'Numérotation, langue et conditions',
    heading: 'Ventes et facturation',
    subtitle:
      'Personnalisez la numérotation et les informations de vos documents commerciaux.',
  },
  {
    title: 'Modules',
    description: 'Outils métier et intelligence artificielle',
    heading: 'Choisissez vos modules',
    subtitle:
      'Activez les outils dont votre équipe a besoin. Vous pourrez faire évoluer cette sélection plus tard.',
  },
  {
    title: 'Vérification',
    description: 'Récapitulatif et activation',
    heading: 'Vérifiez votre configuration',
    subtitle: 'Un dernier regard avant de créer votre espace SmartERP AI.',
  },
] as const

export const moduleNames = {
  sales: 'Ventes',
  customers: 'Clients',
  suppliers: 'Fournisseurs',
  purchases: 'Achats',
  products: 'Produits',
  inventory: 'Stock',
  warehouses: 'Dépôts',
  invoices: 'Factures',
  payments: 'Paiements',
  expenses: 'Dépenses',
  treasury: 'Trésorerie',
  reports: 'Rapports',
  documents: 'Documents',
  ai_assistant: 'AI Assistant',
  ai_control_center: 'AI Control Center',
  forecasting: 'Forecasting',
} as const

export type ModuleId = keyof typeof moduleNames

export interface OnboardingData {
  company: {
    name: string
    legalName: string
    logo: string
    taxId: string
    email: string
    phone: string
    website: string
    address: string
    city: string
    postalCode: string
    country: string
  }
  business: {
    industry: string
    businessType: string
    mainActivity: string
    size: string
    employeeCount?: number
    description: string
  }
  finance: {
    currency: string
    taxSystem: string
    vatRate: number
    fiscalYearStart: string
    fiscalYearEnd: string
    paymentTerms: string
  }
  inventory: {
    enabled: boolean
    warehouseName: string
    warehouseCode: string
    warehouseAddress: string
    multiWarehouse: boolean
    valuationMethod: string
    lowStockAlerts: boolean
    defaultUnit: string
  }
  invoicing: {
    invoicePrefix: string
    invoiceStart: number
    quotePrefix: string
    quoteStart: number
    purchaseOrderPrefix: string
    paymentTerms: string
    footer: string
    language: string
    showVat: boolean
  }
  modules: ModuleId[]
}
