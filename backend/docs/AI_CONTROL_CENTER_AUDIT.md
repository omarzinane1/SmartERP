# AI Control Center — audit avant implémentation

11 octobre 2026. Base inspectée : `4eb6cf0`. Arbre de travail propre au départ. Frontend réel : `smarterp-ai/`, route `/ai/control-center`.

| Partie inspectée | État initial | Décision |
| --- | --- | --- |
| intelligence : models, selectors, services, views, urls, tasks, tools, forecast | MISSING | Fichiers vides ; application absente des settings et URLs |
| Secure AI Tools, AIToolContext, registry/executor | MISSING / RISK | Aucun symbole ou code utilisable trouvé, malgré le titre du dernier commit ; ne pas prétendre intégrer un moteur absent |
| Contrat TS et six composants principaux | IMPLEMENTED | Conserver les clés camelCase, détails, filtres et composants |
| API frontend | PARTIAL | GET prévu, mock activé par défaut ; actions locales seulement en démo |
| Santé, confidence, matrice et forecasting frontend | CONFLICT / RISK | Champs numériques obligatoires issus du mock ; rendre nullables les mesures indisponibles sans inventer de score |
| Finance | IMPLEMENTED | Réutiliser overdue_invoices, balance_summary, get_cash_flow_summary ; flux nets distincts du solde bancaire |
| Inventory | IMPLEMENTED | Réutiliser low_stock_queryset par dépôt actif : disponible <= minimum, stock absent = zéro |
| Dashboard/reporting | IMPLEMENTED | Agrégats et permissions par source existants ; aucun score de santé officiel |
| Sales, purchasing, CRM | IMPLEMENTED | Factures comptabilisées, partenaires et relations par société ; pas de règle de risque fournisseur suffisamment définie |
| Notifications et e-mails | IMPLEMENTED | Notification unique par événement/destinataire ; ajouter une option interne sans e-mail pour les alertes critiques |
| Audit / comptes / sociétés | IMPLEMENTED | Membership courant, permissions existantes, metadata allowlistées, aucune dérogation superuser |
| Celery/Valkey, on_commit, erreurs broker | IMPLEMENTED | Réutiliser common.dispatch ; analyse manuelle asynchrone, getters synchrones |
| Anomalies ML / forecasting ML | MISSING | Historique des détections par règles, risques observés ; aucune prédiction/confidence ML |

## Périmètre retenu

- `AIAlert` persistant, déduplication d'un épisode même résolu manuellement tant que la condition reste présente ; nouvel épisode seulement après disparition observée puis réapparition.
- Trois règles explicites : facture échue impayée, stock au minimum par dépôt, flux net négatif sur 30 jours. Les seuils/sevérités et limites seront documentés.
- Santé : métriques et statuts, sans score, tendance ou confiance artificiels. Historique des anomalies = historique réel des alertes RULE_BASED, sans modèle supplémentaire redondant.
- Risques dérivés des alertes actives récentes, expirant après 24 heures ; aucune probabilité/impact en pourcentage inventé.
- `IntelligenceRun` manuel, after-commit, claim et expiration, autorisations revalidées dans le worker, aucune mutation finance/stock. Pas de contexte système ni LLM nécessaires.
- `ai.use` pour consulter et gérer ce centre, complété par les permissions de chaque source. Une permission AI seule ne donne aucun accès aux montants, stocks ou alertes des autres modules.
- API agrégée bornée, listes paginées et filtres stricts, actions acknowledge/resolve/dismiss explicites. `acknowledged` projeté en `investigating` pour conserver le contrat TS.
- Intégration frontend minimale : API réelle par défaut, états indisponibles, actions persistantes, actualisation 202 et polling du run. Layout/CSS conservés.

La validation inclura isolation inter-sociétés et par domaine, révocation de droits, transitions/déduplication/récurrence, calculs exacts, rollback, broker indisponible, exécution Celery eager, erreurs sans détails internes, migrations et suites backend/frontend.
