export interface InventoryCategory {
  id: string
  name: string
  slug: string
  active: boolean
}

export interface InventoryProduct {
  id: string
  name: string
  categoryId: string
  categoryName: string
  categorySlug: string
  subcategory: string
  price: number
  cost: number
  stockQuantity: number
  minimumStock: number
  sku?: string
  active: boolean
  updatedAt: string
}

export interface InventoryMovement {
  id: string
  productId: string
  productName: string
  quantityDelta: number
  type: 'opening' | 'entry' | 'adjustment' | 'sale' | 'sale_reversal'
  reason: string
  actorUserId: string
  occurredAt: string
  sourceSaleId?: string
  reversesMovementId?: string
}

export interface ProductDraft {
  id?: string
  name: string
  categoryId: string
  subcategory: string
  price: number
  cost: number
  minimumStock: number
  sku?: string
  active: boolean
}

export interface CategoryDraft {
  id?: string
  name: string
  slug: string
  active: boolean
}
