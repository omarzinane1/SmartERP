# SmartERP AI — ordre de développement backend

Plan **PROPOSED** du 27 septembre 2026, fondé sur les routes et contrats audités. Le frontend et ses mocks ne sont pas modifiés par cette mission. Commencer par un monolithe et des tests PostgreSQL ; raccorder un domaine seulement lorsque ses permissions, enveloppes de réponse et erreurs correspondent à [API_CONTRACT](API_CONTRACT.md).

## Première tâche concrète

Créer un dépôt/dossier backend séparé avec Django, DRF et PostgreSQL, **définir le User personnalisé avant la première migration**, puis Company et Membership. Livrer une tranche verticale : session avec CSRF → login → contexte société autorisé → bootstrap de session proposé → GET /me/ → lecture d'un client scoped. Son test d'acceptation obligatoire : un utilisateur de A ne peut lire, modifier ou agréger une ressource de B, même en changeant ID/body/query/company de l'URL. Ajouter le format d'erreur commun et les fixtures de contrat dès cette tranche.

Ne pas commencer par Ollama ou les graphiques : l'identité, le scope et les montants fiables sont les entrées nécessaires à ces fonctionnalités. Les tâches ci-dessous décrivent les fichiers/modèles à créer ultérieurement ; aucun backend n'a été généré par l'audit.

## Règles de livraison de chaque phase

Définir entrée/sortie du serializer avec des exemples issus du contrat réel ; ne pas déclarer un endpoint prêt simplement parce qu'il retourne 200. Chaque phase teste modèles/contraintes, services, permissions, API, workflow et isolation société, même si certains cas sont « sans mutation » pour un rapport. Tester les erreurs et la version concurrente avant de basculer le flag mock correspondant. Les suites Playwright API interceptent HTTP : ajouter des tests d'intégration contre Django réel pour prouver le raccordement.

La convention cible snake_case/Decimal chaîne/pagination DRF nécessite des adaptateurs frontend futurs. Pour livrer sans modification immédiate de React, utiliser serializers de compatibilité avec les enveloppes/camelCase/nombres attendus. Écrire ce choix dans le contrat ; aucune conversion globale magique. Conserver la liste des écarts et ne pas activer une feature dont une sous-requête dépend encore d'un endpoint absent.

## Phase 1 — Fondations

- **Goal** : démarrage déterministe, configuration séparée et connexion PostgreSQL.
- **Models / relations** : base timestamp, User personnalisé minimal ; pas encore de modèles métier dépendants.
- **Migrations** : migration initiale User, extensions PostgreSQL seulement lorsque nécessaires ; vérifier migration depuis base vide et rollback de développement.
- **Serializers** : erreur commune et pagination de base ; conventions Decimal/date définies.
- **Business services** : contexte request_id, horloge injectable, fonctions Decimal ; aucun calcul financier en float.
- **Endpoints** : health interne proposé ; montage `/api/` avec slash terminal.
- **Permissions** : deny by default ; aucun ModelViewSet public par défaut.
- **Tests** : démarrage, settings de test, migration PostgreSQL, erreurs expurgées, dates et arrondis limites.
- **Frontend routes unlocked** : aucune encore ; fondation nécessaire.
- **Dependencies** : environnement Python/Django/DRF choisi et lock ; PostgreSQL ; variables sans secrets dans git.
- **Definition of Done** : serveur reproductible, tests passent sur PostgreSQL, pas SQLite comme seule validation des contraintes/verrous.

## Phase 2 — Session, société et RBAC

- **Goal** : identité fiable et isolation tenant de bout en bout.
- **Models / relations** : Company, Membership, Department, Role, Permission, RolePermission, MembershipRole, UserPreference/UserSession ; relations du blueprint.
- **Migrations** : contraintes user/company, rôles système protégés et catalogue complet des 82 codes réellement trouvés ; tout code proposé supplémentaire séparé et validé.
- **Serializers** : LoginResponse exact (`onboarding_completed`, `enabled_modules`), UserProfile ; permissions et capabilities calculées. DTO bootstrap distinct proposé.
- **Business services** : authenticate/login/logout, active company, can/can_grant, selectors scoped, révocation de session.
- **Endpoints** : POST auth/login, GET/PATCH me, DELETE me/sessions/:id ; GET auth/session, GET auth/csrf, POST auth/logout proposés.
- **Permissions** : session/membership actives ; droits par action+objet, société résolue serveur ; aucun rôle assignable hors délégation.
- **Tests** : login valide/invalide/désactivé, CSRF, expiration, session A/B, mutation sans droit, rôle système et auto-élévation, ID de profil étranger.
- **Frontend routes unlocked** : /login et partie identité/préférences/sessions de /profile ; bootstrap exige future adaptation App/RequireAuth.
- **Dependencies** : phase 1, choix cookies même origine.
- **Definition of Done** : aucun endpoint ne fait confiance au company_id client ; test A→B retourne 404/403 sans fuite ; permissions obtenues depuis une source unique.

## Phase 3 — Onboarding, administration, modules et paramètres

- **Goal** : une société configurable avec délégation sûre.
- **Models / relations** : Branch, ModuleDefinition/Dependency, CompanyModule, CompanySetting, NumberSequence, IntegrationConnection, Invitation, MFADevice, AuditLog.
- **Migrations** : modules et dépendances seed, uniques par société/section/module ; MFA protégé ; numérotation initiale explicite.
- **Serializers** : payload onboarding imbriqué, UsersData/RolesData/Permission, SettingsData/section values/policies/options, ModulesData, challenges 2FA. Conserver version de rôle/settings.
- **Business services** : onboarding atomique, activate/deactivate module, update setting validé, invite/assign/suspend, password/MFA, audit expurgé.
- **Endpoints** : company/onboarding ; admin/users, invitations, roles, permissions ; modules et companies/:id/modules/:key/enable/disable ; settings/:section ; me/password et me/2fa ; audit-logs ; ai/status initialement offline réel.
- **Permissions** : users.manage, roles.assign/manage, modules.manage, settings.view/manage, audit.view/export + politique de section/capabilities.
- **Tests** : dépendances de modules, licence, données conservées à désactivation, section inconnue/verrouillée, version 409, rôle non grantable, invitation expirée, MFA anti-rejeu et secrets absents des logs.
- **Frontend routes unlocked** : /onboarding, /modules, /settings, /admin/users, /admin/roles, /admin/audit-logs, /profile complet selon capacités livrées.
- **Dependencies** : phase 2 ; mail via outbox/job pour invitations ; entrepôt initial à différer/relier à phase 5.
- **Definition of Done** : retour société nouvellement créée spécifié (écart company:null identifié), aucune invitation annoncée livrée sur simple création mock, rollback cohérent des réglages.

## Phase 4 — Référentiels clients et fournisseurs

- **Goal** : partenaires utilisables dans toutes les pièces.
- **Models / relations** : Customer/Contact/CustomerNote, Supplier ; commercial/acheteur via Membership, société explicite.
- **Migrations** : références et index recherche/statut/propriétaire ; contraintes d'archivage et champs normalisés.
- **Serializers** : CustomersData et Supplier/SuppliersData, détail, permissions, options ; métriques peuvent être null/non disponibles si leur historique n'existe pas, jamais copiées des seeds.
- **Business services** : create/update/archive, portefeuille scoped, résumés et activités ; import validé comme tâche si gros volume.
- **Endpoints** : customers CRUD/import/detail/summary/activity ; suppliers CRUD/detail/metrics/price-history ; insight disponible seulement si service livré.
- **Permissions** : customers.*, suppliers.*, droits des onglets ventes/factures/paiements indépendants.
- **Tests** : unicité, scopes de commercial/acheteur, partenaires archivés, pagination fournisseurs, export complet et autorisé, aucune donnée financière non permise.
- **Frontend routes unlocked** : /customers, /customers/:id, /suppliers, /suppliers/:id ; onglets dépendants progressivement.
- **Dependencies** : phases 2–3 ; futures pièces pour KPI réels.
- **Definition of Done** : créations réelles et relecture stable ; données de B absentes des listes, détails, recherche et exports de A.

## Phase 5 — Produits, dépôts et noyau de stock

- **Goal** : catalogue et une autorité unique de quantités/coûts, utilisable par ventes et réceptions.
- **Models / relations** : Product, ProductCategory, Unit, Warehouse, WarehouseStock, StockMovement, StockReservation ; fournisseur principal de phase 4.
- **Migrations** : SKU unique/company, stock unique company/warehouse/product, index journal, precision Decimal ; stock initial via mouvement d'ouverture traçable.
- **Serializers** : Product/Catalog, InventorySummary/Health, WarehousesData/Detail/Valuation ; données de service physiques null.
- **Business services** : catalogue, create warehouse, selector disponible, **service interne** post_stock_movement/valuation transactionnel dès cette phase ; réservations initiales.
- **Endpoints** : products CRUD/metrics/history/import, warehouses/read/create/summary/inventory/movements/valuation, inventory summary/health/critical/recent-movements.
- **Permissions** : products.*, inventory.view/analytics.view/movements.view, warehouses.* ; coûts et valeurs selon droits.
- **Tests** : service non stockable, SKU doublon, disponibilité/réserve, précision, stock concurrent, coûts historiques, interdiction produit/dépôt d'autre société.
- **Frontend routes unlocked** : /products, /products/:id, /inventory, /warehouses, /warehouses/:id en lecture et création livrée.
- **Dependencies** : 2–4 ; décision identifiants dépôt/produit pour anciens DTO achats.
- **Definition of Done** : une réception/livraison future pourra utiliser ce service sans réimplémenter le stock ; invariants before+delta=after prouvés.

## Phase 6 — Devis, commandes et livraisons clients

- **Goal** : chaîne commerciale avec états indépendants.
- **Models / relations** : Quote/Line, SalesOrder/Line, Delivery/Line ; liens client/produit/dépôt et origine devis.
- **Migrations** : lignes ordonnées, séquences, uniques de conversion, snapshots de prix/taxes/coûts, indices état/date.
- **Serializers** : QuoteDTO/DetailDTO snake_case existants ; SalesOrderDetail camelCase de compatibilité ; capabilities calculées.
- **Business services** : calculate_totals, save/send/accept/expire/convert quote, confirm order, reserve/release stock, deliver partiellement.
- **Endpoints** : quotes CRUD/send/duplicate/accept/convert ; sales-orders list/detail/confirm/delivery ; invoice action liée à phase 7.
- **Permissions** : quotes.*, sales.view/edit/margin.view, delivery.create, invoices.create ; chaque transition revalidée.
- **Tests** : remises/taxes arrondies, expiration, double conversion, livraison partielle/excessive, réservations concurrentes, marge masquée, scopes commerciaux.
- **Frontend routes unlocked** : /quotes, /quotes/new, /quotes/:id, /sales, /sales/:id.
- **Dependencies** : 2–5 ; mail asynchrone pour send ; approbation si remise sensible non encore livrée=>capability false.
- **Definition of Done** : stocks réservés/livrés exacts et aucune confusion entre livraison, facturation et paiement.

## Phase 7 — Factures clients, encaissements et trésorerie

- **Goal** : créances, soldes et cash fiables.
- **Models / relations** : CustomerInvoice/Line, Payment, PaymentAllocation, CashAccount/CashEntry, TaxRate, IdempotencyRecord ; liens commande/facture.
- **Migrations** : contraintes cibles/amount, références, index échéance/journal et unique idempotence ; montants Decimal.
- **Serializers** : InvoiceSummary/Detail/Input, Payment/PaymentsData/Summary, AgingBucket, CashFlowData ; documenter confirmed/completed et nombres transport.
- **Business services** : post_invoice, invoice_order, allocate/cancel_payment, remaining, overdue, aging et cash aggregates.
- **Endpoints** : invoices CRUD/aging/post/send/payment/remind ; sales-orders/:id/invoice ; payments CRUD lecture/create/cancel/summary ; finance cash-flow/upcoming/forecast de scénario explicitement déterministe.
- **Permissions** : invoices.*, payments.*, finance.view/cashflow.view ; refus du paiement sans autorisation et solde validé.
- **Tests** : total, paiement partiel, remaining, échéance aujourd'hui/retard, frontières 30/31/60/61/90/91, annulation une fois, concurrence sur solde, double clic/idempotence, cash sans double compte.
- **Frontend routes unlocked** : /invoices, /invoices/new, /invoices/:id, /payments entrant, /finance/cash-flow.
- **Dependencies** : 2–6 ; sorties fournisseurs seulement après phase 8, dépenses après phase 10.
- **Definition of Done** : journal canonique commun aux trois façades de paiement prévues, contrats numériques testés, aucune facture B accessible depuis A.

## Phase 8 — Achats, réceptions et dettes fournisseurs

- **Goal** : commande→réception→facture→règlement fournisseur cohérents.
- **Models / relations** : PurchaseOrder/Line, Receipt/Line, SupplierInvoice/Line, SupplierPriceObservation ; fournisseur, produit et dépôt réels.
- **Migrations** : FK produit nécessaire malgré absence actuelle de productId dans PurchaseLine ; contraintes quantités/cibles/prix ; uniques référence externe selon règle choisie.
- **Serializers** : PurchaseOrdersData/Detail, ReceiptInput, SupplierInvoicesData/Detail et aging ; adaptateur nom dépôt vers identifiant sans ambiguïté à spécifier.
- **Business services** : send/confirm/receive_purchase, create/post supplier invoice, three-way match, outgoing payment via finance unique, supplier metrics/price history.
- **Endpoints** : purchase-orders CRUD/send/confirm/receive/bill ; supplier-invoices CRUD/aging/post/payment ; métriques fournisseurs alimentées réellement.
- **Permissions** : purchases.view/create/edit/confirm, receipts.create, supplier_invoices.*, payments.create ; canSend/canPost/canBill explicitement produits.
- **Tests** : réception partielle/excessive/concurrente, réception service sans stock, atomicité Receipt+Movement, écarts de rapprochement, facture partiellement payée/annulée, aging dettes.
- **Frontend routes unlocked** : /purchases, /purchases/:id, /supplier-invoices, /supplier-invoices/:id, paiements sortants et fiches fournisseurs complètes.
- **Dependencies** : 4–7 ; service stock phase 5 ; autorisation de commandes sensibles via phase 10 ou capability bloquée.
- **Definition of Done** : aucun stock inventé à partir d'un nom produit ; commandes, réceptions, factures et paiement montrent les mêmes quantités/soldes.

## Phase 9 — Journal public, ajustements et transferts

- **Goal** : rendre les opérations stock auditables et concurrentes.
- **Models / relations** : StockTransfer/Line, réutilisation StockMovement/Reservation ; source/destination et produit protégés.
- **Migrations** : source!=destination, quantités expédiées/reçues bornées, clés sources uniques, référence de transfert.
- **Serializers** : MovementData/Input, TransferData/Input/StockTransfer, supportsStatusPatch et capabilities.
- **Business services** : adjustment, dispatch_transfer, complete_transfer, cancel avant expédition/retour contrôlé ; correction par contre-mouvement.
- **Endpoints** : inventory/movements GET/POST/detail ; inventory/transfers GET/POST/PATCH/complete.
- **Permissions** : inventory.movements.view/create, inventory.transfers.view/create/approve, inventory.export, scopes de dépôts.
- **Tests** : réserve protégée, règle négatif, conservation physique+transit, double completion, produits/dépôts inactifs, mouvements immutables, mise à jour concurrente ; réception partielle service si implémentée.
- **Frontend routes unlocked** : /inventory/movements, /inventory/transfers et actions depuis fiches produit/dépôt.
- **Dependencies** : 5, 8 ; approbation seuil sensible phase 10.
- **Definition of Done** : completion entière conforme au contrat actuel ; réception partielle marquée PROPOSED et non présentée comme UI disponible.

## Phase 10 — Dépenses et approbations humaines

- **Goal** : séparer demande, décision et exécution.
- **Models / relations** : Expense/Category, ApprovalRequest/Comment/Execution, OutboxEvent, Job ; cibles typées finance/achats/stock.
- **Migrations** : versions et transitions, unique exécution, payload schema, origine expense ; audit append-only.
- **Serializers** : ExpensesData, ApprovalsData/ApprovalRequest/Decision, allowedApprovalTypes et capabilities ; futur état execution distinct documenté.
- **Business services** : submit/approve/reject expense, dispatcher d'approbation, exécution idempotente, règlement dépense avec CashEntry unique.
- **Endpoints** : expenses GET/POST/submit/approve ; approvals GET/detail/approve/reject ; création, paiement dépense et suivi exécution proposés à intégrer séparément.
- **Permissions** : expenses.*, approvals.view/approve + type/scope/seuil ; séparation demandeur/approbateur selon politique.
- **Tests** : commentaire/version, deux approbateurs simultanés, cible changée entre lecture/décision, retry effet externe, dépense approved non assimilée paid, auto-approbation refusée si requise.
- **Frontend routes unlocked** : /expenses, /approvals ; activation des capabilities sensibles des phases 6/8/9 une fois leur handler livré.
- **Dependencies** : 7–9 ; documents justificatifs complets phase 12.
- **Definition of Done** : aucune action sensible exécutée par un booléen client ; audit lie proposition, décision et résultat effectif.

## Phase 11 — Reporting et dashboard

- **Goal** : KPI et exports issus des données canoniques.
- **Models / relations** : ReportRun, Job ; aucune table indépendante par graphique.
- **Migrations** : snapshots/version/fichiers privés, index company/requester/date.
- **Serializers** : DashboardData, ReportDefinition/GeneratedReport, AnalyticsReport/ReportAnalysis ; mapping douze IDs catalogue vers onze handlers.
- **Business services** : selectors agrégés, rapport explicite par type, période précédente, snapshot immutable, export borné ou job.
- **Endpoints** : dashboard/summary ; reports/catalog/recent/generate/:type/:type/export/:type/ai-analysis (analyse seulement quand disponible).
- **Permissions** : reports.view/generate/export, analytics.view si retenu, permissions des sources et champs financiers.
- **Tests** : égalité KPI/table/export sur filtres, pagination sans perte d'agrégat, snapshot stable, date-only/timezone, N+1/query budget et corpus volumineux, fichier B inaccessible à A.
- **Frontend routes unlocked** : /dashboard, /reports, /reports/:type.
- **Dependencies** : 4–10 ; storage/job pour exports longs.
- **Definition of Done** : pas de KPI repris du mock ni « profit » calculé comme cash ; formats autorisés seulement si implémentés.

## Phase 12 — Documents, parsing et RAG

- **Goal** : fichiers privés interrogeables avec citations autorisées.
- **Models / relations** : Document/Page/Chunk/Grant/Link/IndexRun, Job ; metadata PostgreSQL, binaires séparés.
- **Migrations** : extension pgvector, dimension/version embeddings, index document/company, ACL et génération unique ; index ANN seulement après mesure.
- **Serializers** : multipart metadata, DocumentRecord/List/Detail/Page, DocumentAnswer/Analysis/Source ; limites/visibilité/capabilities réelles.
- **Business services** : validate/store/upload/delete, pipeline Docling→chunks→BGE-M3→pgvector, retrieve scoped avant LLM, contrôle citations et révocation.
- **Endpoints** : documents CRUD/pages/index ; ai/documents/:id/query/analyze ; suivi Job proposé/polling à intégrer.
- **Permissions** : documents.view/upload/delete/ai_analyze + ai.use + grants/département + politique RAG.
- **Tests** : MIME usurpé/taille/pages, échec OCR/index, reprise/dédoublonnage, document A/B, chunk privé jamais transmis au modèle, citation/page vérifiable, révocation après conversation, storage privé.
- **Frontend routes unlocked** : /documents, /documents/:id ; rattachements métier nécessitent futurs endpoints dédiés.
- **Dependencies** : 2–3, 10 ; stockage privé/Celery/Valkey testés ; parser et modèle épinglés.
- **Definition of Done** : indexed seulement après publication complète, provenance de chaque extrait, aucune fuite via URLs, jobs ou logs.

## Phase 13 — Forecasts et opportunités

- **Goal** : projections reproductibles et recommandations avec preuves.
- **Models / relations** : ForecastRun, Opportunity, références evidence et assignee membership.
- **Migrations** : versions modèle/input_hash, index domain/date et statut/assignee, fraîcheur/expiration.
- **Serializers** : ForecastResult/Driver, OpportunitiesData/AIOpportunity ; nullable confidence, bornes de série.
- **Business services** : extraction déterministe, backtesting temporel, baseline puis modèle statsmodels/scikit-learn, six domaines, assignOpportunity ; pas de calcul LLM.
- **Endpoints** : forecast/:domain, recalculate, drivers ; ai/opportunities/list/detail/assign ; recalculate async à négocier avec UI.
- **Permissions** : forecast.view/recalculate, ai.opportunities.view + canAssign ; droits sur entrées métier/évidence.
- **Tests** : horizons 30/60/90/180, insuffisance, disabled policy, absence de confiance inventée, couverture des intervalles, data leakage temporel, assignee d'une autre société refusé.
- **Frontend routes unlocked** : /ai/forecasting, /ai/opportunities.
- **Dependencies** : 7–12 et historique suffisant ; certaines projections restent honnêtement indisponibles.
- **Definition of Done** : cible/unité/history/provenance expliquées, gain potentiel non assimilé à gain garanti.

## Phase 14 — Assistant et AI Control Center

- **Goal** : orchestrateur métier contrôlé avec streaming et validation humaine.
- **Models / relations** : Conversation, AIMessage, MessageSource, ToolRun, AIAlert ; ApprovalRequest pour actions proposées.
- **Migrations** : propriétaire/company, messages finalisés, sources/version, audit d'outils expurgé.
- **Serializers** : ConversationsData/Conversation, ChatEvent/AIResponseBlock, DocumentSource, AIControlCenterData ; schéma fermé des blocs.
- **Business services** : LangGraph et adaptateurs LangChain/Ollama, outils autorisés, RAG scoped, génération d'alertes, proposition d'action et reprise après approbation.
- **Endpoints** : ai/conversations GET/POST, ai/chat/stream POST SSE, ai/messages/:id/sources, ai/control-center ; mutations du centre ancien restent absentes tant que non spécifiées.
- **Permissions** : ai.use + droits outils/métier + ACL + politiques ; aucune connexion SQL libre du LLM.
- **Tests** : split frames SSE, error/done et déconnexion, timeout, sources interdites, injection dans document n'élargissant pas les droits, action sensible jamais exécutée avant approbation, reprise idempotente.
- **Frontend routes unlocked** : /ai/assistant, /ai/control-center ; flux anciens locaux à intégrer séparément.
- **Dependencies** : 10–13 et selectors fiables ; adaptation timeout/reconnexion frontend.
- **Definition of Done** : chiffres issus des services, catégories distinctes, toutes les actions auditées, aucune permission accordée par le modèle.

## Phase 15 — Intégration réelle et exploitation

- **Goal** : preuve d'intégration et exploitation récupérable.
- **Models / migrations** : vérifier toutes les migrations en base vide et sur snapshot anonymisé ; index après profils, rétention documentée.
- **Relations / serializers** : figer OpenAPI et fixtures de compatibilité, tester chaque relation croisée et masque de champ.
- **Services / endpoints** : idempotence, outbox/retry, jobs perdus/repris, pagination, disponibilité et latence ; aucun fallback mock silencieux.
- **Permissions** : audit complet des 82 codes et de la délégation ; tests par rôle et scope.
- **Tests** : Playwright contre Django réel avec tous flags false, charges ciblées, concurrence PostgreSQL, restauration DB+objets, reconnexion Valkey, expiration sessions, secrets/logs, CORS/CSRF réel navigateur.
- **Frontend routes unlocked** : ensemble des contrats livrés, y compris erreurs ; fonctionnalités non livrées restent explicitement indisponibles.
- **Dependencies** : phases précédentes selon périmètre de lancement choisi.
- **Definition of Done** : build/lint frontend, suites frontend et backend, migrations, sauvegarde/restauration et observabilité validés ; aucune API simplement présumée à partir d'un type TS.

## Stratégie de tests transversale

| Domaine | Modèles/services | API/permissions/workflow/isolation |
|---|---|---|
| Auth/admin | uniques, hash, membership, délégation, MFA et sessions | CSRF/login/logout, rôle protégé, profil courant, company URL arbitraire |
| CRM/partenaires | validation/contact/archivage, agrégats | listes/exports/detail/onglets selon portefeuille ; aucune métrique d'une société étrangère |
| Ventes | arrondis, snapshots, conversion/livraison idempotente | droits distincts confirme/livre/facture, cumul de quantités et annulation |
| Finance | total, partial, remaining, overdue, aging, cancellation | allocations concurrentes, factures fournisseurs, cash sans double compte, données A/B |
| Achats | réception/rapprochement, quantités/coûts | atomicité réception+stock, supplier/depot/product étrangers refusés |
| Stock | reservation, movement, transfer, partial service si livré | stock négatif, protection réserve, concurrence, conservation et immutable |
| Dépenses/approbations | version/type/payload, décision et exécution | self-approval, replay, absence d'effet sur rejet, payé séparé d'approuvé |
| Documents | MIME/taille, parser/index/version/storage | grants/département, job/URL privée, retriever scoped et révocation |
| Reports/IA | agrégats/snapshots, projections/backtests | export filtré, sources réautorisées, outils bornés, LLM sans SQL ni mutation libre |
| Settings/modules | validations, dépendances, versions | champs locked, privilèges, disabled sans suppression, conflits conservant données |

Tests de verrouillage avec connexions/concurrence réelles et `TransactionTestCase` ou équivalent PostgreSQL, pas seulement mocks. Exemple finance : facture total 1 000, deux paiements concurrents 700 ; au plus un passe, solde jamais négatif. Exemple stock : disponible 5, deux sorties 4 ; une seule passe. Exemple isolation obligatoire : utilisateur société A demande `/invoices/{id_de_B}/` puis tente paiement/export/source ; 404/403, aucune référence, montant ou nom de B dans le body/log public.

## Checklist globale

- [ ] Projet, PostgreSQL, User initial, migrations et erreurs communes.
- [ ] Session, CSRF, bootstrap/logout, membership et isolation de toutes les lectures/écritures.
- [ ] RBAC, rôles système/custom, délégation et capabilities serveur.
- [ ] Onboarding, société, modules, settings, profil/MFA/sessions et invitations.
- [ ] Clients, fournisseurs et options scoped.
- [ ] Produits, dépôts, stock initial et services de quantité/coût.
- [ ] Devis, commandes clients, réservations et livraisons.
- [ ] Factures clients, paiements/annulations, solde/aging/trésorerie.
- [ ] Achats, réceptions, factures fournisseurs et rapprochement.
- [ ] Mouvements, transferts, règles négatif et concurrence.
- [ ] Dépenses, approbations, exécution unique, audit et outbox.
- [ ] Rapports, dashboard, exports, snapshots et agrégats SQL.
- [ ] Fichiers privés, parsing/OCR, embeddings, pgvector et ACL de RAG.
- [ ] Prévisions validées, insuffisance, opportunités sourcées.
- [ ] Assistant SSE, outils autorisés, approbation humaine et provenance.
- [ ] Jobs/Valkey/cache, retries, limites, observabilité et sauvegardes.
- [ ] Contrats de compatibilité/adaptateurs, erreurs/champs/pagination testés dans le navigateur.
- [ ] Tous les mocks désactivés sur l'environnement d'intégration et tests contre Django réel.

## Décisions restant à valider pendant le développement

Politique de numérotation/clôture, scopes finaux par rôle, rapprochement/tolérances, annulations/avoirs, précision des quantités et valorisation, découpage des factures partielles, définition statistique de confidence et reconnaissance du revenu. Ce sont des décisions métier absentes ou partiellement simulées ; le blueprint donne des choix initiaux explicites sans les présenter comme des exigences déjà exécutées par React.
