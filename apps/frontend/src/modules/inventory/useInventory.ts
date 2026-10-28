import { useCallback, useEffect, useState } from 'react'

import { INVENTORY_CHANGED_EVENT, listInventoryCategories, listInventoryMovements, listInventoryProducts } from './inventoryRepository'
import type { InventoryCategory, InventoryMovement, InventoryProduct } from './types'
import { SYNC_STATUS_EVENT } from '../../infrastructure/sync/outbox'

export function useInventory(includeHistory = true) {
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      listInventoryProducts(),
      listInventoryCategories(),
      includeHistory ? listInventoryMovements() : Promise.resolve([]),
    ] as const)
    const [productsResult, categoriesResult, movementsResult] = results
    const errors: string[] = []

    if (productsResult.status === 'fulfilled') setProducts(productsResult.value)
    else errors.push(productsResult.reason instanceof Error ? productsResult.reason.message : 'No fue posible cargar los productos.')

    if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value)
    else errors.push(categoriesResult.reason instanceof Error ? categoriesResult.reason.message : 'No fue posible cargar las categorías.')

    if (movementsResult.status === 'fulfilled') setMovements(movementsResult.value)
    else errors.push(movementsResult.reason instanceof Error ? movementsResult.reason.message : 'No fue posible cargar el historial.')

    setError(errors.join(' '))
    setLoading(false)
  }, [includeHistory])

  useEffect(() => {
    void refresh()
    window.addEventListener(INVENTORY_CHANGED_EVENT, refresh)
    window.addEventListener(SYNC_STATUS_EVENT, refresh)
    return () => {
      window.removeEventListener(INVENTORY_CHANGED_EVENT, refresh)
      window.removeEventListener(SYNC_STATUS_EVENT, refresh)
    }
  }, [refresh])
  return { products, categories, movements, loading, error, refresh }
}
