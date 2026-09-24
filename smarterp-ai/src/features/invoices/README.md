# Factures clients — pages 12 et 13

La feature réutilise AppShell, les composants UI, Axios, TanStack Query, React Hook Form, Zod et les utilitaires monétaires existants. Aucune dépendance ajoutée.

## Fichiers créés

Les chemins ci-dessous sont relatifs à `src/features/invoices/`.

| Fichier | Responsabilité |
| --- | --- |
| `pages/InvoicesPage.tsx` | Liste, sélection, tri, pagination et confirmations d’envoi/relance |
| `pages/InvoiceDetailPage.tsx` | Consultation, création, édition du brouillon, actions et protection des modifications |
| `components/InvoiceKPIGrid.tsx` | Quatre KPI et composant AgingSummary |
| `components/InvoicesToolbar.tsx` | Recherche, création, export, regroupement, favoris, Liste/Kanban |
| `components/AdvancedFilters.tsx` | Filtres combinés, raccourcis, chips et remise à zéro |
| `components/InvoiceTable.tsx` | Tableau, groupes, sélection et actions par facture |
| `components/InvoiceKanban.tsx` | Classement visuel exclusif des mêmes résultats filtrés |
| `components/InvoiceStatusBadge.tsx` | Badges et barre de workflow comptable |
| `components/InvoiceForm.tsx` | Informations commerciales et lien vers la commande source |
| `components/InvoiceLines.tsx` | Lignes éditables avec useFieldArray et validation |
| `components/InvoiceTotals.tsx` | Totaux, montant payé et solde |
| `components/InvoicePaymentPanel.tsx` | Paiements et dialogue de saisie |
| `components/InvoiceRelatedPanels.tsx` | Smart buttons, documents associés, activités et analyse IA |
| `components/InvoicePreview.tsx` | Aperçu HTML A4, imprimable |
| `hooks/useInvoices.ts` | Chargement de la collection, envoi, relance et invalidations |
| `hooks/useInvoiceDetail.ts` | Détail, sauvegarde, validation, paiement, envoi, relance et analyse |
| `api/invoices.api.ts` | Frontière Django, DTO d’écriture et choix explicite API/démo |
| `data/invoices.mock.ts` | Collection canonique, mutations locales et analyse de démonstration |
| `types/invoices.types.ts` | Contrats, permissions, capacités et statuts indépendants |
| `schemas/invoice.schema.ts` | Validation des factures, lignes, dates et paiements |
| `utils/invoiceCalculations.ts` | Solde, retard, aging, KPI, filtres, regroupement et CSV |
| `invoices.css` | Styles compacts, responsive, dialogues et impression |

Également créés : `src/components/ui/Dialog.tsx`, dialogue natif partagé avec focus et fermeture Échap, et `tests/invoices.spec.ts`.

Fichiers existants modifiés : routeur, Sidebar, Topbar, configuration d’environnement (`env.ts`, `vite-env.d.ts`, `.env.example`), documentation racine, lien de conversion dans `QuoteEditorPage.tsx`, et composants/données Sales pour accéder aux factures et répercuter leurs paiements de démonstration. Les smart buttons Sales utilisent React Router pour préserver l’historique. Une correction de positionnement dans `quotes.css` contient le défilement horizontal du tableau mobile. L’adaptateur Sales traite les capacités absentes comme interdites.

## Liste — `/invoices`

La collection complète autorisée fournit les lignes, le Kanban, les KPI et l’aging. Recherche, statut comptable, paiement, client, commercial, dates, échéances, montants et tranche d’ancienneté se combinent. Les favoris sont des filtres prédéfinis, sans persistance serveur. Les raccourcis comprennent retards et échéances sous sept jours.

Le tableau propose 25, 50 ou 100 factures par page. Le regroupement s’applique à la page courante, explicitement indiqué ; le Kanban montre tous les résultats filtrés. Une facture n’apparaît que dans une colonne. Un paiement partiel en retard est classé « En retard » et conserve son badge « Partiellement payée ». Une colonne « Annulée » conserve également ces résultats lorsqu’ils sont filtrés.

La sélection persiste entre pages et vues ; changer les filtres l’efface. Le CSV exporte les résultats filtrés ou la sélection, avec total, payé, solde, statuts et référence de calcul. Les cellules textuelles neutralisent les préfixes de formules de tableur. Les actions Plus donnent accès aux relations existantes.

Les états chargement, collection vide, aucun résultat, erreur, réactualisation échouée et accès interdit sont distincts. Les chargements utilisent des skeletons dans le shell.

## Détail — `/invoices/:id` et `/invoices/new`

La même page sert à créer un brouillon et à modifier une facture existante. Un identifiant invalide ou une réponse 404 affiche « Facture introuvable ». Sans `invoices.view`, la page reste inaccessible. Le client vient du portefeuille existant ; les relations commande/client ouvrent `/sales/:id` et `/customers/:id`. Paiements, livraisons, avoirs et documents ciblent des sections internes quand aucune route dédiée n’existe.

Seuls les brouillons avec `invoices.edit` et `canEdit` sont modifiables. La création exige `invoices.create`. Les saisies passent par React Hook Form et Zod : client, ligne, montant, dates réelles et échéance au moins égale à la date de facture. Quantités à trois décimales, prix à deux, remise et TVA entre 0 et 100 %. Le changement de page ou le rechargement protège les modifications non enregistrées. Une erreur serveur conserve la saisie.

Les lignes permettent produits/services libres, description, quantité, prix, remise et TVA. L’aperçu utilise les calculs décimaux partagés de `src/lib/money.ts`, avec arrondi en centimes par ligne. Après sauvegarde, la réponse serveur fournit les montants et la référence définitifs ; le frontend ne les substitue pas par ses estimations.

## Règles financières

Le workflow comptable est `draft | posted | cancelled`. Le paiement est séparément `unpaid | partially_paid | paid`. Le retard est calculé et n’est jamais enregistré comme troisième vérité indépendante.

```text
solde = max(0, total TTC − montant payé)
retard = workflow posted ET solde > 0 ET échéance < date de référence
```

Les quatre KPI portent sur les **résultats filtrés avant pagination** : total TTC comptabilisé, payé affecté, solde restant et solde en retard. Brouillons et annulations sont exclus. Une échéance aujourd’hui n’est pas en retard.

L’aging utilise uniquement les soldes positifs des factures comptabilisées : non échues (aujourd’hui inclus), 1–30, 31–60, 61–90, puis plus de 90 jours. Chaque facture appartient à exactement une tranche. Factures payées, brouillons et annulations en sont exclus. La somme des tranches égale le KPI Solde restant. Les différences de dates se calculent en jours UTC pour éviter les effets de changement d’heure.

Le test critique vérifie : TTC 24 600, payé 11 800, solde **12 800 MAD**, paiement partiel et retard simultanés ; contribution de **12 800 MAD uniquement** à une seule tranche.

## Actions et autorisations

Toutes les permissions viennent des données autorisées par Django, sans déduction depuis un rôle administrateur. Les capacités manquantes sont fausses. Le serveur doit contrôler lui-même chaque lecture et mutation et limiter les champs renvoyés.

| Action | Conditions supplémentaires |
| --- | --- |
| Consultation | `invoices.view` |
| KPI / aging globaux | `finance.view` |
| Création | `invoices.create` |
| Édition | Brouillon, `invoices.edit`, `canEdit` |
| Validation | Facture existante, brouillon valide et enregistré, `invoices.post`, `canPost` |
| Envoi | Facture comptabilisée, `invoices.send`, `canSend` |
| Paiement | Comptabilisée, solde positif, `payments.create`, `canPay` |
| Relance | Comptabilisée, solde positif, permission dédiée `invoices.remind`, `canRemind` |
| Analyse | `ai.use` ; service disponible en démonstration uniquement |

**Validation.** Une confirmation explique le passage en comptabilité. Le POST n’est lancé qu’après confirmation, avec verrouillage pendant la requête. La réponse complète actualise détail, liste et aging. Une facture comptabilisée passe en lecture seule.

**Paiement.** Le dialogue contient date, montant, méthode, référence et note. Zod impose `0 < montant <= solde`, avec deux décimales. Aucun montant local n’est ajouté avant succès. Le serveur contrôle les paiements concurrents et renvoie la facture complète, dont les paiements confirmés. Détail, liste, KPI, aging et commandes liées sont alors actualisés.

**Envoi et relance.** Chaque opération exige une confirmation ; aucune relance au chargement. `invoices.send` n’accorde pas `invoices.remind`. La démonstration ne fournit pas de permission de relance : elle reste indisponible. L’API sait l’activer lorsqu’une permission explicite et les capacités correspondantes sont renvoyées. Une relance groupée traite les factures séquentiellement ; après un échec, la reprise ne renvoie pas les factures déjà confirmées. La confirmation individuelle affiche facture, échéance, solde et jours de retard.

**Avoir.** Aucun endpoint n’étant défini, aucun avoir n’est créé. Sans permission dédiée, l’action est masquée ; même autorisée, elle reste désactivée jusqu’au raccordement.

## Aperçu, documents et IA

L’aperçu est un document HTML A4 dans un dialogue, avec identité de la société connectée, client, lignes, taxes, totaux, notes et conditions. Il peut être imprimé par le navigateur. Les informations fiscales d’entreprise absentes ne sont pas inventées. « Télécharger PDF » reste désactivé avec l’explication « Génération PDF disponible après connexion backend ». Aucun faux fichier PDF n’est produit.

L’IA fournit à la demande un exemple explicitement simulé : FACTS, AI ANALYSIS, RISK, FORECAST et RECOMMENDATIONS séparés. Les faits sont calculés à partir de la facture courante. L’analyse ne modifie aucune donnée et n’envoie aucune relance. Une mutation invalide l’analyse précédente. Aucun appel direct React → LLM n’existe ; le futur service passera par Django, sans endpoint arbitraire anticipé.

## Données de démonstration

`VITE_INVOICES_USE_MOCK=true` par défaut. Les **45 factures** de `data/invoices.mock.ts` couvrent tous les statuts et toutes les tranches. La date de référence est le **30 septembre 2026**, explicitement affichée. Liste et détail sont deux projections d’une même collection, isolée par utilisateur et société. Les changements restent en mémoire jusqu’au rechargement.

Les factures déjà présentes dans Customers gardent leurs références et montants. Ainsi `INV-2026-0412` conserve son payé existant de 3 200 MAD ; le cas critique 24 600 − 11 800 = 12 800 est porté par `INV-2026-0413`. À la date de test du 23 septembre, son échéance du 15 septembre donne huit jours de retard ; au 30 septembre, quinze jours.

Les quatre factures issues des commandes réutilisent leurs identifiants, références et paiements. `/sales/1048` relie `/invoices/10480`. Un paiement simulé sur cette facture actualise aussi le solde de la commande. Les agrégats historiques Customers/Dashboard restent leurs instantanés de démonstration indépendants, pas une comptabilité consolidée en direct.

Création, modification, validation et paiement fonctionnent localement avec mentions de simulation. L’envoi ajoute une activité simulée : **aucun email réel**. Rien ne produit d’écriture comptable, de paiement bancaire, de PDF ou de document fiscal réel.

## Raccordement Django REST Framework

Renseigner `VITE_API_BASE_URL`, passer `VITE_INVOICES_USE_MOCK=false`, puis redémarrer Vite. Une erreur API reste une erreur, sans bascule vers les mocks. Authentification et CSRF utilisent le client Axios existant.

| Fonction | Endpoint | Contrat initial |
| --- | --- | --- |
| `getInvoices` | `GET /invoices/` | `InvoicesData` : invoices, permissions, asOf, currentSalesperson |
| `getInvoicesAging` | `GET /invoices/aging/` | Tableau `AgingBucket[]` |
| `getInvoiceById` | `GET /invoices/:id/` | `InvoiceDetail` complet |
| `createInvoice` | `POST /invoices/` | DTO éditable ; détail complet en réponse |
| `updateInvoice` | `PATCH /invoices/:id/` | DTO éditable ; détail complet en réponse |
| `postInvoice` | `POST /invoices/:id/post/` | Détail complet en réponse |
| `sendInvoice` | `POST /invoices/:id/send/` | Détail complet en réponse |
| `recordInvoicePayment` | `POST /invoices/:id/payment/` | date, amount, method, reference, note ; détail complet en réponse |
| `remindInvoice` | `POST /invoices/:id/remind/` | Détail complet en réponse |

`inputDTO()` sérialise les champs éditables et lignes en snake_case, sans totaux calculés, statut comptable ni identifiants locaux de lignes. Le contrat de lecture initial utilise camelCase et des montants numériques, comme Sales. Adapter `fromAPI()` et `getInvoices()` aux serializers définitifs, notamment aux décimaux chaînes DRF. Types exacts dans `types/invoices.types.ts`.

La collection initiale est **complète, non paginée côté serveur** : filtrage, pagination, KPI et aging sont calculés sur le même périmètre frontend. `getInvoicesAging()` prépare l’endpoint demandé, mais la page ne le consulte pas séparément afin de conserver ce périmètre commun. Lors du passage à une pagination DRF, déplacer filtres et agrégats côté serveur ensemble et transmettre les mêmes paramètres à la liste, aux KPI et à l’aging.

La clé de cache inclut utilisateur, société, mode et identifiant. Les mutations stockent le détail canonique reçu, invalident les collections concernées et réinitialisent l’analyse. Les contrôles côté serveur, la persistance, les emails, la comptabilisation réelle, PDF, avoirs et IA restent à fournir par Django.

## Vérification

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e -- tests/invoices.spec.ts

$env:VITE_INVOICES_USE_MOCK = 'false'
$env:PLAYWRIGHT_PORT = '5176'
npm.cmd run test:e2e -- tests/invoices.spec.ts --grep 'Invoices API'
Remove-Item Env:VITE_INVOICES_USE_MOCK, Env:PLAYWRIGHT_PORT
```

Le serveur Vite réutilisé doit être démarré avec les mêmes variables que les tests. Choisir un port distinct pour le mode API, ou redémarrer Vite. Sur Windows, on peut lancer Vite dans un terminal séparé avant Playwright.

Les tests couvrent calculs et frontières d’aging, statuts simultanés, cohérence des fixtures, liste/Kanban, filtres, sélection, pagination, CSV, édition/création, protection des modifications, preview, validation, paiements, autorisations, réponses serveur, erreurs, relance groupée après échec partiel, liens Sales/Customers, analyse et largeur mobile. Les réponses réseau interceptées n’affectent aucune donnée réelle.
