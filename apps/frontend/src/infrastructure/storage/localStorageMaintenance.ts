const PRODUCTS_CACHE_PREFIX = 'cafeteria:inventory-products:v2:'
const MOVEMENTS_CACHE_PREFIX = 'cafeteria:inventory-movements:v2:'
const INVENTORY_CACHE_REGISTRY_KEY = 'cafeteria:inventory-cache-registers:v1'
const MAX_CACHED_REGISTERS = 4

type LocalCacheStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function storedKeys(storage: LocalCacheStorage) {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key))
}

function readRegistry(storage: LocalCacheStorage) {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INVENTORY_CACHE_REGISTRY_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch { return [] }
}

function removeRegisterCaches(storage: LocalCacheStorage, cashRegisterId: string) {
  storage.removeItem(`${PRODUCTS_CACHE_PREFIX}${cashRegisterId}`)
  storage.removeItem(`${MOVEMENTS_CACHE_PREFIX}${cashRegisterId}`)
}

export function cleanupObsoleteLocalCaches(storage: LocalCacheStorage | null = typeof window === 'undefined' ? null : window.localStorage) {
  if (!storage) return
  const obsolete = [
    /^cafeteria:inventory-products:v(?!2:)/,
    /^cafeteria:inventory-movements:v(?!2:)/,
    /^cafeteria:inventory-categories:v(?!1$)/,
    /^cafeteria:cash-registers:v(?!1$)/,
  ]
  for (const key of storedKeys(storage)) {
    if (obsolete.some((pattern) => pattern.test(key))) storage.removeItem(key)
  }

  const discovered = storedKeys(storage).flatMap((key) => {
    if (key.startsWith(PRODUCTS_CACHE_PREFIX)) return [key.slice(PRODUCTS_CACHE_PREFIX.length)]
    if (key.startsWith(MOVEMENTS_CACHE_PREFIX)) return [key.slice(MOVEMENTS_CACHE_PREFIX.length)]
    return []
  })
  const known = [...new Set([...readRegistry(storage), ...discovered])]
  const retained = known.slice(-MAX_CACHED_REGISTERS)
  for (const cashRegisterId of known.slice(0, -MAX_CACHED_REGISTERS)) removeRegisterCaches(storage, cashRegisterId)
  storage.setItem(INVENTORY_CACHE_REGISTRY_KEY, JSON.stringify(retained))
}

export function rememberInventoryCacheRegister(cashRegisterId: string,
  storage: LocalCacheStorage | null = typeof window === 'undefined' ? null : window.localStorage) {
  if (!storage || !cashRegisterId) return
  const ordered = [...new Set([...readRegistry(storage).filter((id) => id !== cashRegisterId), cashRegisterId])]
  const retained = ordered.slice(-MAX_CACHED_REGISTERS)
  for (const evicted of ordered.slice(0, -MAX_CACHED_REGISTERS)) removeRegisterCaches(storage, evicted)
  storage.setItem(INVENTORY_CACHE_REGISTRY_KEY, JSON.stringify(retained))
}
