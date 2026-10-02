# SmartERP AI — Refonte des couleurs uniquement

## 1. Fichiers modifiés

Frontend réel : `smarterp-ai/`. 86 fichiers source modifiés : 13 feuilles CSS et 73 fichiers TS/TSX. Leurs remplacements de couleurs renvoient au même système central. Aucun fichier backend, API, hook, formulaire métier, route ou workflow modifié. Aucune dépendance ajoutée.

- `src/components/layout/AppShell.tsx`
- `src/components/layout/FeaturePlaceholder.tsx`
- `src/components/layout/RouteLoading.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/layout/theme.css`
- `src/components/ui/Alert.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/BusinessPresentation.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Checkbox.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/business.css`
- `src/components/ui/operations.css`
- `src/features/ai-control-center/ai-control-center.css`
- `src/features/ai-control-center/components/AlertDetailDrawer.tsx`
- `src/features/ai-control-center/components/AlertsTable.tsx`
- `src/features/ai-control-center/components/AnomalyHistory.tsx`
- `src/features/ai-control-center/components/BusinessHealth.tsx`
- `src/features/ai-control-center/components/ForecastRisks.tsx`
- `src/features/ai-control-center/components/IntelligenceStats.tsx`
- `src/features/ai-control-center/components/IntelligenceSummary.tsx`
- `src/features/ai-control-center/components/Opportunities.tsx`
- `src/features/ai-control-center/components/PageHeader.tsx`
- `src/features/ai-control-center/components/RecommendedActions.tsx`
- `src/features/ai-control-center/components/RiskMatrix.tsx`
- `src/features/ai/intelligence.css`
- `src/features/ai/pages/AIAssistantPage.tsx`
- `src/features/ai/pages/AIForecastingPage.tsx`
- `src/features/auth/components/AuthBrandPanel.tsx`
- `src/features/auth/components/BusinessIllustration.tsx`
- `src/features/auth/components/LoginForm.tsx`
- `src/features/auth/components/PasswordInput.tsx`
- `src/features/auth/pages/LoginPage.tsx`
- `src/features/customers/components/CustomerDialog.tsx`
- `src/features/customers/components/CustomerInvoicesTable.tsx`
- `src/features/customers/components/CustomerKanban.tsx`
- `src/features/customers/components/CustomerPaymentsTable.tsx`
- `src/features/customers/components/CustomerSelectionBar.tsx`
- `src/features/customers/components/CustomerTable.tsx`
- `src/features/customers/components/CustomersFilters.tsx`
- `src/features/customers/components/CustomersSummary.tsx`
- `src/features/customers/components/CustomersToolbar.tsx`
- `src/features/customers/customers.css`
- `src/features/customers/pages/CustomersPage.tsx`
- `src/features/dashboard/components/AttentionList.tsx`
- `src/features/dashboard/components/CashFlowChart.tsx`
- `src/features/dashboard/components/DashboardTables.tsx`
- `src/features/dashboard/components/ExecutiveSummary.tsx`
- `src/features/dashboard/components/InventoryHealth.tsx`
- `src/features/dashboard/components/KpiCard.tsx`
- `src/features/dashboard/components/RevenueChart.tsx`
- `src/features/dashboard/data/dashboard.mock.ts`
- `src/features/dashboard/pages/DashboardPage.tsx`
- `src/features/finance/components/CashPanels.tsx`
- `src/features/finance/pages/CashFlowPage.tsx`
- `src/features/inventory/components/StockTables.tsx`
- `src/features/invoices/invoices.css`
- `src/features/onboarding/components/BusinessStep.tsx`
- `src/features/onboarding/components/CompanyStep.tsx`
- `src/features/onboarding/components/InventoryStep.tsx`
- `src/features/onboarding/components/InvoicingStep.tsx`
- `src/features/onboarding/components/ModulesStep.tsx`
- `src/features/onboarding/components/OnboardingStepper.tsx`
- `src/features/onboarding/components/ReviewStep.tsx`
- `src/features/onboarding/pages/OnboardingPage.tsx`
- `src/features/payments/components/PaymentTable.tsx`
- `src/features/products/pages/ProductDetailPage.tsx`
- `src/features/purchases/purchasing.css`
- `src/features/quotes/components/CustomerSelector.tsx`
- `src/features/quotes/components/LineItemsEditor.tsx`
- `src/features/quotes/components/QuoteGeneralInformation.tsx`
- `src/features/quotes/components/QuoteSendDialog.tsx`
- `src/features/quotes/components/QuotesFilters.tsx`
- `src/features/quotes/components/QuotesTable.tsx`
- `src/features/quotes/components/TotalsPanel.tsx`
- `src/features/quotes/pages/QuotesPage.tsx`
- `src/features/quotes/quote-editor.css`
- `src/features/quotes/quotes.css`
- `src/features/reports/pages/ReportsLibraryPage.tsx`
- `src/features/sales/sales.css`
- `src/features/settings/configuration.css`
- `src/features/suppliers/components/PriceHistoryChart.tsx`
- `src/features/suppliers/components/SupplierRecordHeader.tsx`
- `src/features/warehouses/pages/WarehouseDetailPage.tsx`
- `src/index.css`

Le présent rapport est ajouté dans `docs/PALETTE_REFACTOR.md`. Les scripts de capture, images et journaux restent dans `test-results/palette/`, dossier ignoré par Git.

## 2. Système central et tokens

Les couleurs sont définies dans `src/components/layout/theme.css`, importé globalement depuis `src/index.css` pour couvrir Login et Onboarding aussi. L’import redondant du shell a été retiré. Le choix de thème existant est conservé ; les pages publiques suivent les préférences système via CSS.

Les utilitaires Tailwind consomment ces variables via `@theme inline`. Les anciens utilitaires slate sont reliés à des neutres chauds ; les classes bleues de thème utilisent désormais des tokens primary. Les couleurs métier vert/orange/rouge sont conservées comme sémantique. Le bleu désaturé est réservé aux informations.

| Token | Clair | Sombre |
|---|---|---|
| `--primary` | `#714B67` | `#714B67` |
| `--primary-hover` | `#5F3F57` | `#5F3F57` |
| `--primary-active` | `#52364B` | `#52364B` |
| `--primary-soft` | `#F3EDF2` | `#3B303A` |
| `--primary-text` | `#714B67` | `#D0A6C5` |
| `--primary-border` | `#C4AFBE` | `#73596B` |
| `--primary-focus` | `#946387` | `#B48BA9` |
| `--on-primary` | `#FFFFFF` | `#FFFFFF` |
| `--ai-primary` | `#7C5CFC` | `#7C5CFC` |
| `--ai-hover` | `#6848EA` | `#6848EA` |
| `--ai-soft` | `#F1EEFF` | `#302744` |
| `--ai-text` | `#6545CE` | `#BAAAFF` |
| `--ai-border` | `#C9BDF3` | `#63528C` |
| `--bg-app` | `#F8F7F8` | `#17151A` |
| `--bg-sidebar` | `#F3F1F3` | `#211D23` |
| `--bg-topbar` | `#FFFFFF` | `#1D1A20` |
| `--surface-1` | `#FFFFFF` | `#242126` |
| `--surface-2` | `#F3F1F3` | `#2B272D` |
| `--surface-3` | `#EBE7EB` | `#332E35` |
| `--surface-hover` | `#EDE8ED` | `#39333B` |
| `--surface-selected` | `#EEE3EC` | `#433744` |
| `--card-bg` | `#FFFFFF` | `#262227` |
| `--card-border` | `#DDD8DC` | `#3A343B` |
| `--card-hover` | `#F8F5F8` | `#2D282F` |
| `--text-primary` | `#2F292E` | `#F4F1F3` |
| `--text-secondary` | `#6F656C` | `#C7BEC5` |
| `--text-muted` | `#70656D` | `#AA9EA7` |
| `--text-disabled` | `#9C9299` | `#6E656C` |
| `--border` | `#DDD8DC` | `#3A343B` |
| `--border-strong` | `#B9AEB6` | `#6F626C` |
| `--table-bg` | `#FFFFFF` | `#242126` |
| `--table-border` | `#DDD8DC` | `#3A343B` |
| `--table-header-bg` | `#F0ECF0` | `#2D282F` |
| `--table-header-text` | `#6F626B` | `#BFB5BC` |
| `--table-header-border` | `#D8CFD6` | `#403941` |
| `--table-row-bg` | `#FFFFFF` | `#242126` |
| `--table-row-hover` | `#F6F1F5` | `#302A31` |
| `--table-row-selected` | `#EFE2EC` | `#3B303A` |
| `--table-row-border` | `#E4DEE3` | `#393239` |
| `--success` | `#2E7D5B` | `#2E7D5B` |
| `--success-bg` | `#EAF5EF` | `#18392E` |
| `--success-text` | `#276848` | `#88D3AD` |
| `--success-border` | `#B5D4C3` | `#35644F` |
| `--warning` | `#C18435` | `#C18435` |
| `--warning-bg` | `#FCF2E2` | `#3D2E18` |
| `--warning-text` | `#815716` | `#EFC27A` |
| `--warning-border` | `#DEC79E` | `#755630` |
| `--danger` | `#C75555` | `#C75555` |
| `--danger-bg` | `#FBECEE` | `#442324` |
| `--danger-text` | `#A53D46` | `#F09A9A` |
| `--danger-border` | `#E4B7BE` | `#824C51` |
| `--info` | `#567A9F` | `#567A9F` |
| `--info-bg` | `#EAF0F6` | `#202F3D` |
| `--info-text` | `#456480` | `#9DBBD5` |
| `--info-border` | `#BACCDD` | `#455E76` |
| `--neutral-bg` | `#EEE9EE` | `#343036` |
| `--neutral-text` | `#6D626A` | `#B8AEB5` |
| `--neutral-border` | `#D6CDD4` | `#50464E` |
| `--sidebar-border` | `#DDD8DC` | `#383138` |
| `--sidebar-text` | `#665B63` | `#C4BBC2` |
| `--sidebar-muted` | `#766A73` | `#A89BA5` |
| `--sidebar-hover` | `#EAE3E9` | `#302A31` |
| `--sidebar-active-bg` | `#E7DAE3` | `#40343F` |
| `--sidebar-active-text` | `#57364E` | `#FFFFFF` |
| `--sidebar-active-icon` | `#714B67` | `#A67899` |
| `--topbar-border` | `#DDD8DC` | `#373138` |
| `--input-bg` | `#FFFFFF` | `#28242A` |
| `--input-border` | `#CFC4CD` | `#655A64` |
| `--input-text` | `#2F292E` | `#F1EDF0` |
| `--input-placeholder` | `#796D76` | `#AA9CA6` |
| `--input-focus` | `#946387` | `#B48BA9` |
| `--button-secondary-bg` | `#F3EFF3` | `#2E2930` |
| `--button-secondary-border` | `#D2C8D0` | `#655A64` |
| `--button-secondary-text` | `#51464E` | `#D8D1D6` |
| `--button-ghost-hover` | `#EDE7ED` | `#312B32` |
| `--popover-bg` | `#FFFFFF` | `#2A262C` |
| `--popover-border` | `#D8CED6` | `#413A42` |
| `--modal-bg` | `#FFFFFF` | `#262227` |
| `--modal-border` | `#D8CED6` | `#403940` |
| `--overlay` | `#17151A99` | `#17151AB8` |
| `--shadow-color` | `#231B22` | `#110E12` |
| `--chart-aubergine` | `#714B67` | `#B483A5` |
| `--chart-purple` | `#A78DAD` | `#9987B0` |
| `--chart-green` | `#5D947A` | `#79AD91` |
| `--chart-amber` | `#BE904D` | `#C6A064` |
| `--chart-amber-soft` | `#D8B776` | `#E0C18A` |
| `--chart-teal` | `#5B9493` | `#77AAA7` |
| `--chart-red` | `#BD747B` | `#CE8990` |
| `--chart-red-strong` | `#A75060` | `#BA6376` |
| `--chart-neutral` | `#9B919A` | `#AAA0A8` |
| `--brand-bg` | `#30212D` | `#30212D` |
| `--brand-glow` | `#5B3D53` | `#5B3D53` |
| `--brand-text` | `#FFFFFF` | `#FFFFFF` |
| `--brand-secondary` | `#D8CDD5` | `#D8CDD5` |
| `--brand-accent` | `#C9A8C0` | `#C9A8C0` |
| `--brand-grid` | `#FFFFFF04` | `#FFFFFF04` |
| `--ai-button` | `#7353EE` | `#7353EE` |

Les alias `--form-bg`, `--form-border`, `--form-text`, `--form-placeholder` référencent les tokens input. Les ombres conservent leurs dimensions ; leur couleur utilise `--shadow-color` avec l’opacité initiale. Le noir du masque de grille reste inchangé : il contrôle la transparence du masque, et ne peint pas une surface noire.

Ajustements de contraste par rapport aux couleurs indicatives : gris muted et placeholders plus lisibles, focus plus clair dans le sombre, token `--ai-button: #7353EE` pour le texte blanc. L’accent IA `--ai-primary: #7C5CFC` reste disponible pour les éléments IA.

## 3. Ancienne couleur primaire

Bleu `#2563EB` dans les actions et accents métier, avec des boutons communs navy `#172C50` et le texte navy `#102747`.

## 4. Nouvelle couleur primaire

Aubergine `#714B67`, hover `#5F3F57`, active `#52364B`. Les liens sombres utilisent un aubergine plus clair pour la lisibilité ; les boutons gardent exactement la couleur principale demandée.

## 5. Composants affectés

Shell, sidebar, topbar, boutons primary/secondary/ghost, liens, onglets, pagination, champs, checkbox, badges, alertes, cartes KPI, tableaux, modales, menus, drawers, notifications et graphiques. Les valeurs KPI du dashboard et de la liste clients utilisent le texte principal, et les unités le texte secondaire.

## 6. Pages inspectées

27 pages dans les deux thèmes, soit 54 captures : Login, Onboarding, Dashboard, Customers, Customer Detail, Quotes, Quote Detail, Sales, Sales Detail, Invoices, Payments, Suppliers, Purchases, Products, Inventory, Warehouses, Expenses, Reports, Documents, AI Control Center, AI Assistant, Approvals, Users, Roles, Audit Logs, Settings, Profile.

Inspection sur Chrome local, viewport 1440 × 1000, captures complètes, données de démonstration isolées. La galerie est `test-results/palette/index.html`. Quatre captures supplémentaires montrent la sélection et le focus de formulaire dans les deux thèmes. Aucune donnée métier réelle créée ou modifiée.

**Constat préexistant :** Customer Detail utilise les classes `.customer-detail-*`, `.customer-record-*`, `.customer-kpi-grid`, mais aucune règle CSS correspondante n’existait dans le code initial. Sa fiche apparaît donc sans sa mise en page dédiée avant comme après cette mission. Les couleurs globales sont appliquées ; aucune mise en page n’a été inventée, conformément au périmètre demandé. Cette anomalie est visible dans la galerie et nécessite une mission séparée de layout.

## 7. Tables corrigées

Tableaux dashboard, clients, devis, commandes, factures, paiements, fournisseurs, achats, produits, stock, dépenses, documents, alertes IA, approbations, utilisateurs, matrice des permissions et audit. Surfaces sombres uniformes, en-têtes distincts, bordures chaudes, textes hiérarchisés, hover subtil et sélection aubergine. Aucune colonne ni structure de table modifiée.

## 8. Cards corrigées

Cards dashboard, business, operations, ventes, devis, facturation et configuration. Suppression des surfaces blanches résiduelles en dark ; valeurs KPI lisibles et fonds neutres chauds. Les panneaux IA disposent de leurs couleurs dédiées. À l’impression, les aperçus devis/factures gardent une encre sombre sur papier clair, quel que soit le thème écran.

## 9. Badges corrigés

Success vert, warning ambre, danger rouge, info bleu désaturé, neutral gris chaud ; badges et alertes partagés, statuts des listes et fiches métier. Les statuts, leurs calculs et leurs libellés ne changent pas.

## 10. Validation

- `npm run build` : réussi, aucune erreur TypeScript. Un passage a émis un avertissement informatif `PLUGIN_TIMINGS` (temps passé dans les plugins), sans échec de compilation.
- `npm run lint` : réussi.
- `git diff --check` : réussi.
- Contrôle syntaxique : les 12 feuilles CSS métier conservent leurs sélecteurs et toutes leurs dimensions ; seules les couleurs diffèrent. Le thème global ajoute exclusivement des traitements de couleur.
- Contrôle AST : les 73 fichiers TS/TSX conservent leur logique et leur structure, avec des substitutions de classes/valeurs de couleur et le déplacement de l’import CSS. Les trois différences de syntaxe des ombres ont été vérifiées : les dimensions sont identiques.
- Vérification des anciennes couleurs : aucun hex/rgb de thème ne subsiste hors du fichier central, à l’exception du noir fonctionnel du masque de grille.
- 18 combinaisons texte/fond mesurées dans chaque thème : minimum 4,55:1. Bouton principal blanc sur aubergine : 7,23:1. Ce contrôle ciblé ne constitue pas un audit complet WCAG.
- Survol du bouton principal vérifié : `#714B67` → `#5F3F57`. Sélection, hover des lignes, champs et modales contrôlés sur les deux thèmes.

Les journaux exacts se trouvent dans `test-results/palette/build.log`, `lint.log`, `contrasts.json`, `inspection.json`, `interaction-colors.json` et `color-scope-check.json`.

## Périmètre confirmé

```text
No API changed.
No business logic changed.
No route changed.
No ERP workflow changed.
No layout changed.
No table structure changed.
Only colors and visual contrast were changed.
```

Aucun commit. Aucun push. Palette prête pour inspection visuelle, sans présumer de votre validation.
