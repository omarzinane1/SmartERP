import type {
  AIControlCenterData,
  SuggestedAction,
} from '../types/aiControlCenter.types'

const reminders: SuggestedAction = {
  id: 'reminders',
  title: 'Relancer les clients les plus en retard',
  detail: 'Recouvrement potentiel : 41 800 MAD',
  button: 'Préparer les relances',
  approvalRequired: true,
  draft: [
    'Périmètre : créances échues depuis plus de 30 jours.',
    'Montant à prioriser : 41 800 MAD.',
    'Vérifier les coordonnées et les litiges avant tout envoi.',
  ],
}
const replenish: SuggestedAction = {
  id: 'replenish',
  title: 'Réapprovisionner PRD-204',
  detail: 'Quantité suggérée : 450 unités',
  button: 'Préparer une commande',
  approvalRequired: true,
  draft: [
    'Produit : PRD-204 · Adaptateur USB-C.',
    'Quantité proposée : 450 unités.',
    'Fournisseur : Maroc Câblage SARL.',
    'Prix, délai et budget à valider par le responsable achats.',
  ],
}
const discounts: SuggestedAction = {
  id: 'discounts',
  title: 'Vérifier les remises > 15 %',
  detail: '23 commandes concernées',
  button: 'Examiner les ventes',
  approvalRequired: false,
  draft: [
    'Périmètre : catégorie Électronique · septembre 2026.',
    '23 commandes dépassent le seuil de 15 %.',
    'Comparer les remises aux conditions contractuelles.',
  ],
}
const discountApproval: SuggestedAction = {
  id: 'discount-approval',
  title: 'Exiger une approbation pour les remises > 15 %',
  detail: 'Règle proposée · département Ventes',
  button: 'Examiner la règle',
  approvalRequired: true,
  draft: [
    'Seuil proposé : remise commerciale supérieure à 15 %.',
    'Validateur proposé : responsable des ventes.',
    'La règle doit être approuvée avant activation.',
  ],
}
const compare: SuggestedAction = {
  id: 'compare',
  title: 'Comparer les prix fournisseurs',
  detail: 'Somaca et Electro Maroc',
  button: 'Préparer le comparatif',
  approvalRequired: false,
  draft: [
    'Comparer les prix nets, frais et délais.',
    'Références concernées : PRD-114, PRD-120, PRD-204.',
  ],
}
const negotiate: SuggestedAction = {
  id: 'negotiate',
  title: 'Négocier les coûts d’achat',
  detail: 'Économie potentielle : 12 400 MAD/mois',
  button: 'Préparer la négociation',
  approvalRequired: false,
  draft: [
    'Fournisseur : Somaca Distribution.',
    'Regrouper les commandes du prochain trimestre.',
    'Objectif indicatif : réduction de 4 % sur le volume annuel.',
  ],
}
const upsell: SuggestedAction = {
  id: 'upsell',
  title: 'Préparer une offre pour Marrakech Market',
  detail: 'Valeur potentielle : 36 000 MAD',
  button: 'Préparer une offre',
  approvalRequired: false,
  draft: [
    'Client : Marrakech Market.',
    'Consommation en hausse de 27 % sur 60 jours.',
    'Proposition : contrat de volume annuel, à examiner avec le commercial.',
  ],
}
const product: SuggestedAction = {
  id: 'product',
  title: 'Étudier la mise en avant de PRD-106',
  detail: 'Marge actuelle : 42 % · croissance : +18 %',
  button: 'Examiner le potentiel',
  approvalRequired: false,
  draft: [
    'Produit : PRD-106.',
    'Étudier la disponibilité et les canaux de vente.',
    'Valider le plan commercial avant toute modification de prix.',
  ],
}

// Un instantané cohérent : toutes les valeurs de démonstration restent dans ce fichier.
export const aiControlCenterMock: AIControlCenterData = {
  period: {
    label: 'Septembre 2026',
    asOf: '2026-09-30T10:00:00Z',
    generatedAt: '2026-09-30T09:56:00Z',
  },
  health: {
    score: 82,
    trend: 3,
    confidence: 94.2,
    departments: [
      {
        name: 'Finance',
        score: 78,
        trend: -4,
        alerts: 3,
        status: 'Attention requise',
        tone: 'warning',
      },
      {
        name: 'Ventes',
        score: 85,
        trend: 1,
        alerts: 2,
        status: 'Sain',
        tone: 'positive',
      },
      {
        name: 'Stock',
        score: 72,
        trend: -6,
        alerts: 4,
        status: 'À risque',
        tone: 'critical',
      },
      {
        name: 'Clients',
        score: 88,
        trend: 2,
        alerts: 1,
        status: 'Sain',
        tone: 'positive',
      },
      {
        name: 'Achats',
        score: 80,
        trend: 0,
        alerts: 2,
        status: 'Stable',
        tone: 'indigo',
      },
      {
        name: 'Opérations',
        score: 86,
        trend: 2,
        alerts: 0,
        status: 'Sain',
        tone: 'positive',
      },
    ],
  },
  stats: {
    critical: 3,
    warnings: 8,
    forecasts: 4,
    opportunities: 6,
    resolved: 12,
  },
  summary: {
    text: 'SmartERP AI détecte actuellement trois situations prioritaires. Les principaux risques concernent les retards de paiement clients, une baisse de marge sur la catégorie Électronique et un risque de rupture sur trois produits. Plusieurs opportunités commerciales ont également été identifiées chez des clients en croissance.',
    confidence: 92,
    priorities: [
      '54 300 MAD de créances à risque (> 30 j)',
      'Marge Électronique en baisse de 7 points',
      '3 produits proches de la rupture (dont PRD-204)',
    ],
    impacts: [
      'Trésorerie sous tension : 54 300 MAD',
      'Impact marge : −18 400 MAD/mois',
      'Risque de ventes perdues : 31 000 MAD',
    ],
    recommendations: [
      'Prioriser les relances clients',
      'Vérifier les remises commerciales > 15 %',
      'Préparer les réapprovisionnements critiques',
    ],
    sources: ['Commandes clients', 'Factures', 'Mouvements de stock', 'Achats'],
    model: 'SmartERP · Llama Finance',
  },
  assignees: ['Nadia Benali', 'Omar Zinane', 'Youssef Amrani'],
  alerts: [
    {
      id: 'receivables',
      title: 'Créances clients à risque (> 30 j)',
      scope: '5 comptes débiteurs identifiés',
      department: 'Finance',
      severity: 'critical',
      type: 'fact',
      metric: 'Créances échues',
      currentValue: '54 300 MAD',
      baseline: 'Référence : 20 037 MAD',
      deviation: '+171 %',
      impact: 'Trésorerie élevée',
      confidence: 96,
      detectedAt: '2026-09-30T09:48:00Z',
      status: 'open',
      facts: [
        { label: 'Créances échues', value: '54 300 MAD' },
        { label: 'Comptes concernés', value: '5' },
        { label: 'Ancienneté', value: '> 30 jours' },
        { label: 'Variation', value: '+171 %' },
      ],
      analysis:
        'La hausse des créances échues est concentrée sur cinq comptes. Leur recouvrement pourrait réduire la pression sur la trésorerie à court terme.',
      causes: [
        {
          title: 'Retards concentrés',
          evidence: '5 comptes dépassent 30 jours de retard.',
        },
      ],
      estimates: [{ label: 'Recouvrement potentiel', value: '41 800 MAD' }],
      recommendations: [reminders],
      evidence: [
        {
          id: 'FAC-2026-0925',
          kind: 'Facture',
          description:
            'Facture échue · solde inclus dans les créances à risque.',
        },
      ],
    },
    {
      id: 'margin',
      title: 'Baisse inhabituelle de marge — Électronique',
      scope: 'CAT-ELEC · 184 commandes affectées',
      department: 'Ventes',
      severity: 'high',
      type: 'analysis',
      metric: 'Marge brute',
      currentValue: '24,1 %',
      baseline: 'Moyenne 3 mois : 31 %',
      deviation: '−6,9 pts',
      impact: '−18 400 MAD/mois',
      confidence: 91,
      detectedAt: '2026-09-30T09:25:00Z',
      status: 'open',
      facts: [
        {
          label: 'Marge brute actuelle',
          value: '24,1 %',
          note: 'Moyenne 3 mois : 31 %',
        },
        { label: 'Chiffre d’affaires', value: '286 000 MAD' },
        {
          label: 'Remise moyenne',
          value: '16,2 %',
          note: 'Historique : 9,8 %',
        },
        { label: 'Coût d’achat', value: '+7,4 %' },
        { label: 'Commandes clients', value: '184' },
        { label: 'Produits concernés', value: '7' },
      ],
      analysis:
        'La réduction de la marge brute semble principalement associée à la hausse des coûts d’achat (+7,4 %) et à des remises commerciales plus élevées. Ces corrélations restent à vérifier sur les pièces liées.',
      causes: [
        {
          title: 'Hausse des coûts fournisseurs',
          evidence: 'Coût d’achat moyen en hausse de 7,4 %.',
        },
        {
          title: 'Remises commerciales plus élevées',
          evidence: 'Remise moyenne passée de 9,8 % à 16,2 %.',
        },
        {
          title: 'Mix produit moins favorable',
          evidence: 'Davantage de produits à faible marge vendus.',
        },
      ],
      estimates: [
        { label: 'Impact mensuel estimé', value: '−18 400 MAD' },
        { label: 'Impact annuel potentiel', value: '−220 800 MAD' },
      ],
      recommendations: [discounts, compare, negotiate, discountApproval],
      evidence: [
        {
          id: 'SO-2026-1048',
          kind: 'Commande client',
          description: 'Électronique · remise supérieure à 15 %.',
        },
        {
          id: 'SO-2026-1052',
          kind: 'Commande client',
          description: 'Électronique · incluse dans les 184 ventes analysées.',
        },
        {
          id: 'SO-2026-1061',
          kind: 'Commande client',
          description: 'Électronique · contrôle de la marge proposé.',
        },
        {
          id: 'PO-2026-0542',
          kind: 'Commande fournisseur',
          description: 'Somaca · hausse du coût d’achat observée.',
        },
        {
          id: 'PO-2026-0551',
          kind: 'Commande fournisseur',
          description: 'Electro Maroc · base de comparaison des prix.',
        },
        {
          id: 'PRD-114',
          kind: 'Produit',
          description:
            'Produit Électronique concerné par le changement du mix.',
        },
        {
          id: 'PRD-120',
          kind: 'Produit',
          description: 'Produit Électronique à marge réduite.',
        },
        {
          id: 'PRD-204',
          kind: 'Produit',
          description:
            'Adaptateur USB-C · couverture de stock estimée à 7 jours.',
        },
      ],
    },
    {
      id: 'stockout',
      title: 'Risque de rupture produit PRD-204',
      scope: 'Adaptateur USB-C · stock actuel : 120 u.',
      department: 'Stock',
      severity: 'high',
      type: 'forecast',
      metric: 'Couverture stock',
      currentValue: '7 jours',
      baseline: 'Seuil cible : 14 jours',
      deviation: '−7 jours',
      impact: '31 000 MAD',
      confidence: 93,
      detectedAt: '2026-09-30T09:00:00Z',
      status: 'open',
      facts: [
        { label: 'Stock disponible', value: '120 unités' },
        { label: 'Produit', value: 'PRD-204' },
      ],
      analysis:
        'Au rythme de consommation observé, le stock pourrait être épuisé dans sept jours. La date dépend des ventes et des réceptions à venir.',
      causes: [
        {
          title: 'Couverture insuffisante',
          evidence: '120 unités disponibles pour une demande récente soutenue.',
        },
      ],
      estimates: [
        { label: 'Rupture possible', value: 'Dans 7 jours' },
        { label: 'Ventes à risque', value: '31 000 MAD' },
      ],
      recommendations: [replenish],
      evidence: [
        {
          id: 'PRD-204',
          kind: 'Produit',
          description: 'Adaptateur USB-C · 120 unités disponibles.',
        },
      ],
    },
    {
      id: 'supplier',
      title: 'Hausse inhabituelle du prix PRD-114',
      scope: 'Somaca Distribution',
      department: 'Achats',
      severity: 'medium',
      type: 'fact',
      metric: 'Prix unitaire',
      currentValue: '158 MAD',
      baseline: 'Dernier prix : 142 MAD',
      deviation: '+11,3 %',
      impact: '+9 600 MAD',
      confidence: 89,
      detectedAt: '2026-09-30T08:00:00Z',
      status: 'open',
      facts: [
        { label: 'Prix actuel', value: '158 MAD' },
        { label: 'Prix précédent', value: '142 MAD' },
        { label: 'Évolution', value: '+11,3 %' },
      ],
      analysis:
        'Le prix proposé par Somaca a augmenté. Un comparatif des conditions fournisseurs permettrait de vérifier les possibilités de négociation.',
      causes: [
        {
          title: 'Nouveau tarif fournisseur',
          evidence: 'Prix unitaire passé de 142 à 158 MAD.',
        },
      ],
      estimates: [{ label: 'Surcoût potentiel', value: '+9 600 MAD' }],
      recommendations: [compare, negotiate],
      evidence: [
        {
          id: 'PO-2026-0542',
          kind: 'Commande fournisseur',
          description: 'Somaca Distribution · PRD-114 à 158 MAD.',
        },
      ],
    },
    {
      id: 'payments',
      title: 'Dégradation du délai de paiement',
      scope: 'Nova Retail · CL-058',
      department: 'Clients',
      severity: 'medium',
      type: 'analysis',
      metric: 'Délai moyen',
      currentValue: '39 jours',
      baseline: 'Historique : 21 jours',
      deviation: '+18 jours',
      impact: '43 800 MAD',
      confidence: 87,
      detectedAt: '2026-09-29T07:00:00Z',
      status: 'investigating',
      assignee: 'Nadia Benali',
      facts: [
        { label: 'Délai actuel', value: '39 jours' },
        { label: 'Délai historique', value: '21 jours' },
        { label: 'Encours', value: '43 800 MAD' },
      ],
      analysis:
        'Les règlements de Nova Retail deviennent plus tardifs. Vérifier les éventuels litiges avant de proposer une adaptation des conditions de crédit.',
      causes: [
        {
          title: 'Allongement du délai client',
          evidence: 'Le délai de paiement a progressé de 18 jours.',
        },
      ],
      estimates: [{ label: 'Encours exposé', value: '43 800 MAD' }],
      recommendations: [reminders],
      evidence: [
        {
          id: 'CL-058',
          kind: 'Client',
          description: 'Nova Retail · délai moyen de paiement : 39 jours.',
        },
      ],
    },
    {
      id: 'growth',
      title: 'Client en forte croissance',
      scope: 'Marrakech Market · potentiel de contrat annuel',
      department: 'Ventes',
      severity: 'opportunity',
      type: 'recommendation',
      metric: 'Croissance achats',
      currentValue: '+27 %',
      baseline: 'Sur les 60 derniers jours',
      deviation: '+27 %',
      impact: '+36 000 MAD',
      confidence: 84,
      detectedAt: '2026-09-28T06:00:00Z',
      status: 'open',
      facts: [
        { label: 'Croissance observée', value: '+27 %' },
        { label: 'Période', value: '60 jours' },
      ],
      analysis:
        'La hausse des achats suggère une opportunité de contrat annuel. Le potentiel doit être confirmé avec le client.',
      causes: [
        {
          title: 'Demande en croissance',
          evidence: 'Volume d’achat en hausse de 27 % sur 60 jours.',
        },
      ],
      estimates: [
        { label: 'Vente additionnelle potentielle', value: '36 000 MAD' },
      ],
      recommendations: [upsell],
      evidence: [
        {
          id: 'CL-042',
          kind: 'Client',
          description: 'Marrakech Market · croissance des achats sur 60 jours.',
        },
      ],
    },
  ],
  risks: [
    {
      id: 'r1',
      alertId: 'receivables',
      label: 'Créances échues',
      shortLabel: '54k',
      impact: 83,
      probability: 82,
      severity: 'critical',
    },
    {
      id: 'r2',
      alertId: 'margin',
      label: 'Baisse de marge',
      shortLabel: '−18k',
      impact: 66,
      probability: 57,
      severity: 'high',
    },
    {
      id: 'r3',
      alertId: 'stockout',
      label: 'Rupture produit',
      shortLabel: '31k',
      impact: 34,
      probability: 78,
      severity: 'high',
    },
    {
      id: 'r4',
      alertId: 'supplier',
      label: 'Coût fournisseur',
      shortLabel: '+9k',
      impact: 22,
      probability: 27,
      severity: 'medium',
    },
    {
      id: 'r5',
      alertId: 'payments',
      label: 'Concentration client',
      shortLabel: '44k',
      impact: 44,
      probability: 40,
      severity: 'low',
    },
  ],
  forecasts: [
    {
      id: 'f1',
      title: 'Tension de trésorerie',
      detail: 'Solde possible inférieur à 150 000 MAD',
      horizon: 'J+18',
      confidence: 81,
      severity: 'critical',
      assumptions:
        'Projection basée sur les échéances et encaissements prévus ; hors financement nouveau.',
    },
    {
      id: 'f2',
      title: 'Rupture du stock PRD-204',
      detail: 'Couverture estimée à 7 jours',
      horizon: 'J+7',
      confidence: 93,
      severity: 'high',
      assumptions:
        'Consommation récente constante et aucune réception supplémentaire.',
    },
    {
      id: 'f3',
      title: 'Revenus Électronique',
      detail: 'Baisse possible de 9 %',
      horizon: '30 jours',
      confidence: 76,
      severity: 'medium',
      assumptions:
        'Tendance actuelle prolongée sans nouvelle campagne commerciale.',
    },
    {
      id: 'f4',
      title: 'Retards de paiement',
      detail: '68 000 MAD potentiellement en retard',
      horizon: '30 jours',
      confidence: 79,
      severity: 'medium',
      assumptions:
        'Habitudes de paiement récentes, sous réserve de règlement anticipé.',
    },
  ],
  opportunities: [
    {
      id: 'o1',
      title: 'Vente additionnelle',
      company: 'Marrakech Market',
      detail: 'Croissance +27 % · proposer un contrat de volume annuel',
      potential: '36 000 MAD',
      confidence: 84,
      action: upsell,
    },
    {
      id: 'o2',
      title: 'Négociation fournisseur',
      company: 'Somaca Distribution',
      detail: 'Regrouper les commandes · objectif de remise de 4 %',
      potential: '12 400 MAD/mois',
      confidence: 82,
      action: negotiate,
    },
    {
      id: 'o3',
      title: 'Produit à forte marge',
      company: 'PRD-106',
      detail: 'Marge 42 % · croissance des ventes +18 %',
      potential: 'Potentiel à étudier',
      confidence: 78,
      action: product,
    },
  ],
  actions: [reminders, replenish, discounts],
  governance: [
    {
      id: 'credit',
      title: 'Blocage du compte Nova Retail',
      detail: 'Délai : 39 jours · encours : 43 800 MAD',
      button: 'Examiner la proposition',
      approvalRequired: true,
      draft: [
        'Proposition : suspendre temporairement le crédit de Nova Retail.',
        'Vérifier les litiges et contacter le responsable commercial.',
        'Aucun blocage sans validation du responsable financier.',
      ],
    },
    replenish,
    discountApproval,
  ],
  anomalyHistory: [
    { day: '01', critical: 1, high: 2, medium: 4, resolved: 8 },
    { day: '04', critical: 3, high: 1, medium: 5, resolved: 11 },
    { day: '07', critical: 1, high: 1, medium: 2, resolved: 6 },
    { day: '10', critical: 1, high: 4, medium: 0, resolved: 13 },
    { day: '13', critical: 2, high: 4, medium: 5, resolved: 15 },
    { day: '16', critical: 1, high: 0, medium: 3, resolved: 10 },
    { day: '19', critical: 3, high: 5, medium: 5, resolved: 13 },
    { day: '22', critical: 0, high: 0, medium: 5, resolved: 20 },
    { day: '25', critical: 1, high: 3, medium: 0, resolved: 12 },
    { day: '28', critical: 5, high: 6, medium: 5, resolved: 10 },
    { day: '30', critical: 3, high: 8, medium: 6, resolved: 0 },
  ],
  resolutionRate: 76.4,
  responseMinutes: 42,
}
