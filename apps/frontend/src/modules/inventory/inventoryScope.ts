import type { InventoryProduct } from './types'

export interface ScopedInventoryProduct extends InventoryProduct {
  cashRegisterId: string
}

export function selectCashRegisterInventory(
  rows: ScopedInventoryProduct[], cashRegisterId: string, pending: ReadonlyMap<string, number>,
): InventoryProduct[] {
  if (!cashRegisterId) return []
  return rows.filter((row) => row.cashRegisterId === cashRegisterId).map(({ cashRegisterId: _id, ...product }) => ({
    ...product,
    stockQuantity: Math.max(0, product.stockQuantity - (pending.get(product.id) ?? 0)),
  }))
}
