# SmartERP AI — blueprint Django

Audit du 27 septembre 2026. Ce document décrit le backend **à construire**, sans l'implémenter. Les contrats effectivement appelés se trouvent dans [API_CONTRACT](API_CONTRACT.md), les 263 types métier dans [DATA_MODEL](DATA_MODEL.md), les contrôles actuels dans [RBAC_MATRIX](RBAC_MATRIX.md), et les étapes de réalisation dans [BACKEND_IMPLEMENTATION_ROADMAP](BACKEND_IMPLEMENTATION_ROADMAP.md).

**DERIVED FROM FRONTEND** : besoin directement visible dans un type, un appel ou une interaction. **BACKEND RECOMMENDATION / PROPOSED** : stockage, sécurité, normalisation ou mécanisme serveur ajouté par ce blueprint. Même lorsqu'un besoin est dérivé, son modèle Django n'existe pas encore.

## 1. Architecture retenue — PROPOSED

Un monolithe Django/DRF avec PostgreSQL, douze apps métier, un worker Celery séparé et des services de modèles locaux. Garder les transactions et les règles métier dans Django ; les workers appellent les mêmes services. Ne pas créer de microservice par écran ni de repository abstrait pour chaque table.

```text
backend/
  manage.py
  config/                 settings/{base,development,production}, urls, asgi, celery
  common/                 contexte, exceptions, pagination, monnaie, idempotence
  apps/
    accounts/             utilisateurs, sessions, MFA, memberships, rôles
    companies/            société, branches, départements, modules, settings, séquences
    crm/                  clients, contacts, notes, activité
    sales/                devis, commandes, livraisons, factures clients
    purchasing/           fournisseurs, commandes, réceptions, factures fournisseurs
    inventory/            catalogue, dépôts, quantités, mouvements, transferts
    finance/              paiements, affectations, dépenses, trésorerie, taxes
    documents/            fichiers, pages, ACL, indexation
    reporting/            selectors de KPI, rapports et exports
    intelligence/         assistant, outils, RAG, prévisions, opportunités, alertes
    approvals/            propositions typées, décisions, exécutions
    audit/                événements, jobs et outbox techniques
```

| App | Pourquoi elle existe | API/UI alimentée |
|---|---|---|
| accounts | Identité globale séparée des droits dans une société | login, profil, users, roles, sessions |
| companies | Frontière du tenant et paramètres qui influencent le métier | onboarding, modules, settings |
| crm | Cycle et contexte client réutilisés dans ventes/finance | customers, summary/activity/insight |
| sales | Une chaîne commerciale, sans confondre ses workflows | quotes, sales-orders, invoices |
| purchasing | Une chaîne fournisseur et rapprochement | suppliers, purchase-orders, supplier-invoices |
| inventory | Une seule autorité sur la quantité et le coût | products, inventory, warehouses |
| finance | Un seul journal pour encaissements/décaissements | payments, expenses, cash-flow |
| documents | Métadonnées, fichiers et droits réutilisés par tous | documents, pages, index |
| reporting | Agrégations communes, sans charger tout le métier dans React | dashboard, reports, summaries |
| intelligence | Orchestration contrôlée des modèles et outils | ai/control-center, assistant, forecast, opportunities |
| approvals | Décision humaine réutilisable, exécution contrôlée | approvals et blocs action IA |
| audit | Traçabilité durable et suivi des traitements | audit-logs, activité profil, jobs proposés |

Chaque app commence par `models.py`, `serializers.py`, `views.py`, `urls.py`, `services.py`, `selectors.py`, `permissions.py`, `tasks.py`, `admin.py`, `tests/`. Découper en sous-fichiers seulement si leur taille le justifie. `services.py` réalise les écritures et règles ; `selectors.py` fournit les lectures scoped et agrégats ; les serializers valident les entrées et produisent les DTO ; les vues authentifient, sélectionnent le contexte et appellent les services. Les tasks transmettent identifiants/contexte et réutilisent ces services. Pas de calcul monétaire ni d'autorisation cachés uniquement dans `serializer.save()` ou dans un signal.

Le déploiement Django/Python/DRF/PostgreSQL doit être épinglé dans un lock et testé comme ensemble. Les références Django 6.0 citées ici décrivent les mécanismes, pas une obligation d'adopter une version précise sans vérifier sa compatibilité avec les dépendances choisies.

## 2. Société et identité — priorité absolue

**DERIVED FROM FRONTEND** : Company est nullable au login ; le cache est indexé par user/company ; toutes les données métier appartiennent conceptuellement à une société. **PROPOSED** : User global, Membership par société, rôle attribué à la membership, contexte société active dans la session. Une permission superuser d'exploitation ne doit pas contourner silencieusement cette frontière dans les endpoints métier.

Chaque selector part de `Model.objects.filter(company=request.company)` ou d'un parent déjà scoped. Les FKs entrantes sont résolues dans ce même queryset ; vérifier également warehouse/product/customer/supplier/role/document appartenant à la société. L'URL `/companies/{companyId}/modules/...` doit être confrontée à la membership et au contexte actif. Ignorer/refuser un `company_id` arbitraire dans un body ; ne jamais s'en servir pour choisir le tenant. Pour des enregistrements étrangers, répondre 404. Les fichiers, caches, jobs, embeddings et citations sont soumis à la même règle.

Recommandation initiale : sessions Django avec cookie HttpOnly/Secure et proxy React/API de même origine, CSRF sur toutes les mutations, y compris login. Le frontend utilise déjà des cookies, pas des tokens. Ajouter un bootstrap de session distinct du GET profil actuel, un amorçage CSRF et un logout qui révoque la session. Les règles de SessionAuthentication, notamment CSRF et choix 401/403, doivent être testées explicitement. [DRF Authentication](https://www.django-rest-framework.org/api-guide/authentication/).

Alternative JWT seulement si clients mobiles/services externes le justifient : access court, refresh rotatif/révocable, détection de réutilisation, stockage sûr, protection CSRF si refresh en cookie. Cela requiert de nouveaux adaptateurs frontend et ne fait pas partie de l'implémentation actuelle. Ne pas placer un token durable en localStorage pour imiter le store existant.

## 3. Catalogue des modèles candidats

Conventions applicables **à chaque ligne du catalogue** :

- `id` PK BigAutoField sauf UUID explicitement indiqué ; les identifiants publics ne dispensent jamais du scope.
- **T** = `company_id` requis ; **P** = scope du parent indiqué (ajouter company_id si besoin de filtrage direct, contrôler sa cohérence) ; **G** = global et accès limité par utilisateur/catalogue.
- **CU** = `created_at`, `updated_at` UTC ; **C** = `created_at` UTC seulement, contenu immutable ; tous les événements portent leur date effective distincte si nécessaire. Les versions sont incrémentées sur les agrégats éditables.
- Chaque index noté complète les PK/FK/contraintes uniques existants, sans dupliquer leurs index. Les index composés commencent par company pour les listes tenant, sauf exceptions globales.
- Les relations vers partenaires, dépôts, produits et pièces comptabilisées utilisent `PROTECT` ; suppression physique réservée aux brouillons réellement inutilisés ou aux politiques documentaires contrôlées. Les noms/adresses/prix de pièces doivent rester des snapshots après validation.
- **D** = DERIVED FROM FRONTEND ; **R** = BACKEND RECOMMENDATION. Tous les champs SQL sont proposés ; le dictionnaire TS reste la référence des DTO actuels.

### Accounts

| Modèle / origine | Responsabilité, champs et relations | Scope / temps | Contraintes / uniques | Index ciblés |
|---|---|---|---|---|
| User D | email, display_name, first_name, last_name, phone, job_title, password hash Django, is_active, last_login | G / CU | email normalisé unique ; jamais password en clair | email unique |
| Membership R | user FK, company FK, department FK nullable, status active/invited/suspended/disabled, joined_at | T / CU | unique user/company ; département même société | company/status |
| Role D | company, name, description, system, version | T / CU | nom unique normalisé/company ; système non modifiable par UI | company/system |
| Permission D | code, label, module, action, active | G / CU | code unique ; catalogue seed versionné | code unique suffit |
| RolePermission R | role FK, permission FK | P rôle / C | unique role/permission | FK existantes |
| MembershipRole R | membership FK, role FK, scope_kind, department/warehouse optionnels | T / CU | rôle et membership même société ; unique attribution exacte | membership/role |
| Invitation D | membership, email, role, token_hash, expires_at, accepted_at, invited_by | T / CU | token hash unique ; invitation active réutilisable selon politique | company/email, expires_at |
| UserPreference D | user OneToOne, langue, timezone, theme, formats, notifications JSON validé | G / CU | une ligne/user ; enums/options autorisées | OneToOne |
| UserSession D | UUID public, user FK, clé session serveur chiffrée ou lien contrôlé, created_at, last_activity, expires_at, revoked_at, métadonnées appareil/IP minimisées | G utilisateur / CU | session détenue par user ; aucune clé brute dans API | user/revoked_at/last_activity |
| MFADevice R | user FK, secret chiffré, confirmed_at, last_used_counter, recovery_codes_hashes | G utilisateur / CU | un device actif initialement ; challenge court séparé ; anti-rejeu | user/confirmed_at |

Le profil reçoit sessions et activité dans `GET /me/`, pas via des endpoints GET supplémentaires actuellement. Les invitations nécessitent un e-mail asynchrone et un parcours d'acceptation absent du frontend. Le changement d'adresse email doit prévoir vérification/réauthentification avant de rendre `canEditEmail=true`. Le changement de mot de passe utilise les validateurs/hashers Django, vérifie le courant, révoque les autres sessions selon politique et n'a pas besoin du champ confirmPassword (non envoyé).

### Companies

| Modèle / origine | Responsabilité, champs et relations | Scope / temps | Contraintes / uniques | Index ciblés |
|---|---|---|---|---|
| Company D | name/legal_name/tax_id, contact/adresse, currency, timezone, onboarding_completed, onboarding_version | T racine / CU | identifiant stable ; devise contrôlée après écritures | nom selon recherche réelle |
| Branch D | company, code, name, adresse, active | T / CU | company/code unique | company/active |
| Department D | company, name, active | T / CU | company/name normalisé unique | company/active |
| ModuleDefinition D | key, name, description, availability, premium, category | G / CU | key unique ; catalogue maintenu par code/migration | key |
| ModuleDependency R | module FK, requires FK | G / C | paire unique, pas soi-même ni cycle | deux FK |
| CompanyModule D | company, module FK, enabled, enabled_by, enabled_at, entitlement | T / CU | company/module unique ; licence et dépendances | company/enabled |
| CompanySetting D | company, section, values JSON validé, schema_version, version | T / CU | company/section unique ; allowlist section/champs | unique suffit |
| NumberSequence R | company, document_type, fiscal_period, prefix, next_value | T / CU | company/type/period unique ; next_value positif | unique suffit |
| IntegrationConnection D | company, key, status, config publique validée, secret_ref, last_test_at | T / CU | company/key unique ; secret jamais dans API | company/status |

Un JSON global serait rapide mais mélange droits, versions et validations de quinze sections. Des modèles dédiés à chaque petit réglage alourdiraient la maintenance. Recommandation : `CompanySetting` **par section**, serializers explicites et version ; Company/Branch/TaxRate/CashAccount/Warehouse/Role restent des modèles relationnels. Les réglages contiennent leurs IDs, pas des copies de noms. Les secrets sont dans un gestionnaire de secrets/chiffrement adapté et seulement référencés.

Sections actuelles : general, company, branches, finance, taxes, invoices, sales, purchasing, inventory, documents, users, notifications, security, ai, integrations. L'API retourne values, policies, options et version. Les sections general/finance/taxes/security/AI peuvent imposer des champs verrouillés. Les politiques AI déterminent allowAnalysis, allowDocumentRag, allowForecasting, allowRecommendations et requireSensitiveApproval. Les règles de sécurité supérieures ne peuvent être désactivées par une valeur de formulaire. Les modules inactive/premium_locked/coming_soon ne suppriment rien ; activer/désactiver vérifie les dépendances dans les deux sens.

### CRM et ventes

| Modèle / origine | Responsabilité, champs et relations | Scope / temps | Contraintes / uniques | Index ciblés |
|---|---|---|---|---|
| Customer D | reference, name, type, contacts/adresses, city, salesperson membership, status, tags, credit_limit Decimal | T / CU | company/reference unique ; commercial même société | company/status/salesperson, recherche nom |
| Contact D | customer FK, name, email, phone, function | P client / CU | email non nécessairement unique global | customer |
| CustomerNote D | customer FK, author, text, visibility | P client / CU | auteur autorisé ; taille limitée | customer/created_at |
| Quote D | reference, customer, salesperson, issue_date, expires_at, currency, termes/notes, status, converted_target, version | T / CU | reference unique/company ; dates et transition ; conversion unique par cible selon règle | company/status/expires_at, customer/issue_date |
| QuoteLine D | quote, position, product nullable, description snapshot, quantity, unit_price, discount_rate, tax_rate | P devis / CU | quote/position unique ; quantité >0, taux 0..100 | quote |
| SalesOrder D | reference, customer, quote nullable, salesperson, status, confirmed_at, currency, terms, version | T / CU | reference unique ; quote/company ; conversion idempotente | company/status/created_at, customer |
| SalesOrderLine D | order, position, product, description/prix/taxe/remise snapshots, quantity, unit_cost snapshot | P commande / CU | position unique ; produit même société ; immutable après confirmation sauf procédure | order/product |
| Delivery D | order, warehouse FK, reference, date, status planned/delivered/cancelled, actor | T / CU | reference unique/company ; dépôt même société | company/warehouse/date |
| DeliveryLine D | delivery, order_line, quantity | P livraison / C après validation | paire unique ; cumul livré <= commandé | order_line |
| CustomerInvoice D | reference, customer, order/quote optionnels, invoice_date, due_date, currency, workflow_status, posted_at, terms/adresse snapshot, version | T / CU | reference unique ; due_date>=invoice_date ; édition verrouillée posted | company/workflow_status/due_date, customer/invoice_date |
| CustomerInvoiceLine D | invoice, position, product/order_line optionnels, description, quantity, unit_price, discount_rate, tax_rate, totaux Decimal figés | P facture / C après posting | position unique ; bornes ; source même société | invoice/order_line |

### Achats

| Modèle / origine | Responsabilité, champs et relations | Scope / temps | Contraintes / uniques | Index ciblés |
|---|---|---|---|---|
| Supplier D | reference, name, contact, email/phone/adresse, category, buyer membership, status, strategic | T / CU | reference unique/company ; buyer même société | company/status/buyer, recherche nom |
| PurchaseOrder D | reference, supplier, buyer, warehouse FK, date, expected_date, status, notes, currency, version | T / CU | reference unique ; date prévue cohérente | company/status/expected_date, supplier/date |
| PurchaseOrderLine D+R | order, position, **product FK ajouté**, product_name/description snapshot, quantity, unit_price, discount_rate, tax_rate | P achat / CU | position unique ; produit même société ; pas déduire FK du nom | order/product |
| Receipt D | order, warehouse FK, reference, date, received_by, posted_at | T / C après réception | reference unique ; dépôt/commande même société | company/warehouse/date |
| ReceiptLine D | receipt, order_line, quantity, unit_cost snapshot | P réception / C | paire unique ; cumul reçu <= commandé | order_line |
| SupplierInvoice D | reference interne, supplier_reference, supplier, purchase_order nullable, dates/devise, workflow_status, posted_at, version | T / CU | reference/company unique ; fournisseur/référence externe selon règle anti-doublon | company/workflow_status/due_date, supplier/invoice_date |
| SupplierInvoiceLine D | invoice, position, purchase_line/receipt_line optionnels, produit/description, quantité, prix/taxes/remise | P facture / C après posting | position unique ; liens cohérents ; rapprochement | purchase_line/receipt_line |
| SupplierPriceObservation D | supplier, product, purchase_line ou receipt_line, date, price, currency, provenance | T / C | source unique ; aucune observation inventée | company/supplier/product/date |

### Inventaire et finance

| Modèle / origine | Responsabilité, champs et relations | Scope / temps | Contraintes / uniques | Index ciblés |
|---|---|---|---|---|
| Product D | sku, name, type product/service, category, supplier principal, prix achat/vente Decimal, unité, barcode, min/max, statut | T / CU | SKU unique insensible casse/company ; seuils cohérents ; service non stockable | company/type/status, recherche SKU/nom |
| ProductCategory D | company, name, active | T / CU | nom unique/company | unique suffit |
| Unit D | company, code, label, precision | T / CU | code unique/company ; précision bornée | unique suffit |
| Warehouse D | reference, name, city/country, manager membership, capacity, capacity_unit, status | T / CU | reference unique ; capacité>=0 ; unité explicite | company/status |
| WarehouseStock R | warehouse, product, on_hand, reserved, average_cost, version | T / CU | unique company/warehouse/product ; reserved>=0 ; stock négatif selon politique et contraintes garanties | unique + company/product |
| StockReservation R | stock, sales_order_line/transfer_line, quantity, status, expires_at | T / CU | quantité positive ; une source valide ; pas double réservation | stock/status, source |
| StockMovement D | product, warehouse, type, before_qty, delta, after_qty, effective_at, source_type/source_id, actor, unit_cost, reversal_of nullable | T / C | before+delta=after ; source d'écriture unique ; aucune modification après confirmation | company/warehouse/product/effective_at, source |
| StockTransfer D | reference, source/destination warehouse, date, status, external_reference, notes, version | T / CU | source!=destination ; reference unique ; transitions bornées | company/status/date, source/destination |
| StockTransferLine D | transfer, product, requested_qty, dispatched_qty, received_qty | P transfert / CU | transfer/product unique ; 0<=received<=dispatched<=requested | transfer/product |
| TaxRate D | company, code, label, rate, active, effective_from/to | T / CU | taux 0..100 ; code/période non ambigu | company/active |
| CashAccount R | company, code, name, currency, opening_balance, opening_date, active | T / CU | code unique/company ; devise non modifiable avec écritures | company/active |
| Payment D | reference, direction incoming/outgoing, partner cible, amount>0, currency, date, method, status, external_reference, note, cancellation_reason | T / CU | reference unique ; partenaire et sens cohérents ; transition completed->cancelled contrôlée | company/date/id, company/partner/date |
| PaymentAllocation R | payment, customer_invoice nullable, supplier_invoice nullable, amount | T / C avec contre-écriture | exactement une cible ; somme <= paiement ; cible même société/devise ; source unique | chaque facture cible |
| ExpenseCategory D | company, name, active | T / CU | nom unique/company | unique suffit |
| Expense D | reference, date, description, category, supplier nullable, employee membership nullable, amount_ht, tax_rate, tax_amount, total, note, status, version | T / CU | reference unique ; total exact ; cible optionnelle cohérente | company/status/date, category/date |
| CashEntry R | account, payment ou expense settlement source, direction, amount, effective_date, reversal_of | T / C | source unique ; une dépense réglée ne doit pas être comptée deux fois | company/account/effective_date |

### Documents, reporting, IA, approbations et audit

| Modèle / origine | Responsabilité, champs et relations | Scope / temps | Contraintes / uniques | Index ciblés |
|---|---|---|---|---|
| Document D | name, storage_key, mime, size, sha256, category, department, owner, visibility, index_status, page_count, index_error public, deleted_at, version | T / CU | taille/MIME valides ; chemin généré ; hash pas nécessairement unique si droits différents | company/status/created_at, company/department |
| DocumentPage D | document, number, title, text, image_key, thumbnail_key | P document / CU par version | document/version/number unique ; number>=1 | document/version |
| DocumentChunk R | document/page, ordinal, section, text, token_count, embedding vector, model_revision, index_version, acl_version | T / C par génération | document/index_version/ordinal unique ; dimension fixe | company/document/version ; vectoriel après mesure |
| DocumentGrant R | document, membership ou department ou rôle, permission | T / CU | une cible ; doublon interdit ; périmètre cohérent | document/cible |
| DocumentLink R | document, type métier allowlist, target_id validé ou FKs explicites selon périmètre | T / CU | cible existante même société ; lien unique ; recontrôle droits cible | company/type/target_id |
| IndexRun R | document, version, status, parser_version, embedding_model, started/finished_at, error_code, job FK | T / CU | génération unique/document/version ; ne publier que complète | document/status |
| ReportRun D | UUID, type/catalog_id, params JSON validé, format, status, requester, as_of, snapshot_version, file_key, error_code | T / CU | clé idempotence ; format autorisé ; résultat immutable ready | company/requester/created_at |
| Conversation D | UUID, owner, company, title, archived_at | T / CU | propriétaire autorisé | company/owner/updated_at |
| AIMessage D | UUID, conversation, role, text, blocks JSON validé, tool_names, period, model_revision, completed_at | P conversation / C après finalisation | état streaming séparé ; schema de blocs connu | conversation/created_at |
| MessageSource D | message, document/chunk optionnels, cible métier typée, page/section/extrait/period, source_version | T / C | source accessible au moment de répondre ; revérifier à la lecture | message/document |
| ToolRun R | conversation/message, user, company, tool_name, args expurgés, result_summary, status, duration, request_id | T / C | nom allowlist ; données sensibles exclues | company/user/created_at |
| ForecastRun D | domain, horizon, generated_at, history_from/to, target/unit, model_version, params, input_hash, series JSON validée, confidence nullable, status, risks | T / CU puis immutable | horizon supporté ; bornes intervalles ; résultat par version | company/domain/generated_at |
| Opportunity D | type, title, potential_value nullable, confidence nullable, evidence refs, recommendation, status, assignee, generated_at, expires_at | T / CU | assignee membership active ; confiance bornée ; faits sourcés | company/status/type, assignee |
| AIAlert D | type, department, severity, status, facts/evidence, analysis, detected_at, assignee, model_version | T / CU | statut allowlist ; sources autorisées | company/status/severity/detected_at |
| ApprovalRequest D | reference, type, target FK/ID typé, requested_by, approver, amount/currency, risk, payload validé, status, version, snapshot_hash, decided_at | T / CU | reference unique ; transition pending seulement ; payload figé après soumission | company/status/type/created_at |
| ApprovalComment D | request, author, text, created_at | P demande / C | texte borné ; author autorisé | request/created_at |
| ApprovalExecution R | request OneToOne, state pending/running/succeeded/failed, result_type/id, error_code, executed_at, idempotency_key | T / CU | une exécution logique/request ; reprise idempotente | state/updated_at |
| AuditLog D | company, actor nullable, timestamp, module/action, entity_type/id, reference, before/after expurgés, IP/device minimisés, request_id, result | T / C | append-only ; aucune suppression via UI ; politiques de rétention | company/timestamp/id, company/entity_type/entity_id |
| Job R | UUID, company/user, kind, status, progress, params hash, result_ref, error_code, attempts, started/finished_at | T / CU | accès du demandeur ou délégation ; résultat autorisé | company/user/created_at, status |
| OutboxEvent R | company, kind, aggregate_id, payload borné, published_at, attempts | T / CU | clé événement unique ; publish après commit | published_at/created_at |
| IdempotencyRecord R | company, actor, operation, key, request_hash, response_ref, expires_at | T / CU | unique company/actor/operation/key ; hash incompatible=>409 | expires_at |

Les modèles R techniques sont introduits au moment où leur workflow en a besoin, pas tous au premier jour. Ne pas créer une table par graphique, permission calculée ou enum. Les pièces jointes, sources et preuves peuvent réutiliser `Document`/`MessageSource` et des serializers tant qu'une nouvelle table n'apporte pas de contrainte utile.

## 4. Règles métier et services attendus

### CRM

`customer_list/detail`, `customer_summary`, `customer_activity` sélectionnent clients du portefeuille autorisé et leurs relations Quote→SalesOrder→Invoice→Payment→Document. L'activité peut être une projection d'AuditLog avec événements métier lisibles, sans champs secrets. Les notes locales de démo demandent une API de persistance si on les conserve. `getCustomerAIInsight` et `requestCustomerAIInsight` sont actuellement le même GET ; ne pas prétendre qu'un POST de recalcul existe. Stocker identité/contact ; calculer CA/encours à partir des pièces appropriées, ne pas copier les KPI mock.

### Devis et commandes clients

Enums devis réels : draft/sent/viewed/accepted/rejected/expired. `send_quote` produit un événement d'envoi et une tâche mail ; l'état sent signifie ce que le produit décide explicitement (mise en file ou livraison), pas un toast. `expire_quotes` traite échéance dépassée uniquement pour états éligibles. Les totaux calculent quantité×prix, remise de ligne, base taxable puis taxe avec arrondi explicite. La conversion accepte sales_order ou invoice ; préserver le snapshot et l'origine, empêcher conversion doublonnée, ne pas générer facture et commande implicitement.

Commandes : orderStatus draft/confirmed/processing/completed/cancelled ; deliveryStatus none/partial/delivered ; invoiceStatus none/partial/invoiced ; paymentStatus unpaid/partial/paid. Les trois derniers se dérivent des lignes/livraisons/factures/paiements valides, avec les noms exacts de DTO actuels. `confirm_order`, `reserve_stock`, `deliver_order`, `invoice_order` sont distincts. Ne pas marquer une commande terminée parce qu'une facture est payée si rien n'est livré. L'API actuelle facture un montant (`SalesInvoiceInput.amount`) : il faudra définir sa répartition fiscale et ses lignes côté service, ou faire évoluer ce contrat avant facturation partielle par quantité.

### Factures clients et fournisseurs, soldes et aging

Workflow draft/posted/cancelled indépendant de paymentStatus unpaid/partially_paid/paid. `remaining = total - somme des affectations actives confirmées`, avec contre-écritures d'annulation. Une facture n'est en retard que si posted, due_date < date société et remaining >0. Elle peut être posted + partially_paid + overdue simultanément. L'état overdue est calculé, pas un remplacement du workflow.

Buckets : current (non échue, y compris échéance aujourd'hui), 1–30, 31–60, 61–90, **90+ = strictement >90**. Utiliser le solde restant et seulement les factures posted ouvertes. À la frontière 90 jours, affecter 61–90 ; à 91, 90+. Les mêmes règles s'appliquent aux dettes fournisseurs. Les labels du frontend n'autorisent pas à sommer les totaux originaux des factures partiellement réglées.

`post_invoice` fige lignes/taxes/partenaire/date/référence et inscrit l'audit. Les avoirs visibles comme collection ne possèdent pas encore un flux API complet : le modèle/endpoint d'avoir est une extension PROPOSED, à spécifier avant annulation comptable de pièces réglées. Ne pas supprimer une facture comptabilisée pour réduire une créance.

### Paiements et trésorerie

Payment.amount est positif, direction distingue incoming et outgoing ; partnerType customer/supplier. Statuts canoniques pending/completed/cancelled/failed, à mapper vers confirmed dans les sous-DTO SalesPayment. Les trois points d'entrée (`/payments/`, `/invoices/:id/payment/`, `/supplier-invoices/:id/payment/`) appellent **le même service** `allocate_payment` et le même journal. Initialement une facture par formulaire ; la table d'affectation prépare plusieurs factures sans exposer ce workflow non implémenté.

`allocate_payment` verrouille facture et paiement, vérifie partenaire/société/devise/sens/date/solde, calcule Decimal, écrit affectation+Caisse+Audit atomiquement. Le client ne fournit ni paidAmount ni remainingAmount de confiance. `cancel_payment` crée une contre-écriture ou désactive comptablement l'affectation avec traçabilité, rétablit le solde une seule fois et refuse les répétitions incompatibles. La clé d'idempotence protège double clic, timeout réseau et retry worker.

`cash_summary` part du solde d'ouverture des comptes + encaissements confirmés − décaissements confirmés. Les dépenses paid ne sont soustraites qu'une fois, via leur écriture de règlement, même si un Payment existe aussi. Receivables/payables sont des créances/dettes, pas des flux encaissés. Revenue vient d'une règle de reconnaissance des ventes/factures, profit inclut coûts, cash est le journal : les quatre notions ne sont pas interchangeables. La démo finance utilise un solde initial fixe et des scénarios d'échéance ; les reprendre comme paramètres d'exemple, jamais comme solde de production.

### Fournisseurs, commandes, réceptions et rapprochement

Supplier.score/risk sont AI-derived ou évaluations manuelles versionnées et sourcées ; purchaseVolume, outstandingBalance et délai moyen observé sont calculés ; identité/buyer/status sont stockés. Le délai moyen exige dates de confirmation/réception, la courbe de prix exige produit/devise/unité comparables et observations datées. Une confiance inconnue reste null.

PurchaseOrder.status draft/sent/confirmed/cancelled ; ReceiptStatus not_received/partially_received/received ; BillingStatus not_billed/partially_billed/billed. Une réception partielle ne confirme pas automatiquement le paiement ni la facture. `receive_purchase` crée Receipt/ReceiptLine et les StockMovement dans une transaction ; quantités positives, aucune ligne étrangère, cumul ≤ quantité commandée sauf tolérance explicitement configurée et auditée. Les types Receipt/ReceiptInput existent réellement ; le problème est la résolution des produits/dépôts, pas l'absence de besoin de réception.

`create_supplier_invoice_from_purchase` conserve les liens de lignes et les quantités reçues/commandées/facturées. Three-way match : comparer Ordered / Received / Invoiced par produit, unité, quantité et prix ; signaler écart/tolérance, bloquer ou soumettre une approbation selon politique. Les factures de services peuvent être validées sans stock physique selon une règle distincte. Le mock de rapprochement et ses libellés ne suffisent pas à attester une comptabilité complète.

### Produits, stock, mouvements et transferts

Un service n'a ni WarehouseStock ni mouvement ; ses champs physiques DTO valent null et stockHealth=not_stocked. Prix achat, prix vente et coût moyen sont différents. Marge commerciale `(selling-purchase)/selling` n'est pas un profit réel sans coût de sortie historique ; gérer prix vente zéro sans division. L'archivage ne retire pas le produit des pièces historiques.

`on_hand` = physique, `reserved` = affecté non livré, `available = on_hand-reserved`. `incoming` du mock inclut le transit attendu au dépôt destinataire ; séparer en base stock en transit, achats attendus et réservations pour éviter les doubles comptes. La capacité des dépôts mock additionne des unités ; un futur volume/palette exige des conversions explicites, pas une somme de quantités incompatibles.

Un mouvement confirmé conserve before/delta/after/source/actor/date et coût de référence ; il est immutable. Corriger par mouvement inverse avec raison et lien. Verrouiller WarehouseStock avant modification ; contrôler stock négatif et protection des réservations. Les ajustements requièrent un motif et éventuellement une approbation. La démo refuse certaines dates anciennes/futures : en production, définir périodes closes, droits d'antidatation et recalcul de valorisation, sans reprendre une date de septembre fixe.

Transfert réel : draft→ready→in_transit→completed ; cancelled selon état autorisé. source!=destination. À expédition, diminution source et création transit ; à réception, diminution transit et augmentation destination. Invariant quantité totale physique+transit conservée. Le frontend actuel termine **tout le transfert** via POST complete, sans quantités reçues partielles : champs dispatched/received du modèle sont PROPOSED pour évolution. Ne pas prétendre que réception partielle des transferts est déjà couverte par l'UI. Annuler en transit nécessite une procédure de retour, pas un simple changement de statut.

Valorisation initiale recommandée : coût moyen pondéré, calculé au moment des entrées et figé sur sorties/mouvements ; cohérent avec averageCost affiché. Une méthode FIFO nécessite des couches de coûts supplémentaires et une mission distincte. Le graphe historique du dépôt mock reconstitue les quantités au **coût moyen actuel constant**, donc n'est pas une valorisation comptable historique réelle.

### Dépenses et reporting

Expense : draft→submitted→approved/rejected→paid. Soumission crée/relie ApprovalRequest ; approbation ne paie pas. `pay_expense` est un service et endpoint PROPOSED car l'UI actuelle n'a pas de mutation de paiement de dépense. Les pièces justificatives locales doivent devenir Document+DocumentLink avec contrôles d'accès et statut upload. Catégorie, fournisseur/employee et taux doivent être validés, HT+taxe=TTC, rejet motivé.

ReportService reste un registre explicite de onze handlers : sales, profitability, customers, products, inventory, purchases, suppliers, invoices, payments, expenses, cash-flow. Le catalogue de douze cartes a des IDs différents (profit, stock, turnover, receivable, payable, cash) : adapter catalogue→handler, ne pas les confondre. Les rapports stock/produits peuvent être snapshots et indiquer que le filtre de dates ne reconstitue pas le passé. Période précédente = intervalle comparable, pas simplement mois précédent quand l'utilisateur choisit des dates libres.

Les KPI sont des selectors SQL utilisant les mêmes filtres que tableaux/exports, indépendamment de la pagination. La démo propose huit exports CSV et certains formats désactivés ; PDF/XLSX ne sont pas opérationnels par leur seule présence dans un enum. Un ReportRun ready conserve un snapshot immutable, son auteur, filtres, date, version/source et checksum du fichier. Les listes de fichiers et leurs téléchargements revérifient droits et société. Les insights de rapport doivent citer ces données ; ne pas inventer anomalies/confiance faute de calcul.

## 5. Documents, stockage et RAG

**DERIVED FROM FRONTEND** : upload multipart, métadonnées/visibility, pages, statut uploading/processing/indexed/index_error, canView et capabilities, analyse et question document, sources avec page/extrait. **R** : chunks, grants, versions de pipeline et fichiers privés.

```mermaid
flowchart LR
  Upload[Upload autorisé] --> Validate[MIME réel / taille / contenu]
  Validate --> Binary[Original dans stockage privé]
  Binary --> Job[Job Celery durable]
  Job --> Parse[Docling / OCR si nécessaire]
  Parse --> Pages[Pages et sections avec provenance]
  Pages --> Chunk[Chunks déterministes et versionnés]
  Chunk --> Embed[BGE-M3 embeddings]
  Embed --> PG[PostgreSQL pgvector + ACL]
  PG --> Publish[Index version complète publiée]
```

Local dev : media privé en dehors du dossier public React ; production : object storage privé compatible S3, URLs courtes signées seulement après contrôle Django, ou téléchargement authentifié relayé. PostgreSQL stocke métadonnées, texte extrait et embeddings ; pas les gros binaires. Valider extension, MIME détecté et signature, taille serveur, nombre de pages et coût OCR ; nom de stockage généré, jamais un chemin utilisateur. Démo actuelle PDF/TXT ≤15 Mio ; publier les limites effectives dans acceptedTypes/maxBytes. Prévoir analyse antivirus/quarantaine selon exposition réelle, sans déclarer un fichier sûr uniquement parce que le navigateur l'accepte.

Docling fournit une représentation structurée utilisable pour préserver pages/tables/sections ; l'OCR et le parser se configurent par pipeline et dépendances. Tester les PDF scannés et tableaux sur un corpus réel ; le mock frontend n'extrait pas leurs pages. [Projet Docling](https://github.com/docling-project/docling).

Commencer par embeddings denses BGE-M3 avec modèle/révision/dimension enregistrés. La fiche BAAI indique 1 024 dimensions pour BGE-M3 ; un changement de modèle impose un nouvel index, pas le mélange silencieux des vecteurs. Chunker selon sections avec recouvrement borné et conserver page/source. Recherche hybride/re-ranking est une amélioration après mesures, pas un prérequis pour brancher la première question document. [Fiche BGE-M3](https://huggingface.co/BAAI/bge-m3).

**Filtrage obligatoire avant utilisation par le retriever/LLM** : company, membership, département, visibilité, document grants et version active. La requête de recherche doit inclure ces prédicats ; aucun chunk interdit ne quitte la couche autorisée vers le LLM, logs ou navigateur. Ne pas récupérer globalement puis masquer les sources en React. Pour petites collections, recherche exacte scoped ; ensuite index vectoriel HNSW et mesure du rappel sous filtres. Les index approximatifs pgvector peuvent filtrer après leur scan interne : adapter index/scan/partitionnement ou fallback exact pour la qualité, sans supprimer le WHERE de sécurité. [pgvector](https://github.com/pgvector/pgvector).

Les sources wire actuelles sont camelCase : id, documentId, documentName, page, section, excerpt, recordPath, period, authorized. `authorized` est une indication d'affichage, jamais la preuve de contrôle. Le backend omet entièrement les sources interdites. À la lecture d'un ancien message, revérifier accès/révocation ; masquer aussi l'extrait et le texte dérivé sensible selon politique de conversation. Une citation ne rend pas automatiquement une affirmation vraie : `verified` exige correspondance réelle source/page et contenu soutenu ; pas une valeur toujours true.

Supprimer un document révoque immédiatement sa consultation/retrieval, puis supprime chunks/images/binaires via job de rétention. L'échec d'une réindexation garde l'ancienne version seulement si encore autorisée et signalée ; publier atomiquement la nouvelle version complète. Journaux sans contenu documentaire intégral par défaut.

## 6. Assistant, outils et actions sensibles

Architecture impérative : **React → endpoint Django → LangGraph → outils métier autorisés → selectors/services Django → PostgreSQL**. Le LLM n'a ni accès direct à PostgreSQL, ni outil SQL générique, ni possibilité de fournir sa société ou ses permissions. Le contexte est injecté par Django hors arguments contrôlables par le modèle.

| Outil proposé | Entrée bornée | Droits métier et scope | Sortie limitée |
|---|---|---|---|
| get_customer_balance | customer_id, as_of | customers.view + invoices.view ; portefeuille autorisé | montant restant/devise/date, refs visibles |
| get_overdue_invoices | date, bucket, limit<=100 | invoices.view + finance.view ; société et portefeuille | soldes/échéances, pas coordonnées sensibles inutiles |
| get_product_stock | product_id, warehouse_id optionnel | products.view + inventory.view ; dépôt | physique/réservé/disponible/date |
| get_supplier_metrics | supplier_id, dates | suppliers.view + purchases.view/finance.view selon champ | agrégats autorisés, provenance |
| get_cash_flow | date_from/to, account facultatif | cashflow.view/finance.view + scope compte | flux confirmés et hypothèses séparées |
| search_documents | query, document_id optionnel, limit borné | documents.view + documents.ai_analyze + ACL/RAG policy | chunks autorisés, pages et citations |

Chaque outil contrôle user/company, RBAC et champs, limite volume/temps, journalise nom/durée/résultat sans secrets. `ai.tools.finance/inventory` du frontend peut limiter la disponibilité, mais ne remplace pas les droits financiers/stock. Les contenus des documents et réponses d'outils sont des données non fiables : ils ne peuvent pas élargir les permissions ni commander une mutation.

LangGraph gère la sélection d'outils, les étapes et les interruptions ; LangChain peut fournir adaptateurs de modèle/retriever/schemas, sans déléguer la sécurité à un agent SQL. Ollama est un service privé appelé par le backend, avec timeouts/concurrence contrôlés ; l'API frontend ne reçoit jamais son URL interne. Django traduit son flux vers le protocole ChatEvent exact. [API Ollama](https://docs.ollama.com/api/introduction).

SSE via POST est adapté au client XHR actuel (auth cookies/CSRF et body de conversation). Ne pas remplacer par EventSource GET sans adapter React. ASGI et reverse proxy doivent autoriser streaming sans buffering, heartbeat et délai adapté ; le timeout frontend 15 s nécessite une évolution. Enregistrer le message final et sa provenance ; annuler la génération sur déconnexion selon politique, sans annuler une transaction déjà commitée. Le schéma fermé des blocs est validé côté serveur avant émission et reste FACT / AI ANALYSIS / FORECAST / RECOMMENDATION. Les nombres FACT viennent des services déterministes.

Pour paiement, relance, dépense, prix, ajustement, achat : le modèle crée seulement une proposition de commande typée. La requête d'approbation conserve cible, version, paramètres, montant/impact, preuves et demandeur. Après décision humaine autorisée, Django revalide puis exécute une seule fois le service et écrit l'audit. Un « oui » dans le chat ne vaut pas permission.

Les interruptions LangGraph nécessitent un état durable et la même identité de thread ; les nœuds peuvent redémarrer lors de reprise. Aucun effet métier non idempotent avant l'interruption. La demande et son exécution restent en PostgreSQL même si le checkpoint d'orchestration est temporairement indisponible. [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts).

## 7. Approbations

Types réels : discount, purchase, expense, payment, inventory, ai_action. États UI : pending, approved, rejected, needs_changes ; seulement approve/reject possèdent une mutation HTTP. Le mock intègre les dépenses, mais une approbation d'achat/IA ne démontre pas l'exécution réelle de ces domaines.

Recommandation simple : payload discriminé par type, handlers explicites `approve_expense`, `confirm_purchase`, etc. Utiliser des FKs nullables explicites pour les quelques cibles financières/stock importantes, avec check « une cible appropriée » ; pour ai_action, un `action_name` allowlist et payload validé. Un `GenericForeignKey` serait flexible mais ne fournit pas de FK SQL ni de garantie de société ; éviter de le choisir par défaut. Une référence `entity_type/id` de lecture/audit peut rester indicative et doit être résolue via registre autorisé.

Verrouiller la demande, vérifier pending+version, droit/type/montant, demandeur différent si règle de séparation, snapshot de cible encore applicable. Écriture de décision/commentaire/exécution DB/audit dans atomic. Pour envoi mail ou effet externe, enregistrer ApprovalExecution/Outbox dans la transaction, exécuter après commit, exposer succeeded/failed séparément d'approved. Ne pas retourner un succès d'exécution sur simple mise en file. Les états d'exécution et la création générique sont des extensions frontend à prévoir.

## 7 bis. Prévisions et opportunités

**DERIVED FROM FRONTEND** : domaines revenue/sales/demand/inventory/cash-flow/payments, horizons 30/60/90/180 jours, séries historical/forecast/lower/upper, projected, confidence nullable, qualité/provenance, états ready/low_confidence/insufficient_data/disabled. **PROPOSED** : pipeline Django → Pandas/NumPy → modèle statsmodels/scikit-learn → résultat versionné → explication LLM facultative. Les séries et intervalles ne sont jamais calculés par le LLM.

| Domaine | Cible à définir explicitement | Historique / entrées | Drivers | Horizon / confiance / insuffisance |
|---|---|---|---|---|
| revenue | revenu reconnu par jour/période, devise société | factures posted nettes d'avoirs selon règle de reconnaissance, dates et saisonnalité | activité, portefeuille, saisonnalité ; hypothèses séparées | 30/60/90/180 ; backtest chronologique ; null si estimation non calibrée |
| sales | nombre de commandes confirmées (distinct du revenu) | confirmations/annulations datées et lignes | jours ouvrés, saison, canal si disponible | mêmes horizons ; faible historique=>insufficient_data sans extrapolation arbitraire |
| demand | unités demandées par produit, puis agrégat explicitement homogène | commandes/lignes, ruptures, demandes non servies si connues | saisonnalité et effets promotionnels seulement si données | horizon adapté au produit ; demande intermittente traitée séparément |
| inventory | disponibilité/risque de rupture par produit-dépôt | physique, réservations, réceptions prévues, consommation et transit | demande prévue, délais fournisseurs, seuils | scénario de conservation du stock ; pas addition de différentes unités sans définition |
| cash-flow | solde de trésorerie futur | solde d'ouverture/ledger, échéances créances/dettes, dépenses prévues et scénarios | délais de règlement, engagements, saisonnalité | scénario déterministe initial, confiance null ; intervalle seulement si modèle validé |
| payments | encaissements/décaissements attendus explicitement distingués | factures ouvertes, affectations, dates d'échéance et retards observés | comportement de paiement, ancienneté, moyens de règlement | courbe d'échéance n'est pas probabilité de paiement ; insuffisance signalée |

La démo cash-flow/payments utilise un scénario d'échéances, notamment un décalage conventionnel pour retards ; revenue/sales/demand manquent d'historique projetable et inventory n'a pas de série suffisante. Ne pas fabriquer une bande de confiance pour satisfaire le graphique. Les champs lower/upper sont null en l'absence d'intervalle fourni.

Préparer un calendrier régulier, traiter trous/outliers avec règles traçables, séparer entraînement/validation temporellement, comparer à un baseline naïf, mesurer erreur et couverture des intervalles par horizon. Enregistrer date du snapshot, nombre d'observations, modèle/version, métriques, hypothèses et qualité. `confidence` doit être défini et calibré, pas une transformation cosmétique de l'erreur. Utiliser une borne minimum d'historique configurable par domaine ; aucune taille universelle n'est démontrée par le frontend.

Les opportunités agrègent Evidence, potentiel nullable, confidence/level nullable, recommandation, statut et assignee. Le mock expose open/assigned/dismissed mais seulement assign possède un endpoint. Les assignables proviennent d'une liste serveur de memberships actives ; le serveur revalide le bénéficiaire. Les opportunités doivent avoir une fraîcheur/expiration, être recalculées après changement des données et distinguer gain potentiel de gain réalisé. L'absence de gain chiffrable doit rester null. Les preuves sont soumises aux mêmes droits que l'assistant.

## 8. Celery, Valkey et traitements

| Travail | SYNC / ASYNC recommandé | Justification / réponse actuelle / adaptation |
|---|---|---|
| Login, lecture petite page, mutation courte | SYNC | contrôle et résultat immédiat |
| Posting, allocation paiement, mouvement, décision DB | SYNC transaction courte | le client attend le nouvel objet ; ne pas différer une vérification de solde |
| Validation/upload original | SYNC borné | DocumentRecord processing dès stockage ; aucun indexed prématuré |
| Parsing/OCR/pages/chunking/embeddings/index | ASYNC | CPU/GPU/latence, retries et progression ; polling Job/Document à ajouter |
| Génération petit CSV | SYNC possible | compatible blob actuel ; taille/temps bornés |
| Rapports/export PDF/XLSX ou gros volumes | ASYNC | snapshot, fichier privé et statut ; 202/Job absent des consommateurs actuels |
| Envoi devis/facture/invitation/relance | ASYNC via outbox | éviter attente SMTP et doublons ; état envoyé/livré défini |
| Forecast recalculation | ASYNC | charge et temps de modèle ; GET résultat précédent + freshness ; contrat actuel attend ForecastResult immédiat |
| Analyse IA courte / chat interactif | flux ASGI ; tâche selon durée | ne pas bloquer worker HTTP synchrone ; contrôles avant chaque outil |
| Analyse documentaire/portefeuille/opportunités | ASYNC | snapshots/version, déduplication, suivi durable |
| Test intégration court | SYNC borné | conforme IntegrationTestResult ; long test=>Job négocié |
| Indexation périodique/expiry/recalculs | ASYNC planifié | tâches idempotentes scoped, pas une boucle dans la requête |
| Purge rétention et nettoyage binaires | ASYNC | révocation immédiate en DB puis nettoyage contrôlé |

Valkey : broker/résultats Celery selon transport testé, cache de selectors scoppé et versionné, rate limiting, état IA éphémère. **Jamais source de vérité des paiements, stocks, approbations ou jobs métier.** Préfixer les clés par environnement/company/user ou version de permissions selon besoin ; expiration et invalidation après commit. L'absence de cache ne doit pas changer un solde.

Les docs Celery consultées décrivent le transport Redis ; elles n'affirment pas explicitement Valkey dans cette page. Utiliser un client/transport compatible et épinglé, puis tester reconnexion, visibilité, retry et reprise avec la version Valkey choisie ; ne pas annoncer une compatibilité de production non vérifiée. [Transport Redis Celery](https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html), [clients Valkey](https://valkey.io/clients/).

Les tâches peuvent être rejouées : input_hash/version/job_id uniques, transition atomique d'état, retries bornés et backoff seulement pour erreurs transitoires. Ne pas retenter aveuglément une validation métier ni un paiement externe. Les IDs Celery ne servent pas d'autorisation de lecture ; le client consulte Job scoppé. La sécurité d'un `acks_late` dépend de l'idempotence effective du travail. [Celery tasks](https://docs.celeryq.dev/en/stable/userguide/tasks.html).

## 9. Cohérence, verrous, monnaie et dates

| Opération | Transaction atomique | Lignes à verrouiller / invariants |
|---|---|---|
| Numéroter pièce | oui | NumberSequence company/type/période ; incrément unique, rollback cohérent |
| Poster facture | oui | facture+version+lignes ; recalcul total, snapshot, audit |
| Affecter/annuler paiement | oui | facture(s) dans ordre stable, paiement/affectations ; solde non négatif, idempotence |
| Confirmer/réserver commande | oui | commande, WarehouseStock et réservations par PK croissante |
| Réception achat | oui | commande/lignes/reliquats et stocks ; Receipt+Movement+coût ensemble |
| Mouvement manuel | oui | WarehouseStock ; before/delta/after et réserve |
| Transfert dispatch/complete | oui | transfert+stocks source/destination dans ordre stable ; conservation physique+transit |
| Approuver/exécuter | oui pour effets DB | demande+version+cible ; une seule exécution logique, audit/outbox |
| Activer module/settings critiques | oui | CompanyModule dépendances/settings/version ; aucune cascade destructrice |

Utiliser `transaction.atomic()` dans le service et `select_for_update()` sur les lignes existantes. Pour un stock encore absent, unique constraint + création concurrente contrôlée/retry ; un verrou sur une ligne inexistante ne suffit pas. Ordre stable des verrous pour réduire les deadlocks. Pas de transaction ouverte durant OCR, génération LLM ou SMTP. Publier tâches/invalidation après commit, avec outbox pour événements qu'on ne peut pas perdre. [Transactions Django](https://docs.djangoproject.com/en/6.0/topics/db/transactions/), [verrous QuerySet](https://docs.djangoproject.com/en/6.0/ref/models/querysets/#select-for-update).

Tous les montants et calculs financiers utilisent Decimal : fixer précision, arrondi par ligne/document, taux et règles d'arrondi de manière explicite. Proposition initiale : montants finaux à 2 décimales MAD, prix/quantités à précision supérieure bornée ; les taux exprimés en pourcentage comme les Input actuels. Ne pas arrondir un float reçu sans passer par validation décimale ; accepter chaînes/nombres wire selon contrat de compatibilité, convertir immédiatement en Decimal. Ne pas recopier les limites BigInt frontend comme seule règle serveur.

UTC pour timestamps ; timezone société pour « aujourd'hui », clôtures et échéances ; timezone utilisateur pour affichage. DateField pour invoice_date/due_date/receipt.date, DateTimeField pour created_at/posted_at/audit. Ne pas transformer arbitrairement une date seule en minuit UTC et changer son jour au rendu. `asOf` doit être calculé une fois par réponse/snapshot. Les périodes clôturées et antidatations ont une politique explicite.

NumberSequence par company/type/exercice produit les références configurées QT/SO/INV/PO/BILL/PAY/MOV (et réceptions/transferts selon configuration). La PK reste indépendante. Ne pas réutiliser un numéro annulé ; documenter à quel état il est attribué. Les contraintes légales de numérotation ne sont pas auditées ici : le produit doit fixer sa politique applicable avant mise en production.

## 10. Performance et sécurité

`select_related` pour client/commercial sur devis/commande/facture, supplier/buyer sur achats, product/warehouse sur stock, membership/role sur users ; `prefetch_related` des lignes/livraisons/affectations/documents sur détails uniquement. Éviter de charger toutes les lignes d'une commande dans une liste qui n'affiche que son total. Utiliser agrégats SQL/Subquery ou compteurs cohérents pour solde, aging, volumes et délais ; tester nombre de requêtes et volumes réalistes. L'IA appelle ces mêmes selectors, jamais une extraction de 50 000 factures côté navigateur.

Pagination cible page-number DRF pour listes, métadonnées et résumés séparés ; adapter les enveloppes legacy avant activation. Un ordre stable incluant id et des filtres allowlist évite doublons/tri non sûr. Les index du catalogue sont des candidats à vérifier par EXPLAIN et profils réels. Les index vectoriels concernent un corpus suffisamment grand ; ils ne remplacent pas les contraintes de société. [Pagination DRF](https://www.django-rest-framework.org/api-guide/pagination/).

Checklist de sécurité à transformer en tests :

- [ ] Session valide, compte et membership actifs, logout et expiration effectifs ; CSRF sur login/mutations ; cookies Secure/HttpOnly adaptés.
- [ ] CORS avec origines explicites et credentials ; jamais wildcard pour une API authentifiée par cookies.
- [ ] Toute liste/détail/export/job/source/tool applique company et RBAC ; vérification objet ajoutée aux querysets de liste.
- [ ] Serializer refuse mass assignment de company, rôle, totaux, statut et capabilities ; FKs scoped ; permissions d'action refaites dans le service.
- [ ] Hashers/validateurs Django pour passwords ; secrets et TOTP chiffrés au repos, challenges courts, anti-rejeu, codes secours hachés, réauthentification des actions sensibles.
- [ ] Rate limits login, MFA, exports, documents et IA ; limites de taille/durée/concurrence.
- [ ] Fichiers privés, MIME réel, taille et noms contrôlés ; URL sortante autorisée et sans SSRF pour intégrations.
- [ ] Audit append-only expurgé récursivement : aucun password, token, cookie, clé privée, secret MFA, credentials d'intégration ; request_id et résultats utiles.
- [ ] Aucun secret dans VITE, JS, logs, traces de prompt ou erreurs publiques ; debug désactivé en production.
- [ ] Tests de sauvegarde/restauration PostgreSQL et fichiers ; révocation immédiate des données interdites et rétention explicite.

DRF ne filtre pas automatiquement chaque objet d'une liste par les permissions objet : le queryset scoped reste indispensable. [DRF permissions](https://www.django-rest-framework.org/api-guide/permissions/). Compléter les contrôles de déploiement Django (secret, debug, hosts, HTTPS et cookies) avant exposition. [Checklist Django](https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/).

## 11. Backend .env required — PROPOSED

| Variable | Usage ; aucune valeur secrète réelle ici |
|---|---|
| DJANGO_SECRET_KEY | secret unique d'environnement, jamais commité |
| DJANGO_DEBUG / DJANGO_ALLOWED_HOSTS | mode et hôtes explicitement autorisés |
| DATABASE_URL | PostgreSQL et TLS selon infrastructure |
| CORS_ALLOWED_ORIGINS / CSRF_TRUSTED_ORIGINS | origines React/API exactes ; même origine recommandée |
| SESSION_COOKIE_SECURE / CSRF_COOKIE_SECURE | true en HTTPS production |
| VALKEY_BROKER_URL / VALKEY_CACHE_URL | instances/DB distinctes selon charge ; auth/TLS si nécessaire |
| CELERY_RESULT_BACKEND | résultat technique à durée courte ; Job métier reste PostgreSQL |
| STORAGE_BACKEND / MEDIA_ROOT | local dev privé ou stockage objet |
| OBJECT_STORAGE_ENDPOINT / OBJECT_STORAGE_BUCKET / OBJECT_STORAGE_REGION | uniquement si stockage objet choisi |
| OBJECT_STORAGE_ACCESS_KEY / OBJECT_STORAGE_SECRET_KEY | via secrets d'infrastructure, jamais réponse settings |
| EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASSWORD / DEFAULT_FROM_EMAIL | service mail choisi, secrets protégés |
| OLLAMA_BASE_URL / OLLAMA_MODEL | service privé et modèle validé/épinglé |
| EMBEDDING_MODEL / EMBEDDING_REVISION | BAAI/bge-m3 et révision contrôlée |
| DOCUMENT_MAX_BYTES / AI_REQUEST_TIMEOUT_SECONDS | bornes serveur publiées en capacités ; cohérence frontend à prévoir |
| FIELD_ENCRYPTION_KEY | chiffrement secrets MFA/intégrations, rotation prévue |
| LOG_LEVEL | logs expurgés, pas de credentials ni contenu complet par défaut |

Pas de clé secrète Ollama inventée si le déploiement n'en utilise pas ; l'auth du proxy interne est configurée uniquement si présente. Les paramètres métier par société restent en base, pas dans un .env partagé.

## 12. Dépendances majeures et écarts à résoudre

Top 10 dépendances backend : (1) identité/membership/tenant ; (2) permissions et capabilities ; (3) serializers de compatibilité ; (4) séquences et Decimal ; (5) clients/fournisseurs/catalogue/dépôts ; (6) services de stock/réservation ; (7) factures/affectations/cash ledger ; (8) transactions/idempotence/audit ; (9) jobs et stockage privé ; (10) selectors fiables + ACL avant IA/RAG/prévisions.

Top 10 écarts frontend/backend : session volatile ; CSRF cross-origin à vérifier ; nommage/Decimal hétérogènes ; collections et KPI locaux ; catalogue RBAC incomplet ; noms de dépôts/produits sans FK dans achats ; workflows/statuts financiers divergents ; attente synchrone et timeout SSE ; approbation sans état d'exécution ; pièces jointes/réglages/actions encore locaux. Les détails, tests et sources figurent dans les cinq documents associés. Aucun de ces écarts n'a été corrigé pendant l'audit.
