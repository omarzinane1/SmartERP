import type { Customer, CustomersData, CustomerDetail, CustomerSummary, CustomerSale, CustomerInvoice, CustomerPayment, CustomerActivity, CustomerAIInsight } from '../types/customers.types'

const salespeople = [
  'Sara El Mansouri',
  'Youssef Karim',
  'Karim Benouda',
  'Amine Taha',
]
const seedCustomers: Customer[] = [
  {
    id: 124,
    reference: 'CUS-000124',
    name: 'Nova Retail SARL',
    type: 'company',
    phone: '+212 522 45 88 12',
    email: 'contact@novaretail.ma',
    city: 'Casablanca',
    district: 'Aïn Sebaâ',
    salesperson: 'Sara El Mansouri',
    revenue: 486200,
    outstanding: 43800,
    overdue: 21400,
    lastActivity: '2026-09-30',
    activity: 'SO-2026-1048 · commande',
    createdAt: '2024-03-01',
    status: 'active',
    tags: ['Distribution', 'VIP'],
    signal: { label: 'Risque paiement', tone: 'critical' },
  },
  {
    id: 85,
    reference: 'CUS-000085',
    name: 'Marrakech Market',
    type: 'company',
    phone: '+212 524 35 21 80',
    email: 'achats@marrakechmarket.example',
    city: 'Marrakech',
    district: 'Guéliz',
    salesperson: 'Youssef Karim',
    revenue: 392500,
    outstanding: 0,
    overdue: 0,
    lastActivity: '2026-09-29',
    activity: 'Paiement reçu',
    createdAt: '2025-03-17',
    status: 'vip',
    tags: ['Grand compte'],
    signal: { label: 'Upsell +27 %', tone: 'indigo' },
  },
  {
    id: 117,
    reference: 'CUS-000117',
    name: 'Atlas Services',
    type: 'company',
    phone: '+212 537 77 10 90',
    email: 'direction@atlasservices.example',
    city: 'Rabat',
    district: 'Agdal',
    salesperson: 'Sara El Mansouri',
    revenue: 294800,
    outstanding: 18600,
    overdue: 11800,
    lastActivity: '2026-09-28',
    activity: 'Devis envoyé',
    createdAt: '2025-09-10',
    status: 'active',
    tags: ['Services'],
  },
  {
    id: 94,
    reference: 'CUS-000094',
    name: 'Riad Pro',
    type: 'company',
    phone: '+212 524 43 15 90',
    email: 'compta@riadpro.example',
    city: 'Marrakech',
    district: 'Médina',
    salesperson: 'Youssef Karim',
    revenue: 182900,
    outstanding: 31200,
    overdue: 31200,
    lastActivity: '2026-09-27',
    activity: 'Relance niveau 2',
    createdAt: '2025-04-08',
    status: 'at_risk',
    tags: ['Hôtellerie'],
  },
  {
    id: 131,
    reference: 'CUS-000131',
    name: 'Sofia El Amrani',
    type: 'individual',
    phone: '+212 661 28 90 44',
    email: 's.elamrani@example.com',
    city: 'Casablanca',
    district: 'Anfa',
    salesperson: 'Karim Benouda',
    revenue: 68400,
    outstanding: 0,
    overdue: 0,
    lastActivity: '2026-09-26',
    activity: 'Premier contact',
    createdAt: '2026-09-04',
    status: 'prospect',
    tags: ['Particulier'],
  },
  {
    id: 72,
    reference: 'CUS-000072',
    name: 'Casa Distribution Group',
    type: 'company',
    phone: '+212 522 67 90 78',
    email: 'commandes@casadistribution.example',
    city: 'Casablanca',
    district: 'Sidi Bernoussi',
    salesperson: 'Sara El Mansouri',
    revenue: 520180,
    outstanding: 12400,
    overdue: 0,
    lastActivity: '2026-09-25',
    activity: 'Livraison validée',
    createdAt: '2025-02-11',
    status: 'active',
    tags: ['Distribution', 'B2B'],
  },
  {
    id: 156,
    reference: 'CUS-000156',
    name: 'Tangier Logistique SARL',
    type: 'company',
    phone: '+212 539 46 10 33',
    email: 'ops@tangierlog.example',
    city: 'Tanger',
    district: 'Tanger Free Zone',
    salesperson: 'Amine Taha',
    revenue: 145000,
    outstanding: 0,
    overdue: 0,
    lastActivity: '2026-09-24',
    activity: 'Clôture audit',
    createdAt: '2026-01-05',
    status: 'active',
    tags: ['Logistique'],
  },
  {
    id: 63,
    reference: 'CUS-000063',
    name: 'Somaca Distribution',
    type: 'company',
    phone: '+212 522 70 11 08',
    email: 'achats@somaca-distribution.example',
    city: 'Casablanca',
    district: 'Roches Noires',
    salesperson: 'Sara El Mansouri',
    revenue: 310800,
    outstanding: 8980,
    overdue: 8980,
    lastActivity: '2026-09-23',
    activity: 'Facture échue',
    createdAt: '2025-11-22',
    status: 'active',
    tags: ['Industrie'],
  },
  {
    id: 209,
    reference: 'CUS-000209',
    name: 'Agadir Fresh Market',
    type: 'company',
    phone: '+212 528 82 64 10',
    email: 'contact@agadirfresh.example',
    city: 'Agadir',
    district: 'Talborjt',
    salesperson: 'Amine Taha',
    revenue: 189400,
    outstanding: 12100,
    overdue: 120,
    lastActivity: '2026-09-22',
    activity: 'Règlement partiel',
    createdAt: '2026-09-10',
    status: 'active',
    tags: ['Alimentaire'],
    signal: { label: 'Forte croissance', tone: 'positive' },
  },
  {
    id: 184,
    reference: 'CUS-000184',
    name: 'Fès Équipement',
    type: 'company',
    phone: '+212 535 62 14 90',
    email: 'commercial@fesequipement.example',
    city: 'Fès',
    district: 'Ville nouvelle',
    salesperson: 'Karim Benouda',
    revenue: 224500,
    outstanding: 15600,
    overdue: 0,
    lastActivity: '2026-09-21',
    activity: 'Commande confirmée',
    createdAt: '2026-09-02',
    status: 'vip',
    tags: ['Équipement'],
  },
]

const cities = [
  'Casablanca',
  'Marrakech',
  'Rabat',
  'Tanger',
  'Agadir',
  'Fès',
  'Meknès',
  'Kénitra',
]
const names = [
  'Al Manar',
  'Nour',
  'Maghreb',
  'Al Amal',
  'Oasis',
  'Sahara',
  'Al Waha',
  'Horizon',
  'Palmier',
  'Dalia',
  'Al Fath',
  'Marjane Pro',
  'Rif',
  'Al Massira',
  'Andalous',
  'Océan',
  'Safir',
  'Al Qods',
  'Targa',
  'Zénith',
  'Al Badr',
  'Nakhil',
  'Al Baraka',
  'Tamuda',
  'Atlas Pro',
  'Souss',
  'Al Yassamine',
  'Bahia',
  'Jasmin',
  'Al Izdihar',
]
const sectors = [
  'Distribution',
  'Équipement',
  'Services',
  'Commerce',
  'Industrie',
  'Logistique',
]
const usedIds = new Set(seedCustomers.map((customer) => customer.id))
const remainingIds = Array.from(
  { length: 248 },
  (_, index) => index + 1,
).filter((id) => !usedIds.has(id))
const remainingRevenue =
  8920400 - seedCustomers.reduce((sum, customer) => sum + customer.revenue, 0)
const remainingOutstanding =
  284300 -
  seedCustomers.reduce((sum, customer) => sum + customer.outstanding, 0)
const revenueWeights = remainingIds.map((_, index) => (index % 9) + 1)
const balanceWeights = remainingIds.map((_, index) =>
  index < remainingIds.length - 16 && index % 4 === 0 ? (index % 5) + 1 : 0,
)

// Une répartition déterministe conserve les totaux de la maquette sans faux compteurs.
function distribute(total: number, weights: number[]) {
  const sum = weights.reduce((value, weight) => value + weight, 0)
  let cumulative = 0
  return weights.map((weight) => {
    const before = Math.round((total * cumulative) / sum)
    cumulative += weight
    return Math.round((total * cumulative) / sum) - before
  })
}
const revenues = distribute(remainingRevenue, revenueWeights)
const balances = distribute(remainingOutstanding, balanceWeights)

const otherCustomers: Customer[] = remainingIds.map((id, index) => {
  const city = cities[Math.floor(index / names.length)]
  const name = `${names[index % names.length]} ${
    sectors[index % sectors.length]
  } ${city}`
  const status =
    index >= 234
      ? 'archived'
      : index >= 229
      ? 'inactive'
      : index >= 222
      ? 'prospect'
      : index % 17 === 0
      ? 'vip'
      : index % 19 === 0
      ? 'at_risk'
      : 'active'
  return {
    id,
    reference: `CUS-${String(id).padStart(6, '0')}`,
    name,
    type: 'company',
    phone: `+212 5${String(20000000 + id * 713).slice(0, 8)}`,
    email: `contact${id}@client.example`,
    city,
    district: 'Centre-ville',
    salesperson: salespeople[index % salespeople.length],
    revenue: revenues[index],
    outstanding: balances[index],
    overdue: 0,
    lastActivity: `2026-09-${String(30 - (index % 28)).padStart(2, '0')}`,
    activity: [
      'Commande confirmée',
      'Appel commercial',
      'Paiement reçu',
      'Devis envoyé',
    ][index % 4],
    createdAt:
      index < 29
        ? `2026-09-${String(1 + (index % 25)).padStart(2, '0')}`
        : `2025-${String(1 + (index % 12)).padStart(2, '0')}-15`,
    status,
    tags: [sectors[index % sectors.length]],
    ...(index % 23 === 0
      ? { signal: { label: 'Forte croissance', tone: 'positive' as const } }
      : {}),
  }
})

export const customersMock: CustomersData = {
  customers: [...seedCustomers, ...otherCustomers],
  permissions: [
    'customers.view',
    'customers.create',
    'customers.edit',
    'customers.export',
  ],
  salespeople,
  currentSalesperson: 'Sara El Mansouri',
  period: {
    asOf: '2026-09-30',
    syncedAt: '2026-09-30T09:56:00Z',
    label: 'Septembre 2026',
  },
  revenueGrowth: 14.2,
  dsoDays: 34,
  dsoTarget: 60,
}

// Fiche 360° : instantané au 30 septembre 2026, comme le portefeuille Clients.
// Les huit commandes sont les commandes récentes ; les 42 commandes du KPI couvrent l'année.
export const customerSalesMock: CustomerSale[] = [
  { reference: 'SO-2026-1048', kind: 'order', date: '2026-09-30', salesperson: salespeople[0], amount: 42500, margin: 31.2, status: 'Processing', paymentStatus: 'Not due' },
  { reference: 'SO-2026-1022', kind: 'order', date: '2026-09-24', salesperson: salespeople[0], amount: 18800, margin: 28.6, status: 'Delivered', paymentStatus: 'Paid' },
  { reference: 'SO-2026-0985', kind: 'order', date: '2026-09-19', salesperson: salespeople[0], amount: 31600, margin: 29.8, status: 'Invoiced', paymentStatus: 'Partial' },
  { reference: 'SO-2026-0972', kind: 'order', date: '2026-09-16', salesperson: salespeople[0], amount: 12400, margin: 27.4, status: 'Invoiced', paymentStatus: 'Paid' },
  { reference: 'SO-2026-0960', kind: 'order', date: '2026-09-12', salesperson: salespeople[0], amount: 21600, margin: 30.1, status: 'Invoiced', paymentStatus: 'Paid' },
  { reference: 'SO-2026-0954', kind: 'order', date: '2026-09-10', salesperson: salespeople[0], amount: 18600, margin: 28.3, status: 'Invoiced', paymentStatus: 'Partial' },
  { reference: 'SO-2026-0937', kind: 'order', date: '2026-09-05', salesperson: salespeople[0], amount: 28400, margin: 32.5, status: 'Confirmed', paymentStatus: 'Unpaid' },
  { reference: 'SO-2026-0921', kind: 'order', date: '2026-09-02', salesperson: salespeople[0], amount: 6400, margin: 25.6, status: 'Cancelled', paymentStatus: 'Not due' },
  { reference: 'QT-2026-0318', kind: 'quote', date: '2026-09-28', salesperson: salespeople[0], amount: 36000, margin: 32, status: 'Draft', paymentStatus: 'Not due' },
  { reference: 'QT-2026-0294', kind: 'quote', date: '2026-09-21', salesperson: salespeople[0], amount: 18400, margin: 29.1, status: 'Confirmed', paymentStatus: 'Not due' },
  { reference: 'QT-2026-0281', kind: 'quote', date: '2026-09-15', salesperson: salespeople[0], amount: 9600, margin: 27.8, status: 'Draft', paymentStatus: 'Not due' },
]

export const customerInvoicesMock: CustomerInvoice[] = [
  { reference: 'INV-2026-0412', date: '2026-08-21', dueDate: '2026-09-20', amount: 24600, paid: 3200, outstanding: 21400, status: 'Overdue' },
  { reference: 'INV-2026-0478', date: '2026-09-10', dueDate: '2026-10-10', amount: 18600, paid: 10000, outstanding: 8600, status: 'Partially Paid' },
  { reference: 'INV-2026-0492', date: '2026-09-19', dueDate: '2026-10-19', amount: 31600, paid: 17800, outstanding: 13800, status: 'Partially Paid' },
  ...[42400, 18800, 12400, 21600, 32000, 28500, 19800, 26400, 15800].map((amount, index): CustomerInvoice => ({
    reference: `INV-2026-${String(390 - index).padStart(4, '0')}`,
    date: `2026-08-${String(18 - index).padStart(2, '0')}`,
    dueDate: `2026-09-${String(17 - index).padStart(2, '0')}`,
    amount, paid: amount, outstanding: 0, status: 'Paid',
  })),
]

// Quinze règlements reçus, dont trois factures réglées en deux versements.
// Chaque somme par facture correspond exactement à son montant payé.
export const customerPaymentsMock: CustomerPayment[] = customerInvoicesMock.flatMap((invoice, index) => {
  const amounts = index >= 3 && index <= 5 ? [invoice.paid / 2, invoice.paid / 2] : [invoice.paid]
  return amounts.map((amount, part) => ({
    reference: `PAY-2026-${String(180 + index * 2 + part).padStart(4, '0')}`,
    date: index < 3 ? '2026-09-29' : `2026-09-${String(15 - index + part).padStart(2, '0')}`,
    invoice: invoice.reference,
    method: (['Bank Transfer', 'Cheque', 'Card', 'Cash'] as const)[index % 4],
    amount, status: 'Received' as const, receivedBy: 'Nadia Bennani',
  }))
})

export const customerSummaryMock: CustomerSummary = {
  asOf: '2026-09-30', customerScore: 86, paymentReliability: 74,
  revenue: 486200, revenueGrowth: 18.4, averageOrderValue: 12150,
  outstanding: 43800, overdue: 21400, paymentDelay: 39, previousPaymentDelay: 21,
  profitability: 29.8, totalOrders: 42, creditLimit: 100000,
}

export const customerDetailMock: CustomerDetail = {
  ...seedCustomers[0],
  country: 'Maroc', industry: 'Distribution & commerce de détail',
  taxId: 'ICE 001234567000078 / IF 12345678', website: 'https://novaretail.ma',
  address: '42, boulevard Al Qods, Aïn Sebaâ', segment: 'Grand compte · Distribution',
  paymentTerms: '30 jours fin de mois', currency: 'MAD', preferredContact: 'E-mail',
  lastOrder: '2026-09-30', lastPayment: '2026-09-29',
  primaryContact: { name: 'Karim El Mansouri', role: 'Directeur des achats', phone: '+212 6 12 34 56 78', email: 'karim@novaretail.ma' },
  sales: customerSalesMock, invoices: customerInvoicesMock, payments: customerPaymentsMock,
  documents: [
    { id: 'doc-contract', name: 'Contrat commercial 2026', type: 'Contrat', uploadedAt: '2026-03-01', uploadedBy: 'Sara El Mansouri', aiIndexed: true, permission: 'sales.view', content: 'EXTRAIT DE DÉMONSTRATION — Contrat commercial 2026\nClient : Nova Retail SARL\nObjet : approvisionnement en produits de distribution.\nDurée : du 1er mars au 31 décembre 2026.\nConditions de paiement : 30 jours fin de mois.' },
    { id: 'doc-tax', name: 'Attestation fiscale', type: 'Fiscal', uploadedAt: '2026-03-02', uploadedBy: 'Nadia Bennani', aiIndexed: true, content: 'EXTRAIT DE DÉMONSTRATION — Attestation fiscale\nNova Retail SARL\nICE : 001234567000078\nSiège : Casablanca, Maroc.\nDocument fictif destiné à la présentation de la fiche client.' },
    { id: 'doc-catalog', name: 'Catalogue produits Q4', type: 'Catalogue', uploadedAt: '2026-09-17', uploadedBy: 'Sara El Mansouri', aiIndexed: true, permission: 'sales.view', content: 'EXTRAIT DE DÉMONSTRATION — Catalogue Q4\nFamilles : équipement de point de vente, rangement, consommables.\nSélection adaptée aux achats récents de Nova Retail SARL.' },
    { id: 'doc-report', name: 'Compte rendu de visite', type: 'Compte rendu', uploadedAt: '2026-09-18', uploadedBy: 'Sara El Mansouri', aiIndexed: false, content: 'EXTRAIT DE DÉMONSTRATION — Visite du 18 septembre\nContact : Karim El Mansouri, directeur des achats.\nLe client prépare ses besoins pour le quatrième trimestre.\nProchaine étape : organiser un échange commercial.' },
  ],
  notes: [
    { id: 'note-1', author: 'Sara El Mansouri', createdAt: '2026-09-18T10:32:00+01:00', content: 'Le client a demandé une extension des délais de paiement pour les commandes du quatrième trimestre.', pinned: true },
    { id: 'note-2', author: 'Youssef Karim', createdAt: '2026-09-16T14:15:00+01:00', content: 'Karim souhaite recevoir le catalogue des produits complémentaires avant notre prochain rendez-vous.', pinned: false },
  ],
  nextActions: [
    { id: 'followup', title: 'Relancer la facture INV-2026-0412', dueDate: '2026-10-01', owner: 'Sara El Mansouri', tab: 'invoices', permission: 'invoices.view' },
    { id: 'upsell', title: 'Préparer une proposition commerciale', dueDate: '2026-09-25', owner: 'Sara El Mansouri', tab: 'sales', permission: 'sales.view' },
  ],
  permissions: [...customersMock.permissions, 'sales.view', 'invoices.view', 'payments.view', 'ai.use'],
  salespeople,
}

export const customerActivitiesMock: CustomerActivity[] = [
  { id: 'activity-1', type: 'sale', title: 'Commande créée', description: 'Nouvelle commande de réapprovisionnement.', user: salespeople[0], createdAt: '2026-09-30T09:42:00+01:00', record: 'SO-2026-1048', permissions: ['sales.view'] },
  { id: 'activity-2', type: 'payment', title: 'Paiement reçu', description: 'Virement de 17 800 MAD rapproché de la facture.', user: 'Nadia Bennani', createdAt: '2026-09-29T15:24:00+01:00', record: 'INV-2026-0492', permissions: ['payments.view', 'invoices.view'] },
  { id: 'activity-3', type: 'ai', title: 'Alerte IA créée', description: 'Allongement du délai de paiement : 21 → 39 jours.', user: 'SmartERP AI', createdAt: '2026-09-28T08:30:00+01:00', record: 'CUS-000124', permissions: ['ai.use', 'payments.view', 'invoices.view', 'sales.view'] },
  { id: 'activity-4', type: 'call', title: 'Appel commercial', description: 'Échange avec Karim sur les besoins du quatrième trimestre.', user: salespeople[0], createdAt: '2026-09-25T11:30:00+01:00', record: 'CUS-000124', permissions: [] },
  { id: 'activity-5', type: 'quote', title: 'Devis envoyé', description: 'Proposition commerciale confirmée par le client.', user: salespeople[0], createdAt: '2026-09-21T16:10:00+01:00', record: 'QT-2026-0294', permissions: ['sales.view'] },
  { id: 'activity-6', type: 'invoice', title: 'Facture émise', description: 'Facture liée à la commande SO-2026-0985.', user: 'Nadia Bennani', createdAt: '2026-09-19T09:15:00+01:00', record: 'INV-2026-0492', permissions: ['invoices.view', 'sales.view'] },
  { id: 'activity-7', type: 'note', title: 'Note ajoutée', description: 'Préparation du suivi commercial Q4.', user: salespeople[0], createdAt: '2026-09-18T10:32:00+01:00', record: 'CUS-000124', permissions: [] },
  { id: 'activity-8', type: 'document', title: 'Document ajouté', description: 'Compte rendu de la visite commerciale.', user: salespeople[0], createdAt: '2026-09-18T10:15:00+01:00', record: 'Compte rendu de visite', permissions: [] },
  { id: 'activity-9', type: 'email', title: 'E-mail envoyé', description: 'Transmission du catalogue des produits Q4.', user: salespeople[0], createdAt: '2026-09-17T14:00:00+01:00', record: 'Catalogue Q4', permissions: ['sales.view'] },
]

export const customerAIInsightMock: CustomerAIInsight = {
  summary: 'Nova Retail SARL reste un client à forte valeur avec une croissance des achats de 18,4 % cette année. Cependant, le délai moyen de paiement est passé de 21 à 39 jours, ce qui augmente le risque de trésorerie. Le volume d’achats récent suggère également une opportunité de vente complémentaire.',
  analysis: 'Le comportement de paiement s’est dégradé au cours des 90 derniers jours, malgré la poursuite de la croissance des ventes.',
  confidence: 89,
  risk: { level: 'Medium', evidence: ['Délai de paiement passé de 21 à 39 jours.', '21 400 MAD de factures actuellement en retard.'] },
  opportunity: { value: 36000, evidence: 'Les achats ont progressé de 27 % sur les 60 derniers jours. Potentiel estimé sur les produits complémentaires.' },
  recommendations: ['Examiner les factures échues avant d’accorder du crédit supplémentaire.', 'Proposer des produits complémentaires liés aux achats récents.', 'Planifier un suivi commercial dans les sept jours.'],
  generatedAt: '2026-09-30T09:56:00+01:00',
  sources: ['Commandes et devis du client', 'Échéancier des 12 factures', 'Historique des 15 règlements'],
}

// Les autres liens du portefeuille ouvrent leur propre identité, avec un historique vide.
// Aucune transaction ou analyse de Nova Retail n'est réutilisée pour un autre client.
export function getCustomerDetailMock(id: number): CustomerDetail | null {
  if (id === customerDetailMock.id) return customerDetailMock
  const customer = customersMock.customers.find((entry) => entry.id === id)
  if (!customer) return null
  return { ...customer, country: 'Maroc', industry: customer.tags[0] ?? '', taxId: '', website: '',
    address: customer.district, segment: '', paymentTerms: '', currency: 'MAD', preferredContact: 'E-mail',
    lastOrder: null, lastPayment: null, primaryContact: null,
    sales: [], invoices: [], payments: [], documents: [], notes: [], nextActions: [],
    permissions: customerDetailMock.permissions, salespeople,
  }
}
export function getCustomerSummaryMock(id: number): CustomerSummary | null {
  if (id === customerDetailMock.id) return customerSummaryMock
  const customer = customersMock.customers.find((entry) => entry.id === id)
  if (!customer) return null
  return { asOf: customersMock.period.asOf, customerScore: null, paymentReliability: null,
    revenue: customer.revenue, outstanding: customer.outstanding, overdue: customer.overdue,
    revenueGrowth: null, averageOrderValue: null, paymentDelay: null, previousPaymentDelay: null,
    profitability: null, totalOrders: null, creditLimit: null,
  }
}
