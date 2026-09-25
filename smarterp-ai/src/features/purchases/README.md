# Achats — pages 16 à 20

Les cinq pages utilisent le shell, Axios, TanStack Query, les dialogues, badges, CSV sécurisé, pagination et calculs monétaires existants. Aucun package ajouté.

## Pages et fichiers

| Route | Page / fonction |
| --- | --- |
| `/suppliers/:id` | `suppliers/pages/SupplierDetailPage.tsx` : identité, score distinct du risque, KPI, onglets, historique tarifaire Recharts, relations et analyse à la demande |
| `/purchases` | `purchases/pages/PurchaseOrdersPage.tsx` : KPI, recherche, filtres combinés, tri, regroupement, sélection, CSV, Liste/Kanban et création |
| `/purchases/:id` | `purchases/pages/PurchaseOrderDetailPage.tsx` : édition brouillon, envoi, confirmation, réception partielle, création de facture, prix, documents et activité |
| `/supplier-invoices` | `supplier-invoices/pages/SupplierInvoicesPage.tsx` : dettes, échéances, aging, recherche, filtres, pagination, export et création |
| `/supplier-invoices/:id` | `supplier-invoices/pages/SupplierInvoiceDetailPage.tsx` : informations, lignes, taxes, rapprochement, édition, validation, décaissement, pièces et analyse |

Chaque feature contient ses types, API, hooks, données et composants. `purchases/schemas` et `supplier-invoices/schemas` valident les formulaires avec Zod et React Hook Form. Les petits éléments communs sont regroupés dans `PurchasingShared.tsx`; `PurchaseLineEditor.tsx` réutilise uniquement les champs de lignes d'achat. Les pages ne font aucun appel Axios directement.

Fichiers existants adaptés : router, Sidebar, Topbar, env, déclarations Vite, `.env.example`, API et hooks fournisseurs, modal/table/page/hooks/données paiements, tests Paiements/Fournisseurs. Le placeholder fournisseur a été retiré.

## Cohérence métier

`purchases/data/purchases.mock.ts` possède les commandes et réceptions. `supplier-invoices/data/supplierInvoices.mock.ts` possède les factures. `payments/data/supplierPayments.mock.ts` possède le journal des décaissements, partagé avec Payments. Les snapshots sont isolés par utilisateur et société ; aucune donnée ne survit au rechargement.

Atlas Packaging conserve **684 200 MAD d'achats** et **48 600 MAD de dette**. Sa commande `PO-2026-0321` vaut **86 400 MAD**, est confirmée, reçue à **60 %** et partiellement facturée. `REC-2026-0148` porte les quantités reçues. `BILL-2026-0078` vaut **48 600 MAD**, avec **18 600 MAD confirmés** par `PAY-2026-0186`, donc **30 000 MAD restants**. `BILL-2026-0079` porte les **18 600 MAD** de dette historique complémentaire. Le paiement 0186, auparavant en attente, est maintenant confirmé pour servir cette chaîne cohérente.

Les commandes historiques explicitement regroupées complètent les volumes d'achats déjà affichés par la liste fournisseurs. Les délais et taux de ponctualité restent des indicateurs de démonstration identifiés ; la variation de prix provient des points affichés. Un nouveau fournisseur n'acquiert pas de fausses commandes ni de faux historique de prix.

La réception représente `sum(receivedQuantity) / sum(quantity)`. Les quantités ne peuvent pas dépasser le restant, être négatives, dupliquées ou nulles sur toutes les lignes. Une réception ne change ni le statut comptable ni les paiements.

Les statuts sont indépendants : commande `draft/sent/confirmed/cancelled`, réception `not_received/partially_received/received`, facturation `not_billed/partially_billed/billed`, facture `draft/posted/cancelled`, paiement `unpaid/partially_paid/paid`. Le retard est calculé séparément.

Créer une facture depuis une commande réserve les quantités reçues encore non facturées, en tenant compte des autres brouillons. Une seconde création sans quantité restante est refusée. Un brouillon ne compte pas comme montant comptabilisé. L'édition ou la comptabilisation sont confirmées par la réponse serveur avant actualisation.

Le rapprochement compare les quantités commandées, reçues et facturées dans ce document, en regroupant les lignes d'une même ligne de commande. Un dépassement affiche **Mismatch** ; une facture partielle reste possible. Ce contrôle informatif n'invente aucune interdiction comptable.

L'aging utilise exclusivement le solde positif des factures comptabilisées. Les tranches sont non échues (aujourd'hui compris), 1–30, 31–60, 61–90 et plus de 90 jours. Une facture partielle contribue uniquement par son restant ; brouillons, annulations et factures payées sont exclus. Les KPI et l'aging portent sur les mêmes résultats filtrés, avant pagination. Le KPI Payé compte les décaissements confirmés du mois de référence.

Le modal partagé Payments est prérempli en **outgoing** sur la facture fournisseur. Zod impose montant positif à deux décimales et inférieur ou égal au solde. Paiement et annulation actualisent factures, vieillissement, commandes, fournisseur et Payments. Aucun historique n'est supprimé. Les soldes ne sont pas changés de façon optimiste avant réponse.

## Permissions et capacités

Les tableaux `permissions` sont renvoyés par le serveur ; aucun rôle administrateur n'accorde implicitement un droit. Les capacités manquantes sont fausses. `suppliers.view`, `purchases.view` et `supplier_invoices.view` protègent les routes ; les permissions des sous-modules contrôlent les onglets, relations et données détaillées. `finance.view` contrôle les agrégats de la liste des factures. `payments.view` contrôle les historiques de règlements. Les mutations exigent les permissions explicitement fournies dans le cahier des charges et leur capacité lorsque nécessaire.

Aucun nom de permission supplémentaire n'a été inventé pour envoi, export, validation ou annulation. `canSend`, `canExport` et `canPost` sont des **autorisations effectives explicites renvoyées par le backend**, incluant ses règles RBAC. En particulier `supplier_invoices.edit` n'accorde jamais `canPost`. Le serveur doit aussi sécuriser les endpoints et expurger les données non autorisées.

L'analyse fournisseur nécessite `ai.use` et l'accès aux données d'achat/facturation utilisées. La section IA de facture nécessite également les droits de lecture des achats pour son rapprochement. FACTS, AI ANALYSIS, RISK et RECOMMENDATION restent séparés. Aucune analyse n'est déclenchée au chargement.

## Contrats Django

Mode explicite : `VITE_PURCHASES_USE_MOCK`, `VITE_SUPPLIER_INVOICES_USE_MOCK`, `VITE_SUPPLIERS_USE_MOCK`, `VITE_PAYMENTS_USE_MOCK`. Les passer à `false` puis redémarrer Vite pour utiliser Django. Garder les modes des modules reliés alignés. Une erreur réseau ne déclenche jamais un fallback mock.

| Fichier API | Endpoints relatifs au client Axios |
| --- | --- |
| `suppliers/api/suppliers.api.ts` | GET `/suppliers/:id/`, `/metrics/`, `/price-history/`; GET `/ai/suppliers/:id/insight/`; PATCH fournisseur existant |
| `purchases/api/purchases.api.ts` | GET/POST `/purchase-orders/`; GET/PATCH `/:id/`; POST `/:id/send/`, `/:id/confirm/`, `/:id/receive/`, `/:id/bill/` |
| `supplier-invoices/api/supplierInvoices.api.ts` | GET/POST `/supplier-invoices/`; GET `/aging/`; GET/PATCH `/:id/`; POST `/:id/post/`, `/:id/payment/` |

Les types de lecture sont les contrats camelCase numériques des fichiers `types/`. Les écritures sont sérialisées en snake_case et excluent totaux calculés, permissions, quantités reçues et statut comptable. Une écriture retourne le détail canonique complet ; `/bill/` retourne la facture créée. Les serializers Django devront convertir leurs décimaux en nombres ou un adaptateur devra être ajouté à cette frontière.

Les collections Achats/Factures de cette version sont **complètes et autorisées**, avec filtres, pagination et agrégats frontend. Lors du passage à DRF paginé, transférer filtres et agrégats ensemble côté serveur. `/aging/` est préparé, mais l'UI calcule les mêmes tranches sur sa collection complète pour rester cohérente avec les filtres.

## Actions actives et limites

Actifs en démonstration : navigation réelle, filtres, CSV, création et modification des brouillons, envoi simulé, confirmation, réception, facturation des quantités disponibles, validation simulée, décaissement, annulation via Payments, aperçus locaux de fichiers et analyses identifiées comme simulées.

En mode API, les actions spécifiées attendent une réponse Django ; aucune persistance locale ne la remplace. L'annulation de commande, la planification d'un paiement et l'upload de documents n'ont pas d'endpoint : aucun appel arbitraire n'est créé. Les fichiers choisis restent locaux, avec URL temporaire libérée à la fermeture de la page. Les documents sans fichier réel ont une prévisualisation désactivée. L'IA fournisseur utilise son endpoint spécifié ; l'IA facture reste indisponible en mode API faute de contrat.

## Vérifications

`tests/purchasing.spec.ts` couvre les montants entre modules, limites d'aging, quantités, doublons de facturation, paiements, annulations, transitions, validation, permissions, erreurs API, navigation, vues, recherche, CSV, prévisualisation locale, IA et largeur desktop.

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e -- tests/purchasing.spec.ts tests/payments-suppliers.spec.ts
```

Pour les tests API, passer les quatre variables des modules à `false` et utiliser un port Vite distinct (`PLAYWRIGHT_PORT`). Les tests Payments vers factures clients exigent aussi `VITE_INVOICES_USE_MOCK=false`. Le chemin d'un navigateur Chromium installé peut être fourni via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
