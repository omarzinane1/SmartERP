# SmartERP AI

Frontend React + TypeScript + Vite, préparé pour **Django + Django REST Framework**. Seule la page de connexion est développée.

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
```

Modifier cette variable dans `.env`, puis redémarrer Vite. Elle désigne la racine de l’API, sans le suffixe `/auth/login/`. Elle est lue dans `src/config/env.ts` puis utilisée uniquement par le client `src/lib/axios.ts`. Les variables préfixées `VITE_` sont publiques : ne jamais y mettre de secret.

## Architecture

```text
src/
  app/                       Router, providers, client TanStack Query
  components/
    ui/                      Button, Input, Checkbox, Spinner, Alert
    layout/                  Logo partagé et placeholder minimal
  config/                    Configuration d’environnement
  features/auth/
    api/                     Appel login, adaptation de réponse, erreurs
    components/              Formulaire, mot de passe, branding, garde
    hooks/                   Mutation de connexion, e-mail mémorisé
    pages/                   Composition de LoginPage
    schemas/                 Validation du formulaire avec Zod
    types/                   Contrats d’authentification
  lib/                       Axios centralisé et utilitaire cn()
  store/                     État global Zustand, conservé en mémoire
tests/                       Tests navigateur, réponses isolées de la production
```

Les prochaines fonctionnalités pourront avoir leur propre dossier sous `features/` et réutiliser les composants UI. `App.tsx` compose les providers et le routeur ; aucun appel API n’est placé dans un composant visuel. TypeScript strict est activé.

Stack : React, React Router DOM, Tailwind CSS via le plugin Vite, Axios, TanStack Query, Zustand, React Hook Form, Zod, `@hookform/resolvers`, Lucide React, Sonner, clsx et tailwind-merge.

## Routes

| Route | État |
| --- | --- |
| `/login` | Page de connexion |
| `/onboarding` | Placeholder minimal |
| `/dashboard` | Placeholder minimal |
| `/ai/control-center` | Placeholder minimal |

La racine et les URLs inconnues renvoient vers `/login`. Les placeholders requièrent un état d’authentification en mémoire. Cette garde facilite la navigation ; les permissions et la protection des données restent à la charge de Django.

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

**L’image Stitch n’était pas présente dans la pièce jointe disponible.** Le design suit donc la direction visuelle du cahier des charges. La comparaison et l’ajustement exacts nécessitent cette référence.

## Vérifications

```bash
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

Playwright lance ou réutilise Vite sur `http://127.0.0.1:5173`. Les tests interceptent uniquement leurs propres requêtes réseau : validation, clavier, mot de passe, chargement, doubles soumissions, erreurs, navigateur hors ligne, réponses invalides, redirections, e-mail mémorisé et responsive. Aucun backend factice n’est embarqué dans le frontend.

Si Chromium est déjà installé, la variable optionnelle `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` peut désigner son exécutable pour les tests, sans téléchargement supplémentaire. Elle ne concerne pas l’application et ne doit pas être préfixée par `VITE_`. Par défaut, Playwright utilise la version installée par sa commande ci-dessus.

Pour l’hébergement final, configurer le serveur afin de servir `index.html` pour les routes SPA, notamment `/login`.
