# AI Control Center : exploitation et contrats

La page existante est `/ai/control-center`, dans `smarterp-ai/`. Le backend lit les données ERP et écrit uniquement des alertes, analyses, notifications internes et audits. Aucun LLM, SQL libre, modèle ML ou outil d'écriture ERP n'est appelé.

## Accès et démarrage

Activer le module `ai_control_center` pour la société via la configuration existante. Le membre doit posséder `ai.use`, puis les droits des sources ci-dessous. Un superuser Django sans rôle métier n'obtient pas d'accès supplémentaire.

Le frontend utilise l'API par défaut. Une configuration locale préexistante `VITE_AI_CONTROL_CENTER_USE_MOCK=true` doit être remplacée par `false` pour ce parcours. Le mode démonstration demeure un choix explicite ; aucune bascule vers des mocks n'est faite si l'API échoue.

Depuis `backend/` :

```powershell
.\.venv\Scripts\python.exe manage.py migrate
docker compose -f compose.valkey.yml up -d --wait
.\.venv\Scripts\celery.exe -A config worker -l info --pool=solo
```

Les paramètres Celery existants restent inchangés. Les analyses sont demandées manuellement ; aucun scan automatique supplémentaire n'est planifié. Le rapprochement horaire existant `apps.reporting.tasks.expire_stalled_jobs` expire également les analyses interrompues. Consulter le centre ou le statut d'un run effectue aussi ce rapprochement.

## Sources et règles

| Règle | Source réutilisée | Condition / sévérité | Droits en plus de ai.use |
| --- | --- | --- | --- |
| overdue_invoice | finance.summary_selectors.overdue_invoices : Invoice | Facture posted dans la devise de la société, client de cette société, solde > 0, échéance strictement avant aujourd'hui local ; medium jusqu'à 30 jours inclus, high au-delà | invoices.view |
| low_stock | inventory.selectors.low_stock_queryset : Product, StockLevel, Warehouse | Produit actif, dépôt actif, relations par société, disponible <= minimum ; absence de ligne stock = zéro ; critical si disponible <= 0 et minimum > 0, sinon high | inventory.view ET products.view |
| negative_cash_flow | finance.summary_selectors.get_cash_flow_summary : Payment | Paiements completed de la devise et partenaires de la société, aujourd'hui local et les 29 jours précédents ; encaissements − décaissements < 0 ; high | finance.view ET cashflow.view |

Les dépenses approuvées ne sont pas ajoutées aux sorties de trésorerie. Le flux net n'est pas le solde bancaire. Le stock disponible utilise le contrat existant : quantité en main, sans réservation inventée. Aucune conversion monétaire n'est ajoutée.

La santé est calculée en direct : `critical` si un stock est en rupture au sens ci-dessus ; sinon `warning` si un seuil de stock est atteint, une facture est échue ou un flux net est négatif ; sinon `healthy` si au moins une source est autorisée ; `not_available` si aucune source n'est autorisée. `healthy` signifie seulement absence de ces signaux dans les données disponibles. Un ERP vide n'est pas une preuve de solvabilité.

`score`, `trend`, `confidence` sont **null**, globalement et par département. Dimensions : Clients (créances), Stock, Finance (flux), uniquement si autorisées. Les métriques de créances viennent de `balance_summary`. Le stock utilise les agrégations SQL du sélecteur par dépôt actif ; le coût des indicateurs de stock croît avec le nombre de dépôts.

## Alertes, épisodes et risques

Chaque épisode possède une empreinte société/règle/entité, avec dépôt pour le stock. Une contrainte unique porte sur les épisodes dont `condition_active=true`, y compris après résolution ou rejet manuel. Ainsi, traiter une alerte ne la recrée pas au scan suivant tant que la condition ERP reste présente.

Un scan réussi marque la disparition des conditions de son périmètre : les alertes open/acknowledged deviennent resolved, et l'épisode devient inactif. Une réapparition après cette disparition observée ouvre un nouvel épisode. Le scan ne clôture jamais les règles absentes des permissions du demandeur. Les instantanés sont publiés atomiquement ; au-delà de 10 000 signaux, l'analyse échoue sans publier un résultat tronqué.

Transitions : open → acknowledged, resolved ou dismissed ; acknowledged → resolved ou dismissed. Les statuts terminaux ne sont pas réouverts. Répéter la même transition est idempotent et ne répète pas l'audit. La projection API d'`acknowledged` est `investigating`, conformément au frontend existant.

Un risque est une projection d'une alerte open/acknowledged, condition active, observée il y a moins de 24 heures. `expiresAt = lastSeenAt + 24 h`. Résolution/rejet ou expiration retire le risque ; l'historique d'alerte reste conservé. L'horizon est **Situation observée** ; aucune probabilité, confiance, score ou impact chiffré prédictif. Il n'y a pas de table ForecastRisk redondante.

L'historique d'anomalies est l'historique **RULE_BASED** des épisodes AIAlert. Les barres quotidiennes comptent les détections par sévérité à la date locale de `detected_at` et les résolutions à celle de `resolved_at`. Le taux de résolution est le pourcentage actuellement resolved parmi les épisodes détectés dans les 30 derniers jours. Le temps moyen de prise en charge mesure `acknowledged_at − detected_at` sur cette cohorte ; sans observation, ces mesures sont null.

## Endpoints

Tous exigent une session authentifiée, une société active et `ai.use`. Les données, détails et actions restent limités aux permissions de source du tableau précédent. Une ressource étrangère ou masquée par ces droits donne 404.

| Méthode | URL | Objet |
| --- | --- | --- |
| GET | /api/ai/control-center/ | Indicateurs, statistiques, dix alertes/risques récents maximum, historique 30 jours et cinq activités propres |
| GET | /api/ai/alerts/ | Liste paginée |
| GET | /api/ai/alerts/:id/ | Détail autorisé, champs de présentation contrôlés |
| POST | /api/ai/alerts/:id/acknowledge/ | Prise en charge |
| POST | /api/ai/alerts/:id/resolve/ | Résolution manuelle du signal uniquement |
| POST | /api/ai/alerts/:id/dismiss/ | Classement sans suite |
| GET | /api/ai/anomalies/ | Historique paginé des détections par règles |
| GET | /api/ai/risks/ | Risques observés actifs non expirés, paginés |
| POST | /api/ai/control-center/refresh/ | Demande d'analyse, 202 ; exige au moins une source autorisée |
| GET | /api/ai/runs/:id/ | État du run, privé à son demandeur et sa société |

Les trois listes acceptent : `status=open|acknowledged|investigating|resolved|dismissed`, `severity=low|medium|high|critical|opportunity`, `alert_type=overdue_invoice|low_stock|negative_cash_flow`, `type=fact|analysis|forecast|recommendation`, `department=Finance|Clients|Stock|Ventes|Achats|Opérations`, `search` ≤ 150 caractères, `date_from`, `date_to` ISO inclusives dans le fuseau société, `days` 1–366, `ordering=date|severity|department` avant pagination, `page` ≥ 1, `page_size` 1–100 (défaut 50). Les filtres frontend opportunity/analysis/forecast/recommendation sont valides mais renvoient une collection vide, aucun signal de ces types n'étant produit. Champ inconnu ou période inversée : 400.

Toutes les actions POST acceptent seulement `{}`. `company_id`, `membership_id` ou `user_id` sont refusés ; aucune assignation, métadonnée ou transition libre n'est acceptée. Le refresh exige `Idempotency-Key`. Une même clé conserve le run ; tant qu'une analyse de même périmètre est active pour ce demandeur, une nouvelle clé réutilise aussi ce run. Une analyse active d'un autre demandeur donne 409, sans exposer ses résultats.

Codes : 400 validation, 401 absence de session, 403 permission/contexte, 404 objet inaccessible, 409 transition/concurrence incompatible, 202 refresh, 200 lecture/action. Les erreurs internes suivent le gestionnaire Django/DRF existant, sans stacktrace dans les réponses de production.

## Formes de réponse

Le contrat TypeScript est `smarterp-ai/src/features/ai-control-center/types/aiControlCenter.types.ts`. Identifiants d'alertes/risques en chaînes ; identifiants de runs en nombres ; horodatages ISO 8601, dates ISO. Montants JSON numériques dans les métriques, valeurs de présentation en chaînes.

```text
GET control-center
{
  period: {label, asOf, generatedAt},
  health: {score:null, trend:null, confidence:null, status,
    metrics:{receivables?, inventory?, cashFlow?},
    departments:[{name, alerts, status, tone, score:null, trend:null}], explanation},
  stats:{critical, warnings, resolved, forecasts, opportunities:0, lastAnalysisAt},
  summary:{text, confidence:null, priorities, impacts:[], recommendations:[], sources, model},
  alerts:[Alert], alertsCount, risks:[Risk],
  forecasts:[{id,title,detail,horizon,confidence:null,severity,source:"RULE_BASED",assumptions}],
  opportunities:[], actions:[], governance:[],
  anomalyHistory:[{day,critical,high,medium,resolved}],
  resolutionRate:number|null, responseMinutes:number|null, assignees:[],
  lastRun:Run|null, permissions:[string],
  recentActivity:[{id,status,createdAt,completedAt}],
  capabilities:{anomalies:"RULE_BASED", forecasts:"not_available", toolsEngine:"not_available", score:"not_available"}
}

Alert = {
  id,title,scope,department,severity,type:"fact",alertType,source:"RULE_BASED",
  metric,currentValue,baseline,deviation,impact,confidence:null,
  detectedAt,lastSeenAt,status,acknowledgedAt,resolvedAt,dismissedAt,conditionActive,
  facts:[{label,value}], analysis, causes:[], estimates:[], recommendations:[],
  evidence:[{id,kind,description}]
}
Risk = {
  id,alertId,label,shortLabel,impact:null,probability:null,score:null,confidence:null,
  severity,source:"RULE_BASED",horizon,explanation,detectedAt,expiresAt
}
Run = {
  id,status:"pending"|"running"|"completed"|"failed",
  createdAt,startedAt,completedAt,errorCode:string|null,errorMessage:string|null,
  summary:{detected,created,updated,autoResolved}|null
}
Liste = {alerts:[Alert] OU anomalies:[Alert] OU risks:[Risk],
  count,next:string|null,previous:string|null,source:"RULE_BASED"}
```

`stats.forecasts` compte les risques observés et est présenté comme tel dans l'UI ; ce nom est conservé pour compatibilité. `lastRun.summary` devient null si le demandeur perd un droit de source. `recentActivity` ne contient que ses runs. `lastAnalysisAt` indique la dernière analyse terminée de la société ; les indicateurs live possèdent leur propre `generatedAt`.

Les listes d'alertes ne font pas de requête par ligne. Le drawer recharge le détail, les mutations invalident les caches société/utilisateur et l'analyse en cours est suivie toutes les 2,5 secondes. La fin du run recharge les alertes et détails. L'export CSV existant exporte uniquement les lignes de la page et des filtres visibles.

## Worker, notifications et reprise

`apps.intelligence.tasks.run_company_intelligence(run_id)` recharge Company/Membership et le périmètre de règles depuis PostgreSQL. Il revalide les droits au démarrage et avant publication. La task utilise un claim UUID, un état running et une échéance de 20 minutes. L'attente en file expire après 24 heures. Un worker tardif ne peut pas publier après expiration. Aucun retry automatique : une erreur déterministe ou une permission perdue exige une nouvelle demande explicite. Une panne broker après commit laisse un run failed/broker_unavailable ; elle ne simule pas un succès.

Il n'existe pas d'outbox distribuée : une interruption entre commit et publication aboutit à expiration, sans rejeu aveugle. Les échéances ne tuent pas le processus solo ; elles interdisent la publication d'un résultat tardif. La limitation à 10 000 signaux est un garde-fou de cette version.

Une alerte critique nouvellement créée ou devenue critique notifie une seule fois chaque membre disposant de `ai.use` et des permissions de sa source. Le réglage `CompanyInventorySetting.low_stock_alerts=false` désactive ces notifications stock. Aucune notification supplémentaire à chaque scan ; aucun BusinessEmail ni envoi SMTP créé par ce module.

Vérification reproductible, données temporaires propres au script et worker dédié :

```powershell
.\.venv\Scripts\python.exe scripts/check_intelligence_worker.py
```

## Vérification manuelle

1. **Dashboard** : se connecter à une société ayant le module et les droits, ouvrir `/ai/control-center`. Vérifier créances, stock, flux selon les sources accessibles. Score/tendance/confiance doivent être indisponibles, pas 0 ni une valeur fictive. Sans analyse préalable, l'écran invite à Actualiser.
2. **Alertes** : créer par les workflows existants une facture comptabilisée dont l'échéance est passée et le solde positif, ou un produit actif sous son minimum dans un dépôt actif. Cliquer Actualiser. Après fin du run, filtrer les alertes, ouvrir Examiner, Prendre en charge puis Résoudre. Recharger : le statut persiste. La facture ou le stock n'a pas été modifié par ces actions.
3. **Sociétés et RBAC** : créer des conditions dans A et B, demander une analyse dans chaque session. Depuis A, appeler détail/action/run de B : 404. Révoquer invoices.view dans A : alertes de factures, créances et résultats de run concernés disparaissent ; les sources stock autorisées restent consultables. Un rôle ai.use seul ne peut pas lancer d'analyse.
4. **Refresh** : observer POST refresh → 202, pending → running → completed dans PostgreSQL et GET runs/:id. Le bouton est bloqué pendant la demande/analyse. Rejouer une clé ne double pas le run. Worker arrêté : état pending, puis expiration contrôlée ; broker indisponible : failed. Corriger la cause puis utiliser une nouvelle demande.
5. **Récurrence** : résoudre manuellement une alerte et rescanner : pas de nouvel épisode si la condition persiste. Régler la facture ou réapprovisionner via le domaine, rescanner, puis provoquer une nouvelle condition : nouvel épisode. Aucun double e-mail ne doit être envoyé par ces opérations de supervision.

Les scénarios de défaillance et de révocation sont aussi couverts sans réseau par les tests automatisés ; ne pas provoquer une panne de production pour les vérifier.
