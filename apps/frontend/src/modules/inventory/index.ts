import type { AppModule } from '../types'

export { InventoryAccessPage } from './InventoryAccessPage'
export { InventorySection } from './InventorySection'
export { useInventory } from './useInventory'
export { listInventoryProducts, INVENTORY_CHANGED_EVENT } from './inventoryRepository'
export type { InventoryCategory, InventoryMovement, InventoryProduct } from './types'

export const inventoryModule: AppModule = {
  id: 'inventory',
  name: 'Inventarios',
}
