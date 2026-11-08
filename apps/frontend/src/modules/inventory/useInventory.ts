import { useCallback, useEffect, useRef, useState } from 'react'

import { INVENTORY_CHANGED_EVENT, listInventoryCategories, listInventoryMovements, listInventoryProducts } from './inventoryRepository'
import type { InventoryCategory, InventoryMovement, InventoryProduct } from './types'
import { SYNC_STATUS_EVENT } from '../../infrastructure/sync/outbox'

export function useInventory(cashRegisterId: string, includeHistory = true, includeCosts = true) {
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [loadedRegisterId, setLoadedRegisterId] = useState('')
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current
    if (!cashRegisterId) {
      setProducts([]); setMovements([]); setError(''); setLoading(false)
      return
    }
    setLoading(true)
    const results = await Promise.allSettled([
      listInventoryProducts(cashRegisterId, false, includeCosts),
      listInventoryCategories(),
      includeHistory ? listInventoryMovements(cashRegisterId) : Promise.resolve([]),
    ] as const)
    if (sequence !== requestSequence.current) return
    const [productsResult, categoriesResult, movementsResult] = results
    const errors: string[] = []

    if (productsResult.status === 'fulfilled') { setProducts(productsResult.value); setLoadedRegisterId(cashRegisterId) }
    else { setProducts([]); errors.push(productsResult.reason instanceof Error ? productsResult.reason.message : 'No fue posible cargar los productos.') }

    if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value)
    else errors.push(categoriesResult.reason instanceof Error ? categoriesResult.reason.message : 'No fue posible cargar las categorías.')

    if (movementsResult.status === 'fulfilled') setMovements(movementsResult.value)
    else { setMovements([]); errors.push(movementsResult.reason instanceof Error ? movementsResult.reason.message : 'No fue posible cargar el historial.') }

    setError(errors.join(' '))
    setLoading(false)
  }, [cashRegisterId, includeHistory, includeCosts])

  useEffect(() => {
    void refresh()
    window.addEventListener(INVENTORY_CHANGED_EVENT, refresh)
    window.addEventListener(SYNC_STATUS_EVENT, refresh)
    return () => {
      requestSequence.current += 1
      window.removeEventListener(INVENTORY_CHANGED_EVENT, refresh)
      window.removeEventListener(SYNC_STATUS_EVENT, refresh)
    }
  }, [refresh])
  return { products: loadedRegisterId === cashRegisterId ? products : [], categories,
    movements: loadedRegisterId === cashRegisterId ? movements : [], loading, error, refresh }
}
