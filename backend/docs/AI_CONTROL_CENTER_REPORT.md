# SmartERP AI — rapport AI Control Center

11 octobre 2026. Base `4eb6cf0`. [Audit préalable](AI_CONTROL_CENTER_AUDIT.md) · [Contrats, formules et guide manuel](AI_CONTROL_CENTER.md).

## 1 — Status

| Fonction | Statut | Livraison |
| --- | --- | --- |
| Business Health | DONE | Métriques et statuts issus de trois sources ERP autorisées, sans score artificiel |
| Alerts | DONE | Factures échues, stock au seuil par dépôt, flux net négatif |
| Alert lifecycle | DONE | Prise en charge, résolution, classement sans suite ; idempotence et audit |
| Anomaly History | DONE | Historique réel de détections RULE_BASED et résolutions |
| Forecast Risks | DONE | Risques observés avec expiration ; prévisions ML explicitement indisponibles |
| Intelligence Stats | DONE | Compteurs PostgreSQL réels, date de dernière analyse, activités propres |
| Control Center API | DONE | Agrégat, listes paginées, détails et actions sécurisées |
| Celery Intelligence Run | DONE | Publication après commit, claims, révocation, expiration et traitement d'échec |
| Frontend integration | DONE | API par défaut, mutations réelles, suivi des analyses, pagination et valeurs indisponibles |

Le Secure AI Tools Engine n'est pas utilisable dans ce checkout : les fichiers intelligence/tools sont vides et aucun AIToolContext/registry/executor n'est présent. Le centre utilise les sélecteurs métier internes, ce que permet la mission. Aucun faux moteur ni contexte administrateur n'a été créé.

## 2 — Files

Inventaire exact Created/Modified/Deleted : [AI_CONTROL_CENTER_FILES.md](AI_CONTROL_CENTER_FILES.md). Aucun fichier supprimé, aucune dépendance ajoutée.

Les anciens fichiers vides `intelligence/{apps,constants,models,selectors,serializers,services,tasks,views,urls}.py` sont implémentés. Créations principales : détection, migration initiale, tests fonctionnels/concurrence, script de worker, documentation, tests navigateur. Adaptations limitées : intégration Django, audit, notifications sans e-mail, maintenance des runs et composants frontend existants. Aucun CSS modifié.

## 3 — Models

**AIAlert** : société, type, empreinte, sévérité, titre/message, état, source, référence d'entité/dépôt, observations JSON contrôlées, condition active, détection/dernière observation, dates et auteurs de prise en charge/résolution/rejet. Contrainte d'unicité par société et empreinte pour un épisode actif ; contraintes de statut/sévérité ; index société/statut, société/sévérité et société/date.

**IntelligenceRun** : société, demandeur, règles autorisées, état, résumé de compteurs, erreur contrôlée, création/démarrage/fin, échéance et claim UUID. Un seul run pending/running par société ; états valides et date de fin obligatoire pour un état terminal. Index propriétaire/date et statut/échéance.

Migration additive `intelligence/0001_initial.py` appliquée. Aucune migration appliquée modifiée, aucun reset/flush. Pas de modèle DetectedAnomaly ni ForecastRisk supplémentaire : historique et risques sont des projections des alertes réelles.

## 4 — Data sources

| Indicateur | Modèles | Sélecteur | Calcul |
| --- | --- | --- | --- |
| Créances / échues | Invoice, Customer | balance_summary / overdue_invoices | Restes dus positifs, factures comptabilisées, devise et client de la société |
| Stock au seuil | Product, StockLevel, Warehouse | low_stock_queryset | Disponible <= minimum dans chaque dépôt actif ; manque de ligne = zéro |
| Flux de trésorerie | Payment | get_cash_flow_summary | Encaissements − décaissements completed, période inclusive de 30 jours |
| Alertes/anomalies | AIAlert | alert_queryset / anomaly_history | Comptage par statut, sévérité et date locale, filtré par permission source |
| Risques | AIAlert | risk_queryset | Épisode actif ouvert/pris en charge, dernière observation < 24 h |
| Activité d'analyse | IntelligenceRun | control_center / run_payload | Cinq activités du demandeur, états persistés, résumé masqué si droits révoqués |

## 5 — Business Health

Dimensions autorisées : Clients, Stock, Finance. Aucun score, confiance ou tendance : null.

Ordre de décision : rupture de stock → critical ; sinon stock au seuil, solde échu ou flux net négatif → warning ; sinon au moins une source autorisée → healthy ; sinon not_available. Les intitulés UI précisent l'absence de signal, sans prétendre à une solvabilité générale. Le flux net n'est jamais présenté comme un solde bancaire. Les règles exactes et bornes temporelles figurent dans le guide.

## 6 — Alerts

Types : overdue_invoice, low_stock, negative_cash_flow. Sévérités calculées : facture medium jusqu'à 30 jours de retard puis high ; stock critical si quantité <= 0 avec minimum > 0, sinon high ; flux négatif high.

États internes : open, acknowledged, resolved, dismissed ; acknowledged est exposé comme investigating. Transitions explicites, atomiques et auditées ; répétition identique sans doublon ; transition depuis un état terminal vers un autre état refusée 409.

Une résolution/rejet manuel conserve l'empreinte de l'épisode tant que la condition persiste. Seule une disparition observée au cours d'un scan autorisé ferme cet épisode ; une réapparition ultérieure ouvre un nouvel épisode. L'analyse ne modifie aucune facture, allocation, paiement ou quantité de stock.

## 7 — Anomalies

**RULE_BASED uniquement.** Historique des épisodes persistés, filtres et pagination. Aucun anomaly_score, accuracy ou confidence ML. Historique graphique sur 30 jours dans le fuseau société, taux de résolution sur la cohorte et délai moyen de prise en charge calculés depuis les dates réelles ; null sans observations.

## 8 — Risks

Projection des alertes open/acknowledged dont la condition reste active et l'observation date de moins de 24 heures. Horizon « Situation observée ». Expiration = dernière observation + 24 h ; résolution/rejet retire immédiatement le risque. Score, probabilité, confiance et impact prédictif sont null. Explication issue du solde, seuil ou flux réellement observé.

## 9 — Endpoints

| Méthode | URL | Permission | But |
| --- | --- | --- | --- |
| GET | /api/ai/control-center/ | ai.use + filtrage source | Agrégat du centre |
| GET | /api/ai/alerts/ | idem | Alertes paginées et filtrées |
| GET | /api/ai/alerts/:id/ | idem | Détail autorisé |
| POST | /api/ai/alerts/:id/acknowledge/ | idem | Prise en charge |
| POST | /api/ai/alerts/:id/resolve/ | idem | Résolution du signal |
| POST | /api/ai/alerts/:id/dismiss/ | idem | Classement sans suite |
| GET | /api/ai/anomalies/ | idem | Historique par règles |
| GET | /api/ai/risks/ | idem | Risques non expirés |
| POST | /api/ai/control-center/refresh/ | ai.use + au moins une source | Créer/réutiliser un run, 202 |
| GET | /api/ai/runs/:id/ | ai.use + propriété société/demandeur | Suivi du run |

Réponses camelCase, champs exacts et filtres : [contrats](AI_CONTROL_CENTER.md). Les listes sont limitées à 100 lignes par page ; l'agrégat à dix alertes/risques et cinq activités. Le tri de liste précède la pagination.

## 10 — Celery

Task : `apps.intelligence.tasks.run_company_intelligence(run_id)`. Déclencheur : refresh manuel. Journal pending créé dans PostgreSQL, publication via `common.dispatch.enqueue_after_commit`, claim running, collecte hors transaction de publication, puis publication atomique et completed. Permissions relues au début et avant publication. Pas de retry automatique d'erreurs déterministes ; nouvelle demande après correction.

Expiration : file 24 h, exécution 20 min. Le claim empêche deux workers de publier le même run et bloque un worker expiré. Panne broker : failed/broker_unavailable. Les traitements de maintenance existants rapprochent les interruptions.

**Vérification réelle réussie** via `scripts/check_intelligence_worker.py` :

```text
Valkey PING: PONG
Worker connected and ready (solo)
Task apps.intelligence.tasks.run_company_intelligence[11908d75-95d8-464c-8c2b-0e4af30a9969] received
Task apps.intelligence.tasks.run_company_intelligence[11908d75-95d8-464c-8c2b-0e4af30a9969] succeeded ... {'id': 1, 'status': 'completed'}
IntelligenceRun: completed; one overdue alert persisted; ERP balance unchanged
Owned diagnostic worker stopped
Owned disposable fixtures removed
```

Le premier essai a trouvé Valkey arrêté ; Docker Desktop et le service existant ont été démarrés, puis le diagnostic a réussi. Aucun LLM, SMTP ou backend de résultats Celery utilisé. Le worker temporaire est arrêté ; Valkey reste actif.

## 11 — Security

Société et Membership issus de la session et rechargés pour les services/tasks ; aucune autorité accordée à company_id dans le body. Filtrage des sources, relations d'entités et dépôts ; 404 sur ressources étrangères. Aucun bypass superuser, contexte système administrateur ou écriture ERP autonome.

Filtres stricts, pagination bornée, références contrôlées, résumé de run masqué après révocation. Métadonnées internes non retournées en bloc. Audit allowlisté, erreurs des runs contrôlées, logs limités aux identifiants et classes d'erreur. Aucun secret, prompt brut, SQL généré ou accès PostgreSQL depuis un LLM.

Les tests de concurrence sur PostgreSQL vérifient une seule publication et un seul claim. La pagination est testée sur 56 alertes, sans croissance du nombre de requêtes par ligne.

## 12 — Audit

Événements : intelligence.refresh_requested, intelligence.started, intelligence.completed, intelligence.failed, intelligence.alert_acknowledged, intelligence.alert_resolved, intelligence.alert_dismissed, intelligence.alert_auto_resolved. Société, acteur si disponible, entité/run, états avant/après ou code d'erreur uniquement. Les événements système d'expiration/rapprochement n'usurpent pas d'utilisateur.

Notification critique : un événement par épisode/destinataire autorisé ; pas d'e-mail automatique. Le réglage low_stock_alerts de la société est respecté pour les notifications stock.

## 13 — Tests

Le harness PostgreSQL isolé exécute `manage.py test ... --settings=config.settings.test --noinput --verbosity 1`. Les tests n'exigent ni Valkey ni SMTP réel.

| Commande / passage | Exécutés | Réussis | Échecs | Erreurs |
| --- | ---: | ---: | ---: | ---: |
| manage.py check | — | OK | 0 | 0 |
| manage.py makemigrations --check | — | Aucun changement | 0 | 0 |
| manage.py migrate | — | intelligence.0001 appliquée | 0 | 0 |
| test_postgres.ps1 -Labels apps.intelligence, premier passage | 20 | 17 | 1 | 2 |
| test_postgres.ps1 -Labels apps.intelligence,apps.notifications, deuxième passage | 57 | 56 | 0 | 1 |
| Même commande corrigée | 57 | 57 | 0 | 0 |
| test_postgres.ps1, suite complète | 298 | 298 | 0 | 0 |
| npm.cmd run build | — | OK | 0 | 0 |
| npm.cmd run lint | — | OK | 0 | 0 |
| Playwright control-center-api.spec.ts, premier passage | 2 | 0 | 2 | 0 |
| Même fichier, session corrigée | 2 | 2 | 0 | 0 |
| check_intelligence_worker.py, Valkey actif | 1 scénario réel | 1 | 0 | 0 |

Les erreurs initiales backend venaient des fixtures : solde/affectation, créateur de paiement, ordre des dates et portée du mock de broker. Les tests navigateur utilisaient initialement le mauvais code de module dans leur session ; correction vers ai_control_center. Les échecs ont été corrigés, pas ignorés. Le navigateur utilisé est Chrome installé, avec API interceptée dans les deux scénarios UI ; la preuve du worker réel est distincte.

Validation finale du tri/pagination et tests ciblés après suite complète : **à consigner**.

## 14 — Frontend

Connexion réelle par défaut de l'API Control Center. Drawer chargé depuis son endpoint ; prise en charge, résolution et classement sans suite persistants. Refresh POST 202, états pending/running/completed/failed, suivi automatique et invalidation des données par utilisateur/société. Pagination et filtres serveur, tri avant pagination. Un échec de mutation n'invente pas un changement local.

Les valeurs non calculées deviennent null avec présentation « non disponible » ; aucun faux pourcentage. Les sections de risque et d'historique distinguent les règles ERP des prévisions ML. Layout, CSS et composants existants conservés, avec ajouts techniques limités aux actions et pagination.

Le mock Control Center demeure uniquement derrière `VITE_AI_CONTROL_CENTER_USE_MOCK=true`, désactivé par défaut et dans l'exemple de configuration. Les mocks des autres modules/assistant/forecasting ne font pas partie de cette mission et restent inchangés. L'export CSV concerne la page filtrée visible.

## 15 — Limitations

Pas de moteur ML d'anomalies ou forecasting, assistant conversationnel, RAG, embeddings, pgvector, ingestion IA ou agents autonomes. Le moteur Secure AI Tools manque dans ce checkout ; les sélecteurs internes sécurisés suffisent à cette implémentation. Opportunités et recommandations automatiques restent vides.

Pas d'assignation nominative d'alerte : prise en charge par le membre courant. Pas d'analyse planifiée automatiquement. Les alertes sont des observations au moment du scan, les métriques de santé sont live ; lancer un refresh après une opération ERP pour mettre à jour les épisodes. Risques expirés après 24 h, sans prétendre qu'ils sont résolus. Maximum 10 000 signaux par run, avec échec explicite au-delà. Coût des indicateurs stock proportionnel aux dépôts actifs.

Publication après commit sans outbox distribuée ; une interruption exacte avant publication est rapprochée par expiration, pas par rejeu automatique. Les échéances empêchent la publication tardive mais ne tuent pas un calcul solo. Les tests navigateur vérifient le contrat avec API interceptée, pas une session de bout en bout contre la base de développement.

## 16 — Git

Aucun commit ni push effectué. Aucun reset, flush ou fake migration. Les changements restent disponibles pour inspection : `git status --short`, `git diff`, migration, contrats, tests et diagnostic worker reproductible. Les nouveaux fichiers non indexés sont détaillés dans le manifeste, car ils ne figurent pas dans `git diff` par défaut.
