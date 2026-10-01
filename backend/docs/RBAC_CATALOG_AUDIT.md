# Catalogue RBAC — audit et validation du 1er octobre 2026

## État constaté avant toute modification

- Frontend réel : `smarterp-ai/` ; aucun dossier `frontend/` dans ce checkout.
- Permissions frontend détectées : **82**.
- Permissions déjà présentes dans le fichier de migration `0003_seed_permission_catalog.py` : **82**.
- Permissions présentes dans PostgreSQL (`smarterp_ai`) : **82**, toutes actives.
- Permissions manquantes au moment de cet audit : **0**. Liste : aucune.
- Codes PostgreSQL hors catalogue : **0**.
- `0003_seed_permission_catalog` était appliquée ; son contenu a été conservé sans modification.
- `0004_complete_permission_catalog` existait comme fichier vide d'opérations, non appliqué. Cette mission le complète.

Le nombre historique de 48 indiqué dans la mission n'est pas reproductible sur l'état trouvé. Aucune trace de l'ancien sous-ensemble de 48 ne permet d'identifier honnêtement 34 anciens codes manquants. Le test de réconciliation reproduit un sous-ensemble de 48 **uniquement dans la base de test**, sans prétendre reconstituer cet historique.

## Méthode et sources

Analyse des littéraux de chaînes de tous les fichiers `.ts` et `.tsx` de `smarterp-ai/src` avec l'AST TypeScript installé dans le projet. Les commentaires sont exclus. Les 101 chaînes de forme pointée ont été examinées : 19 sont des chemins de formulaire d'onboarding ou des noms de fichiers CSV, et 82 sont des codes RBAC déclarés ou utilisés.

Les exclusions sont `business.description`, `business.industry`, `business.size`, `company.address`, `company.city`, `company.country`, `company.email`, `company.logo`, `company.name`, `company.phone`, `company.website`, `finance.currency`, `inventory.enabled`, `invoicing.footer`, `invoicing.language`, `depenses.csv`, `depots.csv`, `mouvements.csv`, `produits.csv`.

Le résultat a été comparé à la matrice existante [RBAC_MATRIX.md](../../smarterp-ai/docs/RBAC_MATRIX.md) : mêmes 82 codes, aucune différence. Un instantané indépendant sert de référence aux tests : [permission_codes.json](../apps/accounts/tests/fixtures/permission_codes.json).

La migration fige les codes ; elle ne dépend ni du frontend au déploiement, ni de modèles applicatifs courants. Elle emploie `apps.get_model` et l'alias de base de `schema_editor.connection`, puis `update_or_create(code=...)`. Elle conserve les identifiants existants, les rôles et leurs attributions. Son retour arrière est un `noop` pour conserver les données.

## Métadonnées et délégation

- `label = code`, comme dans le catalogue frontend : aucune traduction inventée.
- `module` = segment avant le premier point ; `action` = suffixe restant, convention déjà utilisée par la migration backend. Ainsi `inventory.movements.create` a pour action `movements.create`.
- `is_active = True` pour les 82 codes.
- `is_grantable = False` uniquement pour `users.manage`, `roles.manage`, `roles.assign` et `audit.export`, conformément à `admin.mock.ts`.
- L'action regroupée du mock (`ai`, `sensitive`, `edit`, etc.) est une classification d'affichage et ne devient pas une politique backend.
- `customers.delete` sert seulement de code **non accordé** dans les tests ; aucune permission de ce nom n'est créée.

## Rôles existants et étape suivante

La base contient un rôle système `admin`, lié à une société, avec une attribution à `customers.view`. Ce rôle et ses liens ont été conservés. Aucune attribution massive n'est ajoutée.

Le mock comporte Owner, Admin, Manager, Commercial, Comptable, Acheteur, Stock et Analyste personnalisé. Owner/Admin reçoivent le catalogue mock, Manager ses codes grantables, les quatre rôles opérationnels un sous-ensemble calculé par action/module, et Analyste personnalisé `reports.view` + `products.view`. Ce catalogue mock n'est lui-même qu'une union partielle des listes frontend. Ces règles de démonstration ne constituent pas la politique de production. Cette dernière reste à valider séparément.

## Couverture ajoutée

- Chaîne Membership → MembershipRole → Role → RolePermission → Permission.
- Refus d'une permission absente, d'un membership absent et d'un code vide.
- `can`, `can_any`, `can_all`, refus des listes vides et déduplication multi-rôles.
- Rôles/permissions inactifs, isolation société même face à une relation incohérente insérée sans validation, validation `MembershipRole.full_clean`.
- Unicité SQL des codes et absence de bypass Django superuser.
- Vue DRF de test avec `HasPermission` : accès accordé, 403, déclaration absente/vide, session/contexte absents.
- Catalogue exact et métadonnées ; passage simulé de 48 à 82 puis deuxième exécution idempotente, modèles historiques et conservation des liens.
- Login/session/profil, permissions relues depuis PostgreSQL après modification, rôle d'affichage issu des rôles effectifs.
- CSRF réel sur login/logout, cookie de session HttpOnly, déconnexion, suspension, société inactive et rejet des identifiants de société fournis par le client comme autorité.
- Suppression de la route temporaire `/api/auth/rbac-test/` ; vue protégée réservée au module de tests.

## Validation exécutée

Commandes exécutées avec `backend/.venv/Scripts/python.exe` (Python 3.11.9) :

| Contrôle | Résultat |
|---|---|
| `manage.py check` | Aucun problème |
| `manage.py showmigrations accounts` avant modification | 0003 appliquée, 0004 non appliquée |
| `manage.py migrate --plan` | Seule 0004 était en attente |
| `manage.py migrate` | 0004 appliquée avec succès |
| `manage.py showmigrations accounts` après migration | 0001 à 0004 appliquées |
| `manage.py makemigrations --check --dry-run` | Aucun changement de schéma détecté |
| `Permission.objects.count()` | **82** |
| `Permission.objects.filter(is_active=True).count()` | **82** |
| Ensemble des codes PostgreSQL / frontend | Égalité exacte |
| Doublons sur `code` | **0** |
| Codes non grantables | Exactement les quatre codes documentés |
| Identifiants des permissions existantes | Conservés |
| Rôles, RolePermission, MembershipRole | Identiques à l'état initial |
| Découverte de tests Django | **34 tests** |
| `manage.py test apps.accounts --settings=config.settings.test --keepdb --noinput --verbosity=2` | **Bloqué avant exécution**, code de sortie 1 |
| `git diff --check` | Aucun défaut d'espacement |

### Blocage restant pour les tests

PostgreSQL refuse la création de la base de test : `permission denied to create database`. Le rôle `smarterp_user` ne possède pas `CREATEDB` et `test_smarterp_ai` n'existe pas. Les 34 tests sont reconnus, **aucun résultat de réussite ne peut encore être annoncé**. Aucun test n'a été contourné ni lancé sur la base applicative.

Un administrateur PostgreSQL doit créer la base de test dédiée :

```sql
CREATE DATABASE test_smarterp_ai OWNER smarterp_user;
```

Puis, depuis `backend/` :

```powershell
.\.venv\Scripts\python.exe manage.py test apps.accounts --settings=config.settings.test --keepdb --noinput --verbosity=2
```

`--keepdb` réutilise et conserve cette base dédiée. Cette étape n'exige pas d'accorder `CREATEDB` au rôle applicatif. Elle reste à exécuter après création de la base, sans modification du catalogue de rôles système.

## Liste canonique et preuve source

Chaque ligne indique une occurrence réelle ; les pages/hooks et la matrice existante fournissent les autres usages.

| Code | Source frontend |
|---|---|
| `ai.opportunities.view` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `ai.tools.finance` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `ai.tools.inventory` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `ai.use` | [src/features/ai/data/ai.mock.ts](../../smarterp-ai/src/features/ai/data/ai.mock.ts) : 12 |
| `analytics.view` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `approvals.approve` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `approvals.view` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `audit.export` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 10 |
| `audit.view` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 10 |
| `cashflow.view` | [src/features/finance/data/finance.mock.ts](../../smarterp-ai/src/features/finance/data/finance.mock.ts) : 10 |
| `customers.create` | [src/features/customers/data/customers.mock.ts](../../smarterp-ai/src/features/customers/data/customers.mock.ts) : 336 |
| `customers.edit` | [src/features/customers/data/customers.mock.ts](../../smarterp-ai/src/features/customers/data/customers.mock.ts) : 337 |
| `customers.export` | [src/features/customers/data/customers.mock.ts](../../smarterp-ai/src/features/customers/data/customers.mock.ts) : 338 |
| `customers.view` | [src/features/customers/data/customers.mock.ts](../../smarterp-ai/src/features/customers/data/customers.mock.ts) : 335 |
| `delivery.create` | [src/features/sales/data/sales.mock.ts](../../smarterp-ai/src/features/sales/data/sales.mock.ts) : 7 |
| `documents.ai_analyze` | [src/features/documents/data/documents.mock.ts](../../smarterp-ai/src/features/documents/data/documents.mock.ts) : 6 |
| `documents.delete` | [src/features/documents/data/documents.mock.ts](../../smarterp-ai/src/features/documents/data/documents.mock.ts) : 6 |
| `documents.upload` | [src/features/documents/data/documents.mock.ts](../../smarterp-ai/src/features/documents/data/documents.mock.ts) : 6 |
| `documents.view` | [src/features/ai/data/ai.mock.ts](../../smarterp-ai/src/features/ai/data/ai.mock.ts) : 12 |
| `expenses.approve` | [src/features/expenses/data/expenses.mock.ts](../../smarterp-ai/src/features/expenses/data/expenses.mock.ts) : 7 |
| `expenses.create` | [src/features/expenses/data/expenses.mock.ts](../../smarterp-ai/src/features/expenses/data/expenses.mock.ts) : 7 |
| `expenses.export` | [src/features/expenses/data/expenses.mock.ts](../../smarterp-ai/src/features/expenses/data/expenses.mock.ts) : 7 |
| `expenses.view` | [src/features/expenses/data/expenses.mock.ts](../../smarterp-ai/src/features/expenses/data/expenses.mock.ts) : 7 |
| `finance.view` | [src/features/finance/data/finance.mock.ts](../../smarterp-ai/src/features/finance/data/finance.mock.ts) : 10 |
| `forecast.recalculate` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `forecast.view` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `inventory.analytics.view` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `inventory.export` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `inventory.movements.create` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `inventory.movements.view` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `inventory.transfers.approve` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `inventory.transfers.create` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `inventory.transfers.view` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `inventory.view` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `invoices.create` | [src/features/invoices/data/invoices.mock.ts](../../smarterp-ai/src/features/invoices/data/invoices.mock.ts) : 9 |
| `invoices.credit_note` | [src/features/invoices/types/invoices.types.ts](../../smarterp-ai/src/features/invoices/types/invoices.types.ts) : 6 |
| `invoices.edit` | [src/features/invoices/data/invoices.mock.ts](../../smarterp-ai/src/features/invoices/data/invoices.mock.ts) : 9 |
| `invoices.post` | [src/features/invoices/data/invoices.mock.ts](../../smarterp-ai/src/features/invoices/data/invoices.mock.ts) : 9 |
| `invoices.remind` | [src/features/invoices/data/invoices.mock.ts](../../smarterp-ai/src/features/invoices/data/invoices.mock.ts) : 107 |
| `invoices.send` | [src/features/invoices/data/invoices.mock.ts](../../smarterp-ai/src/features/invoices/data/invoices.mock.ts) : 9 |
| `invoices.view` | [src/features/customers/data/customers.mock.ts](../../smarterp-ai/src/features/customers/data/customers.mock.ts) : 420 |
| `modules.manage` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `payments.cancel` | [src/features/payments/data/payments.mock.ts](../../smarterp-ai/src/features/payments/data/payments.mock.ts) : 13 |
| `payments.create` | [src/features/invoices/data/invoices.mock.ts](../../smarterp-ai/src/features/invoices/data/invoices.mock.ts) : 9 |
| `payments.export` | [src/features/payments/data/payments.mock.ts](../../smarterp-ai/src/features/payments/data/payments.mock.ts) : 13 |
| `payments.view` | [src/features/customers/data/customers.mock.ts](../../smarterp-ai/src/features/customers/data/customers.mock.ts) : 423 |
| `products.create` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `products.edit` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `products.export` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `products.view` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 18 |
| `purchases.confirm` | [src/features/purchases/data/purchases.mock.ts](../../smarterp-ai/src/features/purchases/data/purchases.mock.ts) : 8 |
| `purchases.create` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `purchases.edit` | [src/features/purchases/data/purchases.mock.ts](../../smarterp-ai/src/features/purchases/data/purchases.mock.ts) : 8 |
| `purchases.view` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `quotes.accept` | [src/features/quotes/data/quotes.mock.ts](../../smarterp-ai/src/features/quotes/data/quotes.mock.ts) : 22 |
| `quotes.convert` | [src/features/quotes/data/quotes.mock.ts](../../smarterp-ai/src/features/quotes/data/quotes.mock.ts) : 22 |
| `quotes.create` | [src/features/quotes/data/quotes.mock.ts](../../smarterp-ai/src/features/quotes/data/quotes.mock.ts) : 22 |
| `quotes.edit` | [src/features/quotes/data/quotes.mock.ts](../../smarterp-ai/src/features/quotes/data/quotes.mock.ts) : 22 |
| `quotes.export` | [src/features/quotes/data/quotes.mock.ts](../../smarterp-ai/src/features/quotes/data/quotes.mock.ts) : 22 |
| `quotes.send` | [src/features/quotes/data/quotes.mock.ts](../../smarterp-ai/src/features/quotes/data/quotes.mock.ts) : 22 |
| `quotes.view` | [src/features/quotes/data/quotes.mock.ts](../../smarterp-ai/src/features/quotes/data/quotes.mock.ts) : 22 |
| `receipts.create` | [src/features/purchases/data/purchases.mock.ts](../../smarterp-ai/src/features/purchases/data/purchases.mock.ts) : 8 |
| `reports.export` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `reports.generate` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `reports.view` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `roles.assign` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 10 |
| `roles.manage` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 10 |
| `sales.edit` | [src/features/sales/data/sales.mock.ts](../../smarterp-ai/src/features/sales/data/sales.mock.ts) : 7 |
| `sales.margin.view` | [src/features/sales/data/sales.mock.ts](../../smarterp-ai/src/features/sales/data/sales.mock.ts) : 7 |
| `sales.view` | [src/features/customers/data/customers.mock.ts](../../smarterp-ai/src/features/customers/data/customers.mock.ts) : 410 |
| `settings.manage` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `settings.view` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 11 |
| `supplier_invoices.create` | [src/features/purchases/data/purchases.mock.ts](../../smarterp-ai/src/features/purchases/data/purchases.mock.ts) : 8 |
| `supplier_invoices.edit` | [src/features/purchases/data/purchases.mock.ts](../../smarterp-ai/src/features/purchases/data/purchases.mock.ts) : 8 |
| `supplier_invoices.view` | [src/features/finance/data/finance.mock.ts](../../smarterp-ai/src/features/finance/data/finance.mock.ts) : 10 |
| `suppliers.create` | [src/features/suppliers/data/suppliers.mock.ts](../../smarterp-ai/src/features/suppliers/data/suppliers.mock.ts) : 6 |
| `suppliers.edit` | [src/features/purchases/data/purchases.mock.ts](../../smarterp-ai/src/features/purchases/data/purchases.mock.ts) : 8 |
| `suppliers.export` | [src/features/suppliers/data/suppliers.mock.ts](../../smarterp-ai/src/features/suppliers/data/suppliers.mock.ts) : 6 |
| `suppliers.view` | [src/features/expenses/data/expenses.mock.ts](../../smarterp-ai/src/features/expenses/data/expenses.mock.ts) : 7 |
| `users.manage` | [src/features/admin/data/admin.mock.ts](../../smarterp-ai/src/features/admin/data/admin.mock.ts) : 10 |
| `warehouses.create` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
| `warehouses.view` | [src/features/products/data/products.mock.ts](../../smarterp-ai/src/features/products/data/products.mock.ts) : 6 |
