# Paiements — page 14

`/payments` est intégré à AppShell, avec navigation **Finance → Paiements** et breadcrumb existant. Aucun composant de shell ni dépendance supplémentaire n’a été créé.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `pages/PaymentsPage.tsx` | Compose la page, les filtres, les confirmations et l’export |
| `components/PaymentKPIGrid.tsx` | Reçus, envoyés, attente et délai moyen |
| `components/PaymentsToolbar.tsx` | Création, recherche, filtres, groupes, favoris, export et aide Plus |
| `components/PaymentFilters.tsx` | Filtres combinés, raccourcis et chips |
| `components/PaymentTable.tsx` | Tableau financier, badges, relations, détail et annulation |
| `components/RecordPaymentModal.tsx` | Formulaire React Hook Form et validation Zod |
| `types/payments.types.ts` | Paiement, direction, méthode, statuts, permissions et contrats API |
| `schemas/payment.schema.ts` | Cohérence direction/tiers/facture, dates et limites de montant |
| `payments.utils.ts` | Filtrage, périodes UTC, regroupement et calcul des indicateurs |
| `data/payments.mock.ts` | Paiements cohérents avec Invoices et Suppliers, mutations démo |
| `api/payments.api.ts` | Appels Axios, paramètres et DTO d’écriture |
| `hooks/usePayments.ts` | Requêtes liste/summary, mutations, export et invalidations |

Composants/utilitaires partagés avec Fournisseurs : `src/components/ui/CollectionPagination.tsx`, `business.css` et `src/lib/csv.ts`. Button, Badge, Alert, Dialog, formatDate et formatMoney sont réutilisés. Tests : `tests/payments-suppliers.spec.ts`.

Les fichiers existants modifiés comprennent Router, Sidebar, Topbar, configuration et types d’environnement, `.env.example`, README, `invoices.mock.ts`, `useInvoiceDetail.ts` et `sales.types.ts`. Les paiements des factures conservent désormais leurs références externes et notes pour la vue Transactions.

## Fonctionnement

Table financière sans Kanban. Recherche sur référence, facture, tiers et référence externe ; filtres direction, type de tiers, tiers précis, facture, méthode, statut, période et montant. Aujourd’hui, semaine depuis lundi, mois à ce jour et intervalle personnalisé sont calculés avec une date de référence explicite. Les favoris sont des filtres prédéfinis locaux.

Tri par date, montant ou référence. Pagination 25/50/100. Le regroupement par direction, méthode, statut, client, fournisseur ou mois porte sur la page courante, avec indication visible. Aucun regroupement Banque/compte n’est inventé, ces données n’étant pas disponibles.

Les références clients ouvrent `/customers/:id`, les fournisseurs `/suppliers/:id`, les factures clients `/invoices/:id`. Les références `BILL-*` restent du texte : aucune fausse route fournisseur n’est créée. Ouvrir un paiement affiche son détail dans le dialogue existant.

## Indicateurs

Les montants restent positifs. `direction: incoming | outgoing` est distinct du montant et du statut.

- **Reçus** : somme des entrants `completed`.
- **Envoyés** : somme des sortants `completed`.
- **En attente** : somme des deux directions au statut `pending`.
- **Délai moyen** : moyenne simple, arrondie au jour, de `date paiement − date émission facture`, pour les encaissements confirmés avec deux dates valides et un délai non négatif. Le nombre de paiements exploitables est affiché. Sans dates, le délai est « Indisponible ».

Les quatre indicateurs couvrent **tous les résultats filtrés, avant pagination**. Annulations et échecs ne contribuent pas aux montants confirmés. Le backend doit appliquer le même périmètre à `/payments/` et `/payments/summary/`. Les sommes de démonstration utilisent les centimes partagés de `lib/money.ts`.

## Création et annulation

Le formulaire propose encaissement client ou décaissement fournisseur, tiers, facture ouverte de ce tiers, date, montant, méthode, référence externe et note. Changer de direction ou de tiers réinitialise facture et montant. Dans cette version, une facture est obligatoire : avances et trop-perçus ne sont pas activés.

Zod impose un montant strictement positif, deux décimales maximum et un montant inférieur ou égal au solde disponible. La facture doit correspondre au tiers et à la direction. Django revalide l’éligibilité et le solde courant de façon transactionnelle. Une erreur conserve le formulaire ; aucun succès ni allocation locale n’est inventé en mode API.

L’annulation exige `payments.cancel`, `canCancel: true` et un statut éligible. Une confirmation prévient du changement possible du solde. Le paiement reste dans l’historique avec `cancelled`. Annuler un paiement en attente n’ajoute pas d’argent au solde : il n’avait jamais réduit celui-ci.

Après succès serveur, liste, summary, factures, aging, commandes, fournisseurs, clients et dashboard sont invalidés pour l’utilisateur et la société courants. Une mutation depuis une facture invalide aussi la page Paiements. Les agrégats Customers/Dashboard de démonstration restent leurs instantanés historiques indépendants ; le rapprochement dynamique démo concerne Factures ↔ Paiements ↔ Commandes et Fournisseurs ↔ Décaissements.

## Permissions

Les permissions proviennent de la réponse, jamais d’une déduction du rôle :

| Permission | Effet |
| --- | --- |
| `payments.view` | Autorise la page et son résumé |
| `payments.create` | Affiche Enregistrer un paiement |
| `payments.cancel` | Affiche l’annulation uniquement si `canCancel` est vrai |
| `payments.export` | Affiche et autorise l’export |

Une capacité absente est fausse. HTTP 403 ou absence de `payments.view` affiche « Accès non autorisé ». Django reste responsable de l’autorisation réelle et des champs/options renvoyés. Les caches et collections de démonstration sont isolés par utilisateur et société ; les anciennes données ne sont pas conservées lors d’un changement de ce périmètre.

## Démonstration cohérente

`VITE_PAYMENTS_USE_MOCK=true` par défaut. Date de référence : **30 septembre 2026**.

Les encaissements sont une projection des paiements canoniques de `invoices.mock.ts`, sans seconde copie divergente. Les paiements créés depuis la facture apparaissent dans la page Paiements, et réciproquement. `INV-2026-0412` garde ses montants existants ; le cas critique utilise `INV-2026-0413` : 24 600 TTC, 11 800 payé, 12 800 restant. Un encaissement simulé de 6 400 produit un solde local de 6 400 ; son annulation rétablit 12 800 et conserve la ligne historique.

Les décaissements sont définis dans `payments.mock.ts`, à partir des mêmes fournisseurs que la page Fournisseurs. Atlas Packaging possède un paiement en attente de 18 600 MAD sur `BILL-2026-0078` et un solde ouvert de 48 600 MAD. Les soldes fournisseurs initiaux incluent déjà les règlements historiques confirmés. Une facture fournisseur de démonstration par tiers représente ce solde ; aucune feature de facturation fournisseur complète n’est implémentée. Un nouveau décaissement confirmé réduit le solde fournisseur et son annulation le rétablit.

Ces opérations sont **simulées en mémoire jusqu’au rechargement**, sans virement, écriture comptable ni persistance réelle. Il n’existe aucun repli automatique vers les mocks après erreur API.

## Contrats Django

Définir `VITE_PAYMENTS_USE_MOCK=false`, configurer `VITE_API_BASE_URL`, puis redémarrer Vite. Pour un parcours intégré réel, désactiver aussi les mocks des modules concernés.

| Fonction | Endpoint | Réponse |
| --- | --- | --- |
| `getPayments` | `GET /payments/` | `PaymentsData` paginé |
| `getPaymentsSummary` | `GET /payments/summary/` | `PaymentSummary` sur tous les résultats filtrés |
| `createPayment` | `POST /payments/` | Paiement canonique `Payment` |
| `cancelPayment` | `POST /payments/:id/cancel/` | Paiement canonique `Payment` annulé |

Le contrat initial de lecture utilise camelCase et des montants numériques. Adapter la frontière API si DRF renvoie snake_case ou Decimal sous forme de chaîne. Le statut confirmé est `completed` ; normaliser un éventuel statut backend `processing` en `pending` dans cet adaptateur.

`PaymentsData` contient `payments`, `count` filtré, `totalCount` autorisé sans filtre, `permissions`, `asOf`, `partners` et `openInvoices`. Les partenaires/options sont les valeurs autorisées nécessaires aux filtres et au formulaire ; `openInvoices` contient uniquement les factures ouvertes payables, avec direction, tiers, référence et solde courant. Le backend peut ne pas exposer ces options aux utilisateurs sans création. Aucun endpoint supplémentaire arbitraire n’a été inventé pour les charger.

Paramètres : `search`, `direction`, `partner_type`, `partner_id` (clé `customer:124` ou `supplier:42`), `invoice` (référence), `method`, `status`, `period`, `date_from`, `date_to`, `min_amount`, `max_amount`, `page`, `page_size`, `sort`. Le résumé reçoit les mêmes filtres sans pagination ni tri.

POST création : `{ direction, partner_id, invoice_id, date, amount, method, reference_external, note }`, avec identifiants numériques. Les montants et soldes définitifs viennent du backend après mutation et rechargement.

L’export CSV demande les résultats filtrés complets au même endpoint, uniquement avec `payments.export`, puis vérifie que la réponse est complète. Si le serveur plafonne `page_size`, un message d’erreur remplace tout export partiel silencieux. Prévoir alors un endpoint d’export défini avec Django. Les cellules CSV sont protégées contre les préfixes de formules de tableur.

Les écritures réelles, rapprochements, règles d’annulation, transactions concurrentes et persistance attendent Django. Aucun appel Axios ne se trouve dans les composants visuels.
