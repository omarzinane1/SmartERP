# SmartERP AI

Frontend React + TypeScript + Vite, préparé pour **Django + Django REST Framework**. Les pages de connexion, d’onboarding société, de tableau de bord exécutif et d’AI Control Center sont développées.

## Installation

```bash
npm install
cp .env.example .env
npm run dev
```

Sous PowerShell, utiliser `Copy-Item .env.example .env`. Si l’exécution des scripts PowerShell est bloquée, utiliser `npm.cmd` et `npx.cmd`.

Ouvrir **http://localhost:5173/login**. Sans backend lancé, un envoi valide affiche une erreur réseau : aucune connexion simulée n’est activée dans l’application.

## Variables d’environnement

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api
VITE_DASHBOARD_USE_MOCK=true
VITE_AI_CONTROL_CENTER_USE_MOCK=true
```

Modifier cette variable dans `.env`, puis redémarrer Vite. Elle désigne la racine de l’API, sans le suffixe `/auth/login/`. Elle est lue dans `src/config/env.ts` puis utilisée uniquement par le client `src/lib/axios.ts`. Les variables préfixées `VITE_` sont publiques : ne jamais y mettre de secret.

## Architecture

```text
src/
  app/                       Router, providers, client TanStack Query
  components/
    ui/                      Button, Input, Checkbox, Spinner, Alert, Badge
    layout/                  AppShell, Sidebar, Topbar, logo partagé et placeholder
  config/                    Configuration d’environnement
  features/auth/
    api/                     Appel login, adaptation de réponse, erreurs
    components/              Formulaire, mot de passe, branding, garde
    hooks/                   Mutation de connexion, e-mail mémorisé
    pages/                   Composition de LoginPage
    schemas/                 Validation du formulaire avec Zod
    types/                   Contrats d’authentification
  features/onboarding/       Configuration de la société en sept étapes
  features/dashboard/        Vue exécutive, graphiques, API et données temporaires
  features/ai-control-center/ Surveillance, alertes, prévisions et recommandations
  lib/                       Axios centralisé et utilitaire cn()
  store/                     État global Zustand, conservé en mémoire
tests/                       Tests navigateur, réponses isolées de la production
```

Les prochaines fonctionnalités pourront avoir leur propre dossier sous `features/` et réutiliser les composants UI. `App.tsx` compose les providers et le routeur ; aucun appel API n’est placé dans un composant visuel. TypeScript strict est activé.

Stack : React, React Router DOM, Tailwind CSS via le plugin Vite, Axios, TanStack Query, Zustand, React Hook Form, Zod, `@hookform/resolvers`, Recharts, Lucide React, Sonner, clsx et tailwind-merge.

## Routes

| Route | État |
| --- | --- |
| `/login` | Page de connexion |
| `/onboarding` | Configuration de la société en 7 étapes |
| `/dashboard` | Tableau de bord exécutif dans AppShell |
| `/ai/control-center` | Centre de surveillance et d’intelligence dans AppShell |

La racine et les URLs inconnues renvoient vers `/login`. L’onboarding et les pages internes requièrent un état d’authentification en mémoire. Cette garde facilite la navigation ; les permissions et la protection des données restent à la charge de Django.

## Onboarding société

```text
Login → /onboarding → Société → Activité → Finance → Stock
                   → Facturation → Modules → Vérification → /dashboard
```

Le dossier `src/features/onboarding/` suit la même organisation simple que l’authentification :

| Fichier | Responsabilité |
| --- | --- |
| `pages/OnboardingPage.tsx` | Mise en page, formulaire unique, `currentStep` et navigation |
| `components/OnboardingStepper.tsx` | Les 7 étapes, étape active bleue et étapes validées vertes |
| `components/CompanyStep.tsx` | Identité, logo et coordonnées |
| `components/BusinessStep.tsx` | Secteur, type d’activité et effectif |
| `components/FinanceStep.tsx` | Devise, fiscalité, dates et paiement |
| `components/InventoryStep.tsx` | Activation du stock et paramètres du dépôt |
| `components/InvoicingStep.tsx` | Préfixes, numéros, aperçus et mentions |
| `components/ModulesStep.tsx` | Les 16 modules activables |
| `components/ReviewStep.tsx` | Récapitulatif et boutons Modifier |
| `schemas/onboarding.schema.ts` | Validations Zod, sections à valider et valeurs initiales |
| `types/onboarding.types.ts` | Interface `OnboardingData`, noms des étapes et des modules |
| `api/onboarding.api.ts` | Transformation du payload et `saveOnboarding()` |
| `hooks/useOnboarding.ts` | Mutation TanStack Query, erreur lisible, notification et redirection |

**Navigation.** `currentStep` contient un nombre de 1 à 7. « Enregistrer et continuer » valide la section visible avec React Hook Form et Zod avant d’incrémenter ce nombre. Les liens latéraux vérifient aussi les sections précédentes : ils ne permettent pas de contourner les champs obligatoires. « Retour » et « Modifier » conservent les valeurs grâce à un seul `FormProvider`. La validation finale porte sur l’ensemble du formulaire.

**Sauvegarde.** Les valeurs sont conservées uniquement en mémoire pendant ce parcours. Les étapes intermédiaires ne font pas de requête API et un rechargement les efface. L’interface indique « Brouillon en mémoire · Envoi à la dernière étape ». Il n’y a pas d’autosave ni de faux backend. Sans Django, l’envoi final affiche une erreur et permet de réessayer ; aucun succès n’est simulé dans l’application.

**Stock et modules.** Désactiver le stock masque ses paramètres, retire Stock et Dépôts de la sélection et envoie seulement `{ "enabled": false }` pour le stock. Les valeurs du dépôt restent en mémoire si l’on réactive l’option. Au moins un module doit être sélectionné.

**Connexion Django.** L’endpoint est défini dans `src/features/onboarding/api/onboarding.api.ts` :

```http
POST /company/onboarding/
```

Le client Axios partagé ajoute la base `VITE_API_BASE_URL`, soit `http://localhost:8000/api/company/onboarding/` par défaut. Modifier le chemin dans `saveOnboarding()` et le format dans `toOnboardingPayload()` lorsque le contrat Django sera finalisé. Le payload contient `company`, `business`, `finance`, `inventory`, `invoicing` et `modules`, avec des propriétés en `snake_case`. Le logo facultatif est envoyé sous forme de data URL PNG/JPEG/WebP (fichier limité à 2 Mo), ou `null` ; ce format pourra être adapté à un upload multipart côté Django.

Une réponse HTTP 2xx confirme la sauvegarde ; aucun contenu de réponse n’est exigé à ce stade. `useOnboarding` affiche « Votre société est prête. » / « Enregistré », actualise la société en mémoire si elle existe déjà, puis appelle `navigate('/dashboard', { replace: true })`. Le toast reste visible après la navigation vers le tableau de bord exécutif.

## Tableau de bord exécutif

```text
React Router → RequireAuth → AppShell → Outlet → DashboardPage
                                                   ↓
                                             useDashboard
                                                   ↓
                                             dashboard.api
                                               ↙       ↘
                                      dashboard.mock   Axios → Django
```

`AppShell.tsx` compose la sidebar, la topbar et un `Outlet`. React Router remplace cet `Outlet` par la page interne active. Login et Onboarding restent à l’extérieur de ce shell. La sidebar contient les groupes de navigation repliables ; Tableau de bord et AI Control Center sont navigables. Les autres entrées sont marquées « À venir ».

### Fichiers du dashboard

| Fichier | Responsabilité |
| --- | --- |
| `components/layout/AppShell.tsx` | Structure commune et ouverture du menu mobile |
| `components/layout/Sidebar.tsx` | Navigation ERP et groupes repliables |
| `components/layout/Topbar.tsx` | Fil d’Ariane, recherche, Ctrl+K et profil connecté |
| `features/dashboard/pages/DashboardPage.tsx` | Assemble les sections, gère chargement/erreur et export CSV |
| `components/KpiCard.tsx`, `components/KpiGrid.tsx` | Une carte réutilisable et la grille des huit indicateurs |
| `components/ExecutiveSummary.tsx` | Score de santé, analyse, risques, opportunités et recommandations |
| `components/RevenueChart.tsx` | Comparaison sur douze mois et revenus vs dépenses |
| `components/CashFlowChart.tsx` | Trésorerie réelle/prévisionnelle et créances par ancienneté |
| `components/InventoryHealth.tsx` | Valeur et répartition de l’état du stock |
| `components/AttentionList.tsx` | Alertes et filtre de criticité |
| `components/DashboardTables.tsx` | Clients, produits, factures et actions rapides |
| `data/dashboard.mock.ts` | Toutes les données métier de démonstration |
| `types/dashboard.types.ts` | Contrat TypeScript `DashboardData` et interfaces simples |
| `api/dashboard.api.ts` | `getDashboard()` et constante de l’endpoint |
| `hooks/useDashboard.ts` | `useQuery`, cache par utilisateur/société et choix explicite du mode démo |
| `lib/format.ts` | Formatage partagé des montants, nombres, pourcentages et dates |
| `components/ui/Badge.tsx` | Badges réutilisables pour les statuts |

Dans ce tableau, les chemins `components/`, `api/`, `hooks/`, `data/` et `types/` sans autre préfixe appartiennent à `src/features/dashboard/`. Les chemins `components/layout`, `components/ui` et `lib` sont partagés sous `src/`.

### Mode démonstration

Par défaut, `VITE_DASHBOARD_USE_MOCK=true`. Les chiffres fournis dans la référence sont regroupés dans `dashboard.mock.ts`, pour un exemple daté de septembre 2026. La page indique clairement « Données de démonstration ». Ce mode concerne uniquement le dashboard : il ne simule ni une connexion ni l’enregistrement de l’onboarding. La garde d’authentification existante reste active.

Les onglets du graphique changent réellement la série affichée (CA, commandes, marge), le filtre d’alertes fonctionne et l’export CSV télécharge les huit indicateurs avec leur période et leur source. Ctrl+K place le focus dans la recherche. La recherche, les filtres de période/dépôt du Dashboard et les créations métier sont encore des interfaces préparatoires ; les actions non développées l’indiquent sans créer de données. Les liens IA ouvrent l’AI Control Center.

Les chiffres constatés, l’analyse IA, les prévisions et les recommandations portent des libellés distincts. La courbe de trésorerie utilise un trait plein pour l’historique et des pointillés pour la prévision. Le résumé de démonstration n’est pas généré par une IA en direct.

### Connecter Django

1. Définir `VITE_API_BASE_URL` dans `.env`.
2. Passer `VITE_DASHBOARD_USE_MOCK=false`, puis redémarrer Vite.
3. Adapter `DASHBOARD_ENDPOINT` dans `features/dashboard/api/dashboard.api.ts` si nécessaire. Sa valeur initiale est `/dashboard/summary/`, donc `GET http://localhost:8000/api/dashboard/summary/` par défaut.
4. Renvoyer un JSON conforme à `DashboardData` ou adapter la réponse dans `getDashboard()` si Django utilise d’autres noms, par exemple `snake_case`. Aucun changement n’est nécessaire dans les cartes ou graphiques.
5. Appliquer les permissions et limiter les données retournées côté Django selon le rôle. Aucun système RBAC frontend supplémentaire n’est introduit ici.

En mode API, une erreur affiche « Impossible de charger le tableau de bord. » et « Réessayer ». Elle ne déclenche jamais un retour silencieux aux données fictives. Les détails techniques restent hors de l’interface. `AppShell`, Sidebar, Topbar, les composants UI et les fonctions de formatage pourront servir aux prochaines pages.

## AI Control Center

La page réutilise `AppShell`, `Sidebar`, `Topbar`, `Button`, `Badge`, `Input`, `Alert`, `Spinner` et le client Axios existants. Aucune dépendance supplémentaire n’est installée.

`src/features/ai-control-center/pages/AIControlCenterPage.tsx` compose les sections : santé globale et six départements, statistiques, synthèse IA, tableau et détail d’alerte, matrice de risques, quatre prévisions, opportunités, recommandations et historique des anomalies. Chaque section possède son composant dans `components/`. Les styles sont isolés dans `ai-control-center.css`.

La sélection tient dans `selectedAlertId`. L’alerte de marge est sélectionnée au départ. Cliquer sur une ligne ou un point de la matrice affiche ses faits, son analyse, ses estimations, ses recommandations et ses preuves. Le panneau est à droite sur desktop et plein écran sous 1024 px ; il se ferme avec sa croix ou Échap. Sur mobile, le focus reste dans le panneau et revient à son point de départ à la fermeture.

Les filtres recherche, département, sévérité, statut, type et période se combinent côté frontend. Ils concernent le flux d’alertes ; les cartes globales conservent leur période d’analyse. Le regroupement par département et le tri par date sont disponibles. Une vue peut être enregistrée pour la session. L’export CSV reprend les alertes filtrées avec leur source.

Toutes les données de démonstration se trouvent dans `data/aiControlCenter.mock.ts`. Les faits simulés sont explicitement identifiés. `FACT`, `AI ANALYSIS`, `FORECAST / ESTIMATE` et `RECOMMENDATION` distinguent observations et hypothèses. Les compteurs globaux couvrent le portefeuille ; le tableau montre six alertes prioritaires.

Assigner ou résoudre une alerte modifie uniquement l’état de la page en mode démo. Les recommandations ouvrent une proposition détaillée. « Enregistrer le brouillon » conserve cette proposition pendant la session ; aucune commande, relance, règle ou opération ERP n’est exécutée. Les actions sensibles portent `Approval Required`. Ces états locaux sont réinitialisés en quittant la page. En mode API, les mutations sont désactivées tant que leurs endpoints ne sont pas définis.

Pour connecter Django :

1. Implémenter `GET /api/ai/control-center/` avec le contrat `AIControlCenterData` dans `types/aiControlCenter.types.ts`.
2. Définir `VITE_AI_CONTROL_CENTER_USE_MOCK=false` et `VITE_API_BASE_URL` dans `.env`, puis redémarrer Vite.
3. Si nécessaire, adapter la réponse dans `api/aiControlCenter.api.ts`. `getAIControlCenter()` appelle déjà le client Axios partagé, via le hook TanStack Query `useAIControlCenter()` ; le cache inclut l’utilisateur et la société.
4. Définir séparément les endpoints d’assignation, résolution et brouillon, ainsi que la validation côté serveur, avant d’activer les actions réelles.

Une erreur API affiche un message lisible et un bouton Réessayer, sans retour silencieux aux mocks. L’actualisation recharge l’instantané ; elle ne prétend pas exécuter un modèle local dans le navigateur.

`tests/ai-control-center.spec.ts` couvre les sections, filtres combinés, export, sélection, preuves, assignation, résolution, brouillons, navigation, mobile et états API. Pour ces derniers, arrêter le serveur Vite de test précédent puis lancer :

```powershell
$env:VITE_AI_CONTROL_CENTER_USE_MOCK = 'false'
npm.cmd run test:e2e -- tests/ai-control-center.spec.ts --grep 'AI Control Center API'
Remove-Item Env:VITE_AI_CONTROL_CENTER_USE_MOCK
```

## Authentification

```text
LoginForm → useLogin → auth.api → client Axios → Django REST API
                           ↓
                Zustand + notification + redirection
```

- Validation en français avec React Hook Form et Zod.
- Affichage/masquage du mot de passe, focus visible et erreurs associées aux champs.
- Champs et bouton désactivés pendant la requête ; verrou supplémentaire contre les doubles soumissions.
- Les erreurs serveur restent dans le formulaire. Aucun détail technique Axios n’est présenté.
- Une réponse valide remplit `user`, `company` et `isAuthenticated`. Le store expose `setAuth()` et `clearAuth()`.
- Société absente ou onboarding incomplet : `/onboarding`. Sinon : `/dashboard`.
- « Se souvenir de moi » conserve uniquement l’e-mail dans `localStorage`, après une connexion réussie. Décocher efface cet e-mail. Cette option ne prolonge pas la session ; sa durée devra être définie par Django.
- « Mot de passe oublié ? » invite à contacter l’administrateur. Aucune inscription publique ni page de récupération n’est créée.

## Backend attendu

**Django + Django REST Framework**, avec l’endpoint :

```http
POST /api/auth/login/
Content-Type: application/json
```

Payload exact :

```json
{
  "email": "admin@company.com",
  "password": "password"
}
```

Réponse attendue (HTTP 200) :

```json
{
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@company.com",
    "role": "admin"
  },
  "company": {
    "id": 1,
    "name": "Company",
    "onboarding_completed": true
  }
}
```

`company` peut être `null`. Le schéma de réponse dans `features/auth/api/auth.api.ts` valide les données et transforme `onboarding_completed` en `onboardingCompleted` pour l’interface. Adapter ce seul point lorsque le contrat Django sera finalisé.

| Réponse | Message affiché |
| --- | --- |
| 401 | Adresse e-mail ou mot de passe incorrect. |
| 403 | Votre compte n’est pas autorisé à accéder à SmartERP AI. |
| `code: "account_disabled"` ou `"disabled_account"` | Votre compte a été désactivé. Contactez votre administrateur. |
| Réseau / délai dépassé | Impossible de contacter le serveur. Vérifiez votre connexion. |
| Autre erreur / réponse invalide | Une erreur est survenue. Veuillez réessayer. |

Le code de désactivation est prioritaire sur le statut HTTP. Le client attend au maximum 15 secondes et ne réessaie pas automatiquement une connexion.

### Session et connexion Django à finaliser

Le client active `withCredentials: true`. Aucun token, mot de passe ou objet Axios contenant des identifiants n’est persisté. Le store reste en mémoire : un rechargement de page nécessite actuellement une nouvelle connexion.

Pour la future session Django :

1. Définir l’authentification retenue (session par cookie HttpOnly ou stratégie JWT centralisée) et la politique d’expiration côté serveur.
2. Configurer les origines frontend autorisées, CORS avec credentials si les origines diffèrent, CSRF et les attributs des cookies adaptés au déploiement.
3. Initialiser le cookie CSRF avant le premier POST, selon le contrat backend. Axios lit `csrftoken` et envoie `X-CSRFToken` uniquement à l’origine de l’API configurée. Aucun endpoint d’initialisation n’est inventé ici. Si ce cookie n’est pas lisible depuis le frontend, prévoir une réponse dédiée donnant le jeton CSRF.
4. Prévoir la restauration de session (par exemple un endpoint utilisateur courant), la déconnexion serveur et, si nécessaire, le renouvellement des tokens.
5. Appliquer les permissions Django à chaque endpoint protégé.

En développement, garder le même nom d’hôte des deux côtés (par exemple `localhost:5173` et `localhost:8000`) facilite le partage du cookie CSRF. `clearAuth()` efface uniquement l’état local ; il ne révoque pas une session serveur.

## Design

Composition desktop en deux colonnes, panneau navy et formulaire blanc, déclinaison sur une seule colonne en petit écran. L’illustration ERP est composée de vrais éléments HTML/React ; ses chiffres sont strictement décoratifs et ne sont utilisés dans aucun état métier.

L’onboarding reprend la référence Stitch : fond gris clair, navigation latérale, carte principale blanche, champs compacts en deux colonnes, bandeau de progression et barre d’actions fixe au bas de l’écran. Les composants partagés de connexion sont réutilisés ; les styles compacts sont limités à `.onboarding-fields`. Sur petit écran, les étapes défilent horizontalement et les champs passent en une colonne.

## Vérifications

```bash
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

Playwright lance ou réutilise Vite sur `http://127.0.0.1:5173`. Les tests interceptent uniquement leurs propres requêtes réseau : validation, clavier, mot de passe, chargement, doubles soumissions, erreurs, navigateur hors ligne, réponses invalides, redirections, e-mail mémorisé et responsive. Aucun backend factice n’est embarqué dans le frontend.

`tests/onboarding.spec.ts` vérifie aussi les sept étapes, les champs conditionnels de stock, les modules, les modifications depuis le récapitulatif, le payload Django, les erreurs et nouvelles tentatives, le logo et les petits écrans. Les captures de contrôle sont écrites dans `test-results/` (ignoré par Git).

`tests/dashboard.spec.ts` vérifie la structure, les huit KPI, les graphiques, les labels IA/prévision, les alertes, le shell, Ctrl+K, l’export CSV et le responsive. Les tests du mode API se lancent séparément avec un serveur Vite redémarré dans ce mode (arrêter le serveur de test précédent avant cette commande) :

```powershell
$env:VITE_DASHBOARD_USE_MOCK = 'false'
npm.cmd run test:e2e -- tests/dashboard.spec.ts --grep 'Dashboard API'
Remove-Item Env:VITE_DASHBOARD_USE_MOCK
```

Ces tests interceptent les requêtes Django dans le navigateur de test uniquement : chargement, réponse réelle du contrat, erreur serveur, nouvelle tentative et panne réseau. En fonctionnement normal, laisser le mode démo activé jusqu’à la connexion du backend.

Si Chromium est déjà installé, la variable optionnelle `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` peut désigner son exécutable pour les tests, sans téléchargement supplémentaire. Elle ne concerne pas l’application et ne doit pas être préfixée par `VITE_`. Par défaut, Playwright utilise la version installée par sa commande ci-dessus.

Pour l’hébergement final, configurer le serveur afin de servir `index.html` pour les routes SPA, notamment `/login`.
