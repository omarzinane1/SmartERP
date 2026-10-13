# Audit préalable — Opportunités IA — 2026-10-12

Base Git : `8b9be6e`. Les changements du milestone Intelligence sont présents et non commités ; ils sont conservés. Migration intelligence 0002 déjà appliquée : ne pas la modifier. Application React réelle : `smarterp-ai/`.

| Élément | État observé | Décision |
|---|---|---|
| AIAlert / IntelligenceRun | IMPLEMENTED | Réutiliser l'orchestration, les baux, les locks, l'audit et la revalidation des droits. |
| Santé / anomalies / forecasts | IMPLEMENTED dans l'arbre courant | Sources officielles et statistiques Decimal ; forecasts CA et cash, aucune prévision produit. |
| AIOpportunity / engine | MISSING | `opportunities.py` vide, aucun modèle ; ajouter un modèle distinct de AIAlert. |
| Page Opportunities | PARTIAL | Contrat TS et page existants, mais mocks, filtres/pagination client et affectation simulée. Brancher API réelle et workflow acknowledge/complete/dismiss. |
| Carte Control Center | PARTIAL / RISK | Liste vide côté backend ; composant affiche un pourcentage même si confidence null et ouvre un brouillon de démonstration. Remplacer par navigation vers le détail réel. |
| RBAC | IMPLEMENTED | `ai.opportunities.view` existe, ainsi que ai.use et les droits de chaque source. Aucun nouveau code de permission requis. |
| Secure AI Tools | MISSING | Registre et outils restent vides ; utiliser les selectors ORM sécurisés existants. |
| Notifications / audit | IMPLEMENTED | Pas de notification par opportunité ; audit des scans et transitions uniquement. |

Contrats lus : ai/types/ai.types.ts, ai/api/ai.api.ts, ai/hooks/useAIWorkspace.ts, AIOpportunitiesPage, carte Opportunities, SuggestedAction/ActionReview et types Control Center. Sources lues : sales order_queryset, Invoice/CreditNote et finance summaries, Customer/customer selectors, StockLevel/StockMovement/product_queryset/low_stock_queryset/movement_queryset/valuation, purchasing selectors, permissions catalogue, pagination et audit.

Détecteurs retenus : réactivation après commandes confirmées, clients à forte valeur historique facturée nette, créances prioritaires agrégées par client, réapprovisionnement avec sorties historiques suffisantes, stock dormant. Paramètres centralisés, fenêtres bornées, candidats bornés avant publication.

Limites : aucun lien premium/équivalence produit pour upsell ; pas de moteur d'association cross-sell validé ; coût historique des ventes absent pour la marge ; historique fournisseur qualité/prix comparable insuffisant ; forecasting produit absent. Ne pas convertir les forecasts CA/cash globaux en demande produit. Ces familles resteront explicitement NOT IMPLEMENTED. Les valeurs de créance et de stock sont des expositions observées, pas des gains promis.

Affectation nominative : le contrat initial la simule mais le backend n'en dispose pas. Le workflow demandé utilise une prise en charge par le membre courant, avec acteur/date persistés. Conserver les composants/layout, adapter les champs de statut et les actions sans prétendre envoyer une tâche ou créer un document ERP.
