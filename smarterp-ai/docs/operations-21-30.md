# Stock, dépenses et reporting — pages 21 à 30

Les pages utilisent le shell, Axios, TanStack Query, React Hook Form, Zod, les composants UI et les calculs monétaires existants. Aucun package ajouté.

| Page | Route | Fonctionnement |
| --- | --- | --- |
| 21 | `/products` | Catalogue, recherche et filtres, Liste/Kanban, favoris locaux, sélection, CSV, création, modification et archivage |
| 22 | `/products/:id` | Fiche produit/service, prix et marge, ventes, achats, dépôts, quantités, historique, documents et analyse à la demande |
| 23 | `/inventory` | Valeur du stock, disponibilité, alertes, répartition par dépôt, mouvements récents et stock dormant |
| 24 | `/inventory/movements` | Journal immuable, filtres, détail, CSV et création validée selon la disponibilité |
| 25 | `/warehouses` | Dépôts en cartes/table, capacités, alertes, valorisation et création |
| 26 | `/warehouses/:id` | Inventaire, mouvements, entrées/sorties du mois, transferts, alertes et évolution de valorisation |
| 27 | `/inventory/transfers` | Brouillon, prêt, expédition, réception et annulation permise, avec quantités en transit distinctes |
| 28 | `/expenses` | Dépenses, taxes exactes, Liste/Kanban, détails et justificatifs, création/soumission/approbation |
| 29 | `/finance/cash-flow` | Flux confirmés, soldes ouverts, aging, échéances et scénario de trésorerie distinct de l’historique |
| 30 | `/reports` | Bibliothèque de 12 rapports, filtres, génération de vrais CSV et historique des fichiers produits |

## Fichiers

Nouveaux dossiers : `src/features/products`, `inventory`, `warehouses`, `expenses`, `finance`, `reports`. Chacun contient `pages`, `types`, `api`, `hooks`, `data` et ses composants utiles. Les validations sont regroupées dans les fichiers `schemas` ou `*.utils.ts` associés.

Éléments partagés : `src/components/ui/BusinessPresentation.tsx`, `operations.css`, `src/hooks/useBusinessScope.ts`. Les exports utilisent `src/lib/csv.ts`; les montants utilisent `src/lib/money.ts`. `formatDate` accepte maintenant les dates et les horodatages ISO.

Fichiers existants adaptés : `app/router.tsx`, Sidebar, Topbar, configuration Vite, `.env.example`, invalidations des modules Paiements/Achats/Factures/Ventes/Fournisseurs, aperçu de pièces jointes et documentation. La pièce jointe indique son type, sa taille et sa date lorsqu’ils sont fournis ; un fichier local porte uniquement une date d’ajout local.

## Cohérence des données

Le catalogue et le journal de stock sont communs à toutes les pages. **Disponible = physique − réservé**. Les services ont des quantités et une valorisation `null`, jamais un faux stock à zéro. Le Premium Cable possède 148 unités disponibles au départ. La valorisation correspond au stock physique multiplié par le coût moyen ; prix d’achat et coût moyen restent distincts.

Une sortie protège les réservations. Une expédition de transfert diminue le physique source et augmente le transit destination ; une réception ajoute le physique destination et retire le transit une seule fois. Les transitions revalident les produits/dépôts actifs et les quantités. Les historiques restent conservés. Un transfert terminé ou en transit ne peut pas être annulé avec un simple effacement.

La courbe de valorisation démo des dépôts est reconstituée depuis les mouvements au coût moyen actuel constant. Cette hypothèse apparaît sur la page ; elle ne prétend pas fournir un historique de coûts comptables.

Les dépenses utilisent les mêmes calculs de taxes que les documents commerciaux. Leur approbation ne constitue pas un paiement. La trésorerie combine un solde d’ouverture de démonstration, les paiements confirmés et les dépenses payées distinctes, sans double comptage. Le reste dû et l’aging utilisent les factures comptabilisées et leurs règlements confirmés.

Le scénario de cash suppose un règlement intégral aux échéances, reporte les retards à J+7 et n’ajoute aucune activité future. Il est explicitement à faible confiance, sans probabilité calibrée ni intervalle inventé. Les graphiques distinguent l’observé et le prévisionnel.

Les rapports CSV utilisent les mêmes lignes que les modules sources. Le fichier généré est un instantané ; une modification ultérieure des données ne réécrit pas les anciens rapports. Les formats PDF/Excel non disponibles ne sont pas proposés comme des téléchargements réels.

## APIs et permissions

Les fichiers `api/*.api.ts` contiennent les appels Django et la conversion des payloads. Les pages ne font aucun appel Axios. Principales ressources : `/products/`, `/inventory/summary/`, `/inventory/movements/`, `/inventory/transfers/`, `/warehouses/`, `/expenses/`, `/finance/cash-flow/`, `/reports/catalog/`, `/reports/generate/` et leurs endpoints détaillés fournis dans les missions.

Un PATCH de statut de transfert n’est disponible que si le serveur annonce `supportsStatusPatch`. Les endpoints de rejet/paiement de dépense ou d’upload de justificatif absents du contrat ne sont pas inventés. Le rejet d’une dépense peut désormais être effectué par le centre de validation, via son endpoint dédié, ajouté dans la mission suivante.

Les permissions retournées par chaque ressource contrôlent lecture, onglets, agrégats, exports et mutations. Un rôle Admin n’accorde pas implicitement tous les droits. Les clés de cache incluent utilisateur et société ; les mutations invalident les agrégats liés, les rapports, les prévisions et les demandes de validation concernées.

## Mode démo et limites backend

Flags : `VITE_PRODUCTS_USE_MOCK`, `VITE_INVENTORY_USE_MOCK`, `VITE_WAREHOUSES_USE_MOCK`, `VITE_EXPENSES_USE_MOCK`, `VITE_FINANCE_USE_MOCK`, `VITE_REPORTS_USE_MOCK`. `true` active explicitement les magasins en mémoire des dossiers `data`; `false` utilise exclusivement Django. Une erreur serveur ne bascule jamais vers un mock.

Fonctionnent dans le navigateur : navigation, filtres, pagination, graphiques, formulaires, simulations de statuts/stock et exports CSV. Import massif de produits, stockage des pièces, comptabilité, autorisations définitives, transactions atomiques et prévisions réelles nécessitent Django et les services associés. Aucun solde bancaire n’est connecté.

## Validation

`tests/operations.spec.ts` couvre calculs, conservation des stocks, services, marge, taxes, cash, instantanés de rapport, dix routes à 1440 px, workflows et contrats API. Les suites Achats, Paiements, Factures et Ventes vérifient les liens avec les modules existants. Les tests API utilisent des interceptions réseau Playwright, pas un serveur Django réel.
