# Modules, paramètres société et profil — pages 41 à 43

## Fichiers

Créés dans `src/features/modules` : `ModulesMarketplacePage`, `ModuleCardGrid`, `ModuleCard`, `PlanBadge` et `ModuleDependencyList` regroupés dans `ModuleCard.tsx`, `ModuleConfigDrawer`, API, hook, types et mocks.

Créés dans `src/features/settings` : `CompanySettingsPage`, `SettingsSidebar`, `SettingsSectionRouter`, `SettingsForm`, `AISettingsPanel`, `IntegrationCards`, schémas Zod, types par section, API, hook, mocks et `configuration.css`. `aiPolicy.mock.ts` est un simple enregistrement démo partagé avec les pages IA/documentaires.

Créés dans `src/features/profile` : `UserProfilePage`, `ProfileForm`, `PreferenceForm`, `SecurityPanel`, `ActiveSessions`, `RecentActivity`, API, hook, types, schémas et mocks. Autres fichiers : `components/layout/moduleNavigation.ts`, `theme.css`, `tests/configuration.spec.ts`.

Modifiés : router existant, Sidebar, Topbar/menu utilisateur, AppShell, types et adaptateur de session, env/types Vite/`.env.example`, capacités documentaires et politiques IA, catalogue des permissions, invalidations et documentation. Aucune bibliothèque, Sidebar, QueryClient, client Axios ou authentification parallèle ajouté.

## `/modules`

Douze cartes compactes présentent CRM, Ventes, Achats, Stock, Finance, RH, Projets, Production, Maintenance, Point de vente, Documents et Intelligence IA. Le catalogue affiche la société courante, son plan, les catégories, états et dépendances. Recherche et filtre par statut sont combinables.

Activation/désactivation : confirmation, mutation, réponse serveur puis invalidation de la liste. Les dépendances manquantes et les modules actifs dépendants sont présentés ; aucune activation en cascade n’est simulée. Les modules Premium ou à venir ne peuvent pas être activés arbitrairement. Désactiver un module conserve toutes les données.

`ModuleConfigDrawer` présente les réglages descriptifs reçus, le statut et les dépendances. Pour modifier des règles métier, il renvoie vers `/settings?section=...` selon le droit `settings.view`. Aucun endpoint de configuration de module non fourni n’a été créé.

Les modules actifs actualisent `company.enabledModules` dans le store de session existant. Sidebar et AppShell utilisent la même correspondance statique de routes : une entrée inactive est masquée ; un accès direct affiche **Module désactivé pour cette société**, distinct de **Accès non autorisé**. Le contrat de connexion accepte aussi `company.enabled_modules`, afin que cette disponibilité soit connue avant d’ouvrir la page Modules. En l’absence de cette information, le frontend ne devine pas quels modules sont désactivés.

## `/settings`

Une route, une navigation de sections et un contenu borné : Général, Société, Branches, Finance, Taxes, Facturation, Ventes, Achats, Stock, Documents, Utilisateurs, Notifications, Sécurité, IA et Intégrations. Le paramètre `section` permet les liens directs. Les valeurs et options viennent du contrat `SettingsData`, avec des interfaces dédiées à chaque section.

React Hook Form et Zod contrôlent les formulaires. Le bandeau **Modifications non enregistrées** propose Annuler/Enregistrer. La navigation entre sections et vers une autre page demande l’abandon explicite des modifications. Une erreur conserve les saisies. Annuler restaure les valeurs du formulaire, sans appeler un faux endpoint de réinitialisation. Réinitialiser la section reste indisponible faute d’API.

La sauvegarde envoie uniquement `{ values, version }` vers la section choisie. La réponse attendue est le `SettingsData` validé complet. Le numéro de version permet au backend de refuser les mises à jour obsolètes. En démo, les règles de sécurité, certains paramètres de stock/devise et les contraintes documentaires sont verrouillés. Une modification des politiques Sécurité ou IA demande confirmation.

`settings.view` contrôle la page ; `settings.manage` et `policies[section].canManage` contrôlent chaque formulaire. `canView` protège les sections et `lockedFields` impose leurs champs non modifiables. Aucun bouton Enregistrer n’est présent dans une section en lecture seule. Les capacités d’intégration et les droits de la section sont également requis pour les tests.

**AI Status** est lu uniquement lors de l’ouverture de la section IA via `/ai/status/`. Fournisseur, modèle, RAG, embeddings et date sont ceux du service ; la démo annonce **Hors ligne**, sans modèle connecté. Les politiques RAG/prévisions/recommandations actualisent les pages démo correspondantes. Le serveur reste responsable d’appliquer les mêmes politiques en production.

**Tester l’intégration** appelle uniquement l’identifiant annoncé par le backend. Le résultat distingue succès, échec et configuration incomplète. La démo renvoie une configuration incomplète ; elle n’annonce jamais une connexion externe réussie. Aucun mot de passe, token OAuth, clé privée ou secret d’intégration n’est affiché.

La fiscalité n’est pas codée pour un seul pays : devises, taxes, taux et options font partie de la réponse. Les exemples Atlas/Casablanca/MAD restent des données de démonstration. Les règles critiques et leur effet sur les futurs documents sont du ressort de Django ; changer un paramètre local ne réécrit pas les documents existants.

## `/profile`

Le menu utilisateur de la Topbar propose **Mon profil** et **Paramètres personnels**. La page a cinq onglets : Profil, Préférences, Sécurité, Sessions et Activité récente. Tous utilisent `/me/`, sans identifiant utilisateur sélectionnable. Une réponse correspondant à un autre utilisateur que la session est refusée.

Le profil modifie prénom, nom, nom affiché, téléphone, fonction et email seulement si la politique le permet. Rôle/département/statut restent informatifs. La réponse valide actualise le nom dans la Topbar et la Sidebar. L’avatar possède une prévisualisation locale PNG/JPEG/WebP limitée à 2 Mo, libérée à la fermeture ; aucun upload ni suppression persistante n’est prétendu sans endpoint dédié.

Les préférences personnelles comprennent langue, fuseau horaire, format de date/nombres, thème et six canaux de notification. Elles ne modifient pas la société. Le thème clair/sombre/système s’applique via le store de session et AppShell existants, sans nouveau Theme Provider. La langue et les formats sont enregistrés dans le contrat utilisateur ; cette version de l’interface conserve ses libellés français, et les pages métier historiques gardent leurs formateurs existants. Les préférences de notification nécessitent les canaux backend pour produire de vrais envois.

Le formulaire de mot de passe exige l’actuel, le nouveau et sa confirmation. Longueur/majuscules/chiffres sont validés seulement selon `passwordPolicy` reçu. Django confirme le changement. Les champs sont effacés après la tentative ; les erreurs Axios contenant la requête ne sont pas conservées. Le cache de mutation sensible est réinitialisé et sa durée de conservation vaut zéro.

Le setup 2FA est entièrement piloté par `/me/2fa/` : action `setup`, challenge temporaire retourné par le serveur, action `verify` avec `setup_id` et code. Le frontend ne génère aucun secret TOTP. Un QR code image est affiché seulement s’il est fourni sous forme d’image base64 autorisée. La clé n’est visible que pendant la configuration ; elle disparaît après succès/annulation/sortie. La désactivation est masquée si la capacité manque et demande confirmation si elle est permise.

La démo 2FA ne crée aucun secret : elle utilise explicitement le code de parcours `123456`, sans sécuriser un compte réel. Le changement de mot de passe est également présenté comme une simulation qui ne modifie aucun identifiant réel.

Les sessions affichent uniquement appareil/navigateur/IP/localisation fournis, sans géolocalisation supposée. Fermer une session appelle DELETE après confirmation ; la ligne reste présente si le serveur échoue. La session courante n’est révocable que si le serveur l’autorise et exige une confirmation spécifique, puis efface la session locale après succès. L’activité récente utilise uniquement les événements présents dans GET `/me/`.

## APIs Django préparées

| Fonction | Endpoint | Contrat principal |
| --- | --- | --- |
| Catalogue société | `GET /modules/` | `ModulesData`, permissions et capacités par module |
| Activer/désactiver | `POST /companies/:id/modules/:module/enable/` et `/disable/` | `ModulesData` après validation ; la liste est relue |
| Configuration | `GET /settings/` | `SettingsData` : values, policies, options, permissions, version |
| Sauvegarde section | `PATCH /settings/:section/` | `{ values, version }` → `SettingsData` validé |
| État IA | `GET /ai/status/` | `AIStatus`, sans secret |
| Test intégration | `POST /integrations/:id/test/` | `IntegrationTestResult` |
| Profil courant | `GET/PATCH /me/` | `UserProfile`; PATCH identité ou préférences seulement |
| Mot de passe | `POST /me/password/` | `{ current_password, new_password }` → `{ success, simulated }` |
| 2FA | `POST /me/2fa/` | union `TwoFactorInput` / `TwoFactorResult` |
| Session | `DELETE /me/sessions/:id/` | succès HTTP, puis actualisation |

La connexion peut fournir `user.permissions` pour masquer les liens Administration/Intelligence dès l’arrivée. En mode API, les nouveaux liens sans droits de session annoncés restent masqués ; les routes directes contrôlent toujours les permissions de leurs ressources. Les données de profil ne permettent pas de modifier la liste de droits.

Django conserve l’autorité pour licences, dépendances, sécurité, isolation société, permissions, transactions, validation des settings, mots de passe, challenges 2FA et révocation effective. Les API ci-dessus sont des contrats frontend préparés, non un backend Django livré ou validé en production.

## Mode démo, tests et limites

Flags : `VITE_MODULES_USE_MOCK`, `VITE_SETTINGS_USE_MOCK`, `VITE_PROFILE_USE_MOCK`, explicitement documentés dans `.env.example`. Les magasins `data/*.mock.ts` sont isolés par utilisateur/société et disparaissent au rechargement. Une erreur API ne déclenche aucun fallback.

Le navigateur assure navigation, recherche, présentation, formulaires, validation, confirmations, thème, aperçu local et simulations déterministes. Persistance, email, stockage d’avatar/logo, application réelle des politiques, intégrations, authentification durable et sessions effectives nécessitent Django. L’application conserve son modèle de session en mémoire existant ; aucun endpoint de logout ou de restauration automatique non fourni n’a été inventé.

`tests/configuration.spec.ts` couvre dépendances/licences, préservation du stock, isolation société, politiques imposées, droits par section, version, dirty state, validation, sauvegarde, échec API, résultat d’intégration, AI Status, identité propre, préférences/thème, mot de passe, 2FA, suppression de session, activité et rendu 1440 px. Les tests API utilisent des interceptions Playwright.

Validation commune : `npm run build`, `npm run lint`, `npm run test:e2e`. Les scénarios API se lancent séparément avec leurs flags à `false` et un serveur Vite sur un port distinct ; une instance démo existante ne doit pas être réutilisée pour ces scénarios. `PLAYWRIGHT_PORT` et `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` sont pris en charge par la configuration existante.
