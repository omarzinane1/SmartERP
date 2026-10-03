# Audit préalable — 3 octobre 2026

Le frontend actif est `smarterp-ai/` (le chemin `frontend/` de la consigne n'existe pas).

| Classement | Constat vérifié dans le code |
|---|---|
| IMPLEMENTED | Auth/session/CSRF, contexte société, 82 permissions, onboarding, clients, devis, commandes clients, factures brouillon, lignes Decimal, séquences verrouillées, pagination, aging de lecture. |
| PARTIAL | Factures : `draft/posted/cancelled`, champs soldes et historique existent ; actions de posting/paiement/avoir/relance absentes, capacités désactivées. |
| MISSING | Apps finance et purchasing : scaffolds vides, non installés. Aucun Payment, Supplier, PO, Receipt ni service de mouvement de stock. |
| CONFLICT / RISK | Frontend paiements exige une facture même pour un décaissement, mais factures fournisseurs hors périmètre. Risque/solde fournisseur présentés comme connus dans les mocks. PO `sent` suggère un e-mail envoyé sans transport. PATCH imbriqué doit revalider intégralement les lignes. |

Contrats inspectés : API/types/Zod/hooks/pages/mocks invoices, payments, suppliers, purchases et inventory ; modèles/services/selectors/permissions/tests/migrations accounts, companies, crm, sales, inventory, common ; scaffolds finance/purchasing.

Décisions :

- Conserver Invoice workflow `draft/posted/cancelled`, paymentStatus `unpaid/partially_paid/paid` et overdue dérivé. Posting commercial, sans grand livre comptable.
- CreditNote séparée, réutilisation CommercialLine et calcul Decimal. Avoir immédiatement validé et immuable, complet ou quantités partielles de lignes source. Plafond : solde non réglé ; remboursements/crédits sur sommes déjà encaissées hors périmètre. Arrondis cumulés par ligne pour retrouver exactement le montant original au dernier avoir.
- Payment `incoming/outgoing`, statuts frontend `pending/completed/cancelled/failed`. Saisie manuelle crée `completed`, sans transfert bancaire. Allocations multiples entrantes uniquement. Décaissements fournisseurs non affectés autorisés, explicitement indiqués.
- Clé Idempotency-Key obligatoire pour paiements, allocations, avoirs, relances et réceptions ; même clé/payload rejoue, changement de payload donne 409. Verrou Company puis documents pour un ordre constant entre transactions.
- Fournisseur : acheteur Membership de la société. Score/risque/solde fournisseurs inconnus = null, aucune IA. Agrégats sur commandes confirmées et réceptions réellement enregistrées.
- PO workflow `draft → sent → confirmed`, confirmation directe autorisée, annulation avant toute réception ; données figées dès envoi. Envoi = attestation d'envoi externe, aucun e-mail automatique.
- Réception indépendante : `not_received/partially_received/received` dérivé des quantités. Dépôt réel de la société, aucun mouvement de stock ad hoc.
- Conservation des migrations appliquées et documents ; nouvelles migrations uniquement. Aucun commit/push.
