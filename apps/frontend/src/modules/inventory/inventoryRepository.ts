import { requireSupabase } from '../../infrastructure/supabase/client'
import { pendingProductQuantities } from '../../infrastructure/sync/outbox'
import { selectCashRegisterInventory, type ScopedInventoryProduct } from './inventoryScope'
import type { CategoryDraft, InventoryCategory, InventoryMovement, ProductDraft } from './types'

export const INVENTORY_CHANGED_EVENT = 'cafeteria:inventory-changed'
const PRODUCTS_CACHE_KEY = 'cafeteria:inventory-products:v2'
const CATEGORIES_CACHE_KEY = 'cafeteria:inventory-categories:v1'
const MOVEMENTS_CACHE_KEY = 'cafeteria:inventory-movements:v2'

interface CategoryRow { id: string; name: string; slug: string; active: boolean }
interface ProductRow {
  cash_register_id: string; product_id: string; display_name: string | null; category_id: string
  subcategory: string; price: number; cost?: number; stock_quantity: number; minimum_stock: number
  active: boolean; updated_at: string; products: { name: string; sku: string | null } | Array<{ name: string; sku: string | null }>
  product_categories: CategoryRow | CategoryRow[]
}
interface AuthorizedProductRow {
  cash_register_id: string; product_id: string; display_name: string | null; category_id: string
  subcategory: string; price: number; cost: number; stock_quantity: number; minimum_stock: number
  active: boolean; updated_at: string; product_name: string; sku: string | null
  category_name: string; category_slug: string; category_active: boolean
}
interface MovementRow {
  id: string; product_id: string; quantity_delta: number; movement_type: InventoryMovement['type']; reason: string
  actor_user_id: string; occurred_at: string; source_sale_id: string | null; reverses_movement_id: string | null
  cash_register_inventory: { display_name: string | null; products: { name: string } | Array<{ name: string }> } | Array<{ display_name: string | null; products: { name: string } | Array<{ name: string }> }>
}

function first<T>(value: T | T[]) { return Array.isArray(value) ? value[0] : value }
function notifyChanged() { window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT)) }

function readCache<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value as T[] : []
  } catch { return [] }
}

function writeCache<T>(key: string, value: T[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value))
}

function mapProduct(row: ProductRow): ScopedInventoryProduct {
  const category = first(row.product_categories)
  const product = first(row.products)
  return {
    cashRegisterId: row.cash_register_id,
    id: row.product_id, name: row.display_name ?? product?.name ?? row.product_id, categoryId: row.category_id, categoryName: category?.name ?? 'General',
    categorySlug: category?.slug ?? 'general', subcategory: row.subcategory, price: row.price, cost: row.cost ?? 0,
    stockQuantity: row.stock_quantity, minimumStock: row.minimum_stock, sku: product?.sku ?? undefined,
    active: row.active, updatedAt: row.updated_at,
  }
}

function mapAuthorizedProduct(row: AuthorizedProductRow): ScopedInventoryProduct {
  return {
    cashRegisterId: row.cash_register_id,
    id: row.product_id, name: row.display_name ?? row.product_name, categoryId: row.category_id,
    categoryName: row.category_name, categorySlug: row.category_slug, subcategory: row.subcategory,
    price: row.price, cost: row.cost, stockQuantity: row.stock_quantity,
    minimumStock: row.minimum_stock, sku: row.sku ?? undefined, active: row.active,
    updatedAt: row.updated_at,
  }
}

export async function listInventoryCategories() {
  const { data, error } = await requireSupabase().from('product_categories')
    .select('id,name,slug,active').order('name')
  if (error) {
    const cached = readCache<InventoryCategory>(CATEGORIES_CACHE_KEY)
    if (cached.length > 0) return cached
    throw new Error('No fue posible cargar las categorías autorizadas.')
  }
  const categories = (data as CategoryRow[]).map((row) => ({ ...row })) as InventoryCategory[]
  writeCache(CATEGORIES_CACHE_KEY, categories)
  return categories
}

export async function listInventoryProducts(cashRegisterId: string, activeOnly = false, includeCosts = true) {
  if (!cashRegisterId) return []
  if (includeCosts) {
    const { data, error } = await requireSupabase().rpc('list_cash_register_inventory', {
      p_cash_register_id: cashRegisterId,
    })
    if (error) throw new Error('No fue posible cargar el inventario autorizado.')
    const products = (data as AuthorizedProductRow[]).filter((product) => !activeOnly || product.active).map(mapAuthorizedProduct)
    return selectCashRegisterInventory(products, cashRegisterId, pendingProductQuantities(cashRegisterId))
  }
  let query = requireSupabase().from('cash_register_inventory')
    .select('cash_register_id,product_id,display_name,category_id,subcategory,price,stock_quantity,minimum_stock,active,updated_at,products(name,sku),product_categories(id,name,slug,active)')
    .eq('cash_register_id', cashRegisterId).order('product_id')
  if (activeOnly) query = query.eq('active', true)
  const { data, error } = await query
  if (error) {
    const cached = readCache<ScopedInventoryProduct>(`${PRODUCTS_CACHE_KEY}:${cashRegisterId}`)
    if (cached.length > 0) return selectCashRegisterInventory(cached.filter((product) => !activeOnly || product.active), cashRegisterId, pendingProductQuantities(cashRegisterId))
    throw new Error('No fue posible cargar los productos autorizados.')
  }
  const products = (data as unknown as ProductRow[]).map(mapProduct)
  writeCache(`${PRODUCTS_CACHE_KEY}:${cashRegisterId}`, products)
  return selectCashRegisterInventory(products, cashRegisterId, pendingProductQuantities(cashRegisterId))
}

export async function listInventoryMovements(cashRegisterId: string, limit = 200) {
  if (!cashRegisterId) return []
  const { data, error } = await requireSupabase().from('cash_register_stock_movements')
    .select('id,product_id,quantity_delta,movement_type,reason,actor_user_id,occurred_at,source_sale_id,reverses_movement_id,cash_register_inventory(display_name,products(name))')
    .eq('cash_register_id', cashRegisterId).order('occurred_at', { ascending: false }).limit(limit)
  if (error) {
    const cached = readCache<InventoryMovement>(`${MOVEMENTS_CACHE_KEY}:${cashRegisterId}`)
    if (cached.length > 0) return cached.slice(0, limit)
    throw new Error('No fue posible cargar el historial autorizado.')
  }
  const movements = (data as unknown as MovementRow[]).map((row): InventoryMovement => ({
    id: row.id, productId: row.product_id,
    productName: first(row.cash_register_inventory)?.display_name ?? first(first(row.cash_register_inventory)?.products ?? [])?.name ?? row.product_id,
    quantityDelta: row.quantity_delta, type: row.movement_type, reason: row.reason,
    actorUserId: row.actor_user_id, occurredAt: row.occurred_at,
    sourceSaleId: row.source_sale_id ?? undefined, reversesMovementId: row.reverses_movement_id ?? undefined,
  }))
  writeCache(`${MOVEMENTS_CACHE_KEY}:${cashRegisterId}`, movements)
  return movements
}

export async function saveInventoryProduct(cashRegisterId: string, draft: ProductDraft) {
  const { data, error } = await requireSupabase().rpc('save_cash_register_product', {
    p_cash_register_id: cashRegisterId,
    p_id: draft.id ?? null, p_name: draft.name.trim(), p_category_id: draft.categoryId,
    p_subcategory: draft.subcategory.trim(), p_price: draft.price, p_cost: draft.cost,
    p_minimum_stock: draft.minimumStock, p_sku: draft.sku?.trim() || null, p_active: draft.active,
  })
  if (error?.code === '23505') throw new Error('El SKU o identificador ya está en uso.')
  if (error) throw new Error(error.message || 'No fue posible guardar el producto.')
  notifyChanged()
  return data
}

export async function saveInventoryCategory(draft: CategoryDraft) {
  const { data, error } = await requireSupabase().rpc('save_inventory_category', {
    p_id: draft.id ?? null, p_name: draft.name.trim(), p_slug: draft.slug.trim(), p_active: draft.active,
  })
  if (error?.code === '23505') throw new Error('Ya existe una categoría con ese identificador.')
  if (error) throw new Error(error.message || 'No fue posible guardar la categoría.')
  notifyChanged()
  return data
}

export async function recordStockMovement(cashRegisterId: string, input: {
  productId: string; quantityDelta: number; type: 'opening' | 'entry' | 'adjustment'; reason: string
}) {
  const { data, error } = await requireSupabase().rpc('record_cash_register_stock_movement', {
    p_cash_register_id: cashRegisterId,
    p_product_id: input.productId, p_quantity_delta: input.quantityDelta,
    p_movement_type: input.type, p_reason: input.reason.trim(),
    p_idempotency_key: `inventory:${crypto.randomUUID()}`,
  })
  if (error) throw new Error(error.message || 'No fue posible registrar el movimiento.')
  notifyChanged()
  return data
}
