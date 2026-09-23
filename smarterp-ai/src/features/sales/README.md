# Commandes clients — `/sales/:id`

La fiche réutilise AppShell, les composants UI, Axios, TanStack Query et les clients existants. Aucune dépendance ajoutée. La route `/sales` étant absente du dépôt initial, `SalesOrdersPage.tsx` fournit une liste d’accès simple. Aucune page complète Livraison, Facture ou Paiement n’est créée.

## Structure

| Fichier | Rôle |
| --- | --- |
| `pages/SalesOrderDetailPage.tsx` | Récupère `id`, affiche les états de chargement/erreur et compose la fiche ; contrôle les actions |
| `hooks/useSalesOrderDetail.ts` | Requête détail, confirmation, livraison, facture, analyse et invalidations |
| `hooks/useSalesOrders.ts` | Collection utilisée par la liste d’accès |
| `api/sales.api.ts` | Appels Axios et choix explicite du mode démonstration |
| `data/sales.mock.ts` | Collection canonique de sept commandes ; la liste est une projection des détails |
| `types/sales.types.ts` | Contrats des commandes, lignes, documents, activités, permissions et capacités |
| `sales.utils.ts` | Quantités restantes, solde, marge et éligibilité des actions |
| `components/SalesOrderWorkflow.tsx` | Étapes du cycle commercial, sans modification par clic |
| `components/SalesOrderSmartButtons.tsx` | Compteurs de documents et accès aux sections ou au devis source |
| `components/SalesOrderLineItems.tsx` | Quantités, prix, remises, TVA et marge des lignes |
| `components/SalesOrderFinancialSummary.tsx` | Totaux serveur et rapprochement des factures/paiements |
| `components/SalesOrderDeliveryPanel.tsx` | Suivi logistique et progression |
| `components/SalesOrderPaymentPanel.tsx` | Facturation et paiements dans deux composants |
| `components/SalesOrderActionDialog.tsx` | Confirmation et préparations validées de livraison/facture |
| `components/SalesOrderActivityTimeline.tsx` | Historique chronologique fourni par les données |
| `components/SalesOrderAIInsight.tsx` | Faits, analyse, risques et recommandations distincts |
| `sales.css` | Mise en page compacte, responsive et styles isolés |

## Règles de la fiche

Le hook valide l’identifiant numérique avant `GET`. Les clés du cache incluent utilisateur, société, mode et identifiant. Une réponse 403 affiche un accès refusé, 404 une commande introuvable, les autres erreurs une action Réessayer. Aucun échec API ne retourne silencieusement des mocks.

Le workflow affiche Brouillon → Confirmée → En préparation → Terminée, et l’alternative Annulée. Une autre valeur serveur est conservée. Livraison, facturation et paiement ont chacun leur statut ; une facture peut donc précéder une livraison complète. Les smart buttons utilisent les tailles des collections, ciblent des sections focalisables et relient le devis à sa route réelle. Le client ouvre `/customers/:id`.

Restant à livrer = max(0, commandée − livrée), à trois décimales. Les totaux de la commande et les HT de lignes proviennent du serveur. Le montant facturé additionne uniquement les factures `posted`. Le payé additionne les paiements `confirmed` rattachés à ces factures. Solde = max(0, facturé − payé) ; reste à facturer = max(0, commande TTC − facturé). Ce calcul concerne cette commande, pas la totalité du compte client. Les utilitaires monétaires partagés additionnent en centimes.

Marge HT = HT net − coût unitaire × quantité. Elle est affichée seulement avec `sales.margin.view`. L’absence de permission affiche « Accès restreint » ; l’absence de coût affiche « Marge indisponible ». Django doit masquer les coûts sensibles dans sa réponse et fournir des montants validés.

Les permissions viennent de la réponse : `sales.view`, `sales.edit`, `delivery.create`, `invoices.create`, `sales.margin.view`, `ai.use`. `sales.edit` seul n’autorise pas la confirmation : `capabilities.canConfirm` est aussi exigé. Les capacités absentes sont considérées comme fausses. La livraison exige un état actif, des quantités restantes et `canDeliver`. La facture exige un état actif, un reste à facturer positif et `canInvoice`, avec `invoiceableAmount > 0`. Ce plafond peut être inférieur au reste à facturer selon les règles de l’entreprise.

La confirmation ouvre un dialogue ; l’action reste verrouillée pendant le POST et le rafraîchissement. Après succès, détail et liste sont actualisés. Le formulaire de livraison limite chaque quantité au restant et exige un entrepôt fourni. La facture limite le montant au plus petit du plafond autorisé et du reste à facturer. Le serveur valide définitivement stock, quantités, montants et éligibilité. Une livraison planifiée retournée par le serveur augmente le compteur sans modifier localement les quantités livrées.

L’annulation est désactivée, avec une explication visible pour les commandes éligibles : aucun endpoint ni règle d’annulation n’est défini. Les commandes partiellement livrées/facturées n’exposent pas cette action.

## Démonstration

`VITE_SALES_USE_MOCK=true` par défaut. L’instantané est daté du 30 septembre 2026. Les états couvrent brouillon, confirmée, en préparation, terminée, annulée, exécution partielle et complète. `/sales/1048` reprend Nova Retail, la date et les 42 500 MAD de l’historique Client existant ; lignes et coûts reproduisent aussi sa marge de 31,2 % HT. `/sales/1054` illustre une commande issue du devis accepté `/quotes/268` (même client et total).

La confirmation de démonstration est explicitement simulée et conservée en mémoire jusqu’au rechargement. Les préparations de livraison/facture ne créent aucun document, n’incrémentent aucun compteur et ne modifient aucun stock. Le panneau IA fournit à la demande un exemple structuré calculé à partir des faits, sans appel à un modèle. Ses recommandations n’exécutent aucune opération.

## Connexion Django

Passer `VITE_SALES_USE_MOCK=false`, renseigner `VITE_API_BASE_URL`, puis redémarrer Vite. Les chemins sont regroupés dans `sales.api.ts` et restent à confirmer avec Django.

| Opération | Endpoint | Corps / Réponse |
| --- | --- | --- |
| Liste d’accès | `GET /sales-orders/` | `SalesOrdersData` : orders, permissions, asOf |
| Détail | `GET /sales-orders/:id/` | `SalesOrderDetail` complet |
| Confirmation | `POST /sales-orders/:id/confirm/` | Aucun corps ; détail complet en réponse |
| Livraison | `POST /sales-orders/:id/delivery/` | `{ warehouse, lines: [{ line_id, quantity }] }` ; réponse `{ order, reference }` |
| Facture | `POST /sales-orders/:id/invoice/` | `{ amount }` ; réponse `{ order, reference }` |

Ce contrat initial reprend les types camelCase et des montants numériques pour les réponses, comme les autres features existantes hors Devis. Adapter `fromAPI` dans `sales.api.ts` lorsque les serializers DRF (snake_case et décimaux chaînes éventuels) seront finalisés. `order` représente un détail complet, et `reference` la référence du document réellement créé. Les capacités sont `{ canConfirm, canCancel, canDeliver, canInvoice, invoiceableAmount }`.

Aucun endpoint d’annulation ou d’analyse IA n’est inventé. L’analyse réelle et les téléchargements restent désactivés jusqu’à leur connexion. Aucune page de document inexistante n’est ciblée.

## Vérification

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e -- tests/sales.spec.ts

$env:VITE_SALES_USE_MOCK = 'false'
$env:PLAYWRIGHT_PORT = '5175'
npm.cmd run test:e2e -- tests/sales.spec.ts --grep 'Sales API'
Remove-Item Env:VITE_SALES_USE_MOCK, Env:PLAYWRIGHT_PORT
```

Les tests couvrent cohérence comptable, marge, droits, quantités partielles, confirmation, validations, absence de mutation commerciale dans les préparations démo, réponses API autoritaires, erreurs HTTP, liens, analyse et largeur mobile. Ils interceptent les réponses API et n’affectent aucune donnée réelle.
