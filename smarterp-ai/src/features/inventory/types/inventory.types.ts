import type { CatalogProduct, StockHealth } from '../../products/types/products.types'
import type { WarehouseSummary } from '../../warehouses/types/warehouses.types'
export type MovementType = 'in' | 'out' | 'transfer' | 'adjustment' | 'return'
export type TransferStatus = 'draft' | 'ready' | 'in_transit' | 'completed' | 'cancelled'
export interface StockRow { productId: number; warehouseId: number; onHand: number; reserved: number; incoming: number; lastMovementAt: string }
export interface InventoryRow extends StockRow { productName: string; sku: string; warehouseName: string; available: number; value: number; minimum: number; health: StockHealth; unit: string }
export interface MovementInput { productId: number; warehouseId: number; quantity: number; type: Exclude<MovementType, 'transfer'>; date: string; sourceReference: string; note: string; adjustmentDirection: 'increase' | 'decrease' }
export interface StockMovement { id: number; reference: string; date: string; type: MovementType; productId: number; productName: string; warehouseId: number; warehouseName: string; destinationId: number | null; destinationName: string | null; quantity: number; before: number; after: number; sourceReference: string; sourcePath: string | null; user: string; note: string }
export interface TransferInput { sourceId: number; destinationId: number; date: string; referenceExternal: string; notes: string; lines: { productId: number; quantity: number }[] }
export interface StockTransfer extends TransferInput { id: number; reference: string; sourceName: string; destinationName: string; status: TransferStatus; user: string; activities: { id: string; date: string; title: string; detail: string }[]; capabilities: { canEdit: boolean; canReady: boolean; canStart: boolean; canComplete: boolean; canCancel: boolean } }
export interface MovementData { movements: StockMovement[]; products: CatalogProduct[]; stock: InventoryRow[]; warehouses: { id: number; name: string }[]; permissions: string[]; asOf: string }
export interface TransferData { transfers: StockTransfer[]; products: CatalogProduct[]; stock: InventoryRow[]; warehouses: { id: number; name: string }[]; permissions: string[]; asOf: string; supportsStatusPatch: boolean }
export interface InventorySummary { value: number; available: number; lowStock: number; outOfStock: number; dormantValue: number; incoming: number; permissions: string[]; asOf: string; products: CatalogProduct[]; rows: InventoryRow[]; warehouses: WarehouseSummary[] }
export const movementTypeLabels = { in: 'Entrée', out: 'Sortie', transfer: 'Transfert', adjustment: 'Ajustement', return: 'Retour' }
export const transferStatusLabels = { draft: 'Brouillon', ready: 'Prêt', in_transit: 'En transit', completed: 'Terminé', cancelled: 'Annulé' }
