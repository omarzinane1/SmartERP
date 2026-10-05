# Audit préalable — Reporting à Celery

Date : 2026-10-04. Dépôt réel frontend : `smarterp-ai/` (le dossier `frontend/` indiqué dans la mission n'existe pas).

| Tâche | État constaté avant développement | Décision |
|---|---|---|
| Reporting | PARTIAL : infrastructure export et GeneratedExport du jalon précédent en cours de validation | Étendre cette infrastructure, conserver ses règles de sécurité |
| Dashboard KPIs | MISSING : API `/dashboard/summary/` attendue ; source mock seulement | Réutiliser les agrégats Finance/Stock, renvoyer null pour les indicateurs non calculables |
| Analytical Reports | MISSING : 11 types frontend, contrats `AnalyticsReport` et filtres inspectés | Selectors SQL, pagination bornée, séries jour/semaine/mois, comparaison de périodes |
| Executive Dashboard | MISSING : huit KPI, séries, top clients/produits, factures récentes | Un endpoint agrégé, permissions métier sur chaque groupe, aucune analyse IA fabriquée |
| Audit | MISSING : fichiers `apps/audit` vides, UI `/audit-logs/` attendue | Service explicite, événements atomiques, champs autorisés et masquage des secrets |
| Idempotency | PARTIAL : empreinte et clé persistées sur paiements, allocations, avoirs, réceptions, mouvements, créations | Conserver les clés existantes ; registre commun pour les transitions et conversions manquantes |
| Transactions/locks | IMPLEMENTED/PARTIAL : atomic + verrou Company puis ressources, tests de concurrence existants | Audit ciblé, couvrir nouvelles décisions/replays ; PDF et fichiers lourds hors transaction |
| Numbering | IMPLEMENTED : DocumentSequence unique société/type/année, verrou Company + séquence, initialisation sur historique | Conserver les numéros ; compléter validation, fuseau société et tests de préfixes/concurrence |
| Notifications | MISSING : aucun module ; bouton cloche Topbar avec message temporaire | Notifications DB destinataire+société, consultation et marquage, branchement du bouton existant |
| Celery | MISSING : `config/celery.py` vide, aucune dépendance/configuration active | Broker via environnement, eager en tests ; nettoyage et scans périodiques explicites, aucun envoi email configuré |

## Contrats et risques relevés

- `DashboardData` impose actuellement des nombres pour marge, cash, score IA, DSO et rotation. Ces valeurs doivent devenir nullables, avec libellés d'indisponibilité, pour ne pas inventer de faits.
- Le dashboard ne vérifie pas encore de permission dans sa page. L'API vérifiera `analytics.view` et les droits des groupes métier ; le frontend utilisera les permissions retournées.
- Les rapports clients/factures sont des situations actuelles des créances dans le contrat existant. Stock/produits sont aussi des instantanés ; les filtres temporels n'en feront pas de fausses reconstitutions historiques.
- Les revenus comptables proviennent des factures postées HT moins les avoirs datés ; les commandes confirmées restent un indicateur commercial distinct. La marge reste indisponible sans coût des ventes historique.
- Les endpoints audit frontend sont `/audit-logs/`, détail et export ; prévoir aussi `/admin/audit-logs/` conforme à la mission.
- Aucune permission notifications n'existe parmi les 82 codes : utilisateur authentifié, adhésion active, destinataire et société obligatoires ; pas de code ajouté artificiellement.
- Le catalogue existant contient `reports.*`, `audit.*`, `analytics.view`, `finance.view`. Aucun contournement superuser ou nom de rôle.
- Toute notification et tout audit associés à une opération rejouée doivent être créés une seule fois dans la transaction d'origine.
- Celery ne remplace pas les transactions synchrones de stock, paiement, comptabilisation ou approbation. Aucun broker de production ni fournisseur email n'est présumé disponible.

Cet audit précède les modifications propres au jalon Reporting → Celery. Le jalon Finance/Documents/Exports reste à terminer et vérifier avant l'extension.
