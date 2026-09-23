# Devis — `/quotes`

Cette feature réutilise AppShell, Sidebar, Topbar, les composants UI, les fonctions de formatage, Axios et TanStack Query. Aucun package ajouté.

## Lire le code

- `pages/QuotesPage.tsx` : composition, recherche, filtres, vue, tri, sélection, pagination et orchestration des actions.
- `components/QuotesToolbar.tsx`, `QuotesFilters.tsx`, `QuotesKPIGrid.tsx` : commandes, filtres/favoris et indicateurs.
- `components/QuotesTable.tsx`, `QuotesKanban.tsx` : deux présentations de la même collection.
- `components/QuoteStatusBadge.tsx`, `QuoteActions.tsx`, `QuoteSendDialog.tsx` : statuts, règles d’actions partagées et confirmation accessible.
- `quotes.utils.ts` : filtrage, tri, échéances, sommes et CSV UTF-8 avec BOM, échappement des guillemets et neutralisation des formules.
- `hooks/useQuotes.ts` : requête et mutations TanStack Query, cache par utilisateur/société/mode et actualisation après chaque action.
- `api/quotes.api.ts` : endpoints et adaptation du contrat Django.
- `data/quotes.mock.ts` : toutes les données et mutations simulées.
- `types/quotes.types.ts` : types métier et permissions.
- `quotes.css` : styles du module, sans modifier le shell partagé.
- `pages/QuoteEditorPage.tsx` : création `/quotes/new`, édition et consultation `/quotes/:id`.
- `hooks/useQuoteEditor.ts` : détail, sauvegarde, envoi, acceptation, duplication et conversion.
- `schemas/quote.schema.ts` : validation RHF/Zod et valeurs initiales.
- `components/QuoteEditorHeader.tsx`, `QuoteGeneralInformation.tsx`, `CustomerSelector.tsx`, `LineItemsEditor.tsx`, `TotalsPanel.tsx`, `WorkflowStatusBar.tsx`, `QuoteTabs.tsx`, `PdfPreviewDrawer.tsx` : interface de l’éditeur.
- `src/lib/money.ts` : calculs en centimes partagés avec les commandes ; `utils/quoteCalculations.ts` conserve les noms propres au devis.

## Données et comportement

Le mode démo est explicite : `VITE_QUOTES_USE_MOCK=true` (valeur par défaut, comme les autres modules). L’instantané contient **80 devis**, dont **68 en septembre 2026**, et utilise le **23 septembre 2026** comme date de référence. Les mutations sont conservées en mémoire, séparées par utilisateur et société, jusqu’au rechargement de l’application. Elles ne modifient pas les fixtures originales.

`useQuotes` fournit une seule collection. La page applique les filtres, puis le tri. Les cinq KPI et le Kanban utilisent tous les résultats filtrés ; le tableau en présente une page de 25, 50 ou 100 éléments. Les totaux du Kanban portent donc sur tous les résultats, sans glisser-déposer. Le regroupement du tableau porte sur la page courante et l’indique dans chaque en-tête de groupe.

La recherche ignore la casse et les accents et compare référence, client et commercial. Les filtres se combinent : statut, client, commercial, période, expiration et relance. Changer un filtre remet la pagination à 1 et vide la sélection. Les favoris sont des filtres prédéfinis ; ils conservent la période choisie. La sélection reste disponible entre pages et entre Liste/Kanban.

**Conversion = nombre de devis acceptés / nombre de devis hors Brouillon**, parmi les résultats filtrés. Une liste sans devis hors Brouillon affiche 0 %. Les échéances utilisent `asOf`, fourni par le mock ou l’API : aujourd’hui à J+7 inclus, pour les statuts encore envoyables. « À relancer » désigne les devis Envoyés ou Vus encore valides.

L’envoi exige une confirmation. En démo, seul Brouillon passe à Envoyé ; un renvoi conserve Envoyé ou Vu. Aucun e-mail n’est envoyé. Accepté, Refusé, Expiré ou une échéance passée ne permettent pas l’envoi. La duplication crée un nouvel identifiant, une référence unique et un Brouillon, sans modifier l’original. Elle remet les filtres et le tri par date pour montrer les nouvelles copies.

Les actions groupées utilisent les endpoints individuels séquentiellement. Après un échec partiel, les devis déjà traités ne sont pas inclus dans la nouvelle tentative ; un message précise le nombre de succès. Exporter dans la toolbar exporte tous les résultats filtrés ; Exporter CSV dans la barre contextuelle exporte la sélection.

## Brancher Django REST Framework

1. Définir `VITE_QUOTES_USE_MOCK=false` et `VITE_API_BASE_URL` dans `.env`, puis redémarrer Vite.
2. Adapter au besoin `QuoteDTO`, `QuotesResponse` et `fromDTO` dans `api/quotes.api.ts`. Aucun composant ne lit du snake_case.
3. Fournir les endpoints ci-dessous, l’authentification et les permissions côté Django. Le client Axios existant gère credentials et CSRF.

| Fonction | Endpoint |
| --- | --- |
| `getQuotes(scope, params, signal)` | `GET /quotes/` |
| `getQuoteById(scope, id)` | `GET /quotes/:id/` |
| `createQuote(scope, input)` | `POST /quotes/` |
| `updateQuote(scope, id, input)` | `PATCH /quotes/:id/` |
| `sendQuote(scope, id)` | `POST /quotes/:id/send/` |
| `duplicateQuote(scope, id)` | `POST /quotes/:id/duplicate/` |
| `acceptQuote(scope, id)` | `POST /quotes/:id/accept/` — contrat proposé à confirmer |
| `convertQuote(scope, id, target)` | `POST /quotes/:id/convert/` avec `target: sales_order` ou `invoice` |

Les POST d’envoi et de duplication attendent le devis résultant. Exemple de GET :

```json
{
  "results": [{
    "id": 1,
    "reference": "QT-2026-0001",
    "customer_id": 124,
    "customer_name": "Nova Retail SARL",
    "customer_email": "contact@example.com",
    "salesperson": "Sara El Mansouri",
    "created_at": "2026-09-22",
    "expires_at": "2026-10-22",
    "total_amount": "12345.00",
    "status": "draft"
  }],
  "next": null,
  "as_of": "2026-09-23",
  "current_salesperson": "Sara El Mansouri",
  "permissions": ["quotes.view", "quotes.create", "quotes.send", "quotes.export"]
}
```

Les pages DRF `next` sont lues avant de présenter la collection, afin que les KPI et le filtrage local soient complets. Les liens doivent rester sur le même endpoint et la même origine. Pour les gros volumes, déplacer ensuite filtres, pagination et agrégats vers Django : `QuotesParams` prépare recherche, statut, client, commercial, dates et pagination. Il faudra alors exposer les KPI serveur avant de ne charger qu’une page. Une requête API en erreur ne retourne jamais silencieusement des mocks.

Les permissions conditionnent les actions et la consultation. Dupliquer utilise `quotes.create`. La sécurité réelle, les règles de transition, la validation des montants et l’isolation des sociétés restent côté Django.

## Fonctionnel maintenant / à venir

Fonctionnent : recherche, filtres, favoris, regroupement, tri, sélection, pagination, Liste/Kanban, KPI, CSV, création, édition des brouillons, duplication, simulation d’envoi, aperçu HTML imprimable. En mode API, les mutations appellent les endpoints prévus.

À connecter : génération PDF, envoi réel, acceptation et conversion par Django. L’acceptation et les conversions restent désactivées en démo. Une conversion serveur vers une commande affiche le lien `/sales/:id`. Aucun e-mail ni PDF n’est généré par le mock.

## Fonctionnement de l’éditeur

Le paramètre `id` est validé avant le chargement. Sans identifiant, la page crée un nouveau brouillon. Le client vient de la feature Clients ; le catalogue de démonstration est centralisé dans les données Devis. Un produit remplit sa description, son prix et son propre taux de TVA. Les lignes libres, les quantités fractionnaires et plusieurs taux de TVA sont acceptés.

Les montants sont arrondis au centime par ligne : brut = quantité × prix, remise = brut × taux, HT = brut − remise, TVA = HT × taux, TTC = HT + TVA. Le calcul utilise des entiers et BigInt pour éviter les écarts de flottants. Quantité : trois décimales ; prix, remise et TVA : deux. Django recalcule et valide les montants définitifs.

RHF/Zod vérifie le client, les dates, le commercial et les lignes. Les erreurs serveur conservent la saisie. Seuls les brouillons avec `quotes.edit` sont modifiables ; la création exige `quotes.create`. Les actions commerciales attendent une sauvegarde. Une confirmation protège la navigation interne avec modifications non enregistrées ; le navigateur protège aussi le rechargement. Les actions en cours empêchent les doubles soumissions.

L’aperçu HTML utilise la saisie courante et les informations société/client. Il exclut les notes internes. Le bouton Imprimer utilise la fenêtre d’impression du navigateur. Le bouton Télécharger PDF reste désactivé : aucun fichier HTML renommé en PDF.

La réponse détail reprend les champs de liste et ajoute `issue_date`, `currency`, `billing_address`, `payment_terms`, `customer_reference`, `subject`, `delivery_terms`, `commercial_terms`, `internal_notes`, `customer_notes`, `lines`, `activities`, `products`, `permissions`, `as_of`, `can_accept`, `conversion_targets` et `converted_to`. Les lignes API utilisent `product_id`, `description`, `quantity`, `unit_price`, `discount_rate`, `tax_rate` ; les décimaux peuvent être des chaînes. Catalogue `products` et activités suivent les types du frontend dans ce contrat initial. `converted_to` vaut null ou `{ target, id, reference }`.

POST/PATCH envoient les valeurs éditables en snake_case, sans total calculé, statut ni identifiant local de ligne. Ils attendent un détail complet. L’acceptation attend un détail complet ; la conversion attend `{ target, id, reference }`. Les permissions supplémentaires sont `quotes.edit`, `quotes.accept` et `quotes.convert`. Les capacités `can_accept` et `conversion_targets` complètent les permissions et le statut. Adapter ces contrats dans `quotes.api.ts` au serializer Django final.

## Vérifications

Depuis `smarterp-ai/` :

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e -- tests/quotes.spec.ts
```

Pour vérifier les réponses API interceptées dans les tests (sans backend réel), utiliser un port distinct du serveur démo :

```powershell
$env:VITE_QUOTES_USE_MOCK = 'false'
$env:PLAYWRIGHT_PORT = '5174'
npm.cmd run test:e2e -- tests/quotes.spec.ts --grep 'Devis API'
Remove-Item Env:VITE_QUOTES_USE_MOCK, Env:PLAYWRIGHT_PORT
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet de réutiliser un Chromium installé. Les captures desktop/mobile sont produites dans `test-results/`.
