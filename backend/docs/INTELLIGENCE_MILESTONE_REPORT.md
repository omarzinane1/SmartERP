# Intelligence milestone — rapport de livraison

Date : 2026-10-12. Base auditée : `8b9be6e`. Audit préalable : [INTELLIGENCE_MILESTONE_AUDIT.md](INTELLIGENCE_MILESTONE_AUDIT.md). Application React : `smarterp-ai/`.

## 1 — Status

| Fonction | Statut | Périmètre livré |
|---|---|---|
| Business Health | DONE | Cinq dimensions autorisées, métriques réelles, explications et seuils explicites, sans score arbitraire. |
| Anomaly Detection | DONE | Pics de dépenses TTC quotidiennes par quartiles ; règles métier existantes conservées. |
| Forecasting | DONE | CA HT net des avoirs et flux net confirmé, quotidien, horizons 7/30 jours, validation temporelle et résultats persistés. |
| Control Center Integration | DONE | Santé, historique, prévisions/risques et statistiques reliés aux réponses API réelles ; mock Control Center supprimé. |

Ces statuts portent sur ce périmètre initial. Prévision de demande stock, marge, saisonnalité, probabilités et intervalles ne sont pas implémentés.

## 2 — Files

Inventaire exhaustif Created / Modified / Deleted : [INTELLIGENCE_MILESTONE_FILES.md](INTELLIGENCE_MILESTONE_FILES.md), établi depuis Git. Principaux ajouts : `intelligence/health.py`, `features.py`, `anomalies.py`, migration 0002, tests analytiques, documentation et fixtures navigateur réservées aux tests. `forecasting.py` était vide : il est modifié, pas nouvellement créé.

Suppression : `smarterp-ai/src/features/ai-control-center/data/aiControlCenter.mock.ts`. Aucun changement CSS, package ou dépendance Python. Correction complémentaire de `notifications/selectors.py` : vérifications de permissions par EXISTS au lieu de jointures multiplicatives ; deux tests de régression dédiés.

## 3 — Business Health

Service : `apps.intelligence.health.business_health(company, codes)`, intégré au GET Control Center et au résumé de l'orchestration (statut, sans snapshot de toutes les métriques). Les droits sont requis par dimension. Les dates suivent `company.timezone`.

| Dimension / métriques | Formule et seuil | Source |
|---|---|---|
| Clients : total TTC dû, nombre, montant/nombre échu, overdueRatio | Factures comptabilisées en devise société, balance_due > 0 ; échéance strictement avant aujourd'hui. Ratio = échu / dû × 100, null si dû nul. Warning si au moins une facture échue. | `finance.balance_summary` / `eligible_invoices` |
| Stock : lowStock, outOfStock | Compter les couples produit physique actif/dépôt actif : disponible ≤ minimum. Critical si disponible ≤ 0 et minimum > 0 ; sinon warning si au moins un seuil atteint. | `inventory.low_stock_queryset` |
| Ventes : revenue, previousRevenue, growthPercent | CA = sous-totaux HT factures comptabilisées − sous-totaux HT avoirs, chacun à sa date. Période aujourd'hui − 29 jours à aujourd'hui ; comparaison avec les 30 jours précédents. Croissance = (courant − précédent) / précédent × 100 si précédent > 0, sinon null. Warning si croissance ≤ −20 %. | `finance.get_revenue_summary`, partagé avec Finance et Dashboard |
| Finance : incoming, outgoing, netCashFlow | Paiements confirmés dans la devise société ; net = encaissements − décaissements sur 30 jours. Warning si net < 0. Aucun solde bancaire supposé. | `finance.get_cash_flow_summary` |
| Finance : expenses subtotal HT, total TTC, count | Dépenses approved/paid en devise société ; fournisseur et catégorie rattachés à la société. Si droit de CA également disponible : warning quand HT dépenses > max(CA HT, 0). Cela n'est pas une marge. | `finance.get_expenses_summary` / `approved_expenses`, harmonisé avec Reporting |
| Achats : payables actuelles et échues TTC | Factures fournisseurs comptabilisées, reste dû positif. Warning si au moins une échéance dépassée. | `finance.balance_summary(supplier=True)` |

Statut global : `not_available` sans dimension autorisée ; sinon critical si rupture au sens ci-dessus ; warning si un seuil est franchi ; healthy sinon. Le frontend traduit healthy par « Aucun signal ». `score`, `trend`, `confidence` restent null : aucune formule de solvabilité ni pondération n'a été inventée. Les explications sont construites à partir des valeurs, sans LLM. Pas de BusinessHealthSnapshot : aucune courbe historique de santé n'en a besoin.

Test manuel : ouvrir `/ai/control-center`, relever les dates `health.period` et comparer Finance pour exactement ces dates. Le Dashboard utilise l'année civile : aligner la période dans Finance ou appeler le selector avec les mêmes bornes avant de comparer. Les créances/dettes/stock sont des situations actuelles. Comparer le stock par dépôt : le Dashboard agrège les produits tous dépôts et n'utilise pas exactement ce seuil. Vérifier qu'une dépense approuvée supérieure au CA entraîne l'explication Finance, et qu'un paiement sortant affecte le flux sans doubler la dépense.

## 4 — Anomaly Detection

Détecteur `expense_spike`, domaine finance, métrique `expenses_ttc`, méthode `activity_day_iqr`, source `statistical`, version `decimal-daily-v1`.

Observation : total TTC approuvé/payé de la dernière journée locale close. Référence causale : journées avec événements de dépenses pendant les 56 jours strictement précédents. Minimum 20 journées actives et au moins 28 jours calendaires depuis le premier événement de la fenêtre. Sinon `INSUFFICIENT_DATA`, aucune anomalie ni score.

Quartiles par interpolation linéaire inclusive sur les totaux quotidiens triés : position `(n−1)×p`, interpolation entre positions voisines. Médiane = Q(0,5), IQR = Q3−Q1. Seuil haut = `max(Q3 + 3×IQR, 2×médiane)`. Anomalie uniquement si observation strictement supérieure au seuil. Sévérité high ; critical si observation ≥ `max(Q3 + 6×IQR, 5×médiane)`. La protection multiplicative traite les distributions constantes où IQR = 0. Cette première métrique ne génère pas de low/medium artificiels ; ces niveaux restent disponibles pour les autres règles.

Valeur attendue = médiane, écart absolu = observation − médiane. Description, valeurs Decimal, méthode, version et date observée sont persistées. Métadonnées internes : quartiles, seuil, nombre de journées actives, bornes, devise. Déduplication DB par société/fingerprint `expenses:DATE:total`, y compris après résolution manuelle. Une correction des données du jour analysé peut clôturer le signal ; avancer de date ne résout pas automatiquement une observation historique. Les statuts et l'audit existants sont réutilisés.

Les règles `overdue_invoice`, `low_stock`, `negative_cash_flow` restent de source `RULE_BASED`, méthode `business_rule`. Elles ne sont pas présentées comme des anomalies statistiques. Les alertes statistiques critiques utilisent les notifications internes existantes, dédupliquées et filtrées par `expenses.view` + `ai.use`, sans email déclenché par ce scan.

Test manuel contrôlé : dans une société de test autorisée, approuver 35 dépenses de 5 000 MAD TTC sur les 35 journées précédant hier, puis une dépense de 30 000 MAD TTC datée d'hier. Actualiser et attendre completed. Attendus : médiane 5 000, seuil 10 000, écart 25 000, critical, méthode activity_day_iqr. Rejouer : même alerte, pas de doublon. Une dépense datée d'aujourd'hui sera analysée après la clôture de la journée. Le test automatisé `test_spike_exact_baseline_severity_deduplication_and_lifecycle` crée réellement cette situation dans la base isolée.

## 5 — Forecasting

| Métrique | Source | Granularité / fenêtre | Horizons et minimum |
|---|---|---|---|
| revenue | Factures comptabilisées HT moins avoirs datés, devise société, partenaires de la société | Jour ; au plus 180 jours jusqu'à hier local | 7 jours : ≥ 56 jours ; 30 jours : ≥ 120 jours |
| net_cash_flow | `get_cash_flow_series`, colonne `net`, paiements confirmés | Même politique ; jamais la colonne cumulative `actual` | Même politique |

Pour chaque métrique : au moins 14 journées avec événements et dernière activité datant d'au plus 14 jours avant la fin de l'historique. Les dates avant le premier événement admissible ne sont pas fabriquées. Après celui-ci, les journées sans événements valent zéro car ces métriques sont des flux. L'ERP ne dispose pas d'indicateur de complétude d'import : la complétude du journal est une hypothèse affichée, pas une certitude.

Trois candidats déterministes : naïf (dernière valeur), moyenne mobile des 7 derniers jours (niveau constant), tendance linéaire OLS (indices temporels 0..n−1, pente/intercept). Validation temporelle : retirer les 7 dernières journées pour horizon 7, ou 30 pour horizon 30. Ajuster chaque candidat sur le préfixe uniquement, calculer MAE et RMSE sur le suffixe. Choisir la plus faible MAE non arrondie ; égalité : naïf, puis moyenne mobile, puis tendance. Réajuster le gagnant sur tout l'historique et prédire horizon points consécutifs dès le lendemain de la dernière date d'apprentissage.

MAE = moyenne des erreurs absolues ; RMSE = racine de la moyenne des carrés des erreurs. Pas de MAPE (zéros fréquents). Les trois erreurs, dates de validation, période de réajustement, paramètres, historique, valeurs prévues, devise, fuseau et version sont conservés. Les montants restent Decimal, y compris OLS et racine carrée : aucune conversion NumPy/float. Résultats monétaires sérialisés en chaînes à deux décimales ; paramètres à précision Decimal 38 ; garde de finitude et de magnitude (< 10^22). Les deux métriques sont signées : les avoirs peuvent rendre un CA quotidien négatif.

`lowerBound`, `upperBound`, confiance : null. Aucun modèle de probabilité. Risque de flux : somme des points net_cash_flow < 0, libellé quantifié, sans déduction sur le solde bancaire. Les autres prévisions ne reçoivent pas de faux risque. Pas d'AIAlert supplémentaire issue d'une prévision pour éviter de doubler l'alerte de flux constaté : le risque prévisionnel est porté par la carte de prévision.

Test manuel : dans une société de test, disposer de 70 factures quotidiennes comptabilisées HT, de 100 à 238 MAD par pas de 2, jusqu'à hier, sans avoir. Avec `ai.use`, `invoices.view`, `forecast.view`, `forecast.recalculate`, actualiser. Attendus : modèle linear_trend, MAE/RMSE 0, sept points de 240 à 252, total 1 722 MAD. Déplier « Voir les explications », historique et valeurs prévues. Reproduction isolée : `test_forecast_persistence_api_history_no_cross_company_or_corrupt_parent` et le test pur de tendance. Horizon 30 disponible par POST `{ "horizon": 30, "granularity": "day" }`, avec minimum 120 jours ; le bouton UI utilise 7 jours.

## 6 — Models

- AIAlert enrichi : method, metric_name, analysis_version, period_date, observed_value/expected_value/deviation Decimal(30,6), contrainte permanente de déduplication statistique. Il remplit le rôle de DetectedAnomaly sans doublonner le cycle de vie.
- IntelligenceRun enrichi : horizon et granularity, contrainte 7/30 + day.
- ForecastRun créé : company, intelligence_run, metric, status, model_name, version, horizon/granularity, training_start/end, mae/rmse Decimal, created_at, résultat JSON borné (180 historiques + 30 points maximum). Unicité par run/métrique et contraintes sur métrique/statut/horizon.
- Pas de ForecastPoint séparé : les points sont consommés ensemble, à taille bornée. Pas de ForecastRisk ni HealthSnapshot inutilisés.

Migration additive `intelligence/0002_forecastrun_aialert_analysis_version_and_more.py`. Aucune migration appliquée antérieure modifiée, aucune suppression/réinitialisation de base.

## 7 — Celery

Task existante `run_company_intelligence(run_id)` conservée : uniquement un ID sérialisé. Le worker recharge IntelligenceRun et sa Company depuis PostgreSQL, puis les droits actuels du demandeur. Company fournie explicitement à chaque source. Publication après commit, verrou Company et claim token/bail conservés.

Étapes : règles ERP, statut de santé, détection statistique autorisée, forecasts autorisés, puis publication atomique alertes/prévisions/résumé/audit. `INSUFFICIENT_DATA` est un résultat réussi sans chiffres fabriqués. Une exception technique annule toute publication de ce run ; le run devient failed, les anciens résultats restent identifiables par leur date. `forecast_failed` distingue l'erreur de modèle/préparation. Aucun résultat partiel n'est marqué completed.

Pas de nouvelle planification ni retry automatique. Le rapprochement des baux expirés demeure dans `expire_stalled_jobs`. Audits : demande, démarrage/version, exécution anomalies, fin/échec contrôlé ; jamais de séries brutes dans AuditLog. Version du code/config à incrémenter pour toute évolution significative de formule. Logs : IDs société/run, détecteur/métrique/modèle, taille historique, résultats, état, durée et type d'erreur sans valeurs financières brutes. Le diagnostic worker existant sait nettoyer les nouveaux ForecastRun de ses seules fixtures jetables.

## 8 — API

Toutes les routes nécessitent une session et une adhésion active dans la société active ; contexte fourni par le serveur.

| Méthode | URL /api/ | Permission | Usage |
|---|---|---|---|
| GET | ai/control-center/ | ai.use + droits de chaque source | Santé live, alertes, historique, dernières prévisions par métrique, états insuffisants et fraîcheur |
| POST | ai/control-center/refresh/ | ai.use + au moins une source ; forecast.view + forecast.recalculate + droits source pour calculer les forecasts | Lancer/réutiliser IntelligenceRun ; Idempotency-Key obligatoire ; horizon 7/30, granularity day |
| GET | ai/runs/:id/ | ai.use ; demandeur et société correspondants | Suivre pending/running/completed/failed et sous-résultats autorisés |
| GET | ai/alerts/ ou ai/anomalies/ | ai.use + droits source | Liste paginée, historique commun règles/statistiques |
| GET | ai/alerts/:id/ | ai.use + droits source | Détail et méthode |
| POST | ai/alerts/:id/acknowledge/, resolve/, dismiss/ | ai.use + droits source | Cycle de vie existant, persistant et audité |
| GET | ai/risks/ | ai.use + droits source | Expositions constatées encore ouvertes et observées depuis moins de 24 h |
| GET | ai/forecasts/ | ai.use + forecast.view + droits source | Historique paginé, filtres metric/horizon/granularity |
| GET | ai/forecasts/:id/ | ai.use + forecast.view + droits source | Résultat, historique, points, paramètres et validation |

Sources : factures/CA = invoices.view ; stock = inventory.view + products.view ; flux = finance.view + cashflow.view ; dépenses/anomalies = expenses.view ; dettes = supplier_invoices.view. Une source non autorisée n'est pas incluse dans les totaux, résultats ou historique. Retirer forecast.recalculate empêche les nouveaux calculs, sans retirer la consultation si forecast.view subsiste.

Filtres alertes/anomalies : domain (finance/receivables/inventory), anomaly_type ou alert_type, source, severity, status (dont investigating alias acknowledged), type (fact/analysis), department, search, days, date_from/date_to, ordering. Dates inclusives dans le fuseau société. Pagination 50 par défaut, 100 maximum, numéro positif. type=analysis sélectionne les statistiques ; type=fact les règles. Paramètres inconnus refusés ; company_id/user_id/membership_id interdits. Forecasts courants : dernière exécution par métrique, même si insuffisante ; jamais de retour silencieux à un ancien succès.

## 9 — AI Control Center

BusinessHealth : health.metrics/issues/departments.reason ; cartes existantes avec explications chiffrées. AnomalyHistory : détections et résolutions réelles des alertes autorisées sur 30 jours, avec état d'historique statistique insuffisant. ForecastRisks : résultats persistés, statut insuffisant, date/version/modèle/MAE/RMSE/candidats/historique/points affichables ; risque quantifié de flux négatif. IntelligenceStats : alertes critiques/avertissements ouverts, résolutions enregistrées, nombre de prévisions calculées accessibles et fraîches (< 24 h), opportunités = 0 car moteur absent.

RiskMatrix conserve les expositions observées sans probabilité ni impact numérique inventés. Le frontend ne transforme plus localement les statuts ou totaux en faux succès ; mutations et filtres sont serveur. Cache séparé utilisateur/société, suivi automatique des runs et invalidation après achèvement. Une prévision ancienne ou issue d'une autre configuration de devise/fuseau est marquée « À actualiser » et exclue du compteur de prévisions fraîches ; sa devise d'origine reste affichée.

## 10 — Security

Company explicite dans les agrégats, résultats, FK du run et requêtes de lecture. Factures, avoirs, paiements et dépenses filtrés par société et partenaires ; dépenses également par catégorie et devise. Contrôle des droits à l'entrée, au claim et juste avant publication ; révocation masque aussi historique et résumés. Superuser ne remplace pas les permissions métier.

Aucun LLM, SQL généré, service externe de prédiction, écriture autonome ERP, mélange de sociétés ou donnée aléatoire. ORM et agrégats PostgreSQL officiels. Résultats et points financiers Decimal/chaînes. Notification d'anomalie critique interne seulement. Les tests utilisent une base PostgreSQL isolée, pas les données ERP existantes. Le sélecteur de destinataires vérifie chaque permission dans une sous-requête EXISTS indépendante : droits cumulables entre rôles actifs de la même société, sans duplication de destinataires ni explosion de jointures.

## 11 — Model quality

Les tests démontrent la cohérence des formules et les cas contrôlés ; ils ne constituent pas une mesure de précision sur un portefeuille réel. Un holdout unique est reproductible mais sensible à une rupture de régime. Pas de saisonnalité, jours fériés, facteurs externes, budget, échéancier futur ou causalité. Une tendance passée ne garantit pas une trajectoire future. Les erreurs de validation affichées sont dans l'unité monétaire de la série, pas des pourcentages de confiance.

Détection : journaux agrégés société entière, TTC, jours actifs comparés entre eux ; mix de dépenses/catégories potentiellement hétérogène. Elle vise uniquement des pics marqués, pas toutes les fraudes/erreurs. Pas de détection de baisse ni catégorisation ML. Les journées sans activité ne forcent pas une médiane nulle ; le périmètre « journées actives » est explicite. Le jour courant est exclu et les saisies tardives d'un ancien jour ne sont pas rétro-scannées automatiquement.

## 12 — Tests

Validation finale au 2026-10-13, incluant les Opportunités : 353 tests PostgreSQL complets puis 167 tests ciblés réussis, zéro échec/erreur ; 13 tests navigateur réussis. Une première suite complète a été interrompue après identification d’une requête de destinataires bloquée plus de neuf minutes sur un FETCH. La requête de test a été annulée pour diagnostic, puis le seul runner concerné arrêté ; la base de développement n’a pas été touchée. La correction par EXISTS est couverte par une limite de requête de cinq secondes et des tests de rôles cumulés/inactifs. La suite est relancée intégralement. Premier passage : 47 tests Intelligence, 44 réussis, 3 échecs (deux attentes de contrat obsolètes et une clé de fixture trop courte), 0 erreur. Corrections effectuées, aucune exclusion. Passage suivant : 102 tests Intelligence/Finance/Reporting réussis, 0 échec/erreur, 66,153 s. Six tests navigateur API réussis, 0 échec, 21,3 s ; relance après les derniers libellés : 6/6, 30,5 s. Diagnostic réel Valkey/worker solo réussi : task 59d7e5e7-d98f-49cb-9ee4-7b47a7f2a94f reçue puis completed le 2026-10-12 à 11:01:52 UTC, une alerte de facture persistée, solde inchangé, worker et fixtures propres nettoyés. Ce diagnostic réel valide le transport/orchestrateur ; les nouveaux calculs sont validés sur PostgreSQL avec Celery eager. Vérifications Django check/makemigrations --check/migrate et build/lint frontend réussies à ce stade.

Les scénarios navigateur interceptent l'API pour vérifier le contrat UI ; ils ne prétendent pas être une session de bout en bout contre les données de développement. Les tests backend exécutent les vrais modèles/services sur PostgreSQL isolé et Celery eager ; les erreurs contrôlées du broker et du modèle sont injectées pour vérifier les échecs et l'absence de publication partielle.

## 13 — Frontend

API réelle obligatoire pour le Control Center, ses alertes/détails/actions et son refresh. Forecasts et état d'anomalie sont inclus dans le GET agrégé, sans calcul numérique local. Mock Control Center supprimé, drapeau env et typage associés supprimés, anciennes branches de mutation locale retirées. Les anciens tests basés sur la démonstration sont remplacés par des scénarios de contrat API et des fixtures confinées à tests/.

Les mocks des autres pages (`features/intelligence`, assistant, page forecasting séparée, autres modules) ne sont pas supprimés dans ce milestone limité au Control Center. Aucun redesign : CSS/layout/couleurs conservés, explications et détails de séries ajoutés dans les composants existants.

## 14 — Limitations

Statistiques classiques : quartiles/IQR, moyenne mobile, baseline naïve, régression temporelle OLS. Aucune dépendance ML, deep learning, modèle probabiliste ou LLM. Données minimales et complétude du journal requises ; pas de certitude possible sur des imports manquants. Forecasts limités à deux métriques quotidiennes et 7/30 jours ; pas de demande stock/consommation, forecast de dépenses, 3 mois, marge ou solde bancaire. Pas de score de santé ni poids arbitraires.

Le Secure AI Tools Engine reste absent dans ce checkout ; il n'a pas été simulé. Opportunités, recommandations et actions autonomes non développées. Le bouton frontend recalcule à 7 jours ; horizon 30 accessible via API. Pas de scan planifié ni de rattrapage historique automatique des anomalies. Les historiques de résultats sont conservés sans tâche de purge ; chaque résultat et chaque lecture sont bornés/paginés. Le coût de la santé stock reste proportionnel au nombre de dépôts actifs. La collecte ERP n'est pas un instantané comptable verrouillé de toutes les tables ; la publication analytique, elle, est atomique et les séries utilisées sont conservées pour les forecasts.

## 15 — Git

Aucun commit ni push. Changements laissés pour inspection via `git status --short`, `git diff`, fichiers non suivis du manifeste et migration 0002. Aucune modification de .env, credentials, migration antérieure, base réinitialisée ou historique Git. Les résultats et formules sont inspectables avant validation par l'utilisateur.
