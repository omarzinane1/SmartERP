# Audit préalable — factures fournisseurs, catalogue, stock et dépenses

Audit du code et des contrats React effectué avant les modifications de cette milestone (3 octobre 2026). Le frontend réel est `smarterp-ai/`, et non `frontend/`.

| Tâche | État initial | Contrat / risque constaté |
|---|---|---|
| Supplier Invoices | MISSING | Écrans et mocks présents ; draft/posted/cancelled, paiement et retard dérivés. Réutiliser les paiements sortants et conserver les snapshots. |
| Products | PARTIAL | Product existe pour les ventes ; reference = SKU, unit_price = prix de vente. Ne pas créer un second catalogue. |
| Categories / Units / Prices | MISSING | Champs libres côté React ; catégories et unités personnalisables par société. Historique réel des changements de prix nécessaire. |
| Warehouses | PARTIAL | Warehouse existe et est créé par l'onboarding. Étendre ses métadonnées sans le dupliquer. |
| Warehouse Stock | MISSING | Aucun solde réel. StockLevel sera la projection transactionnelle du ledger, sans champ stock sur Product. |
| Stock Movements | MISSING | Contrat in/out/adjustment/return ; quantités fractionnaires et coûts Decimal. |
| Stock Transfers | MISSING | draft/ready/in_transit/completed/cancelled. Les mocks déplacent à deux étapes ; le backend déplacera uniquement à completed, atomiquement. Adapter les explications du frontend. |
| Low Stock Alerts | MISSING | Seuil produit ; stock disponible <= seuil. Alertes calculées, jamais persistées. |
| Stock Valuation | CONFLICT / RISK | Onboarding autorise weighted_average, fifo, standard. Implémenter seulement weighted_average ; bloquer explicitement les opérations sous les deux autres méthodes. |
| Expenses | MISSING | draft/submitted/approved/rejected/paid ; approbation explicite. Aucun faux paiement ni centre d'approbation global. |

## Décisions d'intégration

- Réutiliser les 82 permissions existantes, le contexte request.company/membership, les services transactionnels et DocumentSequence.
- Stock négatif interdit. Company puis StockLevel verrouillés ; les transferts utilisent le même ordre de verrouillage. Aucun endpoint ne modifie directement un solde.
- Ledger immuable, quantité à trois décimales, valeur de stock à six décimales. Sortie complète consomme le reliquat exact ; un transfert conserve exactement la valeur totale.
- Aucun moteur de réservation commerciale ajouté. Les étapes ready/in_transit sont logistiques ; clôture soumise au stock encore disponible.
- Réceptions de produits reliés au catalogue intégrées dans leur transaction via le service central. Lignes libres et services ne créent pas de stock. Les anciennes réceptions ne sont pas rejouées automatiquement.
- Factures et commandes conservent les prix/descriptions de leurs lignes après modification du catalogue.
- Préserver les migrations appliquées, les données existantes, les couleurs et les layouts. Les adaptations React servent uniquement les contrats réels.

## Point de contrôle précédent

Avant cette milestone : `scripts/test_postgres.ps1` exécute 146 tests, tous réussis ; build TypeScript/Vite et lint réussis. Ce résultat sera complété par les vérifications après implémentation.
