# Fournisseurs — page 15

`/suppliers` est intégré au shell existant sous **Achats → Fournisseurs**. `/suppliers/:id` est un placeholder explicite pour la future fiche complète ; aucun endpoint GET détail supplémentaire n’est inventé.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `pages/SuppliersPage.tsx` | Liste, sélection, mutations, confirmations et placeholder détail |
| `components/SuppliersToolbar.tsx` | Recherche, création, import futur, export, favoris et Liste/Kanban |
| `components/SupplierFilters.tsx` | Filtres combinés, raccourcis et chips |
| `components/SupplierTable.tsx` | Tableau, sélection, groupes, badges et actions partagées |
| `components/SupplierKanban.tsx` | Même page de fournisseurs, regroupée sans drag-and-drop |
| `components/SupplierKPIGrid.tsx` | Cinq indicateurs et SupplierScoreBadge |
| `components/SupplierDialog.tsx` | Petit formulaire de coordonnées, React Hook Form + Zod |
| `types/suppliers.types.ts` | Contrats des fournisseurs, permissions, capacités et requêtes |
| `suppliers.utils.ts` | Filtrage, groupement et calcul du résumé |
| `data/suppliers.mock.ts` | 48 fournisseurs canoniques et mutations locales |
| `api/suppliers.api.ts` | Axios, paramètres et mutations Django |
| `hooks/useSuppliers.ts` | Query, création, modification, archivage et export |

Réutilisation de Button, Badge, Checkbox, Alert, Dialog, fonctions de formatage, ainsi que pagination/styles/CSV partagés avec [Paiements](../payments/README.md). Aucune dépendance ajoutée.

## Liste, filtres et Kanban

Recherche sur nom, référence, contact, email, téléphone et ville, sans distinction de casse ou d’accent en démonstration. Filtres catégorie, pays, risque, statut, acheteur et ville se combinent. Raccourcis : actifs, risque élevé, solde ≥ 50 000 MAD, délai > 30 jours et création dans les 30 derniers jours du périmètre. Favoris locaux : mes fournisseurs, risque élevé, stratégiques, Casablanca et délai élevé.

Tri par nom, achats, solde ou score. Pagination 25/50/100. Liste et Kanban utilisent **exactement la même page de résultats filtrés** ; le libellé l’indique. Les groupes sont acheteur, catégorie, pays, risque ou statut. Le Kanban utilise le risque par défaut et permet les autres groupements sélectionnés. Aucun glisser-déposer ne modifie les données.

La sélection persiste entre pages et vues ; changer de filtre la remet à zéro. L’export porte sur tous les résultats filtrés ou la sélection. L’archivage groupé est proposé seulement si tous les éléments sélectionnés sont autorisés ; après un échec partiel, une reprise ne renvoie que les éléments restants.

Les états chargement, vide, aucun résultat, erreur/actualisation échouée et accès interdit sont traités séparément. Les skeletons restent dans AppShell. La table défile dans son conteneur sur petit écran et les dialogues restent centrés.

## KPI, score et risque

Les KPI proviennent du même ensemble filtré **avant pagination** : nombre de statuts actifs, somme du volume d’achats, somme des soldes, moyenne simple des délais renseignés et nombre de risques élevés. Un délai absent vaut `null`, pas zéro. Les achats/soldes historiques des fournisseurs archivés restent visibles lorsqu’ils font partie des résultats.

Le score de performance est compris entre 0 et 100 : ≥ 90 Excellent, ≥ 75 Bon, ≥ 60 À surveiller, sinon Fragile. Une valeur `null` affiche « Non évalué ». Sa provenance `scoreSource` est visible au survol et dans Plus. Les fixtures indiquent **Données statiques de démonstration**, sans présenter ce score comme un résultat IA.

Le risque Faible/Moyen/Élevé reste indépendant du score. Les données incluent volontairement de bons scores avec un risque élevé. Un nouveau fournisseur démo n’a ni achats, solde, délai ni score ; son risque initial est la valeur de démonstration par défaut Faible, à remplacer par la règle de création Django.

## Actions et RBAC

- `suppliers.view` : page accessible, sinon « Accès non autorisé ».
- `suppliers.create` : petit formulaire Créer un fournisseur.
- `suppliers.edit` + `canEdit` : modifier les coordonnées ; + `canArchive` : archiver.
- `suppliers.export` : export CSV filtré ou sélectionné.

Les actions interdites sont masquées. Les capacités manquantes valent false. Django contrôle les permissions et le périmètre réellement renvoyé ; aucune autorisation n’est déduite du rôle utilisateur.

Le formulaire couvre nom, catégorie, contact, email, téléphone, ville, pays et acheteur. Les montants, le score et le risque ne sont pas éditables ici. Une erreur conserve la saisie. L’archivage exige une confirmation et conserve l’historique ; il utilise uniquement **PATCH `/suppliers/:id/` avec `{ status: 'archived' }`**, lorsque le serveur annonce `canArchive`. Aucun endpoint `/archive/` n’est inventé.

Importer CSV/Excel est un contrôle désactivé avec une explication : aucun fichier n’est téléversé et aucune donnée n’est prétendument importée. La fiche complète et le moteur d’import restent hors périmètre.

## Démonstration

`VITE_SUPPLIERS_USE_MOCK=true`, date de référence **30 septembre 2026**. Les 48 enregistrements de `data/suppliers.mock.ts` couvrent plusieurs catégories, pays, acheteurs, risques et statuts. Les quatre fournisseurs de référence conservent les valeurs demandées, dont Atlas Packaging : achats 684 200 MAD, solde 48 600 MAD, délai 18 jours, score 91.

Création, modification et archivage sont explicitement simulés en mémoire, isolés par utilisateur/société et perdus au rechargement. Les décaissements confirmés de la feature Paiements mettent à jour ce même solde fournisseur ; une annulation le rétablit. Aucune persistance comptable ni opération bancaire réelle n’est exécutée.

## API Django

Passer `VITE_SUPPLIERS_USE_MOCK=false`, définir `VITE_API_BASE_URL`, puis redémarrer Vite. Les erreurs API restent des erreurs, sans repli vers les mocks.

| Fonction | Endpoint | Contrat |
| --- | --- | --- |
| `getSuppliers` | `GET /suppliers/` | `SuppliersData` paginé |
| `createSupplier` | `POST /suppliers/` | Coordonnées éditables → `Supplier` canonique |
| `updateSupplier` | `PATCH /suppliers/:id/` | Coordonnées ou `{ status: 'archived' }` → `Supplier` canonique |

Le contrat de lecture initial utilise camelCase et des montants numériques ; adapter la frontière API aux serializers définitifs DRF. `SuppliersData` contient fournisseurs de la page, `count` filtré, `totalCount` sans filtre, `summary` calculé avant pagination, permissions, `asOf`, `currentBuyer` et `facets` (catégories, pays, acheteurs autorisés).

Paramètres : `search`, `category`, `country`, `risk`, `status`, `buyer`, `city`, `quick`, `strategic`, `page`, `page_size`, `sort`. Les mutations invalident Fournisseurs et les options de Paiements. Le cache est isolé par utilisateur, société et mode.

L’export demande l’ensemble filtré et refuse un résultat partiel si le serveur impose une taille inférieure ; dans ce cas, définir ultérieurement un endpoint d’export adapté. CSV local avec protection des cellules de texte.

## Vérifications des deux pages

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e -- tests/payments-suppliers.spec.ts --grep-invert ' API'

# Utiliser un serveur Vite distinct pour le mode API.
$env:VITE_PAYMENTS_USE_MOCK = 'false'
$env:VITE_SUPPLIERS_USE_MOCK = 'false'
$env:VITE_INVOICES_USE_MOCK = 'false'
$env:PLAYWRIGHT_PORT = '5181'
npm.cmd run test:e2e -- tests/payments-suppliers.spec.ts --grep ' API'
Remove-Item Env:VITE_PAYMENTS_USE_MOCK, Env:VITE_SUPPLIERS_USE_MOCK, Env:VITE_INVOICES_USE_MOCK, Env:PLAYWRIGHT_PORT
```

Le serveur Vite réutilisé doit avoir les mêmes variables d’environnement que les tests. Les tests interceptent leurs propres réponses API, sans affecter de données réelles. Ils couvrent calculs, validation des limites, cohérence entre modules, filtres, pagination, sélection, export, Liste/Kanban, création, édition, annulation, archivage, permissions, capacités absentes, erreurs serveur, reprise et contrôles visuels desktop/mobile.
