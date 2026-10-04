# Audit préalable — dépenses, finance, approbations, documents, exports

Contrats inspectés le 4 octobre 2026 dans `smarterp-ai/src/features/` (le chemin `frontend/` du brief n'existe pas). Vérification des types, adaptateurs API, hooks, écrans, formulaires et mocks ; lecture des modèles/services existants et du catalogue réel de 82 permissions.

| Tâche | État avant codage | Constats et décisions |
|---|---|---|
| Expense Categories / Workflow | PARTIAL | Expense et transitions draft/submitted/approved/rejected existent. Catégorie encore textuelle. Ajouter un référentiel par société, préserver les valeurs historiques ; centraliser les décisions avec ApprovalRequest. |
| Cash Flow | MISSING | Finance propose cash-flow, forecast, upcoming-payments. Les deux premiers flux réels proviennent des Payment completed ; aucune dépense approuvée n'est un paiement. Forecast reste hors périmètre. |
| Finance KPIs | MISSING | Soldes factures, avoirs, paiements et dépenses existent. Agrégations SQL Decimal, pas de marge historique inventée. Pas de solde bancaire initial connu. |
| Approval Center | MISSING | App vide. Frontend pending/approved/rejected/needs_changes avec version de décision. Dépenses réellement synchronisées ; achats = demande de revue dans les mocks. Pas d'approbation IA/stock artificielle. |
| Approval Workflow | MISSING | Créer un orchestrateur unique de décision. La route dépense existante garde sa permission ; la route du centre exige aussi approvals.approve. Même verrou et même mutation métier. |
| Documents | MISSING | App vide, frontend documentaire uniquement simulé. Ajouter FileField et métadonnées, aucun contenu binaire en base. Statut explicite « Enregistré », sans prétendre indexer. |
| Upload / Download / Delete | MISSING | Limite UI 15 Mio, PDF/TXT dans Documents et images dans les pièces jointes. Valider le contenu réel. Tous les accès fichiers passent par une vue authentifiée ; pas de route MEDIA publique. |
| Document ERP Links | MISSING | Pièces jointes locales seulement. DocumentLink à registre fermé de types, validation du tenant et des droits sur l'entité. Protection des suppressions ORM ; pas de GenericForeignKey. |
| PDF | MISSING | Boutons PDF des factures/devis désactivés ; aperçu HTML existant. Générateur ReportLab partagé, données des documents enregistrés, coordonnées et pied de page Company. Aucun recalcul des montants. |
| Excel / CSV | PARTIAL | Plusieurs CSV côté navigateur et bibliothèque de rapports simulée. Infrastructure serveur commune CSV en flux et XLSX en écriture séquentielle ; catalogue d'exports simples, sans moteur analytique complet. |

## Limites à respecter

- Solde initial et cash disponible = inconnus, jamais un faux zéro. L'historique représentera le cumul des mouvements connus, avec cette indication explicite.
- Les dépenses approuvées comptent dans les charges approuvées, pas dans les sorties cash. Aucun second débit ajouté à un paiement fournisseur.
- Approbation d'une dépense : un seul ApprovalRequest actif, décision versionnée et transactionnelle. Les deux entrées API empruntent le même orchestrateur.
- Une revue d'achat ne confirme pas automatiquement la commande et ne déplace ni argent ni stock. Cette distinction reprend le contrat du centre existant.
- Les pièces jointes restent protégées par documents.view et par les droits sur leurs liens métier. Visibilités supportées : entreprise et privé (auteur), sans règle fondée sur le nom d'un rôle.
- Suppression : métadonnées conservées comme tombstone, fichier retiré après commit ; tout échec de stockage reste suivi et réessayable, jamais exposé comme document actif.
- DocumentLink : registre explicite entity_type/entity_id, validation à l'écriture et à la lecture, protection pre_delete des entités. Limite assumée : pas de FK SQL vers une table variable ; les écritures SQL externes devront préserver cette règle.
- Aucun OCR/RAG/index IA, notification, Celery, Redis, reporting analytique complet ou dashboard exécutif.
- Aucune modification d'une migration déjà appliquée. Aucun commit ni push.
