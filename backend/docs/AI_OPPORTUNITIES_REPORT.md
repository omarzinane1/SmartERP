# SmartERP AI — Opportunités IA

Date : 2026-10-12. Backend Django/PostgreSQL ; frontend réel `smarterp-ai/`. Audit préalable : [AI_OPPORTUNITIES_AUDIT.md](AI_OPPORTUNITIES_AUDIT.md). Cette livraison prolonge le milestone santé/anomalies/prévisions présent dans le même arbre non commité.

## 1 — Status

| Fonction | Statut | Périmètre livré / limite |
|---|---|---|
| Opportunity Engine | DONE | Détecteurs déterministes, persistance, droits, publication atomique, API et UI |
| Customer Reactivation | DONE | Commandes confirmées, historique et inactivité vérifiables |
| Customer Value | DONE | CA HT net d'avoirs, percentile du portefeuille et activité récente |
| Upsell | NOT IMPLEMENTED | Aucune hiérarchie produit premium fiable ; pas de produit supérieur inventé |
| Cross-sell | NOT IMPLEMENTED | Moteur d'association/support non développé dans cette version |
| Receivables | DONE | Priorisation agrégée par client, ancienneté et part des créances échues |
| Replenishment | DONE | Règle de sorties historiques ; aucune prévision produit revendiquée |
| Dormant Stock | DONE | Stock positif valorisé et dernier mouvement connu ancien |
| Margin | NOT IMPLEMENTED | Coût historique des ventes non établi pour une marge fiable |
| Supplier Optimization | NOT IMPLEMENTED | Comparaison qualité/délais/produits équivalents non établie |
| Expense Optimization | NOT IMPLEMENTED | L'anomalie quotidienne existante ne démontre pas une économie récurrente |
| Sales Trend / forecast produit | NOT IMPLEMENTED | Prévisions disponibles au niveau CA/flux société, pas catégorie/produit |
| Secure AI Tools Engine | NOT IMPLEMENTED | Absent de ce checkout ; selectors ERP existants utilisés directement |

## 2 — Files

Le manifeste [AI_OPPORTUNITIES_FILES.md](AI_OPPORTUNITIES_FILES.md) distingue les fichiers créés, modifiés et supprimés et conserve la visibilité sur les changements du milestone précédent.

Ajouts principaux : `opportunity_config.py`, `opportunity_detectors.py`, `opportunity_selectors.py`, `opportunity_services.py`, modèle/migration 0003, tests PostgreSQL et navigateur, documentation. Modifications : orchestration IntelligenceRun, contrats/API/hooks/pages existants. Suppression des fonctions de mocks d'opportunités dans le fichier partagé ; les mocks assistant/prévisions séparées restent présents.

## 3 — Model

`AIOpportunity` est distinct de `AIAlert`. Company obligatoire ; type/domain/fingerprint ; titre/description/reason ; priority/status ; entity_type/entity_id et warehouse nullable ; estimated_value Decimal(30,6) nullable, currency, confidence nullable ; source/detector/version ; metadata bornée aux observations ; condition_active ; detected_at/last_seen_at/expires_at/created_at/updated_at ; acknowledged/dismissed/completed_at et acteurs User ; expired_at.

États : open, acknowledged, completed, dismissed, expired. Priorités : low, medium, high, critical (aucun détecteur V1 ne produit critical). Contraintes SQL : statut/priorité valides, valeur absente ou non négative, unicité `(company, fingerprint)` lorsque condition_active=True. Index : company/status/priority, company/type/detected_at, company/expires_at. FK PROTECT ; l'intégrité tenant des identifiants métier est également revalidée dans les selectors de lecture. Migration additive `0003_aiopportunity`, dépendant de 0002 déjà appliquée ; aucune migration antérieure modifiée.

## 4 — Detectors

Tous utilisent la Company du run, sa devise et son fuseau. Constantes centralisées dans `opportunity_config.py`, version `opportunities-v1`. Date de scan = jour local courant ; les journées calendaires sont inclusives sauf seuil dormant strict. Les objets archivés, devises incompatibles et relations inter-sociétés sont exclus par les selectors.

| Détecteur / domaine / source | Sources et règle | Fenêtre et minimum | Valeur | Priorité |
|---|---|---|---|---|
| customer_reactivation / sales / rule_based | SalesOrder confirmed/processing/completed, date de confirmation locale. Dernière commande au moins 90 jours avant le scan | 365 jours, ≥3 commandes | null ; montant historique HT uniquement dans les mesures | medium |
| high_value_customer / sales / analytics | Factures comptabilisées HT moins avoirs comptabilisés HT, par client. CA strictement supérieur au percentile 75 des clients à CA positif | 365 jours, ≥10 clients, ≥3 factures pour le candidat, dernière facture depuis ≤30 jours | null ; aucune vente future supposée | medium |
| receivable_collection / finance / analytics | Solde exigible des factures échues regroupé par client. Part ≥20 % du total échu accessible de la société et plus ancienne échéance ≥30 jours | Soldes actuellement ouverts ; pas de duplication par facture | Somme Decimal des balance_due ; exposition constatée, sans probabilité de recouvrement | high si âge ≥60 jours ou part ≥50 %, sinon medium |
| stock_replenishment / inventory / rule_based | Produits physiques actifs, stock disponible ≤minimum, sorties de type issue des 30 derniers jours >disponible | ≥3 jours distincts de sorties. Par produit/dépôt actif | null ; quantité à examiner=max(minimum, sorties historiques)−disponible | high si stock nul, sinon medium |
| dormant_stock / inventory / rule_based | StockLevel positif et valeur positive, dernier StockMovement connu vieux de >90 jours | Dernier mouvement connu obligatoire ; un mouvement récent, même entrant, exclut le candidat | StockLevel.total_value en coût moyen pondéré | medium |

Percentile : tri des CA agrégés, interpolation Decimal entre les positions `floor((n−1)*0.75)` et suivante. Aucun arrondi float. Factures/avoirs réutilisent les sources financières officielles. Réapprovisionnement : sorties opérationnelles, pas nécessairement ventes, aucune forecast déguisée. Stock dormant : délai depuis dernier mouvement, pas âge des lots.

Agrégations SQL, sous-requêtes corrélées et annotation des dates. Python reçoit au plus 5 001 candidats agrégés pour détecter un dépassement, avec plafond global 5 000 ; dépassement = échec contrôlé sans résultats partiels. Même borne pour les conditions persistantes à réconcilier. Les commandes/factures brutes ne sont pas chargées en masse. La boucle stock reste proportionnelle au nombre de dépôts.

## 5 — Scoring

**No artificial scoring implemented.** Priorités catégorielles selon les seuils ci-dessus. Aucun poids, AI Score, pourcentage de confiance, probabilité de gain ou revenu additionnel inventé. confidence=null pour les cinq détecteurs. Les montants restent Decimal en base et chaînes décimales dans JSON et l'affichage frontend.

## 6 — Deduplication

Fingerprint : `type:entity_type:entity_id:warehouse_id_or_0`, complété par Company dans l'unicité SQL. Pas de date quotidienne dans la clé. Un nouveau scan actualise les observations et la validité de la même condition. Statuts acknowledged/completed/dismissed conservés : un rejet ou traitement manuel supprime les réapparitions tant que la condition persiste.

Condition disparue : condition_active=False ; un éventuel retour ultérieur crée un nouvel épisode. Le verrou Company est partagé avec le claim/publication IntelligenceRun et les transitions ; contrainte partielle SQL comme protection supplémentaire. La réconciliation touche uniquement les types autorisés et effectivement scannés ; les autres domaines restent inchangés.

## 7 — Lifecycle

Transitions manuelles : open→acknowledged, open/acknowledged→dismissed, acknowledged→completed. Répéter la même transition terminale/prise en charge est idempotent, sans deuxième audit. Autres transitions : 409. Acteur issu du membre courant, jamais du corps HTTP. Services atomic et contrôle renouvelé de Company/RBAC/source.

Au rescan, une condition disparue passe d'open/acknowledged à expired avec date et audit, jamais automatiquement completed. Une clôture manuelle indique la décision de l'utilisateur ; elle ne prouve pas une opération comptable automatique.

Validité : sept jours depuis dernière observation. À la lecture, une opportunité open/acknowledged dont expires_at est passé apparaît expired, disparaît du résumé et refuse les actions. Cette expiration temporelle est calculée, sans écriture sur GET ; un scan qui confirme encore la condition renouvelle la même ligne et son statut précédent. Une disparition constatée par scan enregistre au contraire l'expiration en base. Aucun job quotidien d'expiration requis.

## 8 — API

Toutes les URL sont préfixées `/api/`. Authentification et Company serveur obligatoires. Permission commune opportunités : ai.use + ai.opportunities.view + permissions source du type.

| Méthode | URL | Permission complémentaire | Usage |
|---|---|---|---|
| GET | ai/opportunities/ | sources autorisées | Liste paginée, count/next/previous, permissions/availableTypes/lastRun/asOf |
| GET | ai/opportunities/:id/ | source du type | Détail et observations filtrées, actions autorisées |
| POST | ai/opportunities/:id/acknowledge/ | source du type | Prise en charge du membre courant |
| POST | ai/opportunities/:id/dismiss/ | source du type | Rejet manuel |
| POST | ai/opportunities/:id/complete/ | source du type | Clôture après prise en charge |
| POST | ai/control-center/refresh/ | ai.use + au moins une source | Run commun asynchrone, Idempotency-Key, 202 |
| GET | ai/runs/:id/ | ai.use, propriétaire du run | Suivi, résumé masqué si droits du périmètre révoqués |
| GET | ai/control-center/ | ai.use, filtrage par sources | Résumé opportunités et compteur exact |

Sources : réactivation = customers.view + sales.view ; valeur/créances = customers.view + invoices.view ; stock = products.view + inventory.view. Sans permission commune : 403 ; objet étranger/inaccessible : 404. Aucun bypass superuser. Corps des transitions vide ; company_id/user_id/membership_id refusés (403), champs inconnus refusés (400).

Filtres : status, priority, type, domain, date_from/date_to inclusifs dans le fuseau société, search (titre/reason, max150), page/page_size. Pages backend 50 par défaut, maximum100 ; UI25. Tri fixe priorité décroissante, date décroissante, ID décroissant. Fenêtre inversée ou valeur invalide : 400.

Contrat conservé/adapté : id numérique, type/title, potentialValue nullable (désormais chaîne Decimal), currency/valueKind, confidence=null, evidence/recommendation/source. Ajouts : reason/description/domain/priority/status, entity, metrics allowlistées, detector/version, dates/acteurs et actions. Aucune metadata brute. Les anciennes affectations fictives deviennent la prise en charge demandée. Les liens autorisés ouvrent `/customers/:id` ou `/products/:id` ; aucune instruction métier arbitraire.

## 9 — Control Center

Top5 parmi conditions actives open/acknowledged, non expirées, devise actuelle et sources encore autorisées. Ordre critical/high/medium/low, puis récent/ID. `stats.opportunities` compte tout ce même ensemble, pas seulement les cinq cartes. Chaque carte ouvre `/ai/opportunities?opportunity=:id`. Aucun pourcentage null affiché, aucune confusion avec AIAlert.severity.

## 10 — Celery

Task existante `run_company_intelligence(run_id)` ; publication after_commit, seul l'ID transite dans Valkey. Phases règles/santé/anomalies/forecasts/opportunités puis publication globale atomique. IntelligenceRun conserve les types sous `opportunity:<type>` dans son périmètre figé. Membres et permissions vérifiés au claim puis à nouveau avant publication, en plus du bail et claim token.

Refresh manuel partagé ; aucune planification automatique ajoutée. Idempotency-Key évite les doublons de requête ; un run actif par Company. Pas de retry automatique des erreurs déterministes. Échec contrôlé `analysis_failed`, `detection_limit` ou `access_revoked` selon cause ; anciens résultats conservés. Publication des alertes, forecasts, opportunités et résumé dans la même transaction, sans état partiel. Compteurs opportunités created/updated/expired/detected et version dans le résumé.

## 11 — Data quality

Réactivation : commandes annulées/brouillons exclues ; trois commandes ne prouvent pas une périodicité commerciale. Valeur client : portefeuille minimum10, CA facturé net et non encaissements, credits de la fenêtre civile pouvant porter sur des ventes antérieures. Créances : priorisation de l'exposition actuelle, pas score de solvabilité ni preuve de bon payeur. Stock : sorties opérationnelles pouvant inclure consommation interne ; commandes en transit, réservations et délais non modélisés dans la suggestion. Dormant : coût moyen pondéré uniquement, dernier mouvement connu requis ; pas de péremption/lot ni gain garanti.

Peu de données = aucune opportunité du détecteur concerné, jamais fallback de démonstration. Une configuration de valorisation non prise en charge provoque un échec contrôlé du run. La collecte entre tables n'est pas un instantané comptable global verrouillé ; la publication est atomique. Les règles supposent des journaux ERP suffisamment complets et une devise société cohérente.

## 12 — Security

Tenant explicite à chaque source, agrégat, résultat et lookup ; FK partenaires/produits/dépôts vérifiées même pour des données corrompues. Droits de sources appliqués aux cartes, compteurs, détails, transitions, candidats et résumé de run. Paramètres client de contexte refusés. Cache frontend séparé par utilisateur/Company, filtres et identifiant de détail. Aucune requête SQL produite par un LLM. Aucun changement automatique de prix, stock, paiement, commande, devis, validation ou email.

## 13 — Audit

Refresh manuel : intelligence.refresh_requested (run_id, status, version). Exécution : intelligence.started/completed/failed et événements analytiques existants. Transitions : intelligence.opportunity_acknowledged, intelligence.opportunity_dismissed, intelligence.opportunity_completed ; disparition de condition : intelligence.opportunity_expired. Avant/après limités aux statuts ; version/ID du run allowlistés, aucun dataset ni prompt. Aucune notification/email d'opportunité.

## 14 — Tests

Validation finale : suite PostgreSQL complète, 353 tests réussis (225,386 s), puis 167 tests ciblés Intelligence/Finance/Reporting/Notifications réussis (177,910 s), zéro échec ou erreur. Check, makemigrations --check et migrate réussis ; build et lint frontend réussis. Playwright : 13 tests Opportunités/Control Center réussis en 39,0 s. Fixture de date stabilisée au midi du fuseau de la société pour les exécutions nocturnes.

Les tests navigateur interceptent des contrats API et vérifient les composants réels ; ils ne constituent pas un parcours contre la base de développement. Les tests Django exécutent les vrais modèles/services et migrations sur PostgreSQL isolé, avec Celery eager ; aucune réinitialisation de la base applicative.

Guide manuel — utiliser une société de test et les droits source correspondants :

1. **Réactivation** : client avec ≥3 commandes confirmées dans les365 derniers jours, dernière confirmation il y a ≥90jours. Lancer « Actualiser les opportunités », attendre completed, filtrer Réactivation client, ouvrir le détail, comparer dates/compteur puis « Prendre en charge ». Vérifier acteur/date et absence de devis/email.
2. **Créances** : deux factures comptabilisées du même client avec solde, ancienne échéance ≥30jours, total représentant ≥20% des échus société. Analyser ; une seule opportunité client. Comparer le solde exact ; régler via Finance puis rescanner : l'opportunité expire sans être automatiquement completed.
3. **Réapprovisionnement** : réception préalable puis sorties sur ≥3 dates des30 derniers jours ; disponible ≤minimum et sorties cumulées >disponible. Analyser ; vérifier dépôt/quantités et absence de montant futur. Réapprovisionner via l'écran stock, rescanner : expiration.
4. **Dormant** : réception valorisée remontant à >90jours, quantité et valeur encore positives, aucun mouvement ultérieur. Analyser ; comparer la valeur comptable. Un mouvement récent puis nouveau scan fait disparaître la condition.
5. **Déduplication** : analyser deux fois sans changement ; mêmes IDs, dates de vérification actualisées. Prendre en charge puis terminer, ou écarter ; rescanner sans réouverture. Faire disparaître puis revenir la condition et vérifier un nouvel épisode. Contrôler top5/compteur puis changer de société : aucune fuite.

## 15 — Frontend

Page/cartes/dialogue/composants/classes CSS conservés, aucun changement de couleur/spacing/design system. Liste paginée et filtres serveur, détail query avec annulation/scope, boutons issus des actions autorisées, refresh202 et polling, affichage des erreurs sans faux succès. Montants décimaux formatés sans conversion float ; libellés « solde échu » / « valeur comptable immobilisée ».

Supprimés : opportunityStore, opportunitiesMock, opportunityAssigneesMock, opportunityByIdMock, assignOpportunityMock et branches API correspondantes. Control Center mock déjà supprimé au milestone précédent. Restants : assistant, page forecasting séparée et autres modules encore contrôlés par leurs flags existants ; `VITE_AI_WORKSPACE_USE_MOCK` n'affecte plus les opportunités. Les fixtures de tests restent explicitement confinées aux tests.

## 16 — Limitations

Version déterministe : trois règles métier, deux analyses agrégées ; aucune opportunity forecast/statistical/ML/LLM. Aucun moteur d'association ou optimisation multivariée, aucune action autonome. Les features non implémentées sont détaillées section1 ; elles ne sont pas remplacées par du texte prétendant avoir détecté un signal. Templates explicatifs alimentés par mesures ERP, sans clients ou montants codés en dur.

Seuils centralisés en code, pas de grande interface Settings. Pas de tâches récurrentes ni purge de l'historique. Plafond5000 peut nécessiter un partitionnement ultérieur pour les grosses sociétés ; jamais de troncature silencieuse. Pas d'attribution à un autre membre : la prise en charge enregistre l'utilisateur courant.

## 17 — Git

Aucun commit ni push. Base HEAD `8b9be6e`. Inspection possible via git status/diff, manifeste et migrations0002/0003. `.env`, secrets, dépendances et migrations déjà appliquées préservés. Artefacts de tests locaux ignorés par Git. Les changements du milestone précédent sont conservés dans le même arbre pour revue.
