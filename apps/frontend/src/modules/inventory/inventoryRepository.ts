import { requireSupabase } from '../../infrastructure/supabase/client'
import { pendingProductQuantities } from '../../infrastructure/sync/outbox'
import type { CategoryDraft, InventoryCategory, InventoryMovement, InventoryProduct, ProductDraft } from './types'

export const INVENTORY_CHANGED_EVENT = 'cafeteria:inventory-changed'
const PRODUCTS_CACHE_KEY = 'cafeteria:inventory-products:v1'
const CATEGORIES_CACHE_KEY = 'cafeteria:inventory-categories:v1'
const MOVEMENTS_CACHE_KEY = 'cafeteria:inventory-movements:v1'

interface CategoryRow { id: string; name: string; slug: string; active: boolean }
interface ProductRow {
  id: string; name: string; category_id: string; subcategory: string; price: number; cost: number
  stock_quantity: number; minimum_stock: number; sku: string | null; active: boolean; updated_at: string
  product_categories: CategoryRow | CategoryRow[]
}
interface MovementRow {
  id: string; product_id: string; quantity_delta: number; movement_type: InventoryMovement['type']; reason: string
  actor_user_id: string; occurred_at: string; source_sale_id: string | null; reverses_movement_id: string | null
  products: { name: string } | Array<{ name: string }>
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

function withPendingSales(products: InventoryProduct[]) {
  const pending = pendingProductQuantities()
  return products.map((product) => ({
    ...product,
    stockQuantity: Math.max(0, product.stockQuantity - (pending.get(product.id) ?? 0)),
  }))
}

function mapProduct(row: ProductRow): InventoryProduct {
  const category = first(row.product_categories)
  return {
    id: row.id, name: row.name, categoryId: row.category_id, categoryName: category?.name ?? 'General',
    categorySlug: category?.slug ?? 'general', subcategory: row.subcategory, price: row.price, cost: row.cost,
    stockQuantity: row.stock_quantity, minimumStock: row.minimum_stock, sku: row.sku ?? undefined,
    active: row.active, updatedAt: row.updated_at,
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

export async function listInventoryProducts(activeOnly = false) {
  let query = requireSupabase().from('products')
    .select('id,name,category_id,subcategory,price,cost,stock_quantity,minimum_stock,sku,active,updated_at,product_categories(id,name,slug,active)')
    .order('name')
  if (activeOnly) query = query.eq('active', true)
  const { data, error } = await query
  if (error) {
    const cached = readCache<InventoryProduct>(PRODUCTS_CACHE_KEY)
    if (cached.length > 0) return withPendingSales(cached.filter((product) => !activeOnly || product.active))
    throw new Error('No fue posible cargar los productos autorizados.')
  }
  const products = (data as unknown as ProductRow[]).map(mapProduct)
  writeCache(PRODUCTS_CACHE_KEY, products)
  return withPendingSales(products)
}

export async function listInventoryMovements(limit = 200) {
  const { data, error } = await requireSupabase().from('stock_movements')
    .select('id,product_id,quantity_delta,movement_type,reason,actor_user_id,occurred_at,source_sale_id,reverses_movement_id,products(name)')
    .order('occurred_at', { ascending: false }).limit(limit)
  if (error) {
    const cached = readCache<InventoryMovement>(MOVEMENTS_CACHE_KEY)
    if (cached.length > 0) return cached.slice(0, limit)
    throw new Error('No fue posible cargar el historial autorizado.')
  }
  const movements = (data as unknown as MovementRow[]).map((row): InventoryMovement => ({
    id: row.id, productId: row.product_id, productName: first(row.products)?.name ?? row.product_id,
    quantityDelta: row.quantity_delta, type: row.movement_type, reason: row.reason,
    actorUserId: row.actor_user_id, occurredAt: row.occurred_at,
    sourceSaleId: row.source_sale_id ?? undefined, reversesMovementId: row.reverses_movement_id ?? undefined,
  }))
  writeCache(MOVEMENTS_CACHE_KEY, movements)
  return movements
}

export async function saveInventoryProduct(draft: ProductDraft) {
  const { data, error } = await requireSupabase().rpc('save_inventory_product', {
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

export async function recordStockMovement(input: {
  productId: string; quantityDelta: number; type: 'opening' | 'entry' | 'adjustment'; reason: string
}) {
  const { data, error } = await requireSupabase().rpc('record_stock_movement', {
    p_product_id: input.productId, p_quantity_delta: input.quantityDelta,
    p_movement_type: input.type, p_reason: input.reason.trim(),
    p_idempotency_key: `inventory:${crypto.randomUUID()}`,
  })
  if (error) throw new Error(error.message || 'No fue posible registrar el movimiento.')
  notifyChanged()
  return data
}
