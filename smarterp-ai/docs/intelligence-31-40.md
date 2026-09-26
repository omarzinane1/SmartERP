# Intelligence et administration — pages 31 à 40

## Pages livrées

| Page | Route | Fonctionnement |
| --- | --- | --- |
| 31 | `/reports/:type` | 11 types, période comparable ou photographie actuelle explicite, filtres contextuels, KPI, deux graphiques, tri, pagination, CSV et analyse IA structurée |
| 32 | `/documents` | Recherche, filtres, accès, transfert PDF/TXT de démonstration, progression, indexation séparée, aperçu et suppression confirmée |
| 33 | `/documents/:id` | Miniatures, navigation par page, zoom, aperçu, quatre analyses, questions/réponses et citations ouvrant leurs pages |
| 34 | `/ai/assistant` | Historique des conversations, recherche, suggestions, flux de blocs, outils utilisés, contexte, sources et validation humaine |
| 35 | `/ai/forecasting` | Six domaines, horizons 30/60/90/180 jours, réel/prévision distincts, confiance fournie, limites et recalcul autorisé |
| 36 | `/ai/opportunities` | Cinq familles, valeur potentielle non garantie, preuves, détail et affectation à un responsable autorisé |
| 37 | `/approvals` | Demandes par statut/type, contexte, pièces autorisées, commentaire et décision confirmée selon droits et version |
| 38 | `/admin/users` | Recherche/filtres, invitation, création autorisée, édition, rôles attribuables, suspension/réactivation et indicateurs de sécurité |
| 39 | `/admin/roles` | Catalogue des droits, matrice View/Create/Edit/Delete/Export/Approve/AI/Sensitive, rôles système protégés, création/duplication et conflits de version |
| 40 | `/admin/audit-logs` | Journal en lecture seule, filtres, export, détails avant/après, restrictions et masquage récursif des secrets |

## Fichiers créés et adaptés

Features : `src/features/documents`, `ai`, `approvals`, `admin`; reporting complété dans `src/features/reports` (`analytics.types.ts`, `analytics.mock.ts`, `useReportAnalytics.ts`, `ReportAnalyticsPage.tsx`). Chaque feature contient ses modèles TypeScript, API Axios, hooks TanStack Query, mocks et composants métier.

Fichiers centraux : `ai/stream.ts` décode le protocole SSE, `ai/components/AIResponse.tsx` affiche une union finie de blocs typés, `documents/documents.utils.ts` valide les URL, `admin/admin.utils.ts` masque les secrets et calcule uniquement les différences consultables. Il n’y a aucun moteur IA, RAG ou workflow générique dans React.

Modifications : router existant, Sidebar et Topbar, `env.ts`, types Vite, `.env.example`, catalogue de rapports, caches des modules opérationnels, rejet de dépense depuis une demande autorisée. Tests ajoutés : `tests/intelligence.spec.ts` et le helper de connexion `tests/workspace.helpers.ts`.

## Rapports et chiffres

Types acceptés : `sales`, `profitability`, `customers`, `products`, `inventory`, `purchases`, `suppliers`, `invoices`, `payments`, `expenses`, `cash-flow`. Un type inconnu affiche un état introuvable.

La période précédente possède le même nombre de jours. La hausse des charges n’est pas présentée comme favorable. Le stock, le catalogue, les fournisseurs et les créances démo représentent une photographie actuelle : aucune comparaison historique n’est inventée. Les rapports clients/factures démo examinent les créances ouvertes. Le taux de rotation et la conversion sans population comparable restent indisponibles.

Les tableaux, KPI et graphiques utilisent les mêmes lignes filtrées. Les marges proviennent des coûts de lignes de ventes ; les charges de rentabilité sont celles de la société entière, non allouées à un client. Une estimation de contribution n’est pas assimilée à un résultat comptable certifié.

L’analyse expose EXECUTIVE SUMMARY, TRENDS, ANOMALIES, RISKS, OPPORTUNITIES, RECOMMENDATIONS, période, date et sources. La démonstration ne prétend pas avoir exécuté un détecteur statistique.

## Sources RAG et blocs IA

`DocumentSource` contient identifiant du document, nom, page/section, extrait, période, chemin métier et autorisation explicite. Les sources non autorisées sont exclues. Les liens vers un document exigent aussi le droit documentaire. Les liens métiers sont limités aux routes existantes.

Une réponse documentaire n’est marquée sourcée que si elle contient une citation autorisée vers une page réellement disponible. Une réponse sans preuve exploitable est non vérifiée. Les sources cliquables synchronisent le lecteur de pages ; elles n’exécutent aucune instruction contenue dans le document.

Les blocs de conversation sont typés et classés en **FACT**, **AI ANALYSIS**, **FORECAST**, **RECOMMENDATION**. Les faits ERP restent distincts de l’interprétation et des propositions. Les états `streaming`, `tool_running`, réponse interrompue et validation attendue sont visibles. Un flux interrompu ne devient pas une réponse finalisée et ne permet pas de confirmer une action partiellement reçue.

Le flux est un POST Axios vers Django, décodé en SSE incrémental. Événements : `status`, `block`, `done`, `error`. Le message `done` contient la réponse finalisée. Les sources peuvent être revérifiées via le endpoint du message. Aucun appel direct à Ollama, OpenAI, PostgreSQL ou à un outil financier n’est réalisé par React.

## Approbation humaine

Une proposition sensible contient son impact, les données utilisées et l’identifiant d’une demande existante. **Confirmer** ou **Annuler la proposition** ouvre un dialogue puis appelle l’approbation/le refus de cette demande. Les droits globaux, `allowedApprovalTypes`, capacités par demande et statut courant sont tous requis. La version évite une seconde décision sur une demande modifiée.

Dans la démo, approuver une revue IA ne déclenche aucun e-mail, paiement ou mouvement. Approuver/refuser une demande de dépense met à jour la dépense canonique, sans la payer. Le commentaire est enregistré avec la décision. Aucune route indépendante de commentaire ou de demande de modification n’est inventée.

## RBAC et administration

Les tableaux de permissions et capacités viennent de chaque réponse serveur. Les boutons non autorisés sont absents ; les requêtes secondaires sont désactivées quand la lecture requise manque. Les rôles de session ne sont pas traduits arbitrairement en droits métier. Les clés TanStack Query sont isolées par utilisateur et société.

Les utilisateurs ne peuvent pas modifier leur propre rôle depuis cette interface. Les rôles attribuables viennent de `assignableRoleIds` ; Owner n’est pas attribuable dans la démo. L’état 2FA de l’administration est en lecture seule. Les invitations démo n’envoient aucun e-mail.

La matrice affiche uniquement le catalogue `/admin/permissions/`. `grantable` détermine les droits attribuables. Les rôles système sont protégés. Une réponse 409/412 conserve les modifications et propose de recharger explicitement la version serveur. Les modifications non sauvegardées bloquent la navigation avant abandon confirmé.

Le journal affiche uniquement les champs modifiés après masquage récursif des mots de passe, tokens, secrets, credentials, clés et graines TOTP. Les entrées restreintes masquent les références, détails et informations réseau ; aucune mutation d’audit n’est proposée.

## Contrats Django

Les types complets se trouvent dans `types/*.types.ts`. Les réponses suivent les modèles camelCase définis côté UI ; les adaptateurs API envoient les paramètres métier snake_case lorsqu’ils sont attendus.

| Service | Endpoints préparés |
| --- | --- |
| Rapport | `GET /reports/:type/`, `POST /reports/:type/ai-analysis/`, `GET /reports/:type/export/` |
| Documents | `GET/POST /documents/`, `GET/DELETE /documents/:id/`, `GET /documents/:id/pages/`, `POST /documents/:id/index/` |
| Intelligence documentaire | `POST /ai/documents/:id/query/`, `POST /ai/documents/:id/analyze/` |
| Conversation | `GET/POST /ai/conversations/`, `POST /ai/chat/stream/`, `GET /ai/messages/:id/sources/` |
| Prévisions | `GET /forecast/:domain/`, `POST /forecast/:domain/recalculate/`, `GET /forecast/:domain/drivers/` |
| Opportunités | `GET /ai/opportunities/`, `GET /ai/opportunities/:id/`, `POST /ai/opportunities/:id/assign/` |
| Validations | `GET /approvals/`, `GET /approvals/:id/`, `POST /approvals/:id/approve/`, `POST /approvals/:id/reject/` |
| Utilisateurs | `GET/POST /admin/users/`, `PATCH /admin/users/:id/`, `POST /admin/invitations/` |
| Rôles | `GET/POST /admin/roles/`, `PATCH /admin/roles/:id/`, `GET /admin/permissions/` |
| Audit | `GET /audit-logs/`, `GET /audit-logs/:id/`, `GET /audit-logs/export/` |

Django doit filtrer les réponses selon les ACL avant de les transmettre, valider les décisions atomiquement et appliquer les autorisations sur chaque endpoint. La présence d’un contrôle frontend ne remplace pas cette responsabilité.

## Mock et limites

Flags dédiés : `VITE_REPORTS_USE_MOCK`, `VITE_DOCUMENTS_USE_MOCK`, `VITE_AI_WORKSPACE_USE_MOCK`, `VITE_APPROVALS_USE_MOCK`, `VITE_ADMIN_USE_MOCK`. Données dans `features/*/data/*.mock.ts`, mémoire de session uniquement. Une panne API n’active jamais les mocks.

Fonctionnent entièrement frontend en mode démo : filtres, formulaires, navigation, graphiques, fichiers CSV, lecteur simulé, citations, stockage temporaire PDF/TXT, indexation de texte, conversation déterministe, décisions locales, affectations et administration simulée.

Restent à connecter côté Django/services : persistance, authentification durable, ACL documentaires effectives, stockage et analyse antivirus, OCR/PDF, indexation vectorielle, RAG/LLM, véritables modèles de prévision, envoi d’invitations et exécution d’actions métier. Un PDF démo sans texte extractible passe explicitement en erreur d’indexation. Aucun intervalle ou score de confiance n’est créé par le navigateur ; seules les bornes reçues sont tracées.

## Tests

`tests/intelligence.spec.ts` vérifie les dix routes à 1440 px, les calculs, périodes, sources, upload/indexation distincts, flux SSE fragmenté, annulation, approbation humaine, autorisations par type, absence de double paiement, affectation, auto-élévation interdite, rôles protégés, conflit de version, audit masqué, exports et états loading/error/403/empty.

Les tests API interceptent Django avec Playwright et vérifient les URLs/payloads ; ils ne constituent pas une validation contre un backend Django déployé.
