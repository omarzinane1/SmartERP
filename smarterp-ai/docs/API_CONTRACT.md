# SmartERP AI — contrat HTTP extrait du frontend

Audit du 27 septembre 2026. **143 sites d'appel `apiClient` dans 25 fichiers `*.api.ts`**. Ce nombre n'est pas celui de routes Django : une boucle répète GET quotes, un dispatcher de factures produit quatre actions, et certains chemins paramétrés couvrent plusieurs domaines. Tous nécessitent un backend ; aucun serveur Django n'est inclus ici. Les fonctions préparées mais non consommées sont signalées par leur liste de consommateurs vide.

Le tableau puis les fiches d'endpoint en annexe sont extraits du code, avec payload exact, réponse attendue, source et consommateurs. Les règles communes ci-dessous s'appliquent à **chaque fiche**. Les types référencés et leurs champs sont décrits dans [DATA_MODEL](DATA_MODEL.md). Les données retournées dans les tests API sont des fixtures, pas une spécification backend validée extérieurement.

## Transport, nommage et numéros

Base : `VITE_API_BASE_URL`, défaut `http://localhost:8000/api`, sans slash final. Les chemins de ce document commencent après `/api`. Cookies inclus, timeout global 15 s ; slash terminal présent sur les endpoints. `signal` est un AbortSignal local, jamais un paramètre HTTP. `scope`, `user`, callbacks et `companyName` passés aux fonctions servent aux mocks/contexte local et ne sont pas automatiquement envoyés au serveur. Les expressions de body/options reproduisent ce qui est réellement envoyé.

**Convention cible PROPOSED :** Python et HTTP en snake_case, React en camelCase, conversion explicite dans chaque fichier `*.api.ts` avec DTO de transport validé. **Compatibilité immédiate :** seuls login, onboarding et surtout quotes possèdent déjà cette frontière explicite. La majorité des réponses restantes sont retournées directement : Django devra temporairement exposer les noms camelCase attendus par leurs types, ou une prochaine mission devra ajouter les adaptateurs avant de changer le wire format. Ne pas appliquer une conversion globale implicite, notamment aux objets `settings.values`, blocs IA et clés de permission.

Montants SQL/Python : Decimal. Le contrat quotes accepte nombre ou chaîne et appelle `Number`. Les autres DTO attendent principalement des nombres JSON (ou utilisent directement `.toFixed`, additions et comparaisons). Une réponse DRF Decimal chaîne n'est donc pas automatiquement compatible. **PROPOSED** : chaînes décimales côté transport, conversion validée/bornée à la frontière frontend ; à court terme un serializer de compatibilité doit émettre le nombre attendu sans effectuer les calculs métier en float. Identifiants majoritairement entiers positifs ; UUID chaînes pour conversations/messages/sessions ; certains IDs de lignes sont des clés locales string non à réutiliser comme PK SQL.

## Pagination et filtres

| Contrat observé | Parcours |
|---|---|
| Collection complète dans une enveloppe métier | clients, ventes, factures, achats, factures fournisseurs, produits, stock, dépôts, dépenses, documents, utilisateurs, audit, approbations et opportunités ; filtres/pagination généralement locaux |
| `results`, `next` + métadonnées snake_case | quotes ; le client suit toutes les pages, contrôle origine/chemin et boucle, puis filtre/pagine localement |
| `payments/count/totalCount` + options et permissions | paiements ; page/page_size/sort et filtres transmis ; summary séparé sans pagination |
| `suppliers/count/totalCount/summary/facets` | fournisseurs ; page_size/sort et filtres transmis ; summary inclus |
| ReportParams vers snake_case | rapports analytiques ; date_from/date_to, partner/owner/category/warehouse envoyés au serveur |
| `horizon` | prévisions finance et IA |

**Convention cible PROPOSED :** DRF page-number `{count,next,previous,results}`, page 1, page_size 25 avec maximum 100, ordre stable avec PK secondaire. Métadonnées `permissions`, `as_of`, `facets`, capabilities de création dans une enveloppe documentée ; KPI via endpoints summary sur les mêmes filtres sans limiter la page. Ne pas envelopper rétroactivement les listes existantes sans modifier leurs adaptateurs. Les filtres UI exacts sont recensés par feature dans [FRONTEND_ARCHITECTURE](FRONTEND_ARCHITECTURE.md), puis les paramètres actuellement transmis sont reproduits dans chaque fiche.

Mapping futur des filtres locaux : `search`, `status`, `customer`, `supplier`, `owner`, `category`, `warehouse`, `date_from`, `date_to`, `ordering`, `page`, `page_size`. Les paramètres spécifiques (direction, method, partner_type, receipt_status, billing_status, health, source/destination, role, department, severity…) restent explicites. Valider une allowlist de champs d'ordre, dates ISO, enums et PK scoped ; une chaîne vide signifie absence de filtre. Le frontend actuel n'envoie pas tous ces paramètres. Aucune pagination backend ne doit conduire à calculer un KPI sur une page incomplète.

## Règles d'erreur communes à toutes les fiches — PROPOSED

```json
{"code":"VALIDATION_ERROR","message":"Certains champs sont invalides.","errors":{"due_date":["Doit être postérieure ou égale à la date de facture."]},"request_id":"req-example"}
```

| HTTP | Cas et usage |
|---|---|
| 200 | Lecture, action, modification avec DTO complet attendu |
| 201 | Création avec DTO de l'objet ; le client Axios accepte aussi 200 |
| 204 | Suppression/révocation, ou onboarding sans body ; ne pas l'utiliser si la fonction lit un DTO |
| 400 | VALIDATION_ERROR : champs, enum, format, borne, FK invalide dans le scope |
| 401 | UNAUTHENTICATED ; DRF SessionAuthentication peut produire 403 selon configuration : fixer et tester ce choix |
| 403 | PERMISSION_DENIED, CSRF_FAILED, MODULE_DISABLED ou politique de société |
| 404 | NOT_FOUND, y compris objet hors société ; jamais révéler le locataire propriétaire |
| 409 | CONFLICT : version périmée, transition impossible, solde/stock insuffisant, doublon métier/idempotence incompatible |
| 429 | RATE_LIMITED pour login, upload, exports et IA |
| 500/503 | erreur inattendue/service indisponible ; message public sans détails internes |

Pas de 422 nécessaire initialement ; réserver 400 à la validation et 409 à l'état métier. Le frontend rôle reconnaît aussi 412, mais proposer 409 de manière uniforme. Le login reconnaît actuellement les codes minuscules `account_disabled` et `disabled_account` : les conserver dans l'adaptateur de compatibilité. Les erreurs HTTP proposées ne sont pas encore un schéma global consommé par React : ajouter ultérieurement un mapper de champs vers `setError`, afficher `message` global, purger la session sur expiration, conserver le formulaire sur conflit et proposer relecture. Les formulaires actuels affichent surtout un message de mutation, parfois volontairement générique pour les secrets.

Pour chaque endpoint : validation = schéma de son Input/DTO (champs obligatoires, tailles, dates, quantité/montant positif et FK autorisée) ; erreurs métier = invariants du domaine décrits dans le blueprint ; autorisation = permission de la fiche **et** scope/capability/module. Ces trois couches ne sont pas interchangeables.

## Exemples compatibles et points de jonction

Login, réponse actuelle (pas de JWT inventé) :

```json
{"user":{"id":1,"name":"Omar Zinane","email":"omar@example.test","role":"Admin","permissions":["customers.view","invoices.view"]},"company":{"id":1,"name":"Atlas","onboarding_completed":true,"enabled_modules":["crm","sales","finance"]}}
```

Liste de devis vide valide, avec le véritable DTO snake_case :

```json
{"results":[],"next":null,"permissions":["quotes.view","quotes.create"],"current_salesperson":"Omar Zinane","as_of":"2026-09-27","products":[]}
```

Création de paiement (`POST /payments/`) et réponse actuelle :

```json
{"direction":"incoming","partner_id":124,"invoice_id":413,"date":"2026-09-27","amount":1000,"method":"bank_transfer","reference_external":"BANK-001","note":"Règlement partiel"}
```

```json
{"id":501,"reference":"PAY-2026-0501","direction":"incoming","partnerType":"customer","partnerId":124,"partnerName":"Nova Retail SARL","invoiceId":413,"invoiceReference":"INV-2026-0413","invoiceIssuedDate":"2026-09-01","date":"2026-09-27","amount":1000,"method":"bank_transfer","status":"completed","referenceExternal":"BANK-001","note":"Règlement partiel","canCancel":true}
```

Le même `InvoicePaymentInput` envoyé par `/invoices/:id/payment/` n'utilise pas le même mapper que `/payments/` ; suivre l'expression exacte de sa fiche. `/supplier-invoices/:id/payment/` renomme la référence en `reference`, pas `reference_external`. Un service unique d'affectation doit être appelé derrière ces façades.

Approbation actuelle :

```json
{"comment":"Pièces vérifiées.","version":2}
```

Le body exact de la fiche fait foi pour l'action ; la réponse attend un `ApprovalRequest` complet, pas `{success:true}`. Ne pas renvoyer une demande approuvée si l'exécution a échoué sans exposer clairement son état.

Settings actuel :

```json
{"values":{"name":"Atlas","legalName":"Atlas SARL","taxId":"DEMO","email":"contact@example.test","phone":"","website":"","address":"","city":"Casablanca","country":"Maroc"},"version":1}
```

Cet exemple illustre l'enveloppe, **pas un payload de section complet** : les clés requises doivent être celles de `SettingsValues[section]` dans le dictionnaire. Le frontend envoie les valeurs camelCase sans conversion. Un serializer par section doit refuser les clés inconnues/verrouillées.

## Documents et streaming

Upload documentaire : multipart `file`, `category`, `department`, `visibility` ; pas un JSON base64. Réponse `DocumentRecord` dès stockage ; `processing` n'est pas `indexed`. Les acceptedTypes/maxBytes proviennent de GET documents. La démo accepte PDF/TXT ≤15 Mio ; les pièces jointes commerciales locales n'ont pas automatiquement ce contrat. Indexation POST retourne actuellement un DocumentRecord ; pour un job long conserver le même DTO `processing` et ajouter ultérieurement polling/événements, ou négocier un 202 Job. Un 202 avec seulement job_id casserait le consommateur actuel.

Assistant : POST `/ai/chat/stream/`, `{conversation_id,message}`, `Accept: text/event-stream`, cookies/CSRF, XHR Axios. Le décodeur attend des lignes `data:` contenant des `ChatEvent` séparés par une ligne vide. Un nom `event:` seul n'est pas consommé. Exemple complet de fin de flux :

```text
data: {"type":"status","status":"tool_running","tool":"get_cash_flow"}

data: {"type":"block","block":{"id":"b1","category":"FACT","type":"text","text":"Aucun mouvement sur la période autorisée."}}

data: {"type":"done","message":{"id":"m1","role":"assistant","text":"Aucun mouvement sur la période autorisée.","blocks":[{"id":"b1","category":"FACT","type":"text","text":"Aucun mouvement sur la période autorisée."}],"sources":[],"createdAt":"2026-09-27T10:00:00Z","tools":["get_cash_flow"],"period":"2026-09","simulated":false}}

```

`category` vaut exactement FACT / AI ANALYSIS / FORECAST / RECOMMENDATION ; `type` vaut text/risk/list/kpi/table/chart/action. Un bloc sensible utilise `type: action`, `approvalId`, `status: awaiting_approval`, `canOpenApproval` ; ce n'est pas un ordre exécutable libre. Le flux doit finir avec `done.message` ; `[DONE]` seul est insuffisant. Les réponses incomplètes ne doivent pas rendre un bouton d'exécution actif. Le timeout global de 15 s, la reprise/reconnexion et la validation complète des blocs sont des écarts documentés, pas des capacités déjà réglées.

Prévision sans données, réponse valide :

```json
{"domain":"revenue","permissions":["forecast.view"],"asOf":"2026-09-27","status":"insufficient_data","horizon":30,"confidence":null,"dataQuality":"Historique insuffisant","generatedAt":"2026-09-27T10:00:00Z","historyFrom":null,"historyTo":null,"projected":null,"unit":"money","series":[],"risks":[],"source":"Historique autorisé de la société"}
```

## Endpoints proposés mais absents

| PROPOSED | Utilité | Frontend à adapter ultérieurement |
|---|---|---|
| GET /auth/session/ ; GET /auth/csrf/ ; POST /auth/logout/ | bootstrap identité+société, CSRF, logout | garde, démarrage App, topbar ; GET /me/ actuel n'a pas cette signature |
| POST /auth/active-company/ | sélectionner une membership autorisée | sélecteur société et purge des caches |
| GET /jobs/:id/ | statut, progression, résultat autorisé | polling indexation/rapport/forecast ; 202 seulement après adaptation |
| POST /approvals/ | soumission typée d'une proposition | formulaires/IA ; aucune création générique actuelle |
| GET /approvals/:id/execution/ | distinguer décision et exécution | état séparé, réessai contrôlé |
| POST /expenses/:id/pay/ ; /reject/ | paiement dépense / rejet selon politique | actions non présentes comme API directe actuellement |
| POST /invoices/:id/credit-notes/ | avoir légal/métier | bouton/type seuls ne fournissent pas ce workflow |
| POST /sales/:id/cancel/ ; /purchases/:id/cancel/ | annulation contrôlée | capacités/états existent sans endpoint dédié consommé |
| POST /records/:type/:id/attachments/ | pièce jointe liée et protégée | remplace les blobs locaux ; route définitive à choisir par domaine |
| GET /lookups/warehouses/ ; /users/ ; /products/ | identifiants et options paginés/scopés | remplace noms ambigus et options massives imbriquées |

Aucun refresh JWT n'est requis par la stratégie session recommandée. Si JWT est choisi ultérieurement, ajouter rotation/révocation/stockage sûr et son contrat ; ce serait une évolution, pas un endpoint découvert.

<!-- GENERATED_API -->

## Tableau global des sites d’appel existants

Permission = controles observes et regle serveur proposee ; capabilities et scopes sont toujours additionnels.

| Method | Endpoint | Feature | Request | Response | Permission | Status |
|---|---|---|---|---|---|---|
| GET | [`/admin/users/`](#api-001) | admin | getUsers / fiche | `UsersData` | users.manage | BACKEND REQUIRED |
| POST | [`/admin/users/`](#api-002) | admin | createUser / fiche | `AdminUser` | users.manage + canCreateDirectly ; roles.assign si role | BACKEND REQUIRED |
| POST | [`/admin/invitations/`](#api-003) | admin | inviteUser / fiche | `AdminUser` | users.manage ; roles.assign si role | BACKEND REQUIRED |
| PATCH | [`/admin/users/{id}/`](#api-004) | admin | updateUser / fiche | `AdminUser` | users.manage + capability ; roles.assign pour role | BACKEND REQUIRED |
| GET | [`/admin/roles/`](#api-005) | admin | getRoles / fiche | `RolesData` | roles.manage | BACKEND REQUIRED |
| GET | [`/admin/permissions/`](#api-006) | admin | getPermissions / fiche | `Permission[]` | roles.manage | BACKEND REQUIRED |
| POST | [`/admin/roles/`](#api-007) | admin | createRole / fiche | `Role` | roles.manage + grantable | BACKEND REQUIRED |
| PATCH | [`/admin/roles/{id}/`](#api-008) | admin | updateRole / fiche | `Role` | roles.manage + canEdit + grantable | BACKEND REQUIRED |
| GET | [`/audit-logs/`](#api-009) | admin | getAuditLogs / fiche | `AuditData` | audit.view | BACKEND REQUIRED |
| GET | [`/audit-logs/{id}/`](#api-010) | admin | getAuditLogById / fiche | `AuditLog` | audit.view + scope | BACKEND REQUIRED |
| GET | [`/audit-logs/export/`](#api-011) | admin | exportAuditLogs / fiche | `{ rows?: (string &#124; number)[][]; blob?: Blob; filename: string; }` | audit.export + exportFormats | BACKEND REQUIRED |
| GET | [`/ai/conversations/`](#api-012) | ai | getConversations / fiche | `ConversationsData` | ai.use | BACKEND REQUIRED |
| POST | [`/ai/conversations/`](#api-013) | ai | createConversation / fiche | `Conversation` | ai.use + canChat | BACKEND REQUIRED |
| POST | [`/ai/chat/stream/`](#api-014) | ai | streamAIChat / fiche | `string` | ai.use + canChat + droits outils | BACKEND REQUIRED |
| GET | [`/ai/messages/{id}/sources/`](#api-015) | ai | getMessageSources / fiche | `DocumentSource[]` | ai.use + ACL sources | BACKEND REQUIRED |
| GET | [`/forecast/{domain}/`](#api-016) | ai | getForecast / fiche | `ForecastResult` | forecast.view | BACKEND REQUIRED |
| POST | [`/forecast/{domain}/recalculate/`](#api-017) | ai | recalculateForecast / fiche | `ForecastResult` | forecast.recalculate | BACKEND REQUIRED |
| GET | [`/forecast/{domain}/drivers/`](#api-018) | ai | getForecastDrivers / fiche | `ForecastDriver[]` | forecast.view | BACKEND REQUIRED |
| GET | [`/ai/opportunities/`](#api-019) | ai | getAIOpportunities / fiche | `OpportunitiesData` | ai.opportunities.view | BACKEND REQUIRED |
| GET | [`/ai/opportunities/{id}/`](#api-020) | ai | getAIOpportunityById / fiche | `AIOpportunity` | ai.opportunities.view | BACKEND REQUIRED |
| POST | [`/ai/opportunities/{id}/assign/`](#api-021) | ai | assignAIOpportunity / fiche | `AIOpportunity` | ai.opportunities.view + canAssign (pas de code assign dedie) | BACKEND REQUIRED |
| GET | [`/ai/control-center/`](#api-022) | ai-control-center | getAIControlCenter / fiche | `AIControlCenterData` | aucun code explicite ; PROPOSED ai.use | BACKEND REQUIRED |
| GET | [`/approvals/`](#api-023) | approvals | getApprovals / fiche | `ApprovalsData` | approvals.view | BACKEND REQUIRED |
| GET | [`/approvals/{id}/`](#api-024) | approvals | getApprovalById / fiche | `ApprovalRequest` | approvals.view | BACKEND REQUIRED |
| POST | [`/approvals/{id}/approve/`](#api-025) | approvals | approveRequest / fiche | `ApprovalRequest` | approvals.approve + allowedApprovalTypes + canApprove | BACKEND REQUIRED |
| POST | [`/approvals/{id}/reject/`](#api-026) | approvals | rejectRequest / fiche | `ApprovalRequest` | approvals.approve + allowedApprovalTypes + canReject | BACKEND REQUIRED |
| POST | [`/auth/login/`](#api-027) | auth | login / fiche | `unknown` | public avec CSRF et limitation tentatives | BACKEND REQUIRED |
| GET | [`/customers/`](#api-028) | customers | getCustomers / fiche | `CustomersData` | customers.view | BACKEND REQUIRED |
| POST | [`/customers/`](#api-029) | customers | createCustomer / fiche | `Customer` | customers.create | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| PATCH | [`/customers/{id}/`](#api-030) | customers | updateCustomer / fiche | `Customer` | customers.edit | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| POST | [`/customers/import/`](#api-031) | customers | importCustomers / fiche | `{ imported: number; }` | customers.create (pas de code import distinct) | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| GET | [`/customers/{id}/`](#api-032) | customers | getCustomerById / fiche | `CustomerDetail` | customers.view | BACKEND REQUIRED |
| GET | [`/customers/{id}/summary/`](#api-033) | customers | getCustomerSummary / fiche | `CustomerSummary` | customers.view | BACKEND REQUIRED |
| GET | [`/customers/{id}/activity/`](#api-034) | customers | getCustomerActivity / fiche | `CustomerActivity[]` | customers.view | BACKEND REQUIRED |
| GET | [`/ai/customers/{id}/insight/`](#api-035) | customers | getCustomerAIInsight / fiche | `CustomerAIInsight &#124; null` | customers.view + ai.use | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| GET | [`/dashboard/summary/`](#api-036) | dashboard | getDashboard / fiche | `DashboardData` | aucun code explicite ; PROPOSED dashboard.view | BACKEND REQUIRED |
| GET | [`/documents/`](#api-037) | documents | getDocuments / fiche | `DocumentList` | documents.view | BACKEND REQUIRED |
| GET | [`/documents/{id}/`](#api-038) | documents | getDocumentById / fiche | `DocumentDetail` | documents.view | BACKEND REQUIRED |
| GET | [`/documents/{id}/pages/`](#api-039) | documents | getDocumentPages / fiche | `DocumentPage[]` | documents.view | BACKEND REQUIRED |
| POST | [`/documents/`](#api-040) | documents | uploadDocument / fiche | `DocumentRecord` | documents.upload | BACKEND REQUIRED |
| DELETE | [`/documents/{id}/`](#api-041) | documents | deleteDocument / fiche | `any` | documents.delete + canDelete | BACKEND REQUIRED |
| POST | [`/documents/{id}/index/`](#api-042) | documents | indexDocument / fiche | `DocumentRecord` | documents.ai_analyze + canIndex | BACKEND REQUIRED |
| POST | [`/ai/documents/{id}/query/`](#api-043) | documents | queryDocument / fiche | `DocumentAnswer` | documents.view + documents.ai_analyze + ai.use + canAnalyze | BACKEND REQUIRED |
| POST | [`/ai/documents/{id}/analyze/`](#api-044) | documents | analyzeDocument / fiche | `DocumentAnalysis` | documents.view + documents.ai_analyze + ai.use + canAnalyze | BACKEND REQUIRED |
| GET | [`/expenses/`](#api-045) | expenses | getExpenses / fiche | `ExpensesData` | expenses.view | BACKEND REQUIRED |
| POST | [`/expenses/`](#api-046) | expenses | createExpense / fiche | `Expense` | expenses.create | BACKEND REQUIRED |
| POST | [`/expenses/{id}/submit/`](#api-047) | expenses | submitExpense / fiche | `Expense` | expenses.create + canSubmit | BACKEND REQUIRED |
| POST | [`/expenses/{id}/approve/`](#api-048) | expenses | approveExpense / fiche | `Expense` | expenses.approve + canApprove | BACKEND REQUIRED |
| GET | [`/finance/cash-flow/`](#api-049) | finance | getCashFlow / fiche | `CashFlowData` | finance.view / cashflow.view | BACKEND REQUIRED |
| GET | [`/finance/forecast/`](#api-050) | finance | getCashForecast / fiche | `CashForecast` | finance.view / cashflow.view | BACKEND REQUIRED |
| GET | [`/finance/upcoming-payments/`](#api-051) | finance | getUpcomingPayments / fiche | `CashUpcoming` | finance.view / cashflow.view | BACKEND REQUIRED |
| GET | [`/ai/finance/cash-insight/`](#api-052) | finance | getCashAIInsight / fiche | `CashInsight` | finance.view / cashflow.view + ai.use | BACKEND REQUIRED |
| GET | [`/inventory/summary/`](#api-053) | inventory | getInventorySummary / fiche | `InventorySummary` | inventory.view | BACKEND REQUIRED |
| GET | [`/inventory/health/`](#api-054) | inventory | getInventoryHealth / fiche | `InventoryHealth` | inventory.analytics.view | BACKEND REQUIRED |
| GET | [`/inventory/critical/`](#api-055) | inventory | getCriticalProducts / fiche | `InventoryRow[]` | inventory.view | BACKEND REQUIRED |
| GET | [`/inventory/recent-movements/`](#api-056) | inventory | getRecentMovements / fiche | `StockMovement[]` | inventory.movements.view | BACKEND REQUIRED |
| GET | [`/inventory/movements/`](#api-057) | inventory | getStockMovements / fiche | `MovementData` | inventory.movements.view | BACKEND REQUIRED |
| GET | [`/inventory/movements/{id}/`](#api-058) | inventory | getStockMovementById / fiche | `StockMovement` | inventory.movements.view | BACKEND REQUIRED |
| POST | [`/inventory/movements/`](#api-059) | inventory | createStockMovement / fiche | `any` | inventory.movements.create | BACKEND REQUIRED |
| GET | [`/inventory/transfers/`](#api-060) | inventory | getStockTransfers / fiche | `TransferData` | inventory.transfers.view | BACKEND REQUIRED |
| POST | [`/inventory/transfers/`](#api-061) | inventory | createStockTransfer / fiche | `any` | inventory.transfers.create | BACKEND REQUIRED |
| PATCH | [`/inventory/transfers/{id}/`](#api-062) | inventory | updateStockTransfer / fiche | `any` | inventory.transfers.create ou inventory.transfers.approve selon transition + capabilities | BACKEND REQUIRED |
| POST | [`/inventory/transfers/{id}/complete/`](#api-063) | inventory | completeStockTransfer / fiche | `any` | inventory.transfers.approve + canComplete | BACKEND REQUIRED |
| GET | [`/invoices/`](#api-064) | invoices | getInvoices / fiche | `InvoicesData` | invoices.view | BACKEND REQUIRED |
| GET | [`/invoices/aging/`](#api-065) | invoices | getInvoicesAging / fiche | `AgingBucket[]` | invoices.view + finance.view | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| GET | [`/invoices/{id}/`](#api-066) | invoices | getInvoiceById / fiche | `InvoiceDetail` | invoices.view | BACKEND REQUIRED |
| POST | [`/invoices/`](#api-067) | invoices | createInvoice / fiche | `InvoiceDetail` | invoices.create | BACKEND REQUIRED |
| PATCH | [`/invoices/{id}/`](#api-068) | invoices | updateInvoice / fiche | `InvoiceDetail` | invoices.edit + canEdit | BACKEND REQUIRED |
| POST | [`/invoices/{id}/{action}/`](#api-069) | invoices | mutateInvoice / fiche | `InvoiceDetail` | post: invoices.post ; send: invoices.send ; payment: payments.create ; remind: invoices.remind + capability | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| GET | [`/modules/`](#api-070) | modules | getModules / fiche | `ModulesData` | modules.manage | BACKEND REQUIRED |
| POST | [`/companies/{companyId}/modules/{moduleKey}/enable/`](#api-071) | modules | enableModule / fiche | `ModulesData` | modules.manage | BACKEND REQUIRED |
| POST | [`/companies/{companyId}/modules/{moduleKey}/disable/`](#api-072) | modules | disableModule / fiche | `ModulesData` | modules.manage | BACKEND REQUIRED |
| POST | [`/company/onboarding/`](#api-073) | onboarding | saveOnboarding / fiche | `void` | session ; PROPOSED companies.configure | BACKEND REQUIRED |
| GET | [`/payments/`](#api-074) | payments | getPayments / fiche | `PaymentsData` | payments.view | BACKEND REQUIRED |
| GET | [`/payments/summary/`](#api-075) | payments | getPaymentsSummary / fiche | `PaymentSummary` | payments.view | BACKEND REQUIRED |
| POST | [`/payments/`](#api-076) | payments | createPayment / fiche | `Payment` | payments.create | BACKEND REQUIRED |
| POST | [`/payments/{id}/cancel/`](#api-077) | payments | cancelPayment / fiche | `Payment` | payments.cancel + canCancel | BACKEND REQUIRED |
| GET | [`/products/`](#api-078) | products | getProducts / fiche | `ProductsData` | products.view | BACKEND REQUIRED |
| GET | [`/products/{id}/`](#api-079) | products | getProductById / fiche | `ProductDetail` | products.view | BACKEND REQUIRED |
| GET | [`/products/{id}/metrics/`](#api-080) | products | getProductMetrics / fiche | `ProductMetrics` | products.view + analytics.view | BACKEND REQUIRED |
| GET | [`/products/{id}/history/`](#api-081) | products | getProductHistory / fiche | `ProductHistory` | products.view + (inventory.view ou analytics.view) | BACKEND REQUIRED |
| GET | [`/ai/products/{id}/insight/`](#api-082) | products | getProductAIInsight / fiche | `ProductInsight` | products.view + ai.use | BACKEND REQUIRED |
| POST | [`/products/`](#api-083) | products | createProduct / fiche | `any` | products.create | BACKEND REQUIRED |
| PATCH | [`/products/{id}/`](#api-084) | products | updateProduct / fiche | `any` | products.edit + canEdit/canArchive | BACKEND REQUIRED |
| POST | [`/products/import/`](#api-085) | products | importProducts / fiche | `any` | products.create | BACKEND REQUIRED |
| GET | [`/me/`](#api-086) | profile | getMe / fiche | `UserProfile` | utilisateur courant + capabilities | BACKEND REQUIRED |
| PATCH | [`/me/`](#api-087) | profile | updateMe / fiche | `UserProfile` | utilisateur courant + capabilities | BACKEND REQUIRED |
| POST | [`/me/password/`](#api-088) | profile | changePassword / fiche | `{ success: boolean; simulated: boolean; }` | utilisateur courant + capabilities | BACKEND REQUIRED |
| POST | [`/me/2fa/`](#api-089) | profile | setup2FA / fiche | `TwoFactorResult` | utilisateur courant + capabilities | BACKEND REQUIRED |
| DELETE | [`/me/sessions/{sessionId}/`](#api-090) | profile | deleteSession / fiche | `void` | utilisateur courant + capabilities | BACKEND REQUIRED |
| GET | [`/purchase-orders/`](#api-091) | purchases | getPurchaseOrders / fiche | `PurchaseOrdersData` | purchases.view | BACKEND REQUIRED |
| GET | [`/purchase-orders/{id}/`](#api-092) | purchases | getPurchaseOrderById / fiche | `PurchaseOrderDetail` | purchases.view | BACKEND REQUIRED |
| POST | [`/purchase-orders/`](#api-093) | purchases | createPurchaseOrder / fiche | `PurchaseOrderDetail` | purchases.create | BACKEND REQUIRED |
| PATCH | [`/purchase-orders/{id}/`](#api-094) | purchases | updatePurchaseOrder / fiche | `PurchaseOrderDetail` | purchases.edit + canEdit | BACKEND REQUIRED |
| POST | [`/purchase-orders/{id}/send/`](#api-095) | purchases | sendPurchaseOrder / fiche | `PurchaseOrderDetail` | purchases.edit + canSend | BACKEND REQUIRED |
| POST | [`/purchase-orders/{id}/confirm/`](#api-096) | purchases | confirmPurchaseOrder / fiche | `PurchaseOrderDetail` | purchases.confirm + canConfirm | BACKEND REQUIRED |
| POST | [`/purchase-orders/{id}/receive/`](#api-097) | purchases | receivePurchaseOrder / fiche | `PurchaseOrderDetail` | receipts.create + canReceive | BACKEND REQUIRED |
| POST | [`/purchase-orders/{id}/bill/`](#api-098) | purchases | createSupplierInvoiceFromPurchase / fiche | `SupplierInvoiceDetail` | supplier_invoices.create + canBill | BACKEND REQUIRED |
| GET | [`/quotes/`](#api-099) | quotes | getQuotes / fiche | `QuotesResponse` | quotes.view | BACKEND REQUIRED |
| GET | [`/quotes/{url.search}`](#api-100) | quotes | getQuotes / fiche | `QuotesResponse` | quotes.view | BACKEND REQUIRED |
| POST | [`/quotes/{id}/send/`](#api-101) | quotes | sendQuote / fiche | `QuoteDTO` | quotes.send | BACKEND REQUIRED |
| POST | [`/quotes/{id}/duplicate/`](#api-102) | quotes | duplicateQuote / fiche | `QuoteDTO` | quotes.create | BACKEND REQUIRED |
| GET | [`/quotes/{id}/`](#api-103) | quotes | getQuoteById / fiche | `QuoteDetailDTO` | quotes.view | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| POST | [`/quotes/`](#api-104) | quotes | createQuote / fiche | `QuoteDetailDTO` | quotes.create | BACKEND REQUIRED |
| PATCH | [`/quotes/{id}/`](#api-105) | quotes | updateQuote / fiche | `QuoteDetailDTO` | quotes.edit | BACKEND REQUIRED |
| POST | [`/quotes/{id}/accept/`](#api-106) | quotes | acceptQuote / fiche | `QuoteDetailDTO` | quotes.accept + canAccept | BACKEND REQUIRED |
| POST | [`/quotes/{id}/convert/`](#api-107) | quotes | convertQuote / fiche | `QuoteConversion` | quotes.convert + conversionTargets | BACKEND REQUIRED |
| GET | [`/reports/catalog/`](#api-108) | reports | getReportsCatalog / fiche | `ReportsCatalog` | reports.view | BACKEND REQUIRED |
| GET | [`/reports/recent/`](#api-109) | reports | getRecentReports / fiche | `GeneratedReport[]` | reports.view | BACKEND REQUIRED |
| POST | [`/reports/generate/`](#api-110) | reports | generateReport / fiche | `GeneratedReport` | reports.generate | BACKEND REQUIRED |
| GET | [`/reports/{type}/`](#api-111) | reports | getReport / fiche | `AnalyticsReport` | reports.view | BACKEND REQUIRED |
| POST | [`/reports/{type}/ai-analysis/`](#api-112) | reports | generateReportAIAnalysis / fiche | `ReportAnalysis` | reports.view + ai.use | BACKEND REQUIRED |
| GET | [`/reports/{type}/export/`](#api-113) | reports | exportReport / fiche | `{ rows?: (string &#124; number)[][]; blob?: Blob; filename: string; }` | reports.export | BACKEND REQUIRED |
| GET | [`/sales-orders/`](#api-114) | sales | getSalesOrders / fiche | `SalesOrdersData` | sales.view | BACKEND REQUIRED |
| GET | [`/sales-orders/{id}/`](#api-115) | sales | getSalesOrderById / fiche | `SalesOrderDetail` | sales.view | BACKEND REQUIRED |
| POST | [`/sales-orders/{id}/confirm/`](#api-116) | sales | confirmSalesOrder / fiche | `SalesOrderDetail` | sales.edit + canConfirm | BACKEND REQUIRED |
| POST | [`/sales-orders/{id}/delivery/`](#api-117) | sales | createSalesOrderDelivery / fiche | `{ order: SalesOrderDetail; reference: string; }` | delivery.create + canDeliver | BACKEND REQUIRED |
| POST | [`/sales-orders/{id}/invoice/`](#api-118) | sales | createSalesOrderInvoice / fiche | `{ order: SalesOrderDetail; reference: string; }` | invoices.create + canInvoice | BACKEND REQUIRED |
| GET | [`/settings/`](#api-119) | settings | getSettings / fiche | `SettingsData` | settings.view | BACKEND REQUIRED |
| PATCH | [`/settings/{input.section}/`](#api-120) | settings | updateSettingsSection / fiche | `SettingsData` | settings.manage + policy.canManage + lockedFields | BACKEND REQUIRED |
| GET | [`/ai/status/`](#api-121) | settings | getAIStatus / fiche | `AIStatus` | settings.view + policy ai | BACKEND REQUIRED |
| POST | [`/integrations/{id}/test/`](#api-122) | settings | testIntegration / fiche | `IntegrationTestResult` | settings.manage + canTest | BACKEND REQUIRED |
| GET | [`/supplier-invoices/`](#api-123) | supplier-invoices | getSupplierInvoices / fiche | `SupplierInvoicesData` | supplier_invoices.view | BACKEND REQUIRED |
| GET | [`/supplier-invoices/{id}/`](#api-124) | supplier-invoices | getSupplierInvoiceById / fiche | `SupplierInvoiceDetail` | supplier_invoices.view | BACKEND REQUIRED |
| GET | [`/supplier-invoices/aging/`](#api-125) | supplier-invoices | getSupplierInvoiceAging / fiche | `PayableBucket[]` | supplier_invoices.view + finance.view | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| POST | [`/supplier-invoices/`](#api-126) | supplier-invoices | createSupplierInvoice / fiche | `SupplierInvoiceDetail` | supplier_invoices.create | BACKEND REQUIRED |
| PATCH | [`/supplier-invoices/{id}/`](#api-127) | supplier-invoices | updateSupplierInvoice / fiche | `SupplierInvoiceDetail` | supplier_invoices.edit + canEdit | BACKEND REQUIRED |
| POST | [`/supplier-invoices/{id}/post/`](#api-128) | supplier-invoices | postSupplierInvoice / fiche | `SupplierInvoiceDetail` | supplier_invoices.edit + canPost | BACKEND REQUIRED |
| POST | [`/supplier-invoices/{id}/payment/`](#api-129) | supplier-invoices | recordSupplierInvoicePayment / fiche | `SupplierInvoiceDetail` | payments.create + canPay | BACKEND REQUIRED |
| GET | [`/suppliers/{id}/`](#api-130) | suppliers | getSupplierById / fiche | `SupplierDetail` | suppliers.view | BACKEND REQUIRED |
| GET | [`/suppliers/{id}/metrics/`](#api-131) | suppliers | getSupplierMetrics / fiche | `SupplierMetrics` | suppliers.view | BACKEND REQUIRED |
| GET | [`/suppliers/{id}/price-history/`](#api-132) | suppliers | getSupplierPriceHistory / fiche | `SupplierPriceHistory` | suppliers.view | BACKEND REQUIRED |
| GET | [`/ai/suppliers/{id}/insight/`](#api-133) | suppliers | getSupplierAIInsight / fiche | `PurchasingInsight` | suppliers.view + ai.use | BACKEND REQUIRED |
| GET | [`/suppliers/`](#api-134) | suppliers | getSuppliers / fiche | `SuppliersData` | suppliers.view | BACKEND REQUIRED |
| POST | [`/suppliers/`](#api-135) | suppliers | createSupplier / fiche | `Supplier` | suppliers.create | BACKEND REQUIRED |
| PATCH | [`/suppliers/{id}/`](#api-136) | suppliers | updateSupplier / fiche | `Supplier` | suppliers.edit + capability | BACKEND REQUIRED |
| GET | [`/warehouses/`](#api-137) | warehouses | getWarehouses / fiche | `WarehousesData` | warehouses.view | BACKEND REQUIRED |
| GET | [`/warehouses/summary/`](#api-138) | warehouses | getWarehousesSummary / fiche | `WarehouseSummary[]` | warehouses.view | BACKEND REQUIRED ; prepare sans consommateur externe identifie |
| GET | [`/warehouses/{id}/`](#api-139) | warehouses | getWarehouseById / fiche | `WarehouseDetail` | warehouses.view | BACKEND REQUIRED |
| GET | [`/warehouses/{id}/inventory/`](#api-140) | warehouses | getWarehouseInventory / fiche | `InventoryRow[]` | warehouses.view + inventory.view | BACKEND REQUIRED |
| GET | [`/warehouses/{id}/movements/`](#api-141) | warehouses | getWarehouseMovements / fiche | `StockMovement[]` | warehouses.view + inventory.view + inventory.movements.view | BACKEND REQUIRED |
| GET | [`/warehouses/{id}/valuation/`](#api-142) | warehouses | getWarehouseValuation / fiche | `WarehouseValuation` | warehouses.view + inventory.view | BACKEND REQUIRED |
| POST | [`/warehouses/`](#api-143) | warehouses | createWarehouse / fiche | `any` | warehouses.create | BACKEND REQUIRED |

## Fiches exhaustives

Les exemples JSON sont des exemples **structurels** de reponse (collections vides, droits restrictifs, donnees fictives), tires des types. Ils ne constituent ni des donnees coherentes entre endpoints ni une validation metier. Les regles et codes communs en tete s’appliquent a chaque fiche.

<a id="api-001"></a>
### API-001 — GET `/admin/users/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 7, fonction `getUsers`. **BACKEND REQUIRED**.

- Permission / scope : users.manage ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `UsersData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "users": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "roles": [],
  "departments": [],
  "currentUserId": 1,
  "assignableRoleIds": [],
  "canCreateDirectly": false
}
```

<a id="api-002"></a>
### API-002 — POST `/admin/users/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 9, fonction `createUser`. **BACKEND REQUIRED**.

- Permission / scope : users.manage + canCreateDirectly ; roles.assign si role ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `userDTO(v)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: UserInput`.
- Success response : `AdminUser`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['admin-users', 'admin-roles', 'audit-logs'])` ; `invalidate(['admin-roles', 'admin-users', 'audit-logs'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "name": "Exemple",
  "email": "example@example.test",
  "department": "Exemple",
  "roleId": 1,
  "roleName": "Exemple",
  "status": "active",
  "twoFactorEnabled": false,
  "passwordResetRequired": false,
  "lastLogin": null,
  "createdAt": "2026-09-27T10:00:00Z",
  "capabilities": {
    "canEdit": false,
    "canAssignRole": false,
    "canSuspend": false,
    "canReactivate": false
  }
}
```

<a id="api-003"></a>
### API-003 — POST `/admin/invitations/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 10, fonction `inviteUser`. **BACKEND REQUIRED**.

- Permission / scope : users.manage ; roles.assign si role ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `userDTO(v)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: UserInput`.
- Success response : `AdminUser`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['admin-users', 'admin-roles', 'audit-logs'])` ; `invalidate(['admin-roles', 'admin-users', 'audit-logs'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "name": "Exemple",
  "email": "example@example.test",
  "department": "Exemple",
  "roleId": 1,
  "roleName": "Exemple",
  "status": "active",
  "twoFactorEnabled": false,
  "passwordResetRequired": false,
  "lastLogin": null,
  "createdAt": "2026-09-27T10:00:00Z",
  "capabilities": {
    "canEdit": false,
    "canAssignRole": false,
    "canSuspend": false,
    "canReactivate": false
  }
}
```

<a id="api-004"></a>
### API-004 — PATCH `/admin/users/{id}/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 11, fonction `updateUser`. **BACKEND REQUIRED**.

- Permission / scope : users.manage + capability ; roles.assign pour role ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `userDTO(v)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, v: UserInput`.
- Success response : `AdminUser`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['admin-users', 'admin-roles', 'audit-logs'])` ; `invalidate(['admin-roles', 'admin-users', 'audit-logs'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "name": "Exemple",
  "email": "example@example.test",
  "department": "Exemple",
  "roleId": 1,
  "roleName": "Exemple",
  "status": "active",
  "twoFactorEnabled": false,
  "passwordResetRequired": false,
  "lastLogin": null,
  "createdAt": "2026-09-27T10:00:00Z",
  "capabilities": {
    "canEdit": false,
    "canAssignRole": false,
    "canSuspend": false,
    "canReactivate": false
  }
}
```

<a id="api-005"></a>
### API-005 — GET `/admin/roles/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 12, fonction `getRoles`. **BACKEND REQUIRED**.

- Permission / scope : roles.manage ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `RolesData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "roles": [],
  "users": [],
  "permissions": [],
  "asOf": "2026-09-27"
}
```

<a id="api-006"></a>
### API-006 — GET `/admin/permissions/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 13, fonction `getPermissions`. **BACKEND REQUIRED**.

- Permission / scope : roles.manage ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `signal?: AbortSignal`.
- Success response : `Permission[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-007"></a>
### API-007 — POST `/admin/roles/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 14, fonction `createRole`. **BACKEND REQUIRED**.

- Permission / scope : roles.manage + grantable ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ name: v.name, description: v.description, permission_codes: v.permissionCodes }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: RoleInput`.
- Success response : `Role`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['admin-users', 'admin-roles', 'audit-logs'])` ; `invalidate(['admin-roles', 'admin-users', 'audit-logs'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "name": "Exemple",
  "description": "Exemple",
  "system": false,
  "permissionCodes": [],
  "version": 1,
  "userIds": [],
  "capabilities": {
    "canEdit": false,
    "canDuplicate": false,
    "canAssign": false
  }
}
```

<a id="api-008"></a>
### API-008 — PATCH `/admin/roles/{id}/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 15, fonction `updateRole`. **BACKEND REQUIRED**.

- Permission / scope : roles.manage + canEdit + grantable ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ name: v.name, description: v.description, permission_codes: v.permissionCodes, version: v.version }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, v: RoleInput`.
- Success response : `Role`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['admin-users', 'admin-roles', 'audit-logs'])` ; `invalidate(['admin-roles', 'admin-users', 'audit-logs'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "name": "Exemple",
  "description": "Exemple",
  "system": false,
  "permissionCodes": [],
  "version": 1,
  "userIds": [],
  "capabilities": {
    "canEdit": false,
    "canDuplicate": false,
    "canAssign": false
  }
}
```

<a id="api-009"></a>
### API-009 — GET `/audit-logs/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 16, fonction `getAuditLogs`. **BACKEND REQUIRED**.

- Permission / scope : audit.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `AuditData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "logs": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "canViewNetwork": false,
  "exportFormats": []
}
```

<a id="api-010"></a>
### API-010 — GET `/audit-logs/{id}/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 17, fonction `getAuditLogById`. **BACKEND REQUIRED**.

- Permission / scope : audit.view + scope ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `AuditLog`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "timestamp": "2026-09-27T10:00:00Z",
  "actor": "Exemple",
  "module": "Exemple",
  "action": "Exemple",
  "entityType": "Exemple",
  "recordId": null,
  "reference": "Exemple",
  "result": "success",
  "ip": null,
  "device": null,
  "requestId": null,
  "before": {},
  "after": {},
  "restricted": false,
  "canOpenRecord": false
}
```

<a id="api-011"></a>
### API-011 — GET `/audit-logs/export/`

Source : [features/admin/api/admin.api.ts](../src/features/admin/api/admin.api.ts) ligne 20, fonction `exportAuditLogs`. **BACKEND REQUIRED**.

- Permission / scope : audit.export + exportFormats ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: { ...params, date_from: params.dateFrom, date_to: params.dateTo, format }, responseType: 'blob' }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, params: AuditFilters, format: 'csv' &#124; 'pdf' &#124; 'xlsx'`.
- Success response : `{ rows?: (string &#124; number)[][]; blob?: Blob; filename: string; }`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; role attribuable, pas auto-elevation, role systeme protege, version, email unique.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/admin/hooks/useAdmin.ts](../src/features/admin/hooks/useAdmin.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('admin-users'), env.adminUseMock]` ; `[...key('admin-roles'), env.adminUseMock]` ; `[...key('admin-permissions'), env.adminUseMock]` ; `[...key('audit-logs'), env.adminUseMock]`.

Reponse wire : fichier binaire (responseType blob). Le wrapper TS ajoute le filename localement, ce n’est pas une enveloppe JSON serveur.

<a id="api-012"></a>
### API-012 — GET `/ai/conversations/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 9, fonction `getConversations`. **BACKEND REQUIRED**.

- Permission / scope : ai.use ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `ConversationsData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "conversations": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "availableTools": []
}
```

<a id="api-013"></a>
### API-013 — POST `/ai/conversations/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 10, fonction `createConversation`. **BACKEND REQUIRED**.

- Permission / scope : ai.use + canChat ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{}`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string`.
- Success response : `Conversation`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['ai-conversations'])` ; `invalidate(['ai-conversations'])` ; `invalidate(['forecast', 'forecast-drivers'])` ; `invalidate(['ai-opportunities'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": "example-id",
  "title": "Exemple",
  "createdAt": "2026-09-27T10:00:00Z",
  "messages": []
}
```

<a id="api-014"></a>
### API-014 — POST `/ai/chat/stream/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 16, fonction `streamAIChat`. **BACKEND REQUIRED**.

- Permission / scope : ai.use + canChat + droits outils ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal, responseType: 'text', adapter: 'xhr', headers: { Accept: 'text/event-stream' }, onDownloadProgress: (event) => { const xhr = event.event?.target as XMLHttpRequest &#124; undefined; if (!decodingError && typeof xhr?.responseText === 'string') { try { decoder.consume(xhr.responseText) } catch (error) { decodingError = error } } } }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ conversation_id: conversationId, message: question }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, conversationId: string, question: string, emit: (event: ChatEvent) => void, signal?: AbortSignal`.
- Success response : `string`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['ai-conversations'])` ; `invalidate(['ai-conversations'])` ; `invalidate(['forecast', 'forecast-drivers'])` ; `invalidate(['ai-opportunities'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Reponse wire : SSE ChatEvent, exemple complet en tete ; pas un JSON AIMessage seul.

<a id="api-015"></a>
### API-015 — GET `/ai/messages/{id}/sources/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 20, fonction `getMessageSources`. **BACKEND REQUIRED**.

- Permission / scope : ai.use + ACL sources ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: string`.
- Success response : `DocumentSource[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-016"></a>
### API-016 — GET `/forecast/{domain}/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 21, fonction `getForecast`. **BACKEND REQUIRED**.

- Permission / scope : forecast.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: { horizon }, signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, domain: ForecastDomain, horizon: number, signal?: AbortSignal`.
- Success response : `ForecastResult`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "domain": "revenue",
  "permissions": [],
  "asOf": "2026-09-27",
  "status": "disabled",
  "horizon": 1,
  "confidence": null,
  "dataQuality": "Exemple",
  "generatedAt": "2026-09-27T10:00:00Z",
  "historyFrom": null,
  "historyTo": null,
  "projected": null,
  "unit": "number",
  "series": [],
  "risks": [],
  "source": "Exemple"
}
```

<a id="api-017"></a>
### API-017 — POST `/forecast/{domain}/recalculate/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 22, fonction `recalculateForecast`. **BACKEND REQUIRED**.

- Permission / scope : forecast.recalculate ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ horizon }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, domain: ForecastDomain, horizon: number`.
- Success response : `ForecastResult`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['ai-conversations'])` ; `invalidate(['ai-conversations'])` ; `invalidate(['forecast', 'forecast-drivers'])` ; `invalidate(['ai-opportunities'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "domain": "revenue",
  "permissions": [],
  "asOf": "2026-09-27",
  "status": "disabled",
  "horizon": 1,
  "confidence": null,
  "dataQuality": "Exemple",
  "generatedAt": "2026-09-27T10:00:00Z",
  "historyFrom": null,
  "historyTo": null,
  "projected": null,
  "unit": "number",
  "series": [],
  "risks": [],
  "source": "Exemple"
}
```

<a id="api-018"></a>
### API-018 — GET `/forecast/{domain}/drivers/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 23, fonction `getForecastDrivers`. **BACKEND REQUIRED**.

- Permission / scope : forecast.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `_scope: string, domain: ForecastDomain, signal?: AbortSignal`.
- Success response : `ForecastDriver[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-019"></a>
### API-019 — GET `/ai/opportunities/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 24, fonction `getAIOpportunities`. **BACKEND REQUIRED**.

- Permission / scope : ai.opportunities.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `OpportunitiesData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "opportunities": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "assignees": []
}
```

<a id="api-020"></a>
### API-020 — GET `/ai/opportunities/{id}/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 25, fonction `getAIOpportunityById`. **BACKEND REQUIRED**.

- Permission / scope : ai.opportunities.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `AIOpportunity`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "type": "inventory",
  "title": "Exemple",
  "potentialValue": null,
  "confidence": null,
  "confidenceLevel": null,
  "evidence": [],
  "recommendation": "Exemple",
  "status": "open",
  "assignedTo": null,
  "canAssign": false,
  "source": "Exemple"
}
```

<a id="api-021"></a>
### API-021 — POST `/ai/opportunities/{id}/assign/`

Source : [features/ai/api/ai.api.ts](../src/features/ai/api/ai.api.ts) ligne 26, fonction `assignAIOpportunity`. **BACKEND REQUIRED**.

- Permission / scope : ai.opportunities.view + canAssign (pas de code assign dedie) ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ user_id: userId }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, userId: number`.
- Success response : `AIOpportunity`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; politique IA, scope outil/document, horizon supporte, donnees insuffisantes sans invention.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai/hooks/useAIWorkspace.ts](../src/features/ai/hooks/useAIWorkspace.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['ai-conversations'])` ; `invalidate(['ai-conversations'])` ; `invalidate(['forecast', 'forecast-drivers'])` ; `invalidate(['ai-opportunities'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('ai-conversations'), env.aiWorkspaceUseMock]` ; `[...key('forecast'), env.aiWorkspaceUseMock, domain, horizon]` ; `[...key('forecast-drivers'), env.aiWorkspaceUseMock, domain]` ; `[...key('ai-opportunities'), env.aiWorkspaceUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "type": "inventory",
  "title": "Exemple",
  "potentialValue": null,
  "confidence": null,
  "confidenceLevel": null,
  "evidence": [],
  "recommendation": "Exemple",
  "status": "open",
  "assignedTo": null,
  "canAssign": false,
  "source": "Exemple"
}
```

<a id="api-022"></a>
### API-022 — GET `/ai/control-center/`

Source : [features/ai-control-center/api/aiControlCenter.api.ts](../src/features/ai-control-center/api/aiControlCenter.api.ts) ligne 14, fonction `getAIControlCenter`. **BACKEND REQUIRED**.

- Permission / scope : aucun code explicite ; PROPOSED ai.use ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `signal?: AbortSignal`.
- Success response : `AIControlCenterData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; faits/provenance et scope ; mutations locales sans endpoint.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/ai-control-center/hooks/useAIControlCenter.ts](../src/features/ai-control-center/hooks/useAIControlCenter.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[ 'ai-control-center', userId, companyId, env.aiControlCenterUseMock, ]`.

Exemple de forme JSON attendue :

```json
{
  "period": {
    "label": "Exemple",
    "asOf": "2026-09-27",
    "generatedAt": "2026-09-27T10:00:00Z"
  },
  "health": {
    "score": 0,
    "trend": 0,
    "confidence": 1,
    "departments": []
  },
  "stats": {
    "critical": 0,
    "warnings": 0,
    "forecasts": 0,
    "opportunities": 0,
    "resolved": 0
  },
  "summary": {
    "text": "Exemple",
    "confidence": 1,
    "priorities": [],
    "impacts": [],
    "recommendations": [],
    "sources": [],
    "model": "Exemple"
  },
  "alerts": [],
  "risks": [],
  "forecasts": [],
  "opportunities": [],
  "actions": [],
  "governance": [],
  "anomalyHistory": [],
  "resolutionRate": 0,
  "responseMinutes": 0,
  "assignees": []
}
```

<a id="api-023"></a>
### API-023 — GET `/approvals/`

Source : [features/approvals/api/approvals.api.ts](../src/features/approvals/api/approvals.api.ts) ligne 6, fonction `getApprovals`. **BACKEND REQUIRED**.

- Permission / scope : approvals.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `ApprovalsData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; pending + version ; type/montant autorise ; revalidation et execution unique.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/approvals/hooks/useApprovals.ts](../src/features/approvals/hooks/useApprovals.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('approvals'), env.approvalsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "requests": [],
  "permissions": [],
  "allowedApprovalTypes": [],
  "asOf": "2026-09-27"
}
```

<a id="api-024"></a>
### API-024 — GET `/approvals/{id}/`

Source : [features/approvals/api/approvals.api.ts](../src/features/approvals/api/approvals.api.ts) ligne 7, fonction `getApprovalById`. **BACKEND REQUIRED**.

- Permission / scope : approvals.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `ApprovalRequest`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; pending + version ; type/montant autorise ; revalidation et execution unique.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/approvals/hooks/useApprovals.ts](../src/features/approvals/hooks/useApprovals.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('approvals'), env.approvalsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "date": "2026-09-27",
  "type": "inventory",
  "requester": "Exemple",
  "context": "Exemple",
  "amount": null,
  "risk": null,
  "status": "pending",
  "approver": null,
  "recordId": null,
  "recordPath": null,
  "canOpenRecord": false,
  "attachments": [],
  "comments": [],
  "aiRecommendation": null,
  "impact": "Exemple",
  "version": 1,
  "capabilities": {
    "canApprove": false,
    "canReject": false
  }
}
```

<a id="api-025"></a>
### API-025 — POST `/approvals/{id}/approve/`

Source : [features/approvals/api/approvals.api.ts](../src/features/approvals/api/approvals.api.ts) ligne 8, fonction `approveRequest`. **BACKEND REQUIRED**.

- Permission / scope : approvals.approve + allowedApprovalTypes + canApprove ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `data`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, data: ApprovalDecision`.
- Success response : `ApprovalRequest`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; pending + version ; type/montant autorise ; revalidation et execution unique.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/approvals/hooks/useApprovals.ts](../src/features/approvals/hooks/useApprovals.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['approvals', 'expenses', 'audit-logs', 'cash-flow', 'cash-forecast', 'report-analytics'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('approvals'), env.approvalsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "date": "2026-09-27",
  "type": "inventory",
  "requester": "Exemple",
  "context": "Exemple",
  "amount": null,
  "risk": null,
  "status": "pending",
  "approver": null,
  "recordId": null,
  "recordPath": null,
  "canOpenRecord": false,
  "attachments": [],
  "comments": [],
  "aiRecommendation": null,
  "impact": "Exemple",
  "version": 1,
  "capabilities": {
    "canApprove": false,
    "canReject": false
  }
}
```

<a id="api-026"></a>
### API-026 — POST `/approvals/{id}/reject/`

Source : [features/approvals/api/approvals.api.ts](../src/features/approvals/api/approvals.api.ts) ligne 9, fonction `rejectRequest`. **BACKEND REQUIRED**.

- Permission / scope : approvals.approve + allowedApprovalTypes + canReject ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `data`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, data: ApprovalDecision`.
- Success response : `ApprovalRequest`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; pending + version ; type/montant autorise ; revalidation et execution unique.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/approvals/hooks/useApprovals.ts](../src/features/approvals/hooks/useApprovals.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['approvals', 'expenses', 'audit-logs', 'cash-flow', 'cash-forecast', 'report-analytics'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('approvals'), env.approvalsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "date": "2026-09-27",
  "type": "inventory",
  "requester": "Exemple",
  "context": "Exemple",
  "amount": null,
  "risk": null,
  "status": "pending",
  "approver": null,
  "recordId": null,
  "recordPath": null,
  "canOpenRecord": false,
  "attachments": [],
  "comments": [],
  "aiRecommendation": null,
  "impact": "Exemple",
  "version": 1,
  "capabilities": {
    "canApprove": false,
    "canReject": false
  }
}
```

<a id="api-027"></a>
### API-027 — POST `/auth/login/`

Source : [features/auth/api/auth.api.ts](../src/features/auth/api/auth.api.ts) ligne 53, fonction `login`. **BACKEND REQUIRED**.

- Permission / scope : public avec CSRF et limitation tentatives ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ email: credentials.email, password: credentials.password, }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `credentials: LoginCredentials`.
- Success response : `unknown`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; compte actif, credentials valides ; politique 2FA a integrer.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [app/router.tsx](../src/app/router.tsx), [components/layout/FeaturePlaceholder.tsx](../src/components/layout/FeaturePlaceholder.tsx), [features/admin/data/admin.mock.ts](../src/features/admin/data/admin.mock.ts), [features/auth/components/LoginForm.tsx](../src/features/auth/components/LoginForm.tsx), [features/auth/components/RequireAuth.tsx](../src/features/auth/components/RequireAuth.tsx), [features/auth/hooks/useLogin.ts](../src/features/auth/hooks/useLogin.ts), [features/profile/data/profile.mock.ts](../src/features/profile/data/profile.mock.ts), [features/profile/pages/UserProfilePage.tsx](../src/features/profile/pages/UserProfilePage.tsx).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Transport valide par loginResponseSchema ; exemple JSON login en tete du document. unknown est la frontiere de validation Zod, pas une absence de contrat.

<a id="api-028"></a>
### API-028 — GET `/customers/`

Source : [features/customers/api/customers.api.ts](../src/features/customers/api/customers.api.ts) ligne 21, fonction `getCustomers`. **BACKEND REQUIRED**.

- Permission / scope : customers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal, }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `signal?: AbortSignal`.
- Success response : `CustomersData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/identite et scope commercial ; limites credit et archivage.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/customers/hooks/useCustomers.ts](../src/features/customers/hooks/useCustomers.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['customers', userId, companyId, env.customersUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "customers": [],
  "permissions": [],
  "salespeople": [],
  "currentSalesperson": "Exemple",
  "period": {
    "asOf": "2026-09-27",
    "syncedAt": "2026-09-27T10:00:00Z",
    "label": "Exemple"
  },
  "revenueGrowth": 0,
  "dsoDays": 0,
  "dsoTarget": 0
}
```

<a id="api-029"></a>
### API-029 — POST `/customers/`

Source : [features/customers/api/customers.api.ts](../src/features/customers/api/customers.api.ts) ligne 31, fonction `createCustomer`. **BACKEND REQUIRED**.

- Permission / scope : customers.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `customer`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `customer: CustomerInput`.
- Success response : `Customer`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/identite et scope commercial ; limites credit et archivage.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "name": "Exemple",
  "type": "company",
  "phone": "Exemple",
  "email": "example@example.test",
  "city": "Exemple",
  "district": "Exemple",
  "salesperson": "Exemple",
  "revenue": 0,
  "outstanding": 0,
  "overdue": 0,
  "lastActivity": "Exemple",
  "activity": "Exemple",
  "createdAt": "2026-09-27T10:00:00Z",
  "status": "active",
  "tags": []
}
```

<a id="api-030"></a>
### API-030 — PATCH `/customers/{id}/`

Source : [features/customers/api/customers.api.ts](../src/features/customers/api/customers.api.ts) ligne 39, fonction `updateCustomer`. **BACKEND REQUIRED**.

- Permission / scope : customers.edit ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `customer`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number, customer: Partial<CustomerInput & Pick<Customer, 'status' &#124; 'tags'>>`.
- Success response : `Customer`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/identite et scope commercial ; limites credit et archivage.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "name": "Exemple",
  "type": "company",
  "phone": "Exemple",
  "email": "example@example.test",
  "city": "Exemple",
  "district": "Exemple",
  "salesperson": "Exemple",
  "revenue": 0,
  "outstanding": 0,
  "overdue": 0,
  "lastActivity": "Exemple",
  "activity": "Exemple",
  "createdAt": "2026-09-27T10:00:00Z",
  "status": "active",
  "tags": []
}
```

<a id="api-031"></a>
### API-031 — POST `/customers/import/`

Source : [features/customers/api/customers.api.ts](../src/features/customers/api/customers.api.ts) ligne 51, fonction `importCustomers`. **BACKEND REQUIRED**.

- Permission / scope : customers.create (pas de code import distinct) ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `form`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `file: File`.
- Success response : `{ imported: number; }`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/identite et scope commercial ; limites credit et archivage.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
{
  "imported": 0
}
```

<a id="api-032"></a>
### API-032 — GET `/customers/{id}/`

Source : [features/customers/api/customers.api.ts](../src/features/customers/api/customers.api.ts) ligne 66, fonction `getCustomerById`. **BACKEND REQUIRED**.

- Permission / scope : customers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number, signal?: AbortSignal`.
- Success response : `CustomerDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/identite et scope commercial ; limites credit et archivage.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/customers/hooks/useCustomerDetail.ts](../src/features/customers/hooks/useCustomerDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `key` ; `[...key, 'summary']` ; `[...key, 'activity']` ; `[...key, 'ai']`.

Exemple de forme JSON attendue :

```json
{
  "country": "Exemple",
  "industry": "Exemple",
  "taxId": "example-id",
  "website": "Exemple",
  "address": "Exemple",
  "segment": "Exemple",
  "paymentTerms": "Exemple",
  "currency": "MAD",
  "preferredContact": "Exemple",
  "lastOrder": null,
  "lastPayment": null,
  "primaryContact": null,
  "sales": [],
  "invoices": [],
  "payments": [],
  "documents": [],
  "notes": [],
  "nextActions": [],
  "permissions": [],
  "salespeople": [],
  "id": 1,
  "reference": "Exemple",
  "name": "Exemple",
  "type": "company",
  "phone": "Exemple",
  "email": "example@example.test",
  "city": "Exemple",
  "district": "Exemple",
  "salesperson": "Exemple",
  "revenue": 0,
  "outstanding": 0,
  "overdue": 0,
  "lastActivity": "Exemple",
  "activity": "Exemple",
  "createdAt": "2026-09-27T10:00:00Z",
  "status": "active",
  "tags": []
}
```

<a id="api-033"></a>
### API-033 — GET `/customers/{id}/summary/`

Source : [features/customers/api/customers.api.ts](../src/features/customers/api/customers.api.ts) ligne 76, fonction `getCustomerSummary`. **BACKEND REQUIRED**.

- Permission / scope : customers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number, signal?: AbortSignal`.
- Success response : `CustomerSummary`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/identite et scope commercial ; limites credit et archivage.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/customers/hooks/useCustomerDetail.ts](../src/features/customers/hooks/useCustomerDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `key` ; `[...key, 'summary']` ; `[...key, 'activity']` ; `[...key, 'ai']`.

Exemple de forme JSON attendue :

```json
{
  "asOf": "2026-09-27",
  "customerScore": null,
  "paymentReliability": null,
  "revenue": null,
  "revenueGrowth": null,
  "averageOrderValue": null,
  "outstanding": null,
  "overdue": null,
  "paymentDelay": null,
  "previousPaymentDelay": null,
  "profitability": null,
  "totalOrders": null,
  "creditLimit": null
}
```

<a id="api-034"></a>
### API-034 — GET `/customers/{id}/activity/`

Source : [features/customers/api/customers.api.ts](../src/features/customers/api/customers.api.ts) ligne 82, fonction `getCustomerActivity`. **BACKEND REQUIRED**.

- Permission / scope : customers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number, signal?: AbortSignal`.
- Success response : `CustomerActivity[]`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/identite et scope commercial ; limites credit et archivage.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/customers/hooks/useCustomerDetail.ts](../src/features/customers/hooks/useCustomerDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `key` ; `[...key, 'summary']` ; `[...key, 'activity']` ; `[...key, 'ai']`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-035"></a>
### API-035 — GET `/ai/customers/{id}/insight/`

Source : [features/customers/api/customers.api.ts](../src/features/customers/api/customers.api.ts) ligne 97, fonction `getCustomerAIInsight`. **BACKEND REQUIRED**.

- Permission / scope : customers.view + ai.use ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number, signal?: AbortSignal`.
- Success response : `CustomerAIInsight &#124; null`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/identite et scope commercial ; limites credit et archivage.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
null
```

<a id="api-036"></a>
### API-036 — GET `/dashboard/summary/`

Source : [features/dashboard/api/dashboard.api.ts](../src/features/dashboard/api/dashboard.api.ts) ligne 12, fonction `getDashboard`. **BACKEND REQUIRED**.

- Permission / scope : aucun code explicite ; PROPOSED dashboard.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `aucun`.
- Success response : `DashboardData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; agregats autorises coherents a une meme date.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/dashboard/hooks/useDashboard.ts](../src/features/dashboard/hooks/useDashboard.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['dashboard', userId, companyId, env.dashboardUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "currency": "MAD",
  "period": {
    "label": "Exemple",
    "quarter": "Exemple",
    "currentYear": 0,
    "previousYear": 0,
    "asOf": "2026-09-27"
  },
  "branch": "Exemple",
  "kpis": [],
  "summary": {
    "score": 0,
    "status": "Exemple",
    "confidence": 1,
    "generatedAt": "2026-09-27T10:00:00Z",
    "text": "Exemple",
    "risks": [],
    "opportunities": [],
    "recommendations": []
  },
  "revenue": [],
  "revenueBreakdown": {
    "revenue": 0,
    "expenses": 0,
    "grossProfit": 0,
    "margin": 0,
    "suggestion": "Exemple"
  },
  "cashFlow": {
    "current": 0,
    "inflows": 0,
    "outflows": 0,
    "projected": 0,
    "points": [],
    "status": "Exemple"
  },
  "receivables": {
    "total": 0,
    "dso": 0,
    "overdueCount": 1,
    "buckets": []
  },
  "inventory": {
    "value": 0,
    "turnover": 0,
    "dormantValue": 0,
    "segments": []
  },
  "alerts": [],
  "topCustomers": [],
  "topCustomersShare": 0,
  "topProducts": [],
  "recentInvoices": []
}
```

<a id="api-037"></a>
### API-037 — GET `/documents/`

Source : [features/documents/api/documents.api.ts](../src/features/documents/api/documents.api.ts) ligne 6, fonction `getDocuments`. **BACKEND REQUIRED**.

- Permission / scope : documents.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `DocumentList`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; MIME/taille/ACL ; document indexe avant RAG ; citations autorisees.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/documents/hooks/useDocuments.ts](../src/features/documents/hooks/useDocuments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('documents'), env.documentsUseMock]` ; `[...key('document'), env.documentsUseMock, id]` ; `[...key('document-pages'), env.documentsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "documents": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "acceptedTypes": [],
  "maxBytes": 0,
  "visibilityOptions": []
}
```

<a id="api-038"></a>
### API-038 — GET `/documents/{id}/`

Source : [features/documents/api/documents.api.ts](../src/features/documents/api/documents.api.ts) ligne 7, fonction `getDocumentById`. **BACKEND REQUIRED**.

- Permission / scope : documents.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `DocumentDetail`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; MIME/taille/ACL ; document indexe avant RAG ; citations autorisees.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/documents/hooks/useDocuments.ts](../src/features/documents/hooks/useDocuments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('documents'), env.documentsUseMock]` ; `[...key('document'), env.documentsUseMock, id]` ; `[...key('document-pages'), env.documentsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "name": "Exemple",
  "mime": "Exemple",
  "category": "Exemple",
  "department": "Exemple",
  "author": "Exemple",
  "size": 1,
  "createdAt": "2026-09-27T10:00:00Z",
  "status": "uploading",
  "visibility": "Exemple",
  "url": null,
  "pageCount": 1,
  "canView": false,
  "capabilities": {
    "canDelete": false,
    "canIndex": false,
    "canDownload": false,
    "canAnalyze": false
  },
  "indexError": null
}
```

<a id="api-039"></a>
### API-039 — GET `/documents/{id}/pages/`

Source : [features/documents/api/documents.api.ts](../src/features/documents/api/documents.api.ts) ligne 8, fonction `getDocumentPages`. **BACKEND REQUIRED**.

- Permission / scope : documents.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `DocumentPage[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; MIME/taille/ACL ; document indexe avant RAG ; citations autorisees.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/documents/hooks/useDocuments.ts](../src/features/documents/hooks/useDocuments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('documents'), env.documentsUseMock]` ; `[...key('document'), env.documentsUseMock, id]` ; `[...key('document-pages'), env.documentsUseMock, id]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-040"></a>
### API-040 — POST `/documents/`

Source : [features/documents/api/documents.api.ts](../src/features/documents/api/documents.api.ts) ligne 9, fonction `uploadDocument`. **BACKEND REQUIRED**.

- Permission / scope : documents.upload ; societe active, module et droits objet.
- Query parameters et options Axios : `{ onUploadProgress: (event) => { if (event.total) progress?.(Math.round(event.loaded / event.total * 100)) } }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, file: File, metadata: DocumentMetadata, progress?: (percent: number) => void`.
- Success response : `DocumentRecord`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; MIME/taille/ACL ; document indexe avant RAG ; citations autorisees.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/documents/hooks/useDocuments.ts](../src/features/documents/hooks/useDocuments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['documents', 'document', 'document-pages'])` ; `invalidate(['documents', 'document', 'document-pages'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('documents'), env.documentsUseMock]` ; `[...key('document'), env.documentsUseMock, id]` ; `[...key('document-pages'), env.documentsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "name": "Exemple",
  "mime": "Exemple",
  "category": "Exemple",
  "department": "Exemple",
  "author": "Exemple",
  "size": 1,
  "createdAt": "2026-09-27T10:00:00Z",
  "status": "uploading",
  "visibility": "Exemple",
  "url": null,
  "pageCount": 1,
  "canView": false,
  "capabilities": {
    "canDelete": false,
    "canIndex": false,
    "canDownload": false,
    "canAnalyze": false
  },
  "indexError": null
}
```

<a id="api-041"></a>
### API-041 — DELETE `/documents/{id}/`

Source : [features/documents/api/documents.api.ts](../src/features/documents/api/documents.api.ts) ligne 10, fonction `deleteDocument`. **BACKEND REQUIRED**.

- Permission / scope : documents.delete + canDelete ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; MIME/taille/ACL ; document indexe avant RAG ; citations autorisees.
- HTTP possibles : 204 (ou 200 si body attendu), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/documents/hooks/useDocuments.ts](../src/features/documents/hooks/useDocuments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['documents', 'document', 'document-pages'])` ; `invalidate(['documents', 'document', 'document-pages'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('documents'), env.documentsUseMock]` ; `[...key('document'), env.documentsUseMock, id]` ; `[...key('document-pages'), env.documentsUseMock, id]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.

<a id="api-042"></a>
### API-042 — POST `/documents/{id}/index/`

Source : [features/documents/api/documents.api.ts](../src/features/documents/api/documents.api.ts) ligne 11, fonction `indexDocument`. **BACKEND REQUIRED**.

- Permission / scope : documents.ai_analyze + canIndex ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `DocumentRecord`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; MIME/taille/ACL ; document indexe avant RAG ; citations autorisees.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/documents/hooks/useDocuments.ts](../src/features/documents/hooks/useDocuments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['documents', 'document', 'document-pages'])` ; `invalidate(['documents', 'document', 'document-pages'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('documents'), env.documentsUseMock]` ; `[...key('document'), env.documentsUseMock, id]` ; `[...key('document-pages'), env.documentsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "name": "Exemple",
  "mime": "Exemple",
  "category": "Exemple",
  "department": "Exemple",
  "author": "Exemple",
  "size": 1,
  "createdAt": "2026-09-27T10:00:00Z",
  "status": "uploading",
  "visibility": "Exemple",
  "url": null,
  "pageCount": 1,
  "canView": false,
  "capabilities": {
    "canDelete": false,
    "canIndex": false,
    "canDownload": false,
    "canAnalyze": false
  },
  "indexError": null
}
```

<a id="api-043"></a>
### API-043 — POST `/ai/documents/{id}/query/`

Source : [features/documents/api/documents.api.ts](../src/features/documents/api/documents.api.ts) ligne 12, fonction `queryDocument`. **BACKEND REQUIRED**.

- Permission / scope : documents.view + documents.ai_analyze + ai.use + canAnalyze ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ question }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, question: string`.
- Success response : `DocumentAnswer`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; MIME/taille/ACL ; document indexe avant RAG ; citations autorisees.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/documents/hooks/useDocuments.ts](../src/features/documents/hooks/useDocuments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['documents', 'document', 'document-pages'])` ; `invalidate(['documents', 'document', 'document-pages'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('documents'), env.documentsUseMock]` ; `[...key('document'), env.documentsUseMock, id]` ; `[...key('document-pages'), env.documentsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "answer": "Exemple",
  "sources": [],
  "verified": false,
  "generatedAt": "2026-09-27T10:00:00Z",
  "confidence": null,
  "simulated": false
}
```

<a id="api-044"></a>
### API-044 — POST `/ai/documents/{id}/analyze/`

Source : [features/documents/api/documents.api.ts](../src/features/documents/api/documents.api.ts) ligne 13, fonction `analyzeDocument`. **BACKEND REQUIRED**.

- Permission / scope : documents.view + documents.ai_analyze + ai.use + canAnalyze ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ action }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, action: DocumentAction`.
- Success response : `DocumentAnalysis`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; MIME/taille/ACL ; document indexe avant RAG ; citations autorisees.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/documents/hooks/useDocuments.ts](../src/features/documents/hooks/useDocuments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['documents', 'document', 'document-pages'])` ; `invalidate(['documents', 'document', 'document-pages'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('documents'), env.documentsUseMock]` ; `[...key('document'), env.documentsUseMock, id]` ; `[...key('document-pages'), env.documentsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "summary": "Exemple",
  "keyInformation": [],
  "dates": [],
  "paymentTerms": [],
  "risks": [],
  "sources": [],
  "generatedAt": "2026-09-27T10:00:00Z",
  "confidence": null,
  "simulated": false
}
```

<a id="api-045"></a>
### API-045 — GET `/expenses/`

Source : [features/expenses/api/expenses.api.ts](../src/features/expenses/api/expenses.api.ts) ligne 7, fonction `getExpenses`. **BACKEND REQUIRED**.

- Permission / scope : expenses.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `ExpensesData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; draft -> submitted -> approved/rejected -> paid ; montants justes ; pas de double decaissement.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/expenses/hooks/useExpenses.ts](../src/features/expenses/hooks/useExpenses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('expenses'), env.expensesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "expenses": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "suppliers": [],
  "categories": []
}
```

<a id="api-046"></a>
### API-046 — POST `/expenses/`

Source : [features/expenses/api/expenses.api.ts](../src/features/expenses/api/expenses.api.ts) ligne 8, fonction `createExpense`. **BACKEND REQUIRED**.

- Permission / scope : expenses.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ date: v.date, description: v.description, category: v.category, supplier_id: v.supplierId, employee: v.employee, amount_ht: v.amountHT, tax_rate: v.taxRate, note: v.note }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: ExpenseInput`.
- Success response : `Expense`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; draft -> submitted -> approved/rejected -> paid ; montants justes ; pas de double decaissement.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/expenses/hooks/useExpenses.ts](../src/features/expenses/hooks/useExpenses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['expenses', 'cash-flow', 'cash-forecast', 'cash-upcoming', 'reports', 'report-analytics', 'forecast', 'forecast-drivers', 'ai-opportunities', 'approvals', 'reports-recent'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('expenses'), env.expensesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "supplierName": null,
  "taxAmount": 0,
  "total": 0,
  "status": "approved",
  "paidDate": null,
  "receipt": null,
  "capabilities": {
    "canSubmit": false,
    "canApprove": false
  },
  "date": "2026-09-27",
  "description": "Exemple",
  "category": "Exemple",
  "supplierId": null,
  "employee": "Exemple",
  "amountHT": 0,
  "taxRate": 0,
  "note": "Exemple"
}
```

<a id="api-047"></a>
### API-047 — POST `/expenses/{id}/submit/`

Source : [features/expenses/api/expenses.api.ts](../src/features/expenses/api/expenses.api.ts) ligne 9, fonction `submitExpense`. **BACKEND REQUIRED**.

- Permission / scope : expenses.create + canSubmit ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `Expense`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; draft -> submitted -> approved/rejected -> paid ; montants justes ; pas de double decaissement.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/expenses/hooks/useExpenses.ts](../src/features/expenses/hooks/useExpenses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['expenses', 'cash-flow', 'cash-forecast', 'cash-upcoming', 'reports', 'report-analytics', 'forecast', 'forecast-drivers', 'ai-opportunities', 'approvals', 'reports-recent'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('expenses'), env.expensesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "supplierName": null,
  "taxAmount": 0,
  "total": 0,
  "status": "approved",
  "paidDate": null,
  "receipt": null,
  "capabilities": {
    "canSubmit": false,
    "canApprove": false
  },
  "date": "2026-09-27",
  "description": "Exemple",
  "category": "Exemple",
  "supplierId": null,
  "employee": "Exemple",
  "amountHT": 0,
  "taxRate": 0,
  "note": "Exemple"
}
```

<a id="api-048"></a>
### API-048 — POST `/expenses/{id}/approve/`

Source : [features/expenses/api/expenses.api.ts](../src/features/expenses/api/expenses.api.ts) ligne 10, fonction `approveExpense`. **BACKEND REQUIRED**.

- Permission / scope : expenses.approve + canApprove ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `Expense`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; draft -> submitted -> approved/rejected -> paid ; montants justes ; pas de double decaissement.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/expenses/hooks/useExpenses.ts](../src/features/expenses/hooks/useExpenses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['expenses', 'cash-flow', 'cash-forecast', 'cash-upcoming', 'reports', 'report-analytics', 'forecast', 'forecast-drivers', 'ai-opportunities', 'approvals', 'reports-recent'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('expenses'), env.expensesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "supplierName": null,
  "taxAmount": 0,
  "total": 0,
  "status": "approved",
  "paidDate": null,
  "receipt": null,
  "capabilities": {
    "canSubmit": false,
    "canApprove": false
  },
  "date": "2026-09-27",
  "description": "Exemple",
  "category": "Exemple",
  "supplierId": null,
  "employee": "Exemple",
  "amountHT": 0,
  "taxRate": 0,
  "note": "Exemple"
}
```

<a id="api-049"></a>
### API-049 — GET `/finance/cash-flow/`

Source : [features/finance/api/finance.api.ts](../src/features/finance/api/finance.api.ts) ligne 5, fonction `getCashFlow`. **BACKEND REQUIRED**.

- Permission / scope : finance.view / cashflow.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `CashFlowData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; ledger confirme ; annulations exclues ; pas de double compte depense/paiement.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/finance/hooks/useCashFlow.ts](../src/features/finance/hooks/useCashFlow.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('cash-flow'), env.financeUseMock]` ; `[...key('cash-forecast'), env.financeUseMock, horizon]` ; `[...key('cash-upcoming'), env.financeUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "opening": 0,
  "openingDate": "2026-09-27",
  "cash": null,
  "incoming": 0,
  "outgoing": 0,
  "receivable": 0,
  "payable": 0,
  "history": [],
  "receivableAging": [],
  "payableAging": [],
  "source": "Exemple"
}
```

<a id="api-050"></a>
### API-050 — GET `/finance/forecast/`

Source : [features/finance/api/finance.api.ts](../src/features/finance/api/finance.api.ts) ligne 6, fonction `getCashForecast`. **BACKEND REQUIRED**.

- Permission / scope : finance.view / cashflow.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: { horizon }, signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, horizon: number, signal?: AbortSignal`.
- Success response : `CashForecast`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; ledger confirme ; annulations exclues ; pas de double compte depense/paiement.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/finance/hooks/useCashFlow.ts](../src/features/finance/hooks/useCashFlow.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('cash-flow'), env.financeUseMock]` ; `[...key('cash-forecast'), env.financeUseMock, horizon]` ; `[...key('cash-upcoming'), env.financeUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "horizon": 1,
  "generatedAt": "2026-09-27T10:00:00Z",
  "confidence": null,
  "lowConfidence": false,
  "projected": null,
  "series": [],
  "assumptions": "Exemple"
}
```

<a id="api-051"></a>
### API-051 — GET `/finance/upcoming-payments/`

Source : [features/finance/api/finance.api.ts](../src/features/finance/api/finance.api.ts) ligne 7, fonction `getUpcomingPayments`. **BACKEND REQUIRED**.

- Permission / scope : finance.view / cashflow.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `CashUpcoming`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; ledger confirme ; annulations exclues ; pas de double compte depense/paiement.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/finance/hooks/useCashFlow.ts](../src/features/finance/hooks/useCashFlow.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('cash-flow'), env.financeUseMock]` ; `[...key('cash-forecast'), env.financeUseMock, horizon]` ; `[...key('cash-upcoming'), env.financeUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "customers": [],
  "suppliers": []
}
```

<a id="api-052"></a>
### API-052 — GET `/ai/finance/cash-insight/`

Source : [features/finance/api/finance.api.ts](../src/features/finance/api/finance.api.ts) ligne 8, fonction `getCashAIInsight`. **BACKEND REQUIRED**.

- Permission / scope : finance.view / cashflow.view + ai.use ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: { horizon } }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, horizon: number`.
- Success response : `CashInsight`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; ledger confirme ; annulations exclues ; pas de double compte depense/paiement.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/finance/hooks/useCashFlow.ts](../src/features/finance/hooks/useCashFlow.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('cash-flow'), env.financeUseMock]` ; `[...key('cash-forecast'), env.financeUseMock, horizon]` ; `[...key('cash-upcoming'), env.financeUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "facts": [],
  "forecast": null,
  "analysis": "Exemple",
  "risk": "Exemple",
  "recommendations": [],
  "source": "Exemple",
  "horizon": 1,
  "generatedAt": "2026-09-27T10:00:00Z",
  "confidence": null
}
```

<a id="api-053"></a>
### API-053 — GET `/inventory/summary/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 9, fonction `getInventorySummary`. **BACKEND REQUIRED**.

- Permission / scope : inventory.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `InventorySummary`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "value": 0,
  "available": 0,
  "lowStock": 0,
  "outOfStock": 0,
  "dormantValue": 0,
  "incoming": 0,
  "permissions": [],
  "asOf": "2026-09-27",
  "products": [],
  "rows": [],
  "warehouses": []
}
```

<a id="api-054"></a>
### API-054 — GET `/inventory/health/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 11, fonction `getInventoryHealth`. **BACKEND REQUIRED**.

- Permission / scope : inventory.analytics.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `InventoryHealth`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "categories": [],
  "warehouses": []
}
```

<a id="api-055"></a>
### API-055 — GET `/inventory/critical/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 16, fonction `getCriticalProducts`. **BACKEND REQUIRED**.

- Permission / scope : inventory.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `InventoryRow[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-056"></a>
### API-056 — GET `/inventory/recent-movements/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 17, fonction `getRecentMovements`. **BACKEND REQUIRED**.

- Permission / scope : inventory.movements.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `StockMovement[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-057"></a>
### API-057 — GET `/inventory/movements/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 18, fonction `getStockMovements`. **BACKEND REQUIRED**.

- Permission / scope : inventory.movements.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `MovementData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "movements": [],
  "products": [],
  "stock": [],
  "warehouses": [],
  "permissions": [],
  "asOf": "2026-09-27"
}
```

<a id="api-058"></a>
### API-058 — GET `/inventory/movements/{id}/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 19, fonction `getStockMovementById`. **BACKEND REQUIRED**.

- Permission / scope : inventory.movements.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `StockMovement`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "date": "2026-09-27",
  "type": "in",
  "productId": 1,
  "productName": "Exemple",
  "warehouseId": 1,
  "warehouseName": "Exemple",
  "destinationId": null,
  "destinationName": null,
  "quantity": 1,
  "before": 0,
  "after": 0,
  "sourceReference": "Exemple",
  "sourcePath": null,
  "user": "Exemple",
  "note": "Exemple"
}
```

<a id="api-059"></a>
### API-059 — POST `/inventory/movements/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 20, fonction `createStockMovement`. **BACKEND REQUIRED**.

- Permission / scope : inventory.movements.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ product_id: v.productId, warehouse_id: v.warehouseId, quantity: v.quantity, type: v.type, date: v.date, source_reference: v.sourceReference, note: v.note, adjustment_direction: v.adjustmentDirection }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: MovementInput`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.

<a id="api-060"></a>
### API-060 — GET `/inventory/transfers/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 21, fonction `getStockTransfers`. **BACKEND REQUIRED**.

- Permission / scope : inventory.transfers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `TransferData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts), [features/warehouses/hooks/useWarehouses.ts](../src/features/warehouses/hooks/useWarehouses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]` ; `[...key('warehouses'), env.warehousesUseMock]` ; `[...key('warehouse'), env.warehousesUseMock, id]` ; `[...key('warehouse-inventory'), env.warehousesUseMock, id]` ; `[...key('warehouse-movements'), env.warehousesUseMock, id]` ; `[...key('warehouse-valuation'), env.warehousesUseMock, id]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "transfers": [],
  "products": [],
  "stock": [],
  "warehouses": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "supportsStatusPatch": false
}
```

<a id="api-061"></a>
### API-061 — POST `/inventory/transfers/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 23, fonction `createStockTransfer`. **BACKEND REQUIRED**.

- Permission / scope : inventory.transfers.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `transferDTO(v)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: TransferInput`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.

<a id="api-062"></a>
### API-062 — PATCH `/inventory/transfers/{id}/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 24, fonction `updateStockTransfer`. **BACKEND REQUIRED**.

- Permission / scope : inventory.transfers.create ou inventory.transfers.approve selon transition + capabilities ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `'status' in v ? v : transferDTO(v)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, v: TransferInput &#124; { status: 'ready' &#124; 'in_transit' &#124; 'cancelled' }`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.

<a id="api-063"></a>
### API-063 — POST `/inventory/transfers/{id}/complete/`

Source : [features/inventory/api/inventory.api.ts](../src/features/inventory/api/inventory.api.ts) ligne 25, fonction `completeStockTransfer`. **BACKEND REQUIRED**.

- Permission / scope : inventory.transfers.approve + canComplete ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; quantites positives ; disponible suffisant ; source != destination ; etat/version ; journal immutable.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/inventory/hooks/useStockData.ts](../src/features/inventory/hooks/useStockData.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('inventory-summary'), env.inventoryUseMock]` ; `[...key('inventory-health'), env.inventoryUseMock]` ; `[...key('inventory-critical'), env.inventoryUseMock]` ; `[...key('inventory-recent'), env.inventoryUseMock]` ; `[...key('movements'), env.inventoryUseMock]` ; `[...key('transfers'), env.inventoryUseMock]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.

<a id="api-064"></a>
### API-064 — GET `/invoices/`

Source : [features/invoices/api/invoices.api.ts](../src/features/invoices/api/invoices.api.ts) ligne 12, fonction `getInvoices`. **BACKEND REQUIRED**.

- Permission / scope : invoices.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `InvoicesData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow/version, lignes exactes, echeance, solde et idempotence paiement.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/invoices/hooks/useInvoiceDetail.ts](../src/features/invoices/hooks/useInvoiceDetail.ts), [features/invoices/hooks/useInvoices.ts](../src/features/invoices/hooks/useInvoices.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `[name, userId, companyId]` ; `['invoices', userId, companyId]` ; `['invoice-aging', userId, companyId]` ; `['sales-order', userId, companyId]` ; `['sales-orders', userId, companyId]` ; `['payments', userId, companyId]` ; `['payments-summary', userId, companyId]` ; `['invoices', userId, companyId, env.invoicesUseMock]` ; `['invoices', userId, companyId, env.invoicesUseMock]` ; `['invoice-detail', userId, companyId]` ; `['invoice-aging', userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "invoices": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "currentSalesperson": "Exemple"
}
```

<a id="api-065"></a>
### API-065 — GET `/invoices/aging/`

Source : [features/invoices/api/invoices.api.ts](../src/features/invoices/api/invoices.api.ts) ligne 17, fonction `getInvoicesAging`. **BACKEND REQUIRED**.

- Permission / scope : invoices.view + finance.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `AgingBucket[]`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow/version, lignes exactes, echeance, solde et idempotence paiement.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-066"></a>
### API-066 — GET `/invoices/{id}/`

Source : [features/invoices/api/invoices.api.ts](../src/features/invoices/api/invoices.api.ts) ligne 21, fonction `getInvoiceById`. **BACKEND REQUIRED**.

- Permission / scope : invoices.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `InvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow/version, lignes exactes, echeance, solde et idempotence paiement.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/invoices/hooks/useInvoiceDetail.ts](../src/features/invoices/hooks/useInvoiceDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `[name, userId, companyId]` ; `['invoices', userId, companyId]` ; `['invoice-aging', userId, companyId]` ; `['sales-order', userId, companyId]` ; `['sales-orders', userId, companyId]` ; `['payments', userId, companyId]` ; `['payments-summary', userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "customerEmail": "example@example.test",
  "totals": {
    "gross": 0,
    "discount": 1,
    "net": 0,
    "tax": 0,
    "total": 0
  },
  "payments": [],
  "deliveries": [],
  "creditNotes": [],
  "documents": [],
  "activities": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "customerId": 1,
  "customerName": "Exemple",
  "salesperson": "Exemple",
  "invoiceDate": "2026-09-27",
  "issuedAt": null,
  "dueDate": "2026-09-27",
  "totalAmount": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "salesOrderId": null,
  "salesOrderReference": null,
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canSend": false,
    "canPay": false,
    "canRemind": false
  },
  "billingAddress": "Exemple",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "customerReference": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-067"></a>
### API-067 — POST `/invoices/`

Source : [features/invoices/api/invoices.api.ts](../src/features/invoices/api/invoices.api.ts) ligne 29, fonction `createInvoice`. **BACKEND REQUIRED**.

- Permission / scope : invoices.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `inputDTO(input)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, input: InvoiceInput`.
- Success response : `InvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow/version, lignes exactes, echeance, solde et idempotence paiement.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/invoices/hooks/useInvoiceDetail.ts](../src/features/invoices/hooks/useInvoiceDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [name, userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['invoices', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['invoice-aging', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['sales-order', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['sales-orders', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['payments', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['payments-summary', userId, companyId] })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `[name, userId, companyId]` ; `['invoices', userId, companyId]` ; `['invoice-aging', userId, companyId]` ; `['sales-order', userId, companyId]` ; `['sales-orders', userId, companyId]` ; `['payments', userId, companyId]` ; `['payments-summary', userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "customerEmail": "example@example.test",
  "totals": {
    "gross": 0,
    "discount": 1,
    "net": 0,
    "tax": 0,
    "total": 0
  },
  "payments": [],
  "deliveries": [],
  "creditNotes": [],
  "documents": [],
  "activities": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "customerId": 1,
  "customerName": "Exemple",
  "salesperson": "Exemple",
  "invoiceDate": "2026-09-27",
  "issuedAt": null,
  "dueDate": "2026-09-27",
  "totalAmount": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "salesOrderId": null,
  "salesOrderReference": null,
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canSend": false,
    "canPay": false,
    "canRemind": false
  },
  "billingAddress": "Exemple",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "customerReference": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-068"></a>
### API-068 — PATCH `/invoices/{id}/`

Source : [features/invoices/api/invoices.api.ts](../src/features/invoices/api/invoices.api.ts) ligne 33, fonction `updateInvoice`. **BACKEND REQUIRED**.

- Permission / scope : invoices.edit + canEdit ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `inputDTO(input)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, input: InvoiceInput`.
- Success response : `InvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow/version, lignes exactes, echeance, solde et idempotence paiement.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/invoices/hooks/useInvoiceDetail.ts](../src/features/invoices/hooks/useInvoiceDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [name, userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['invoices', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['invoice-aging', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['sales-order', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['sales-orders', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['payments', userId, companyId] })` ; `client.invalidateQueries({ queryKey: ['payments-summary', userId, companyId] })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `[name, userId, companyId]` ; `['invoices', userId, companyId]` ; `['invoice-aging', userId, companyId]` ; `['sales-order', userId, companyId]` ; `['sales-orders', userId, companyId]` ; `['payments', userId, companyId]` ; `['payments-summary', userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "customerEmail": "example@example.test",
  "totals": {
    "gross": 0,
    "discount": 1,
    "net": 0,
    "tax": 0,
    "total": 0
  },
  "payments": [],
  "deliveries": [],
  "creditNotes": [],
  "documents": [],
  "activities": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "customerId": 1,
  "customerName": "Exemple",
  "salesperson": "Exemple",
  "invoiceDate": "2026-09-27",
  "issuedAt": null,
  "dueDate": "2026-09-27",
  "totalAmount": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "salesOrderId": null,
  "salesOrderReference": null,
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canSend": false,
    "canPay": false,
    "canRemind": false
  },
  "billingAddress": "Exemple",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "customerReference": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-069"></a>
### API-069 — POST `/invoices/{id}/{action}/`

Source : [features/invoices/api/invoices.api.ts](../src/features/invoices/api/invoices.api.ts) ligne 37, fonction `mutateInvoice`. **BACKEND REQUIRED**.

- Permission / scope : post: invoices.post ; send: invoices.send ; payment: payments.create ; remind: invoices.remind + capability ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `input`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, action: InvoiceAction, input?: InvoicePaymentInput`.
- Success response : `InvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow/version, lignes exactes, echeance, solde et idempotence paiement.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
{
  "customerEmail": "example@example.test",
  "totals": {
    "gross": 0,
    "discount": 1,
    "net": 0,
    "tax": 0,
    "total": 0
  },
  "payments": [],
  "deliveries": [],
  "creditNotes": [],
  "documents": [],
  "activities": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "customerId": 1,
  "customerName": "Exemple",
  "salesperson": "Exemple",
  "invoiceDate": "2026-09-27",
  "issuedAt": null,
  "dueDate": "2026-09-27",
  "totalAmount": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "salesOrderId": null,
  "salesOrderReference": null,
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canSend": false,
    "canPay": false,
    "canRemind": false
  },
  "billingAddress": "Exemple",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "customerReference": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-070"></a>
### API-070 — GET `/modules/`

Source : [features/modules/api/modules.api.ts](../src/features/modules/api/modules.api.ts) ligne 5, fonction `getModules`. **BACKEND REQUIRED**.

- Permission / scope : modules.manage ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, companyId: number, signal?: AbortSignal`.
- Success response : `ModulesData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; module connu ; dependances et licence ; aucune suppression de donnees.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/modules/hooks/useModules.ts](../src/features/modules/hooks/useModules.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('modules'), env.modulesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "companyId": 1,
  "modules": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "plan": "Exemple"
}
```

<a id="api-071"></a>
### API-071 — POST `/companies/{companyId}/modules/{moduleKey}/enable/`

Source : [features/modules/api/modules.api.ts](../src/features/modules/api/modules.api.ts) ligne 6, fonction `enableModule`. **BACKEND REQUIRED**.

- Permission / scope : modules.manage ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{}`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, companyId: number, moduleKey: string`.
- Success response : `ModulesData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; module connu ; dependances et licence ; aucune suppression de donnees.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/modules/hooks/useModules.ts](../src/features/modules/hooks/useModules.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['modules', 'company-settings', 'ai-status'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('modules'), env.modulesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "companyId": 1,
  "modules": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "plan": "Exemple"
}
```

<a id="api-072"></a>
### API-072 — POST `/companies/{companyId}/modules/{moduleKey}/disable/`

Source : [features/modules/api/modules.api.ts](../src/features/modules/api/modules.api.ts) ligne 7, fonction `disableModule`. **BACKEND REQUIRED**.

- Permission / scope : modules.manage ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{}`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, companyId: number, moduleKey: string`.
- Success response : `ModulesData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; module connu ; dependances et licence ; aucune suppression de donnees.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/modules/hooks/useModules.ts](../src/features/modules/hooks/useModules.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['modules', 'company-settings', 'ai-status'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('modules'), env.modulesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "companyId": 1,
  "modules": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "plan": "Exemple"
}
```

<a id="api-073"></a>
### API-073 — POST `/company/onboarding/`

Source : [features/onboarding/api/onboarding.api.ts](../src/features/onboarding/api/onboarding.api.ts) ligne 68, fonction `saveOnboarding`. **BACKEND REQUIRED**.

- Permission / scope : session ; PROPOSED companies.configure ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `toOnboardingPayload(data)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `data: OnboardingData`.
- Success response : `void`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; membership, configuration valide, creation atomique, onboarding non duplique.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/onboarding/hooks/useOnboarding.ts](../src/features/onboarding/hooks/useOnboarding.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Pas de JSON garanti : retour void/any. Le consommateur ne demande pas de body.

<a id="api-074"></a>
### API-074 — GET `/payments/`

Source : [features/payments/api/payments.api.ts](../src/features/payments/api/payments.api.ts) ligne 10, fonction `getPayments`. **BACKEND REQUIRED**.

- Permission / scope : payments.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: params(query), signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, query: PaymentQuery, signal?: AbortSignal`.
- Success response : `PaymentsData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; facture comptabilisee meme partenaire/direction/devise ; montant <= solde ; annulation une fois.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/payments/hooks/usePayments.ts](../src/features/payments/hooks/usePayments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['payments', userId, companyId, env.paymentsUseMock, filters]` ; `['payments-summary', userId, companyId, env.paymentsUseMock, filters]` ; `[key, userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "payments": [],
  "count": 1,
  "totalCount": 1,
  "permissions": [],
  "asOf": "2026-09-27",
  "openInvoices": [],
  "partners": []
}
```

<a id="api-075"></a>
### API-075 — GET `/payments/summary/`

Source : [features/payments/api/payments.api.ts](../src/features/payments/api/payments.api.ts) ligne 17, fonction `getPaymentsSummary`. **BACKEND REQUIRED**.

- Permission / scope : payments.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: filters, signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, query: PaymentQuery, signal?: AbortSignal`.
- Success response : `PaymentSummary`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; facture comptabilisee meme partenaire/direction/devise ; montant <= solde ; annulation une fois.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/payments/hooks/usePayments.ts](../src/features/payments/hooks/usePayments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['payments', userId, companyId, env.paymentsUseMock, filters]` ; `['payments-summary', userId, companyId, env.paymentsUseMock, filters]` ; `[key, userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "received": 0,
  "sent": 0,
  "pending": 0,
  "averageCollectionDays": null,
  "datedReceipts": 0
}
```

<a id="api-076"></a>
### API-076 — POST `/payments/`

Source : [features/payments/api/payments.api.ts](../src/features/payments/api/payments.api.ts) ligne 21, fonction `createPayment`. **BACKEND REQUIRED**.

- Permission / scope : payments.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ direction: input.direction, partner_id: input.partnerId, invoice_id: input.invoiceId, date: input.date, amount: input.amount, method: input.method, reference_external: input.referenceExternal, note: input.note }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, input: PaymentInput`.
- Success response : `Payment`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; facture comptabilisee meme partenaire/direction/devise ; montant <= solde ; annulation une fois.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/payments/hooks/usePayments.ts](../src/features/payments/hooks/usePayments.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [key, userId, companyId] })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['payments', userId, companyId, env.paymentsUseMock, filters]` ; `['payments-summary', userId, companyId, env.paymentsUseMock, filters]` ; `[key, userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "direction": "incoming",
  "partnerType": "supplier",
  "partnerId": 1,
  "partnerName": "Exemple",
  "invoiceId": null,
  "invoiceReference": null,
  "invoiceIssuedDate": null,
  "date": "2026-09-27",
  "amount": 0,
  "method": "cash",
  "status": "pending",
  "referenceExternal": "Exemple",
  "note": "Exemple",
  "canCancel": false
}
```

<a id="api-077"></a>
### API-077 — POST `/payments/{id}/cancel/`

Source : [features/payments/api/payments.api.ts](../src/features/payments/api/payments.api.ts) ligne 25, fonction `cancelPayment`. **BACKEND REQUIRED**.

- Permission / scope : payments.cancel + canCancel ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `Payment`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; facture comptabilisee meme partenaire/direction/devise ; montant <= solde ; annulation une fois.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/payments/hooks/usePayments.ts](../src/features/payments/hooks/usePayments.ts), [features/payments/pages/PaymentsPage.tsx](../src/features/payments/pages/PaymentsPage.tsx).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [key, userId, companyId] })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['payments', userId, companyId, env.paymentsUseMock, filters]` ; `['payments-summary', userId, companyId, env.paymentsUseMock, filters]` ; `[key, userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "direction": "incoming",
  "partnerType": "supplier",
  "partnerId": 1,
  "partnerName": "Exemple",
  "invoiceId": null,
  "invoiceReference": null,
  "invoiceIssuedDate": null,
  "date": "2026-09-27",
  "amount": 0,
  "method": "cash",
  "status": "pending",
  "referenceExternal": "Exemple",
  "note": "Exemple",
  "canCancel": false
}
```

<a id="api-078"></a>
### API-078 — GET `/products/`

Source : [features/products/api/products.api.ts](../src/features/products/api/products.api.ts) ligne 8, fonction `getProducts`. **BACKEND REQUIRED**.

- Permission / scope : products.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `ProductsData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; SKU unique par societe ; service sans stock ; archivage et FK fournisseur.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/products/hooks/useProducts.ts](../src/features/products/hooks/useProducts.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('products'), env.productsUseMock]` ; `[...key('product'), env.productsUseMock, id]` ; `[...key('product-metrics'), env.productsUseMock, id]` ; `[...key('product-history'), env.productsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "products": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "suppliers": []
}
```

<a id="api-079"></a>
### API-079 — GET `/products/{id}/`

Source : [features/products/api/products.api.ts](../src/features/products/api/products.api.ts) ligne 9, fonction `getProductById`. **BACKEND REQUIRED**.

- Permission / scope : products.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `ProductDetail`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; SKU unique par societe ; service sans stock ; archivage et FK fournisseur.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/products/hooks/useProducts.ts](../src/features/products/hooks/useProducts.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('products'), env.productsUseMock]` ; `[...key('product'), env.productsUseMock, id]` ; `[...key('product-metrics'), env.productsUseMock, id]` ; `[...key('product-history'), env.productsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "suppliers": [],
  "sales": [],
  "purchases": [],
  "warehouses": [],
  "documents": [],
  "onHand": null,
  "reserved": null,
  "available": null,
  "incoming": null,
  "stockValue": null,
  "stockHealth": "inactive",
  "id": 1,
  "supplierName": "Exemple",
  "averageCost": 0,
  "status": "active",
  "capabilities": {
    "canEdit": false,
    "canArchive": false
  },
  "name": "Exemple",
  "sku": "Exemple",
  "type": "product",
  "category": "Exemple",
  "supplierId": 1,
  "purchasePrice": 0,
  "sellingPrice": 0,
  "unit": "Exemple",
  "barcode": "Exemple",
  "minimumStock": 0,
  "maximumStock": 0,
  "description": "Exemple"
}
```

<a id="api-080"></a>
### API-080 — GET `/products/{id}/metrics/`

Source : [features/products/api/products.api.ts](../src/features/products/api/products.api.ts) ligne 10, fonction `getProductMetrics`. **BACKEND REQUIRED**.

- Permission / scope : products.view + analytics.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `ProductMetrics`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; SKU unique par societe ; service sans stock ; archivage et FK fournisseur.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/products/hooks/useProducts.ts](../src/features/products/hooks/useProducts.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('products'), env.productsUseMock]` ; `[...key('product'), env.productsUseMock, id]` ; `[...key('product-metrics'), env.productsUseMock, id]` ; `[...key('product-history'), env.productsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "revenue": 0,
  "unitsSold": 0,
  "marginAmount": 0,
  "averageCost": 0,
  "stockValue": null,
  "available": null
}
```

<a id="api-081"></a>
### API-081 — GET `/products/{id}/history/`

Source : [features/products/api/products.api.ts](../src/features/products/api/products.api.ts) ligne 11, fonction `getProductHistory`. **BACKEND REQUIRED**.

- Permission / scope : products.view + (inventory.view ou analytics.view) ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `ProductHistory`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; SKU unique par societe ; service sans stock ; archivage et FK fournisseur.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/products/hooks/useProducts.ts](../src/features/products/hooks/useProducts.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('products'), env.productsUseMock]` ; `[...key('product'), env.productsUseMock, id]` ; `[...key('product-metrics'), env.productsUseMock, id]` ; `[...key('product-history'), env.productsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "stock": [],
  "prices": [],
  "source": "Exemple"
}
```

<a id="api-082"></a>
### API-082 — GET `/ai/products/{id}/insight/`

Source : [features/products/api/products.api.ts](../src/features/products/api/products.api.ts) ligne 12, fonction `getProductAIInsight`. **BACKEND REQUIRED**.

- Permission / scope : products.view + ai.use ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `ProductInsight`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; SKU unique par societe ; service sans stock ; archivage et FK fournisseur.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/products/hooks/useProducts.ts](../src/features/products/hooks/useProducts.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('products'), env.productsUseMock]` ; `[...key('product'), env.productsUseMock, id]` ; `[...key('product-metrics'), env.productsUseMock, id]` ; `[...key('product-history'), env.productsUseMock, id]`.

Exemple de forme JSON attendue :

```json
{
  "facts": [],
  "analysis": "Exemple",
  "forecast": null,
  "recommendations": [],
  "source": "Exemple"
}
```

<a id="api-083"></a>
### API-083 — POST `/products/`

Source : [features/products/api/products.api.ts](../src/features/products/api/products.api.ts) ligne 14, fonction `createProduct`. **BACKEND REQUIRED**.

- Permission / scope : products.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `dto(v)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: ProductInput`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; SKU unique par societe ; service sans stock ; archivage et FK fournisseur.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/products/hooks/useProducts.ts](../src/features/products/hooks/useProducts.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('products'), env.productsUseMock]` ; `[...key('product'), env.productsUseMock, id]` ; `[...key('product-metrics'), env.productsUseMock, id]` ; `[...key('product-history'), env.productsUseMock, id]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.

<a id="api-084"></a>
### API-084 — PATCH `/products/{id}/`

Source : [features/products/api/products.api.ts](../src/features/products/api/products.api.ts) ligne 15, fonction `updateProduct`. **BACKEND REQUIRED**.

- Permission / scope : products.edit + canEdit/canArchive ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `'status' in v ? v : dto(v)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, v: ProductInput &#124; { status: 'archived' }`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; SKU unique par societe ; service sans stock ; archivage et FK fournisseur.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/products/hooks/useProducts.ts](../src/features/products/hooks/useProducts.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('products'), env.productsUseMock]` ; `[...key('product'), env.productsUseMock, id]` ; `[...key('product-metrics'), env.productsUseMock, id]` ; `[...key('product-history'), env.productsUseMock, id]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.

<a id="api-085"></a>
### API-085 — POST `/products/import/`

Source : [features/products/api/products.api.ts](../src/features/products/api/products.api.ts) ligne 16, fonction `importProducts`. **BACKEND REQUIRED**.

- Permission / scope : products.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `data`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `file: File`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; SKU unique par societe ; service sans stock ; archivage et FK fournisseur.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/products/hooks/useProducts.ts](../src/features/products/hooks/useProducts.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)` ; `invalidate(stockQueryNames)`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('products'), env.productsUseMock]` ; `[...key('product'), env.productsUseMock, id]` ; `[...key('product-metrics'), env.productsUseMock, id]` ; `[...key('product-history'), env.productsUseMock, id]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.

<a id="api-086"></a>
### API-086 — GET `/me/`

Source : [features/profile/api/profile.api.ts](../src/features/profile/api/profile.api.ts) ligne 6, fonction `getMe`. **BACKEND REQUIRED**.

- Permission / scope : utilisateur courant + capabilities ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, user: AuthUser, signal?: AbortSignal`.
- Success response : `UserProfile`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; identite courante ; mot de passe actuel ; challenge 2FA ; session possedee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/profile/hooks/useUserProfile.ts](../src/features/profile/hooks/useUserProfile.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('me'), env.profileUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "identity": {
    "firstName": "Exemple",
    "lastName": "Exemple",
    "displayName": "Exemple",
    "email": "example@example.test",
    "phone": "Exemple",
    "jobTitle": "Exemple"
  },
  "preferences": {
    "language": "Exemple",
    "timezone": "Exemple",
    "theme": "system",
    "dateFormat": "2026-09-27",
    "numberFormat": "Exemple",
    "notifications": {
      "email": false,
      "inApp": false,
      "approvals": false,
      "invoiceReminders": false,
      "stockAlerts": false,
      "aiAlerts": false
    }
  },
  "role": "Exemple",
  "department": "Exemple",
  "status": "Exemple",
  "avatarUrl": null,
  "twoFactorEnabled": false,
  "sessions": [],
  "activity": [],
  "passwordPolicy": {
    "minLength": null,
    "maxLength": null,
    "requireUppercase": false,
    "requireNumber": false,
    "summary": "Exemple"
  },
  "capabilities": {
    "canEditProfile": false,
    "canEditEmail": false,
    "canChangePassword": false,
    "canSetup2FA": false,
    "canDisable2FA": false
  },
  "options": {
    "languages": [],
    "timezones": [],
    "dateFormats": [],
    "numberFormats": []
  },
  "asOf": "2026-09-27"
}
```

<a id="api-087"></a>
### API-087 — PATCH `/me/`

Source : [features/profile/api/profile.api.ts](../src/features/profile/api/profile.api.ts) ligne 7, fonction `updateMe`. **BACKEND REQUIRED**.

- Permission / scope : utilisateur courant + capabilities ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `data`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, user: AuthUser, data: ProfileUpdate`.
- Success response : `UserProfile`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; identite courante ; mot de passe actuel ; challenge 2FA ; session possedee.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/profile/hooks/useUserProfile.ts](../src/features/profile/hooks/useUserProfile.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['me'])` ; `invalidate(['me'])` ; `invalidate(['me'])` ; `invalidate(['me'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('me'), env.profileUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "identity": {
    "firstName": "Exemple",
    "lastName": "Exemple",
    "displayName": "Exemple",
    "email": "example@example.test",
    "phone": "Exemple",
    "jobTitle": "Exemple"
  },
  "preferences": {
    "language": "Exemple",
    "timezone": "Exemple",
    "theme": "system",
    "dateFormat": "2026-09-27",
    "numberFormat": "Exemple",
    "notifications": {
      "email": false,
      "inApp": false,
      "approvals": false,
      "invoiceReminders": false,
      "stockAlerts": false,
      "aiAlerts": false
    }
  },
  "role": "Exemple",
  "department": "Exemple",
  "status": "Exemple",
  "avatarUrl": null,
  "twoFactorEnabled": false,
  "sessions": [],
  "activity": [],
  "passwordPolicy": {
    "minLength": null,
    "maxLength": null,
    "requireUppercase": false,
    "requireNumber": false,
    "summary": "Exemple"
  },
  "capabilities": {
    "canEditProfile": false,
    "canEditEmail": false,
    "canChangePassword": false,
    "canSetup2FA": false,
    "canDisable2FA": false
  },
  "options": {
    "languages": [],
    "timezones": [],
    "dateFormats": [],
    "numberFormats": []
  },
  "asOf": "2026-09-27"
}
```

<a id="api-088"></a>
### API-088 — POST `/me/password/`

Source : [features/profile/api/profile.api.ts](../src/features/profile/api/profile.api.ts) ligne 8, fonction `changePassword`. **BACKEND REQUIRED**.

- Permission / scope : utilisateur courant + capabilities ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ current_password: data.currentPassword, new_password: data.newPassword }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, user: AuthUser, data: PasswordInput`.
- Success response : `{ success: boolean; simulated: boolean; }`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; identite courante ; mot de passe actuel ; challenge 2FA ; session possedee.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/profile/hooks/useUserProfile.ts](../src/features/profile/hooks/useUserProfile.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['me'])` ; `invalidate(['me'])` ; `invalidate(['me'])` ; `invalidate(['me'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('me'), env.profileUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "success": false,
  "simulated": false
}
```

<a id="api-089"></a>
### API-089 — POST `/me/2fa/`

Source : [features/profile/api/profile.api.ts](../src/features/profile/api/profile.api.ts) ligne 9, fonction `setup2FA`. **BACKEND REQUIRED**.

- Permission / scope : utilisateur courant + capabilities ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `data.action === 'verify' ? { action: data.action, setup_id: data.setupId, code: data.code } : { action: data.action }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, user: AuthUser, data: TwoFactorInput`.
- Success response : `TwoFactorResult`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; identite courante ; mot de passe actuel ; challenge 2FA ; session possedee.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/profile/hooks/useUserProfile.ts](../src/features/profile/hooks/useUserProfile.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['me'])` ; `invalidate(['me'])` ; `invalidate(['me'])` ; `invalidate(['me'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('me'), env.profileUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "status": "setup",
  "setupId": "example-id",
  "qrImage": null,
  "secret": null,
  "codeLength": null,
  "instruction": "Exemple",
  "simulated": false
}
```

<a id="api-090"></a>
### API-090 — DELETE `/me/sessions/{sessionId}/`

Source : [features/profile/api/profile.api.ts](../src/features/profile/api/profile.api.ts) ligne 10, fonction `deleteSession`. **BACKEND REQUIRED**.

- Permission / scope : utilisateur courant + capabilities ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, user: AuthUser, sessionId: string`.
- Success response : `void`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; identite courante ; mot de passe actuel ; challenge 2FA ; session possedee.
- HTTP possibles : 204 (ou 200 si body attendu), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/profile/hooks/useUserProfile.ts](../src/features/profile/hooks/useUserProfile.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['me'])` ; `invalidate(['me'])` ; `invalidate(['me'])` ; `invalidate(['me'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('me'), env.profileUseMock]`.

Pas de JSON garanti : retour void/any. Le consommateur ne demande pas de body.

<a id="api-091"></a>
### API-091 — GET `/purchase-orders/`

Source : [features/purchases/api/purchases.api.ts](../src/features/purchases/api/purchases.api.ts) ligne 13, fonction `getPurchaseOrders`. **BACKEND REQUIRED**.

- Permission / scope : purchases.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `PurchaseOrdersData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat, reception <= reliquat, depot de la societe, facturation <= autorise.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/purchases/hooks/usePurchaseOrders.ts](../src/features/purchases/hooks/usePurchaseOrders.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('purchase-orders'), env.purchasesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "orders": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "currentBuyer": "Exemple",
  "suppliers": [],
  "canExport": false
}
```

<a id="api-092"></a>
### API-092 — GET `/purchase-orders/{id}/`

Source : [features/purchases/api/purchases.api.ts](../src/features/purchases/api/purchases.api.ts) ligne 17, fonction `getPurchaseOrderById`. **BACKEND REQUIRED**.

- Permission / scope : purchases.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `PurchaseOrderDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat, reception <= reliquat, depot de la societe, facturation <= autorise.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/purchases/hooks/usePurchaseOrderDetail.ts](../src/features/purchases/hooks/usePurchaseOrderDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('purchase-order-detail'), env.purchasesUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "invoices": [],
  "payments": [],
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "total": 0,
  "status": "sent",
  "receiptStatus": "not_received",
  "billingStatus": "not_billed",
  "receipts": [],
  "invoiceIds": [],
  "billedAmount": 0,
  "paidAmount": 1,
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canSend": false,
    "canConfirm": false,
    "canReceive": false,
    "canBill": false
  },
  "supplierId": 1,
  "date": "2026-09-27",
  "expectedDate": "2026-09-27",
  "buyer": "Exemple",
  "warehouse": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-093"></a>
### API-093 — POST `/purchase-orders/`

Source : [features/purchases/api/purchases.api.ts](../src/features/purchases/api/purchases.api.ts) ligne 21, fonction `createPurchaseOrder`. **BACKEND REQUIRED**.

- Permission / scope : purchases.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `inputDTO(input)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, input: PurchaseInput`.
- Success response : `PurchaseOrderDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat, reception <= reliquat, depot de la societe, facturation <= autorise.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/purchases/hooks/usePurchaseOrders.ts](../src/features/purchases/hooks/usePurchaseOrders.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('purchase-orders'), env.purchasesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "invoices": [],
  "payments": [],
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "total": 0,
  "status": "sent",
  "receiptStatus": "not_received",
  "billingStatus": "not_billed",
  "receipts": [],
  "invoiceIds": [],
  "billedAmount": 0,
  "paidAmount": 1,
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canSend": false,
    "canConfirm": false,
    "canReceive": false,
    "canBill": false
  },
  "supplierId": 1,
  "date": "2026-09-27",
  "expectedDate": "2026-09-27",
  "buyer": "Exemple",
  "warehouse": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-094"></a>
### API-094 — PATCH `/purchase-orders/{id}/`

Source : [features/purchases/api/purchases.api.ts](../src/features/purchases/api/purchases.api.ts) ligne 25, fonction `updatePurchaseOrder`. **BACKEND REQUIRED**.

- Permission / scope : purchases.edit + canEdit ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `inputDTO(input)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, input: PurchaseInput`.
- Success response : `PurchaseOrderDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat, reception <= reliquat, depot de la societe, facturation <= autorise.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/purchases/hooks/usePurchaseOrderDetail.ts](../src/features/purchases/hooks/usePurchaseOrderDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('purchase-order-detail'), env.purchasesUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "invoices": [],
  "payments": [],
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "total": 0,
  "status": "sent",
  "receiptStatus": "not_received",
  "billingStatus": "not_billed",
  "receipts": [],
  "invoiceIds": [],
  "billedAmount": 0,
  "paidAmount": 1,
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canSend": false,
    "canConfirm": false,
    "canReceive": false,
    "canBill": false
  },
  "supplierId": 1,
  "date": "2026-09-27",
  "expectedDate": "2026-09-27",
  "buyer": "Exemple",
  "warehouse": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-095"></a>
### API-095 — POST `/purchase-orders/{id}/send/`

Source : [features/purchases/api/purchases.api.ts](../src/features/purchases/api/purchases.api.ts) ligne 29, fonction `sendPurchaseOrder`. **BACKEND REQUIRED**.

- Permission / scope : purchases.edit + canSend ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `PurchaseOrderDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat, reception <= reliquat, depot de la societe, facturation <= autorise.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/purchases/hooks/usePurchaseOrderDetail.ts](../src/features/purchases/hooks/usePurchaseOrderDetail.ts), [features/purchases/hooks/usePurchaseOrders.ts](../src/features/purchases/hooks/usePurchaseOrders.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('purchase-order-detail'), env.purchasesUseMock, numeric]` ; `[...key('purchase-orders'), env.purchasesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "invoices": [],
  "payments": [],
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "total": 0,
  "status": "sent",
  "receiptStatus": "not_received",
  "billingStatus": "not_billed",
  "receipts": [],
  "invoiceIds": [],
  "billedAmount": 0,
  "paidAmount": 1,
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canSend": false,
    "canConfirm": false,
    "canReceive": false,
    "canBill": false
  },
  "supplierId": 1,
  "date": "2026-09-27",
  "expectedDate": "2026-09-27",
  "buyer": "Exemple",
  "warehouse": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-096"></a>
### API-096 — POST `/purchase-orders/{id}/confirm/`

Source : [features/purchases/api/purchases.api.ts](../src/features/purchases/api/purchases.api.ts) ligne 33, fonction `confirmPurchaseOrder`. **BACKEND REQUIRED**.

- Permission / scope : purchases.confirm + canConfirm ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `PurchaseOrderDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat, reception <= reliquat, depot de la societe, facturation <= autorise.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/purchases/hooks/usePurchaseOrderDetail.ts](../src/features/purchases/hooks/usePurchaseOrderDetail.ts), [features/purchases/hooks/usePurchaseOrders.ts](../src/features/purchases/hooks/usePurchaseOrders.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('purchase-order-detail'), env.purchasesUseMock, numeric]` ; `[...key('purchase-orders'), env.purchasesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "invoices": [],
  "payments": [],
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "total": 0,
  "status": "sent",
  "receiptStatus": "not_received",
  "billingStatus": "not_billed",
  "receipts": [],
  "invoiceIds": [],
  "billedAmount": 0,
  "paidAmount": 1,
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canSend": false,
    "canConfirm": false,
    "canReceive": false,
    "canBill": false
  },
  "supplierId": 1,
  "date": "2026-09-27",
  "expectedDate": "2026-09-27",
  "buyer": "Exemple",
  "warehouse": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-097"></a>
### API-097 — POST `/purchase-orders/{id}/receive/`

Source : [features/purchases/api/purchases.api.ts](../src/features/purchases/api/purchases.api.ts) ligne 37, fonction `receivePurchaseOrder`. **BACKEND REQUIRED**.

- Permission / scope : receipts.create + canReceive ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ date: input.date, warehouse: input.warehouse, lines: input.lines.map((l) => ({ line_id: l.lineId, quantity: l.quantity })) }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, input: ReceiptInput`.
- Success response : `PurchaseOrderDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat, reception <= reliquat, depot de la societe, facturation <= autorise.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/purchases/hooks/usePurchaseOrderDetail.ts](../src/features/purchases/hooks/usePurchaseOrderDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('purchase-order-detail'), env.purchasesUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "invoices": [],
  "payments": [],
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "total": 0,
  "status": "sent",
  "receiptStatus": "not_received",
  "billingStatus": "not_billed",
  "receipts": [],
  "invoiceIds": [],
  "billedAmount": 0,
  "paidAmount": 1,
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canSend": false,
    "canConfirm": false,
    "canReceive": false,
    "canBill": false
  },
  "supplierId": 1,
  "date": "2026-09-27",
  "expectedDate": "2026-09-27",
  "buyer": "Exemple",
  "warehouse": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-098"></a>
### API-098 — POST `/purchase-orders/{id}/bill/`

Source : [features/purchases/api/purchases.api.ts](../src/features/purchases/api/purchases.api.ts) ligne 42, fonction `createSupplierInvoiceFromPurchase`. **BACKEND REQUIRED**.

- Permission / scope : supplier_invoices.create + canBill ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `SupplierInvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat, reception <= reliquat, depot de la societe, facturation <= autorise.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/purchases/hooks/usePurchaseOrderDetail.ts](../src/features/purchases/hooks/usePurchaseOrderDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('purchase-order-detail'), env.purchasesUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "buyer": "Exemple",
  "orderId": null,
  "orderReference": null,
  "receipts": [],
  "total": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "payments": [],
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canPay": false
  },
  "supplierId": 1,
  "supplierReference": "Exemple",
  "invoiceDate": "2026-09-27",
  "dueDate": "2026-09-27",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-099"></a>
### API-099 — GET `/quotes/`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 40, fonction `getQuotes`. **BACKEND REQUIRED**.

- Permission / scope : quotes.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params, signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, params: QuotesParams = {}, signal?: AbortSignal`.
- Success response : `QuotesResponse`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/quotes/hooks/useQuotes.ts](../src/features/quotes/hooks/useQuotes.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['quotes', userId, companyId, env.quotesUseMock]` ; `['quotes', userId, companyId, env.quotesUseMock]` ; `['quote-editor', userId, companyId, env.quotesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "results": [],
  "permissions": [],
  "current_salesperson": "Exemple",
  "as_of": "Exemple"
}
```

<a id="api-100"></a>
### API-100 — GET `/quotes/{url.search}`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 52, fonction `getQuotes`. **BACKEND REQUIRED**.

- Permission / scope : quotes.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, params: QuotesParams = {}, signal?: AbortSignal`.
- Success response : `QuotesResponse`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/quotes/hooks/useQuotes.ts](../src/features/quotes/hooks/useQuotes.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['quotes', userId, companyId, env.quotesUseMock]` ; `['quotes', userId, companyId, env.quotesUseMock]` ; `['quote-editor', userId, companyId, env.quotesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "results": [],
  "permissions": [],
  "current_salesperson": "Exemple",
  "as_of": "Exemple"
}
```

<a id="api-101"></a>
### API-101 — POST `/quotes/{id}/send/`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 60, fonction `sendQuote`. **BACKEND REQUIRED**.

- Permission / scope : quotes.send ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `QuoteDTO`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/quotes/hooks/useQuoteEditor.ts](../src/features/quotes/hooks/useQuoteEditor.ts), [features/quotes/hooks/useQuotes.ts](../src/features/quotes/hooks/useQuotes.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey })` ; `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey })` ; `client.invalidateQueries({ queryKey: ['quote-editor', userId, companyId, env.quotesUseMock] })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `listKey` ; `[...prefix, numericId ?? 'new']` ; `listKey` ; `listKey` ; `['quotes', userId, companyId, env.quotesUseMock]` ; `['quotes', userId, companyId, env.quotesUseMock]` ; `['quote-editor', userId, companyId, env.quotesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "customer_id": 1,
  "customer_name": "Exemple",
  "customer_email": "example@example.test",
  "salesperson": "Exemple",
  "created_at": "Exemple",
  "expires_at": "Exemple",
  "total_amount": "Exemple",
  "status": "rejected"
}
```

<a id="api-102"></a>
### API-102 — POST `/quotes/{id}/duplicate/`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 65, fonction `duplicateQuote`. **BACKEND REQUIRED**.

- Permission / scope : quotes.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `QuoteDTO`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/quotes/hooks/useQuoteEditor.ts](../src/features/quotes/hooks/useQuoteEditor.ts), [features/quotes/hooks/useQuotes.ts](../src/features/quotes/hooks/useQuotes.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey })` ; `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey })` ; `client.invalidateQueries({ queryKey: ['quote-editor', userId, companyId, env.quotesUseMock] })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `listKey` ; `[...prefix, numericId ?? 'new']` ; `listKey` ; `listKey` ; `['quotes', userId, companyId, env.quotesUseMock]` ; `['quotes', userId, companyId, env.quotesUseMock]` ; `['quote-editor', userId, companyId, env.quotesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "customer_id": 1,
  "customer_name": "Exemple",
  "customer_email": "example@example.test",
  "salesperson": "Exemple",
  "created_at": "Exemple",
  "expires_at": "Exemple",
  "total_amount": "Exemple",
  "status": "rejected"
}
```

<a id="api-103"></a>
### API-103 — GET `/quotes/{id}/`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 107, fonction `getQuoteById`. **BACKEND REQUIRED**.

- Permission / scope : quotes.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `QuoteDetailDTO`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
{
  "issue_date": "2026-09-27",
  "billing_address": "Exemple",
  "currency": "MAD",
  "payment_terms": "Exemple",
  "customer_reference": "Exemple",
  "subject": "Exemple",
  "delivery_terms": "Exemple",
  "commercial_terms": "Exemple",
  "internal_notes": "Exemple",
  "customer_notes": "Exemple",
  "lines": [],
  "permissions": [],
  "activities": [],
  "as_of": "Exemple",
  "id": 1,
  "reference": "Exemple",
  "customer_id": 1,
  "customer_name": "Exemple",
  "customer_email": "example@example.test",
  "salesperson": "Exemple",
  "created_at": "Exemple",
  "expires_at": "Exemple",
  "total_amount": "Exemple",
  "status": "rejected"
}
```

<a id="api-104"></a>
### API-104 — POST `/quotes/`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 121, fonction `createQuote`. **BACKEND REQUIRED**.

- Permission / scope : quotes.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `inputToDTO(input)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, input: QuoteInput`.
- Success response : `QuoteDetailDTO`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/quotes/hooks/useQuoteEditor.ts](../src/features/quotes/hooks/useQuoteEditor.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey })` ; `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey: listKey })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `listKey` ; `[...prefix, numericId ?? 'new']` ; `listKey` ; `listKey`.

Exemple de forme JSON attendue :

```json
{
  "issue_date": "2026-09-27",
  "billing_address": "Exemple",
  "currency": "MAD",
  "payment_terms": "Exemple",
  "customer_reference": "Exemple",
  "subject": "Exemple",
  "delivery_terms": "Exemple",
  "commercial_terms": "Exemple",
  "internal_notes": "Exemple",
  "customer_notes": "Exemple",
  "lines": [],
  "permissions": [],
  "activities": [],
  "as_of": "Exemple",
  "id": 1,
  "reference": "Exemple",
  "customer_id": 1,
  "customer_name": "Exemple",
  "customer_email": "example@example.test",
  "salesperson": "Exemple",
  "created_at": "Exemple",
  "expires_at": "Exemple",
  "total_amount": "Exemple",
  "status": "rejected"
}
```

<a id="api-105"></a>
### API-105 — PATCH `/quotes/{id}/`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 126, fonction `updateQuote`. **BACKEND REQUIRED**.

- Permission / scope : quotes.edit ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `inputToDTO(input)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, input: QuoteInput`.
- Success response : `QuoteDetailDTO`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/quotes/hooks/useQuoteEditor.ts](../src/features/quotes/hooks/useQuoteEditor.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey })` ; `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey: listKey })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `listKey` ; `[...prefix, numericId ?? 'new']` ; `listKey` ; `listKey`.

Exemple de forme JSON attendue :

```json
{
  "issue_date": "2026-09-27",
  "billing_address": "Exemple",
  "currency": "MAD",
  "payment_terms": "Exemple",
  "customer_reference": "Exemple",
  "subject": "Exemple",
  "delivery_terms": "Exemple",
  "commercial_terms": "Exemple",
  "internal_notes": "Exemple",
  "customer_notes": "Exemple",
  "lines": [],
  "permissions": [],
  "activities": [],
  "as_of": "Exemple",
  "id": 1,
  "reference": "Exemple",
  "customer_id": 1,
  "customer_name": "Exemple",
  "customer_email": "example@example.test",
  "salesperson": "Exemple",
  "created_at": "Exemple",
  "expires_at": "Exemple",
  "total_amount": "Exemple",
  "status": "rejected"
}
```

<a id="api-106"></a>
### API-106 — POST `/quotes/{id}/accept/`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 132, fonction `acceptQuote`. **BACKEND REQUIRED**.

- Permission / scope : quotes.accept + canAccept ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number`.
- Success response : `QuoteDetailDTO`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/quotes/hooks/useQuoteEditor.ts](../src/features/quotes/hooks/useQuoteEditor.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey })` ; `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey: listKey })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `listKey` ; `[...prefix, numericId ?? 'new']` ; `listKey` ; `listKey`.

Exemple de forme JSON attendue :

```json
{
  "issue_date": "2026-09-27",
  "billing_address": "Exemple",
  "currency": "MAD",
  "payment_terms": "Exemple",
  "customer_reference": "Exemple",
  "subject": "Exemple",
  "delivery_terms": "Exemple",
  "commercial_terms": "Exemple",
  "internal_notes": "Exemple",
  "customer_notes": "Exemple",
  "lines": [],
  "permissions": [],
  "activities": [],
  "as_of": "Exemple",
  "id": 1,
  "reference": "Exemple",
  "customer_id": 1,
  "customer_name": "Exemple",
  "customer_email": "example@example.test",
  "salesperson": "Exemple",
  "created_at": "Exemple",
  "expires_at": "Exemple",
  "total_amount": "Exemple",
  "status": "rejected"
}
```

<a id="api-107"></a>
### API-107 — POST `/quotes/{id}/convert/`

Source : [features/quotes/api/quotes.api.ts](../src/features/quotes/api/quotes.api.ts) ligne 137, fonction `convertQuote`. **BACKEND REQUIRED**.

- Permission / scope : quotes.convert + conversionTargets ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ target }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number, target: QuoteConversionTarget`.
- Success response : `QuoteConversion`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; etat editable, dates coherentes, lignes/remises/taxes, conversion non dupliquee.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/quotes/hooks/useQuoteEditor.ts](../src/features/quotes/hooks/useQuoteEditor.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey })` ; `client.invalidateQueries({ queryKey: listKey })` ; `client.invalidateQueries({ queryKey: listKey })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...prefix, numericId ?? 'new']` ; `listKey` ; `[...prefix, numericId ?? 'new']` ; `listKey` ; `listKey`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "target": "invoice"
}
```

<a id="api-108"></a>
### API-108 — GET `/reports/catalog/`

Source : [features/reports/api/reports.api.ts](../src/features/reports/api/reports.api.ts) ligne 8, fonction `getReportsCatalog`. **BACKEND REQUIRED**.

- Permission / scope : reports.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `ReportsCatalog`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; type/format permis ; filtres scoped ; snapshot de periode et droits source.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/reports/hooks/useReports.ts](../src/features/reports/hooks/useReports.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('reports'), env.reportsUseMock]` ; `[...key('reports-recent'), env.reportsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "reports": [],
  "permissions": [],
  "asOf": "2026-09-27"
}
```

<a id="api-109"></a>
### API-109 — GET `/reports/recent/`

Source : [features/reports/api/reports.api.ts](../src/features/reports/api/reports.api.ts) ligne 9, fonction `getRecentReports`. **BACKEND REQUIRED**.

- Permission / scope : reports.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `GeneratedReport[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; type/format permis ; filtres scoped ; snapshot de periode et droits source.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/reports/hooks/useReports.ts](../src/features/reports/hooks/useReports.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('reports'), env.reportsUseMock]` ; `[...key('reports-recent'), env.reportsUseMock]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-110"></a>
### API-110 — POST `/reports/generate/`

Source : [features/reports/api/reports.api.ts](../src/features/reports/api/reports.api.ts) ligne 10, fonction `generateReport`. **BACKEND REQUIRED**.

- Permission / scope : reports.generate ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ report_id: v.reportId, date_from: v.dateFrom, date_to: v.dateTo, filter: v.filter, format: v.format }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: ReportInput`.
- Success response : `GeneratedReport`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; type/format permis ; filtres scoped ; snapshot de periode et droits source.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/reports/hooks/useReports.ts](../src/features/reports/hooks/useReports.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['reports', 'reports-recent'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('reports'), env.reportsUseMock]` ; `[...key('reports-recent'), env.reportsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "id": "example-id",
  "reportId": "example-id",
  "name": "Exemple",
  "createdAt": "2026-09-27T10:00:00Z",
  "generatedBy": "Exemple",
  "format": "csv",
  "status": "ready",
  "filename": "Exemple",
  "downloadUrl": null,
  "dateFrom": "2026-09-27",
  "dateTo": "2026-09-27"
}
```

<a id="api-111"></a>
### API-111 — GET `/reports/{type}/`

Source : [features/reports/api/reports.api.ts](../src/features/reports/api/reports.api.ts) ligne 12, fonction `getReport`. **BACKEND REQUIRED**.

- Permission / scope : reports.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: analyticsParams(params), signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, type: ReportType, params: ReportParams, signal?: AbortSignal`.
- Success response : `AnalyticsReport`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; type/format permis ; filtres scoped ; snapshot de periode et droits source.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/reports/hooks/useReportAnalytics.ts](../src/features/reports/hooks/useReportAnalytics.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('report-analytics'), env.reportsUseMock, type, params]`.

Exemple de forme JSON attendue :

```json
{
  "type": "sales",
  "title": "Exemple",
  "permissions": [],
  "asOf": "2026-09-27",
  "period": {
    "dateFrom": "2026-09-27",
    "dateTo": "2026-09-27",
    "partner": "Exemple",
    "owner": "Exemple",
    "category": "Exemple",
    "warehouse": "Exemple"
  },
  "previousPeriod": {
    "dateFrom": "2026-09-27",
    "dateTo": "2026-09-27"
  },
  "snapshot": false,
  "amountLabel": "Exemple",
  "quantityLabel": "Exemple",
  "rows": [],
  "kpis": [],
  "charts": [],
  "filters": [],
  "formats": [],
  "source": "Exemple"
}
```

<a id="api-112"></a>
### API-112 — POST `/reports/{type}/ai-analysis/`

Source : [features/reports/api/reports.api.ts](../src/features/reports/api/reports.api.ts) ligne 13, fonction `generateReportAIAnalysis`. **BACKEND REQUIRED**.

- Permission / scope : reports.view + ai.use ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `analyticsParams(params)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, type: ReportType, params: ReportParams`.
- Success response : `ReportAnalysis`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; type/format permis ; filtres scoped ; snapshot de periode et droits source.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/reports/hooks/useReportAnalytics.ts](../src/features/reports/hooks/useReportAnalytics.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('report-analytics'), env.reportsUseMock, type, params]`.

Exemple de forme JSON attendue :

```json
{
  "executiveSummary": "Exemple",
  "trends": [],
  "anomalies": [],
  "risks": [],
  "opportunities": [],
  "recommendations": [],
  "period": {
    "dateFrom": "2026-09-27",
    "dateTo": "2026-09-27"
  },
  "confidence": null,
  "generatedAt": "2026-09-27T10:00:00Z",
  "sources": [],
  "source": "Exemple"
}
```

<a id="api-113"></a>
### API-113 — GET `/reports/{type}/export/`

Source : [features/reports/api/reports.api.ts](../src/features/reports/api/reports.api.ts) ligne 16, fonction `exportReport`. **BACKEND REQUIRED**.

- Permission / scope : reports.export ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: { ...analyticsParams(params), format }, responseType: 'blob' }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, type: ReportType, params: ReportParams, format: 'csv' &#124; 'pdf' &#124; 'xlsx'`.
- Success response : `{ rows?: (string &#124; number)[][]; blob?: Blob; filename: string; }`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; type/format permis ; filtres scoped ; snapshot de periode et droits source.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/reports/hooks/useReportAnalytics.ts](../src/features/reports/hooks/useReportAnalytics.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('report-analytics'), env.reportsUseMock, type, params]`.

Reponse wire : fichier binaire (responseType blob). Le wrapper TS ajoute le filename localement, ce n’est pas une enveloppe JSON serveur.

<a id="api-114"></a>
### API-114 — GET `/sales-orders/`

Source : [features/sales/api/sales.api.ts](../src/features/sales/api/sales.api.ts) ligne 17, fonction `getSalesOrders`. **BACKEND REQUIRED**.

- Permission / scope : sales.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `SalesOrdersData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; commande confirmable, quantite livrable et montant facturable restant, reservation.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/sales/hooks/useSalesOrders.ts](../src/features/sales/hooks/useSalesOrders.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['sales-orders', userId, companyId, env.salesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "orders": [],
  "permissions": [],
  "asOf": "2026-09-27"
}
```

<a id="api-115"></a>
### API-115 — GET `/sales-orders/{id}/`

Source : [features/sales/api/sales.api.ts](../src/features/sales/api/sales.api.ts) ligne 26, fonction `getSalesOrderById`. **BACKEND REQUIRED**.

- Permission / scope : sales.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `SalesOrderDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; commande confirmable, quantite livrable et montant facturable restant, reservation.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/sales/hooks/useSalesOrderDetail.ts](../src/features/sales/hooks/useSalesOrderDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `key` ; `[name, userId, companyId]` ; `key` ; `listKey`.

Exemple de forme JSON attendue :

```json
{
  "confirmedAt": null,
  "quoteId": null,
  "quoteReference": null,
  "customerReference": "Exemple",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "customer": {
    "reference": "Exemple",
    "contactName": "Exemple",
    "phone": "Exemple",
    "email": "example@example.test",
    "billingAddress": "Exemple",
    "deliveryAddress": "Exemple"
  },
  "lines": [],
  "totals": {
    "gross": 0,
    "discount": 1,
    "net": 0,
    "tax": 0,
    "total": 0
  },
  "deliveryStatus": "none",
  "invoiceStatus": "none",
  "paymentStatus": "paid",
  "deliveries": [],
  "invoices": [],
  "payments": [],
  "activities": [],
  "documents": [],
  "permissions": [],
  "capabilities": {
    "canConfirm": false,
    "canCancel": false,
    "canDeliver": false,
    "canInvoice": false,
    "invoiceableAmount": 0
  },
  "warehouses": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "customerId": 1,
  "customerName": "Exemple",
  "salesperson": "Exemple",
  "createdAt": "2026-09-27T10:00:00Z",
  "totalAmount": 0,
  "orderStatus": "processing"
}
```

<a id="api-116"></a>
### API-116 — POST `/sales-orders/{id}/confirm/`

Source : [features/sales/api/sales.api.ts](../src/features/sales/api/sales.api.ts) ligne 31, fonction `confirmSalesOrder`. **BACKEND REQUIRED**.

- Permission / scope : sales.edit + canConfirm ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `SalesOrderDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; commande confirmable, quantite livrable et montant facturable restant, reservation.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/sales/hooks/useSalesOrderDetail.ts](../src/features/sales/hooks/useSalesOrderDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [name, userId, companyId] })` ; `client.invalidateQueries({ queryKey: key })` ; `client.invalidateQueries({ queryKey: listKey })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `key` ; `[name, userId, companyId]` ; `key` ; `listKey`.

Exemple de forme JSON attendue :

```json
{
  "confirmedAt": null,
  "quoteId": null,
  "quoteReference": null,
  "customerReference": "Exemple",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "customer": {
    "reference": "Exemple",
    "contactName": "Exemple",
    "phone": "Exemple",
    "email": "example@example.test",
    "billingAddress": "Exemple",
    "deliveryAddress": "Exemple"
  },
  "lines": [],
  "totals": {
    "gross": 0,
    "discount": 1,
    "net": 0,
    "tax": 0,
    "total": 0
  },
  "deliveryStatus": "none",
  "invoiceStatus": "none",
  "paymentStatus": "paid",
  "deliveries": [],
  "invoices": [],
  "payments": [],
  "activities": [],
  "documents": [],
  "permissions": [],
  "capabilities": {
    "canConfirm": false,
    "canCancel": false,
    "canDeliver": false,
    "canInvoice": false,
    "invoiceableAmount": 0
  },
  "warehouses": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "customerId": 1,
  "customerName": "Exemple",
  "salesperson": "Exemple",
  "createdAt": "2026-09-27T10:00:00Z",
  "totalAmount": 0,
  "orderStatus": "processing"
}
```

<a id="api-117"></a>
### API-117 — POST `/sales-orders/{id}/delivery/`

Source : [features/sales/api/sales.api.ts](../src/features/sales/api/sales.api.ts) ligne 37, fonction `createSalesOrderDelivery`. **BACKEND REQUIRED**.

- Permission / scope : delivery.create + canDeliver ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ warehouse: input.warehouse, lines: input.lines.map((line) => ({ line_id: line.lineId, quantity: line.quantity })), }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number, input: SalesDeliveryInput`.
- Success response : `{ order: SalesOrderDetail; reference: string; }`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; commande confirmable, quantite livrable et montant facturable restant, reservation.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/sales/hooks/useSalesOrderDetail.ts](../src/features/sales/hooks/useSalesOrderDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [name, userId, companyId] })` ; `client.invalidateQueries({ queryKey: key })` ; `client.invalidateQueries({ queryKey: listKey })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `key` ; `[name, userId, companyId]` ; `key` ; `listKey`.

Exemple de forme JSON attendue :

```json
{
  "order": {
    "confirmedAt": null,
    "quoteId": null,
    "quoteReference": null,
    "customerReference": "Exemple",
    "currency": "MAD",
    "paymentTerms": "Exemple",
    "customer": {
      "reference": "Exemple",
      "contactName": "Exemple",
      "phone": "Exemple",
      "email": "example@example.test",
      "billingAddress": "Exemple",
      "deliveryAddress": "Exemple"
    },
    "lines": [],
    "totals": {
      "gross": 0,
      "discount": 1,
      "net": 0,
      "tax": 0,
      "total": 0
    },
    "deliveryStatus": "none",
    "invoiceStatus": "none",
    "paymentStatus": "paid",
    "deliveries": [],
    "invoices": [],
    "payments": [],
    "activities": [],
    "documents": [],
    "permissions": [],
    "capabilities": {
      "canConfirm": false,
      "canCancel": false,
      "canDeliver": false,
      "canInvoice": false,
      "invoiceableAmount": 0
    },
    "warehouses": [],
    "asOf": "2026-09-27",
    "id": 1,
    "reference": "Exemple",
    "customerId": 1,
    "customerName": "Exemple",
    "salesperson": "Exemple",
    "createdAt": "2026-09-27T10:00:00Z",
    "totalAmount": 0,
    "orderStatus": "processing"
  },
  "reference": "Exemple"
}
```

<a id="api-118"></a>
### API-118 — POST `/sales-orders/{id}/invoice/`

Source : [features/sales/api/sales.api.ts](../src/features/sales/api/sales.api.ts) ligne 44, fonction `createSalesOrderInvoice`. **BACKEND REQUIRED**.

- Permission / scope : invoices.create + canInvoice ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `input`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `id: number, input: SalesInvoiceInput`.
- Success response : `{ order: SalesOrderDetail; reference: string; }`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; commande confirmable, quantite livrable et montant facturable restant, reservation.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/sales/hooks/useSalesOrderDetail.ts](../src/features/sales/hooks/useSalesOrderDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [name, userId, companyId] })` ; `client.invalidateQueries({ queryKey: key })` ; `client.invalidateQueries({ queryKey: listKey })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `key` ; `[name, userId, companyId]` ; `key` ; `listKey`.

Exemple de forme JSON attendue :

```json
{
  "order": {
    "confirmedAt": null,
    "quoteId": null,
    "quoteReference": null,
    "customerReference": "Exemple",
    "currency": "MAD",
    "paymentTerms": "Exemple",
    "customer": {
      "reference": "Exemple",
      "contactName": "Exemple",
      "phone": "Exemple",
      "email": "example@example.test",
      "billingAddress": "Exemple",
      "deliveryAddress": "Exemple"
    },
    "lines": [],
    "totals": {
      "gross": 0,
      "discount": 1,
      "net": 0,
      "tax": 0,
      "total": 0
    },
    "deliveryStatus": "none",
    "invoiceStatus": "none",
    "paymentStatus": "paid",
    "deliveries": [],
    "invoices": [],
    "payments": [],
    "activities": [],
    "documents": [],
    "permissions": [],
    "capabilities": {
      "canConfirm": false,
      "canCancel": false,
      "canDeliver": false,
      "canInvoice": false,
      "invoiceableAmount": 0
    },
    "warehouses": [],
    "asOf": "2026-09-27",
    "id": 1,
    "reference": "Exemple",
    "customerId": 1,
    "customerName": "Exemple",
    "salesperson": "Exemple",
    "createdAt": "2026-09-27T10:00:00Z",
    "totalAmount": 0,
    "orderStatus": "processing"
  },
  "reference": "Exemple"
}
```

<a id="api-119"></a>
### API-119 — GET `/settings/`

Source : [features/settings/api/settings.api.ts](../src/features/settings/api/settings.api.ts) ligne 6, fonction `getSettings`. **BACKEND REQUIRED**.

- Permission / scope : settings.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, company: Company &#124; null, signal?: AbortSignal`.
- Success response : `SettingsData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; section connue, version, champs verrouilles, options autorisees.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/settings/hooks/useCompanySettings.ts](../src/features/settings/hooks/useCompanySettings.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('company-settings'), env.settingsUseMock]` ; `[...key('ai-status'), env.settingsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "values": {
    "general": {
      "language": "Exemple",
      "timezone": "Exemple",
      "dateFormat": "2026-09-27",
      "currency": "MAD",
      "numberFormat": "Exemple"
    },
    "company": {
      "companyName": "Exemple",
      "legalName": "Exemple",
      "taxId": "example-id",
      "email": "example@example.test",
      "phone": "Exemple",
      "address": "Exemple",
      "city": "Exemple",
      "country": "Exemple",
      "logoUrl": null
    },
    "branches": {
      "activeBranches": [],
      "defaultBranch": "Exemple"
    },
    "finance": {
      "currency": "MAD",
      "fiscalYearStart": "Exemple",
      "defaultAccount": "Exemple",
      "paymentTerms": "Exemple",
      "rounding": "Exemple"
    },
    "taxes": {
      "activeTaxes": [],
      "vatRate": 0,
      "inclusive": false,
      "rounding": "Exemple"
    },
    "invoices": {
      "prefix": "Exemple",
      "numbering": "Exemple",
      "paymentTerms": "Exemple",
      "defaultDueDays": 0,
      "notes": "Exemple",
      "sendEmail": false
    },
    "sales": {
      "quotePrefix": "Exemple",
      "orderPrefix": "Exemple",
      "quoteValidityDays": 1,
      "reserveStock": false,
      "requireApproval": false
    },
    "purchasing": {
      "prefix": "Exemple",
      "approvalThreshold": 0,
      "defaultWarehouse": "Exemple",
      "defaultTax": "Exemple"
    },
    "inventory": {
      "allowNegative": false,
      "valuationMethod": "Exemple",
      "minimumStock": 0,
      "unit": "Exemple",
      "alerts": false
    },
    "documents": {
      "allowedFormats": [],
      "maxSizeMB": 1,
      "autoIndex": false,
      "retentionDays": 0,
      "ragEnabled": false
    },
    "users": {
      "allowInvitations": false,
      "defaultRole": "Exemple",
      "sessionTimeoutMinutes": 0,
      "passwordPolicySummary": "Exemple"
    },
    "notifications": {
      "email": false,
      "inApp": false,
      "stockAlerts": false,
      "invoiceOverdue": false,
      "approvals": false,
      "aiAlerts": false
    },
    "security": {
      "require2FA": false,
      "sessionMinutes": 0,
      "passwordPolicy": "Exemple",
      "sensitiveApproval": false,
      "auditRetentionDays": 0
    },
    "ai": {
      "allowAnalysis": false,
      "allowDocumentRag": false,
      "allowForecasting": false,
      "allowRecommendations": false,
      "requireSensitiveApproval": false
    },
    "integrations": {
      "items": []
    }
  },
  "policies": {},
  "permissions": [],
  "asOf": "2026-09-27",
  "options": {
    "languages": [],
    "timezones": [],
    "dateFormats": [],
    "currencies": [],
    "numberFormats": [],
    "rounding": [],
    "valuationMethods": [],
    "units": [],
    "accounts": [],
    "warehouses": [],
    "taxes": [],
    "roles": [],
    "passwordPolicies": []
  },
  "version": 1
}
```

<a id="api-120"></a>
### API-120 — PATCH `/settings/{input.section}/`

Source : [features/settings/api/settings.api.ts](../src/features/settings/api/settings.api.ts) ligne 7, fonction `updateSettingsSection`. **BACKEND REQUIRED**.

- Permission / scope : settings.manage + policy.canManage + lockedFields ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ values: input.values, version }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, company: Company &#124; null, input: SettingsPayload, version: number`.
- Success response : `SettingsData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; section connue, version, champs verrouilles, options autorisees.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/settings/hooks/useCompanySettings.ts](../src/features/settings/hooks/useCompanySettings.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['company-settings', 'ai-status', 'documents', 'document', 'ai-conversations', 'forecast', 'ai-opportunities'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('company-settings'), env.settingsUseMock]` ; `[...key('ai-status'), env.settingsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "values": {
    "general": {
      "language": "Exemple",
      "timezone": "Exemple",
      "dateFormat": "2026-09-27",
      "currency": "MAD",
      "numberFormat": "Exemple"
    },
    "company": {
      "companyName": "Exemple",
      "legalName": "Exemple",
      "taxId": "example-id",
      "email": "example@example.test",
      "phone": "Exemple",
      "address": "Exemple",
      "city": "Exemple",
      "country": "Exemple",
      "logoUrl": null
    },
    "branches": {
      "activeBranches": [],
      "defaultBranch": "Exemple"
    },
    "finance": {
      "currency": "MAD",
      "fiscalYearStart": "Exemple",
      "defaultAccount": "Exemple",
      "paymentTerms": "Exemple",
      "rounding": "Exemple"
    },
    "taxes": {
      "activeTaxes": [],
      "vatRate": 0,
      "inclusive": false,
      "rounding": "Exemple"
    },
    "invoices": {
      "prefix": "Exemple",
      "numbering": "Exemple",
      "paymentTerms": "Exemple",
      "defaultDueDays": 0,
      "notes": "Exemple",
      "sendEmail": false
    },
    "sales": {
      "quotePrefix": "Exemple",
      "orderPrefix": "Exemple",
      "quoteValidityDays": 1,
      "reserveStock": false,
      "requireApproval": false
    },
    "purchasing": {
      "prefix": "Exemple",
      "approvalThreshold": 0,
      "defaultWarehouse": "Exemple",
      "defaultTax": "Exemple"
    },
    "inventory": {
      "allowNegative": false,
      "valuationMethod": "Exemple",
      "minimumStock": 0,
      "unit": "Exemple",
      "alerts": false
    },
    "documents": {
      "allowedFormats": [],
      "maxSizeMB": 1,
      "autoIndex": false,
      "retentionDays": 0,
      "ragEnabled": false
    },
    "users": {
      "allowInvitations": false,
      "defaultRole": "Exemple",
      "sessionTimeoutMinutes": 0,
      "passwordPolicySummary": "Exemple"
    },
    "notifications": {
      "email": false,
      "inApp": false,
      "stockAlerts": false,
      "invoiceOverdue": false,
      "approvals": false,
      "aiAlerts": false
    },
    "security": {
      "require2FA": false,
      "sessionMinutes": 0,
      "passwordPolicy": "Exemple",
      "sensitiveApproval": false,
      "auditRetentionDays": 0
    },
    "ai": {
      "allowAnalysis": false,
      "allowDocumentRag": false,
      "allowForecasting": false,
      "allowRecommendations": false,
      "requireSensitiveApproval": false
    },
    "integrations": {
      "items": []
    }
  },
  "policies": {},
  "permissions": [],
  "asOf": "2026-09-27",
  "options": {
    "languages": [],
    "timezones": [],
    "dateFormats": [],
    "currencies": [],
    "numberFormats": [],
    "rounding": [],
    "valuationMethods": [],
    "units": [],
    "accounts": [],
    "warehouses": [],
    "taxes": [],
    "roles": [],
    "passwordPolicies": []
  },
  "version": 1
}
```

<a id="api-121"></a>
### API-121 — GET `/ai/status/`

Source : [features/settings/api/settings.api.ts](../src/features/settings/api/settings.api.ts) ligne 8, fonction `getAIStatus`. **BACKEND REQUIRED**.

- Permission / scope : settings.view + policy ai ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, company: Company &#124; null, signal?: AbortSignal`.
- Success response : `AIStatus`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; section connue, version, champs verrouilles, options autorisees.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/settings/hooks/useCompanySettings.ts](../src/features/settings/hooks/useCompanySettings.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('company-settings'), env.settingsUseMock]` ; `[...key('ai-status'), env.settingsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "status": "disabled",
  "provider": null,
  "model": null,
  "ragEnabled": false,
  "embeddingsAvailable": false,
  "checkedAt": "2026-09-27T10:00:00Z",
  "simulated": false,
  "detail": "Exemple"
}
```

<a id="api-122"></a>
### API-122 — POST `/integrations/{id}/test/`

Source : [features/settings/api/settings.api.ts](../src/features/settings/api/settings.api.ts) ligne 9, fonction `testIntegration`. **BACKEND REQUIRED**.

- Permission / scope : settings.manage + canTest ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{}`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, company: Company &#124; null, id: string`.
- Success response : `IntegrationTestResult`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; section connue, version, champs verrouilles, options autorisees.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/settings/hooks/useCompanySettings.ts](../src/features/settings/hooks/useCompanySettings.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(['company-settings', 'ai-status', 'documents', 'document', 'ai-conversations', 'forecast', 'ai-opportunities'])`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('company-settings'), env.settingsUseMock]` ; `[...key('ai-status'), env.settingsUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "status": "success",
  "message": "Exemple",
  "checkedAt": "2026-09-27T10:00:00Z",
  "simulated": false
}
```

<a id="api-123"></a>
### API-123 — GET `/supplier-invoices/`

Source : [features/supplier-invoices/api/supplierInvoices.api.ts](../src/features/supplier-invoices/api/supplierInvoices.api.ts) ligne 13, fonction `getSupplierInvoices`. **BACKEND REQUIRED**.

- Permission / scope : supplier_invoices.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `SupplierInvoicesData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow, rapprochement commande/reception/facture, paiement <= solde.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/supplier-invoices/hooks/useSupplierInvoices.ts](../src/features/supplier-invoices/hooks/useSupplierInvoices.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-invoices'), env.supplierInvoicesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "invoices": [],
  "permissions": [],
  "asOf": "2026-09-27",
  "suppliers": [],
  "canExport": false
}
```

<a id="api-124"></a>
### API-124 — GET `/supplier-invoices/{id}/`

Source : [features/supplier-invoices/api/supplierInvoices.api.ts](../src/features/supplier-invoices/api/supplierInvoices.api.ts) ligne 17, fonction `getSupplierInvoiceById`. **BACKEND REQUIRED**.

- Permission / scope : supplier_invoices.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `SupplierInvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow, rapprochement commande/reception/facture, paiement <= solde.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/supplier-invoices/hooks/useSupplierInvoiceDetail.ts](../src/features/supplier-invoices/hooks/useSupplierInvoiceDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-invoice-detail'), env.supplierInvoicesUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "buyer": "Exemple",
  "orderId": null,
  "orderReference": null,
  "receipts": [],
  "total": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "payments": [],
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canPay": false
  },
  "supplierId": 1,
  "supplierReference": "Exemple",
  "invoiceDate": "2026-09-27",
  "dueDate": "2026-09-27",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-125"></a>
### API-125 — GET `/supplier-invoices/aging/`

Source : [features/supplier-invoices/api/supplierInvoices.api.ts](../src/features/supplier-invoices/api/supplierInvoices.api.ts) ligne 21, fonction `getSupplierInvoiceAging`. **BACKEND REQUIRED**.

- Permission / scope : supplier_invoices.view + finance.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `PayableBucket[]`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow, rapprochement commande/reception/facture, paiement <= solde.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-126"></a>
### API-126 — POST `/supplier-invoices/`

Source : [features/supplier-invoices/api/supplierInvoices.api.ts](../src/features/supplier-invoices/api/supplierInvoices.api.ts) ligne 25, fonction `createSupplierInvoice`. **BACKEND REQUIRED**.

- Permission / scope : supplier_invoices.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `inputDTO(input)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, input: SupplierInvoiceInput`.
- Success response : `SupplierInvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow, rapprochement commande/reception/facture, paiement <= solde.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/supplier-invoices/hooks/useSupplierInvoices.ts](../src/features/supplier-invoices/hooks/useSupplierInvoices.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-invoices'), env.supplierInvoicesUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "buyer": "Exemple",
  "orderId": null,
  "orderReference": null,
  "receipts": [],
  "total": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "payments": [],
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canPay": false
  },
  "supplierId": 1,
  "supplierReference": "Exemple",
  "invoiceDate": "2026-09-27",
  "dueDate": "2026-09-27",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-127"></a>
### API-127 — PATCH `/supplier-invoices/{id}/`

Source : [features/supplier-invoices/api/supplierInvoices.api.ts](../src/features/supplier-invoices/api/supplierInvoices.api.ts) ligne 29, fonction `updateSupplierInvoice`. **BACKEND REQUIRED**.

- Permission / scope : supplier_invoices.edit + canEdit ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `inputDTO(input)`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, input: SupplierInvoiceInput`.
- Success response : `SupplierInvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow, rapprochement commande/reception/facture, paiement <= solde.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/supplier-invoices/hooks/useSupplierInvoiceDetail.ts](../src/features/supplier-invoices/hooks/useSupplierInvoiceDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-invoice-detail'), env.supplierInvoicesUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "buyer": "Exemple",
  "orderId": null,
  "orderReference": null,
  "receipts": [],
  "total": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "payments": [],
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canPay": false
  },
  "supplierId": 1,
  "supplierReference": "Exemple",
  "invoiceDate": "2026-09-27",
  "dueDate": "2026-09-27",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-128"></a>
### API-128 — POST `/supplier-invoices/{id}/post/`

Source : [features/supplier-invoices/api/supplierInvoices.api.ts](../src/features/supplier-invoices/api/supplierInvoices.api.ts) ligne 33, fonction `postSupplierInvoice`. **BACKEND REQUIRED**.

- Permission / scope : supplier_invoices.edit + canPost ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `SupplierInvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow, rapprochement commande/reception/facture, paiement <= solde.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/supplier-invoices/hooks/useSupplierInvoiceDetail.ts](../src/features/supplier-invoices/hooks/useSupplierInvoiceDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-invoice-detail'), env.supplierInvoicesUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "buyer": "Exemple",
  "orderId": null,
  "orderReference": null,
  "receipts": [],
  "total": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "payments": [],
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canPay": false
  },
  "supplierId": 1,
  "supplierReference": "Exemple",
  "invoiceDate": "2026-09-27",
  "dueDate": "2026-09-27",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-129"></a>
### API-129 — POST `/supplier-invoices/{id}/payment/`

Source : [features/supplier-invoices/api/supplierInvoices.api.ts](../src/features/supplier-invoices/api/supplierInvoices.api.ts) ligne 39, fonction `recordSupplierInvoicePayment`. **BACKEND REQUIRED**.

- Permission / scope : payments.create + canPay ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ date: input.date, amount: input.amount, method: input.method, reference: input.referenceExternal, note: input.note }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, input: PaymentInput`.
- Success response : `SupplierInvoiceDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; workflow, rapprochement commande/reception/facture, paiement <= solde.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/supplier-invoices/hooks/useSupplierInvoiceDetail.ts](../src/features/supplier-invoices/hooks/useSupplierInvoiceDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune dans un hook consommateur direct ; voir dispatcher/parcours et registre feature.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-invoice-detail'), env.supplierInvoicesUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "id": 1,
  "reference": "Exemple",
  "supplierName": "Exemple",
  "buyer": "Exemple",
  "orderId": null,
  "orderReference": null,
  "receipts": [],
  "total": 0,
  "paidAmount": 1,
  "workflowStatus": "draft",
  "paymentStatus": "paid",
  "payments": [],
  "documents": [],
  "activities": [],
  "capabilities": {
    "canEdit": false,
    "canPost": false,
    "canPay": false
  },
  "supplierId": 1,
  "supplierReference": "Exemple",
  "invoiceDate": "2026-09-27",
  "dueDate": "2026-09-27",
  "currency": "MAD",
  "paymentTerms": "Exemple",
  "notes": "Exemple",
  "lines": []
}
```

<a id="api-130"></a>
### API-130 — GET `/suppliers/{id}/`

Source : [features/suppliers/api/suppliers.api.ts](../src/features/suppliers/api/suppliers.api.ts) ligne 12, fonction `getSupplierById`. **BACKEND REQUIRED**.

- Permission / scope : suppliers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `SupplierDetail`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/statut ; agreger uniquement achats/dettes autorises.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/suppliers/hooks/useSupplierDetail.ts](../src/features/suppliers/hooks/useSupplierDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-detail'), env.suppliersUseMock, numeric]` ; `[...key('supplier-metrics'), env.suppliersUseMock, numeric]` ; `[...key('supplier-price-history'), env.suppliersUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "orders": [],
  "invoices": [],
  "payments": [],
  "documents": [],
  "contracts": [],
  "activities": [],
  "id": 1,
  "reference": "Exemple",
  "name": "Exemple",
  "contact": "Exemple",
  "email": "example@example.test",
  "phone": "Exemple",
  "category": "Exemple",
  "country": "Exemple",
  "city": "Exemple",
  "buyer": "Exemple",
  "purchaseVolume": 0,
  "outstandingBalance": 0,
  "averageLeadTimeDays": null,
  "score": null,
  "scoreSource": "Exemple",
  "risk": "high",
  "status": "active",
  "createdAt": "2026-09-27T10:00:00Z",
  "lastPurchaseAt": null,
  "strategic": false,
  "capabilities": {
    "canEdit": false,
    "canArchive": false
  }
}
```

<a id="api-131"></a>
### API-131 — GET `/suppliers/{id}/metrics/`

Source : [features/suppliers/api/suppliers.api.ts](../src/features/suppliers/api/suppliers.api.ts) ligne 16, fonction `getSupplierMetrics`. **BACKEND REQUIRED**.

- Permission / scope : suppliers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `SupplierMetrics`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/statut ; agreger uniquement achats/dettes autorises.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/suppliers/hooks/useSupplierDetail.ts](../src/features/suppliers/hooks/useSupplierDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-detail'), env.suppliersUseMock, numeric]` ; `[...key('supplier-metrics'), env.suppliersUseMock, numeric]` ; `[...key('supplier-price-history'), env.suppliersUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "purchaseVolume": 0,
  "outstandingBalance": 0,
  "averageLeadTimeDays": null,
  "onTimeDelivery": null,
  "priceChange": null,
  "score": null
}
```

<a id="api-132"></a>
### API-132 — GET `/suppliers/{id}/price-history/`

Source : [features/suppliers/api/suppliers.api.ts](../src/features/suppliers/api/suppliers.api.ts) ligne 20, fonction `getSupplierPriceHistory`. **BACKEND REQUIRED**.

- Permission / scope : suppliers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `SupplierPriceHistory`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/statut ; agreger uniquement achats/dettes autorises.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/suppliers/hooks/useSupplierDetail.ts](../src/features/suppliers/hooks/useSupplierDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-detail'), env.suppliersUseMock, numeric]` ; `[...key('supplier-metrics'), env.suppliersUseMock, numeric]` ; `[...key('supplier-price-history'), env.suppliersUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "product": "Exemple",
  "points": [],
  "source": "Exemple"
}
```

<a id="api-133"></a>
### API-133 — GET `/ai/suppliers/{id}/insight/`

Source : [features/suppliers/api/suppliers.api.ts](../src/features/suppliers/api/suppliers.api.ts) ligne 24, fonction `getSupplierAIInsight`. **BACKEND REQUIRED**.

- Permission / scope : suppliers.view + ai.use ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number`.
- Success response : `PurchasingInsight`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/statut ; agreger uniquement achats/dettes autorises.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/suppliers/hooks/useSupplierDetail.ts](../src/features/suppliers/hooks/useSupplierDetail.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-detail'), env.suppliersUseMock, numeric]` ; `[...key('supplier-metrics'), env.suppliersUseMock, numeric]` ; `[...key('supplier-price-history'), env.suppliersUseMock, numeric]`.

Exemple de forme JSON attendue :

```json
{
  "facts": [],
  "analysis": "Exemple",
  "risk": "Exemple",
  "recommendations": [],
  "source": "Exemple"
}
```

<a id="api-134"></a>
### API-134 — GET `/suppliers/`

Source : [features/suppliers/api/suppliers.api.ts](../src/features/suppliers/api/suppliers.api.ts) ligne 29, fonction `getSuppliers`. **BACKEND REQUIRED**.

- Permission / scope : suppliers.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ params: { ...filters, page_size: pageSize }, signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, query: SupplierQuery, signal?: AbortSignal`.
- Success response : `SuppliersData`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/statut ; agreger uniquement achats/dettes autorises.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/suppliers/hooks/useSuppliers.ts](../src/features/suppliers/hooks/useSuppliers.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['suppliers', userId, companyId, env.suppliersUseMock, filters]` ; `[key, userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "suppliers": [],
  "count": 1,
  "totalCount": 1,
  "summary": {
    "active": 0,
    "purchaseVolume": 0,
    "outstandingBalance": 0,
    "averageLeadTimeDays": null,
    "atRisk": 0
  },
  "permissions": [],
  "asOf": "2026-09-27",
  "currentBuyer": "Exemple",
  "facets": {
    "categories": [],
    "countries": [],
    "buyers": []
  }
}
```

<a id="api-135"></a>
### API-135 — POST `/suppliers/`

Source : [features/suppliers/api/suppliers.api.ts](../src/features/suppliers/api/suppliers.api.ts) ligne 34, fonction `createSupplier`. **BACKEND REQUIRED**.

- Permission / scope : suppliers.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `input`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, input: SupplierInput`.
- Success response : `Supplier`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/statut ; agreger uniquement achats/dettes autorises.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/suppliers/hooks/useSuppliers.ts](../src/features/suppliers/hooks/useSuppliers.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [key, userId, companyId] })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `['suppliers', userId, companyId, env.suppliersUseMock, filters]` ; `[key, userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "name": "Exemple",
  "contact": "Exemple",
  "email": "example@example.test",
  "phone": "Exemple",
  "category": "Exemple",
  "country": "Exemple",
  "city": "Exemple",
  "buyer": "Exemple",
  "purchaseVolume": 0,
  "outstandingBalance": 0,
  "averageLeadTimeDays": null,
  "score": null,
  "scoreSource": "Exemple",
  "risk": "high",
  "status": "active",
  "createdAt": "2026-09-27T10:00:00Z",
  "lastPurchaseAt": null,
  "strategic": false,
  "capabilities": {
    "canEdit": false,
    "canArchive": false
  }
}
```

<a id="api-136"></a>
### API-136 — PATCH `/suppliers/{id}/`

Source : [features/suppliers/api/suppliers.api.ts](../src/features/suppliers/api/suppliers.api.ts) ligne 39, fonction `updateSupplier`. **BACKEND REQUIRED**.

- Permission / scope : suppliers.edit + capability ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `input`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, input: SupplierInput &#124; { status: 'archived' }`.
- Success response : `Supplier`. Type du transport explicite.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; unicite/statut ; agreger uniquement achats/dettes autorises.
- HTTP possibles : 200 avec DTO (onboarding accepte 204), 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/suppliers/hooks/useSupplierDetail.ts](../src/features/suppliers/hooks/useSupplierDetail.ts), [features/suppliers/hooks/useSuppliers.ts](../src/features/suppliers/hooks/useSuppliers.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `client.invalidateQueries({ queryKey: [key, userId, companyId] })`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('supplier-detail'), env.suppliersUseMock, numeric]` ; `[...key('supplier-metrics'), env.suppliersUseMock, numeric]` ; `[...key('supplier-price-history'), env.suppliersUseMock, numeric]` ; `['suppliers', userId, companyId, env.suppliersUseMock, filters]` ; `[key, userId, companyId]`.

Exemple de forme JSON attendue :

```json
{
  "id": 1,
  "reference": "Exemple",
  "name": "Exemple",
  "contact": "Exemple",
  "email": "example@example.test",
  "phone": "Exemple",
  "category": "Exemple",
  "country": "Exemple",
  "city": "Exemple",
  "buyer": "Exemple",
  "purchaseVolume": 0,
  "outstandingBalance": 0,
  "averageLeadTimeDays": null,
  "score": null,
  "scoreSource": "Exemple",
  "risk": "high",
  "status": "active",
  "createdAt": "2026-09-27T10:00:00Z",
  "lastPurchaseAt": null,
  "strategic": false,
  "capabilities": {
    "canEdit": false,
    "canArchive": false
  }
}
```

<a id="api-137"></a>
### API-137 — GET `/warehouses/`

Source : [features/warehouses/api/warehouses.api.ts](../src/features/warehouses/api/warehouses.api.ts) ligne 11, fonction `getWarehouses`. **BACKEND REQUIRED**.

- Permission / scope : warehouses.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `WarehousesData`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; depot actif ; capacite/unite ; valorisation autorisee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/warehouses/hooks/useWarehouses.ts](../src/features/warehouses/hooks/useWarehouses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('warehouses'), env.warehousesUseMock]` ; `[...key('warehouse'), env.warehousesUseMock, id]` ; `[...key('warehouse-inventory'), env.warehousesUseMock, id]` ; `[...key('warehouse-movements'), env.warehousesUseMock, id]` ; `[...key('warehouse-valuation'), env.warehousesUseMock, id]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "warehouses": [],
  "permissions": [],
  "asOf": "2026-09-27"
}
```

<a id="api-138"></a>
### API-138 — GET `/warehouses/summary/`

Source : [features/warehouses/api/warehouses.api.ts](../src/features/warehouses/api/warehouses.api.ts) ligne 12, fonction `getWarehousesSummary`. **BACKEND REQUIRED**.

- Permission / scope : warehouses.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, signal?: AbortSignal`.
- Success response : `WarehouseSummary[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; depot actif ; capacite/unite ; valorisation autorisee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : aucun fichier externe ; verifier aliases/dispatcher dans notes de transport.
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : pas de cle dans un hook consommateur direct.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-139"></a>
### API-139 — GET `/warehouses/{id}/`

Source : [features/warehouses/api/warehouses.api.ts](../src/features/warehouses/api/warehouses.api.ts) ligne 13, fonction `getWarehouseById`. **BACKEND REQUIRED**.

- Permission / scope : warehouses.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `WarehouseDetail`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; depot actif ; capacite/unite ; valorisation autorisee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/warehouses/hooks/useWarehouses.ts](../src/features/warehouses/hooks/useWarehouses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('warehouses'), env.warehousesUseMock]` ; `[...key('warehouse'), env.warehousesUseMock, id]` ; `[...key('warehouse-inventory'), env.warehousesUseMock, id]` ; `[...key('warehouse-movements'), env.warehousesUseMock, id]` ; `[...key('warehouse-valuation'), env.warehousesUseMock, id]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "permissions": [],
  "asOf": "2026-09-27",
  "stockValue": 0,
  "products": 0,
  "lowStock": 0,
  "outOfStock": 0,
  "usedCapacity": 0,
  "capacityPercent": null,
  "incomingTransfers": 0,
  "id": 1,
  "reference": "Exemple",
  "status": "active",
  "capacityUnit": "Exemple",
  "name": "Exemple",
  "city": "Exemple",
  "country": "Exemple",
  "manager": "Exemple",
  "capacity": 0
}
```

<a id="api-140"></a>
### API-140 — GET `/warehouses/{id}/inventory/`

Source : [features/warehouses/api/warehouses.api.ts](../src/features/warehouses/api/warehouses.api.ts) ligne 14, fonction `getWarehouseInventory`. **BACKEND REQUIRED**.

- Permission / scope : warehouses.view + inventory.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `InventoryRow[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; depot actif ; capacite/unite ; valorisation autorisee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/warehouses/hooks/useWarehouses.ts](../src/features/warehouses/hooks/useWarehouses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('warehouses'), env.warehousesUseMock]` ; `[...key('warehouse'), env.warehousesUseMock, id]` ; `[...key('warehouse-inventory'), env.warehousesUseMock, id]` ; `[...key('warehouse-movements'), env.warehousesUseMock, id]` ; `[...key('warehouse-valuation'), env.warehousesUseMock, id]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-141"></a>
### API-141 — GET `/warehouses/{id}/movements/`

Source : [features/warehouses/api/warehouses.api.ts](../src/features/warehouses/api/warehouses.api.ts) ligne 15, fonction `getWarehouseMovements`. **BACKEND REQUIRED**.

- Permission / scope : warehouses.view + inventory.view + inventory.movements.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `StockMovement[]`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; depot actif ; capacite/unite ; valorisation autorisee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/warehouses/hooks/useWarehouses.ts](../src/features/warehouses/hooks/useWarehouses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('warehouses'), env.warehousesUseMock]` ; `[...key('warehouse'), env.warehousesUseMock, id]` ; `[...key('warehouse-inventory'), env.warehousesUseMock, id]` ; `[...key('warehouse-movements'), env.warehousesUseMock, id]` ; `[...key('warehouse-valuation'), env.warehousesUseMock, id]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
[]
```

<a id="api-142"></a>
### API-142 — GET `/warehouses/{id}/valuation/`

Source : [features/warehouses/api/warehouses.api.ts](../src/features/warehouses/api/warehouses.api.ts) ligne 16, fonction `getWarehouseValuation`. **BACKEND REQUIRED**.

- Permission / scope : warehouses.view + inventory.view ; societe active, module et droits objet.
- Query parameters et options Axios : `{ signal }`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `aucun body`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, id: number, signal?: AbortSignal`.
- Success response : `WarehouseValuation`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; depot actif ; capacite/unite ; valorisation autorisee.
- HTTP possibles : 200, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/warehouses/hooks/useWarehouses.ts](../src/features/warehouses/hooks/useWarehouses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : aucune mutation par cette lecture.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('warehouses'), env.warehousesUseMock]` ; `[...key('warehouse'), env.warehousesUseMock, id]` ; `[...key('warehouse-inventory'), env.warehousesUseMock, id]` ; `[...key('warehouse-movements'), env.warehousesUseMock, id]` ; `[...key('warehouse-valuation'), env.warehousesUseMock, id]` ; `[...key('transfers'), env.inventoryUseMock]`.

Exemple de forme JSON attendue :

```json
{
  "byProduct": [],
  "history": [],
  "source": "Exemple"
}
```

<a id="api-143"></a>
### API-143 — POST `/warehouses/`

Source : [features/warehouses/api/warehouses.api.ts](../src/features/warehouses/api/warehouses.api.ts) ligne 17, fonction `createWarehouse`. **BACKEND REQUIRED**.

- Permission / scope : warehouses.create ; societe active, module et droits objet.
- Query parameters et options Axios : `{}`. Seul params devient la query string ; signal, responseType et callbacks restent locaux.
- Request body : `{ name: v.name, city: v.city, country: v.country, manager: v.manager, capacity: v.capacity, capacity_unit: 'unités' }`. Helpers DTO reproduits apres les fiches.
- Parametres TS de la fonction : `scope: string, v: WarehouseInput`.
- Success response : `any`. Type de retour fonction ; Axios souvent accepte sans validation runtime.
- Validation errors : 400, schema body/Input du dictionnaire ; champs requis, IDs, enums, bornes, dates et FK de meme societe. Lecture : filtres et ID invalides.
- Business errors : 409 pour conflit/version/transition ; depot actif ; capacite/unite ; valorisation autorisee.
- HTTP possibles : 201 avec DTO, 400, 401/403, 404, 409 si conflit, 429, 500/503. 202 seulement apres adaptation async.
- Frontend consumers : [features/warehouses/hooks/useWarehouses.ts](../src/features/warehouses/hooks/useWarehouses.ts).
- TanStack Query invalidations du fichier de hooks (ensemble, voir mutations associees) : `invalidate(stockQueryNames)`.
- Query keys du fichier de hooks consommateur (inclut requetes voisines) : `[...key('warehouses'), env.warehousesUseMock]` ; `[...key('warehouse'), env.warehousesUseMock, id]` ; `[...key('warehouse-inventory'), env.warehousesUseMock, id]` ; `[...key('warehouse-movements'), env.warehousesUseMock, id]` ; `[...key('warehouse-valuation'), env.warehousesUseMock, id]` ; `[...key('transfers'), env.inventoryUseMock]`.

Pas de JSON garanti : retour void/any. **GAP** : typer et valider le transport avant integration.


## Helpers de transport et schemas locaux

Conversions existantes ; ne pas supposer une convention globale.

### src/features/admin/api/admin.api.ts

```ts
const userDTO = (v: UserInput) => ({ name: v.name, email: v.email, department: v.department, ...(v.roleId !== undefined ? { role_id: v.roleId } : {}), ...(v.status ? { status: v.status } : {}) })
```

### src/features/ai-control-center/api/aiControlCenter.api.ts

```ts
export const AI_CONTROL_CENTER_ENDPOINT = '/ai/control-center/'
```

### src/features/auth/api/auth.api.ts

```ts
const loginResponseSchema = z.object({
  user: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    email: z.string().email(),
    role: z.string(),
    permissions: z.array(z.string()).optional(),
  }),
  company: z
    .object({
      id: z.number().int().positive(),
      name: z.string(),
      onboarding_completed: z.boolean(),
      enabled_modules: z.array(z.string()).optional(),
    })
    .nullable(),
})
```

### src/features/customers/api/customers.api.ts

```ts
export const CUSTOMERS_ENDPOINT = '/customers/'
```

### src/features/dashboard/api/dashboard.api.ts

```ts
export const DASHBOARD_ENDPOINT = '/dashboard/summary/'
```

### src/features/inventory/api/inventory.api.ts

```ts
export interface InventoryHealth { categories: { name: string; value: number }[]; warehouses: { name: string; value: number }[] }

const transferDTO = (v: TransferInput) => ({ source_id: v.sourceId, destination_id: v.destinationId, date: v.date, reference_external: v.referenceExternal, notes: v.notes, lines: v.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })) })
```

### src/features/invoices/api/invoices.api.ts

```ts
export const INVOICES_ENDPOINT = '/invoices/'

function fromAPI(invoice: InvoiceDetail): InvoiceDetail { return { ...invoice, capabilities: { ...capabilities, ...invoice.capabilities } } }

function inputDTO(input: InvoiceInput) {
  return { customer_id: input.customerId, billing_address: input.billingAddress, invoice_date: input.invoiceDate, due_date: input.dueDate, salesperson: input.salesperson, currency: input.currency, payment_terms: input.paymentTerms, customer_reference: input.customerReference, notes: input.notes,
    lines: input.lines.map((line) => ({ product_id: line.productId, product_name: line.productName, description: line.description, quantity: line.quantity, unit_price: line.unitPrice, discount_rate: line.discountRate, tax_rate: line.taxRate })) }
}

export const postInvoice = (scope: string, id: number) => mutateInvoice(scope, id, 'post')

export const sendInvoice = (scope: string, id: number) => mutateInvoice(scope, id, 'send')

export const recordInvoicePayment = (scope: string, id: number, input: InvoicePaymentInput) => mutateInvoice(scope, id, 'payment', input)

export const remindInvoice = (scope: string, id: number) => mutateInvoice(scope, id, 'remind')
```

### src/features/onboarding/api/onboarding.api.ts

```ts
export function toOnboardingPayload(data: OnboardingData) {
  return {
    company: {
      name: data.company.name,
      legal_name: data.company.legalName,
      logo: data.company.logo || null,
      tax_id: data.company.taxId,
      email: data.company.email,
      phone: data.company.phone,
      website: data.company.website,
      address: data.company.address,
      city: data.company.city,
      postal_code: data.company.postalCode,
      country: data.company.country,
      currency: data.finance.currency,
    },
    business: {
      industry: data.business.industry,
      business_type: data.business.businessType,
      main_activity: data.business.mainActivity,
      size: data.business.size,
      employee_count: data.business.employeeCount ?? null,
      description: data.business.description,
    },
    finance: {
      currency: data.finance.currency,
      tax_system: data.finance.taxSystem,
      vat_rate: data.finance.vatRate,
      fiscal_year_start: data.finance.fiscalYearStart,
      fiscal_year_end: data.finance.fiscalYearEnd,
      payment_terms: data.finance.paymentTerms,
    },
    inventory: data.inventory.enabled
      ? {
          enabled: true,
          warehouse_name: data.inventory.warehouseName,
          warehouse_code: data.inventory.warehouseCode,
          warehouse_address: data.inventory.warehouseAddress,
          multi_warehouse: data.inventory.multiWarehouse,
          valuation_method: data.inventory.valuationMethod,
          low_stock_alerts: data.inventory.lowStockAlerts,
          default_unit: data.inventory.defaultUnit,
        }
      : { enabled: false },
    invoicing: {
      invoice_prefix: data.invoicing.invoicePrefix,
      invoice_start: data.invoicing.invoiceStart,
      quote_prefix: data.invoicing.quotePrefix,
      quote_start: data.invoicing.quoteStart,
      purchase_order_prefix: data.invoicing.purchaseOrderPrefix,
      payment_terms: data.invoicing.paymentTerms,
      footer: data.invoicing.footer,
      language: data.invoicing.language,
      show_vat: data.invoicing.showVat,
    },
    modules: data.inventory.enabled
      ? data.modules
      : data.modules.filter((id) => id !== 'inventory' && id !== 'warehouses'),
  }
}
```

### src/features/payments/api/payments.api.ts

```ts
export const PAYMENTS_ENDPOINT = '/payments/'

function params(query: PaymentQuery) { const { pageSize, dateFrom, dateTo, minAmount, maxAmount, partnerType, partnerId, ...rest } = query; return { ...rest, page_size: pageSize, date_from: dateFrom, date_to: dateTo, min_amount: minAmount, max_amount: maxAmount, partner_type: partnerType, partner_id: partnerId } }
```

### src/features/products/api/products.api.ts

```ts
const dto = (v: ProductInput) => ({ name: v.name, sku: v.sku, type: v.type, category: v.category, supplier_id: v.supplierId, purchase_price: v.purchasePrice, selling_price: v.sellingPrice, unit: v.unit, barcode: v.barcode, minimum_stock: v.minimumStock, maximum_stock: v.maximumStock, description: v.description })
```

### src/features/purchases/api/purchases.api.ts

```ts
export const PURCHASE_ORDERS_ENDPOINT = '/purchase-orders/'

const inputDTO = (v: PurchaseInput) => ({ supplier_id: v.supplierId, date: v.date, expected_date: v.expectedDate, buyer: v.buyer, warehouse: v.warehouse, notes: v.notes, lines: v.lines.map((l) => ({ id: l.id, product_name: l.productName, description: l.description, quantity: l.quantity, unit_price: l.unitPrice, discount_rate: l.discountRate, tax_rate: l.taxRate })) })
```

### src/features/quotes/api/quotes.api.ts

```ts
export const QUOTES_ENDPOINT = '/quotes/'

export interface QuotesParams {
  search?: string
  status?: QuoteStatus
  customer?: number
  salesperson?: string
  created_after?: string
  created_before?: string
  page?: number
  page_size?: number
}

interface QuoteDTO {
  id: number; reference: string; customer_id: number; customer_name: string; customer_email: string
  salesperson: string; created_at: string; expires_at: string; total_amount: number | string; status: QuoteStatus
}

interface QuotesResponse {
  results: QuoteDTO[]
  next?: string | null
  permissions: QuotePermission[]
  current_salesperson: string
  as_of: string
  products?: QuoteProduct[]
}

function fromDTO(quote: QuoteDTO): Quote {
  return {
    id: quote.id, reference: quote.reference, customerId: quote.customer_id,
    customerName: quote.customer_name, customerEmail: quote.customer_email, salesperson: quote.salesperson,
    createdAt: quote.created_at.slice(0, 10), expiresAt: quote.expires_at.slice(0, 10),
    totalAmount: Number(quote.total_amount), status: quote.status,
  }
}

interface QuoteDetailDTO extends QuoteDTO {
  issue_date: string; billing_address: string; currency: 'MAD'; payment_terms: string
  customer_reference: string; subject: string; delivery_terms: string; commercial_terms: string
  internal_notes: string; customer_notes: string
  lines: { id: string | number; product_id: number | null; description: string; quantity: number | string; unit_price: number | string; discount_rate: number | string; tax_rate: number | string }[]
  permissions: QuotePermission[]; activities: QuoteActivity[]; as_of: string
  products?: QuoteProduct[]; can_accept?: boolean; conversion_targets?: QuoteConversionTarget[]; converted_to?: QuoteConversion | null
}

function detailFromDTO(data: QuoteDetailDTO): QuoteDetail {
  return {
    ...fromDTO(data), issueDate: data.issue_date.slice(0, 10), billingAddress: data.billing_address,
    currency: data.currency, paymentTerms: data.payment_terms, customerReference: data.customer_reference,
    subject: data.subject, deliveryTerms: data.delivery_terms, commercialTerms: data.commercial_terms,
    internalNotes: data.internal_notes, customerNotes: data.customer_notes,
    lines: data.lines.map((line) => ({ id: String(line.id), productId: line.product_id, description: line.description,
      quantity: Number(line.quantity), unitPrice: Number(line.unit_price), discountRate: Number(line.discount_rate), taxRate: Number(line.tax_rate) })),
    permissions: data.permissions, activities: data.activities, asOf: data.as_of.slice(0, 10), products: data.products ?? [],
    canAccept: data.can_accept ?? false, conversionTargets: data.conversion_targets ?? [], convertedTo: data.converted_to ?? null,
  }
}

function inputToDTO(input: QuoteInput) {
  return {
    customer_id: input.customerId, billing_address: input.billingAddress, salesperson: input.salesperson,
    issue_date: input.issueDate, expires_at: input.expiresAt, currency: input.currency,
    payment_terms: input.paymentTerms, customer_reference: input.customerReference, subject: input.subject,
    delivery_terms: input.deliveryTerms, commercial_terms: input.commercialTerms,
    internal_notes: input.internalNotes, customer_notes: input.customerNotes,
    // Les IDs de ligne sont des clés locales ; Django gère les identifiants persistés.
    lines: input.lines.map((line) => ({ product_id: line.productId, description: line.description,
      quantity: line.quantity, unit_price: line.unitPrice, discount_rate: line.discountRate, tax_rate: line.taxRate })),
  }
}
```

### src/features/reports/api/reports.api.ts

```ts
const analyticsParams = (v: ReportParams) => ({ date_from: v.dateFrom, date_to: v.dateTo, partner: v.partner || undefined, owner: v.owner || undefined, category: v.category || undefined, warehouse: v.warehouse || undefined })
```

### src/features/sales/api/sales.api.ts

```ts
export const SALES_ENDPOINT = '/sales-orders/'

function fromAPI(order: Omit<SalesOrderDetail, 'capabilities'> & { capabilities?: Partial<SalesOrderDetail['capabilities']> }): SalesOrderDetail {
  return { ...order,
    capabilities: { canConfirm: false, canCancel: false, canDeliver: false, canInvoice: false, invoiceableAmount: 0, ...order.capabilities },
    lines: order.lines.map((line) => ({ ...line, unitCost: typeof line.unitCost === 'number' && Number.isFinite(line.unitCost) ? line.unitCost : null })),
  }
}
```

### src/features/supplier-invoices/api/supplierInvoices.api.ts

```ts
export const SUPPLIER_INVOICES_ENDPOINT = '/supplier-invoices/'

const inputDTO = (v: SupplierInvoiceInput) => ({ supplier_id: v.supplierId, supplier_reference: v.supplierReference, invoice_date: v.invoiceDate, due_date: v.dueDate, currency: v.currency, payment_terms: v.paymentTerms, notes: v.notes, lines: v.lines.map((l) => ({ id: l.id, product_name: l.productName, description: l.description, purchase_line_id: l.purchaseLineId, quantity: l.quantity, unit_price: l.unitPrice, discount_rate: l.discountRate, tax_rate: l.taxRate })) })
```

### src/features/suppliers/api/suppliers.api.ts

```ts
export const SUPPLIERS_ENDPOINT = '/suppliers/'
```


### Dispatcher factures et pagination devis

mutateInvoice produit POST /invoices/{id}/post/, /send/, /payment/, /remind/. Aliases : postInvoice, sendInvoice, recordInvoicePayment, remindInvoice ; leurs invalidations figurent dans les hooks invoices du registre frontend. Le second GET quotes suit next sur le meme chemin. Apres expansion des quatre actions et deduplication de la pagination : **145 templates methode/chemin**, avant expansion des domaines forecast et types de report. Ce sont des contrats attendus, pas des endpoints Django deja disponibles.
