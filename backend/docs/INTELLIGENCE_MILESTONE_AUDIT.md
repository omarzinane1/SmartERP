# Audit préalable — Intelligence milestone — 2026-10-12

Base inspectée : `8b9be6e`, arbre Git propre avant intervention. Application React réelle : `smarterp-ai/` ; le dossier `frontend/` indiqué dans la mission n'est pas l'application.

| Fonction | État initial | Constat |
|---|---|---|
| Business Health | PARTIAL | Créances, seuils de stock par dépôt, flux nets confirmés ; scores nuls, pas de ventes/dépenses/dettes ni explications par dimension. |
| Anomalies | PARTIAL / MISSING | AIAlert porte déjà historique, cycle de vie, déduplication et permissions. Trois règles ERP ; aucune méthode statistique. Réutiliser ce modèle plutôt que dupliquer les statuts dans DetectedAnomaly. |
| Prévisions | MISSING | Modules forecast vides ; cartes actuellement alimentées par des risques observés. Aucun modèle évalué, historique ou résultat quantitatif. |
| Orchestration | IMPLEMENTED | IntelligenceRun, verrou Company, clé d'idempotence, publication après commit, bail et fencing, contrôle des droits avant publication. |
| RBAC / isolation | IMPLEMENTED | ai.use et droits des sources ; permissions forecast.view et forecast.recalculate présentes au catalogue. Aucun bypass superuser. |
| Secure Tools Engine | MISSING | Fichiers tools/agents vides, pas de registre ou AIToolContext trouvé. Utiliser les selectors officiels, sans prétendre intégrer un moteur absent. |
| Frontend | PARTIAL | API réelle par défaut, mais mock opt-in et libellés sans prévision. Conserver layout/CSS et brancher les résultats statistiques. |

Sources inspectées : intelligence models/services/selectors/tasks/views/tests ; finance summary_selectors/expense_selectors/models ; reporting dashboard/analytics ; purchasing selectors/models ; CRM selectors ; inventory selectors et règles existantes ; accounts catalogue/RBAC ; audit sanitizer ; common dates/views/dispatch ; configuration Celery. Contrats, API, hook, page et quatre composants Control Center lus.

Risques identifiés : les dépenses du résumé Finance n'appliquent pas encore le filtre devise et fournisseur utilisé par d'autres lecteurs ; harmoniser ce selector avant réutilisation. Le CA doit rester HT net d'avoirs et ne pas être confondu avec les commandes. Le flux net n'est pas un solde bancaire. Les jours avant le premier événement ne doivent pas être remplis artificiellement. Le jour courant incomplet sera exclu des modèles.

Dépendances : requirements/base.txt ne contient ni NumPy, pandas, sklearn, statsmodels, scipy. Les calculs retenus (quartiles, moyenne mobile, tendance linéaire, MAE/RMSE) sont réalisables en Decimal avec la bibliothèque standard ; aucun ajout prévu.

Décisions : santé sans score ni poids ; un détecteur de dépenses quotidiennes sur journées closes ; prévisions CA et flux net quotidiens, horizons 7/30 jours, comparaison temporelle naïf/moyenne mobile/tendance. AIAlert enrichi pour les observations statistiques ; ForecastRun avec résultat JSON borné (historique et points monétaires sérialisés en chaînes), utilisé par l'API et l'UI. Aucun snapshot santé sans usage UI. Les résultats seront publiés ensemble après revalidation des droits ; une erreur technique annule la publication, une insuffisance de données est un résultat explicite.
