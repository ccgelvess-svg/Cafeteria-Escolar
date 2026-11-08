export const OUTBOX_KEY = 'cafeteria:sync-outbox:v1'
const OUTBOX_RECOVERY_KEY = `${OUTBOX_KEY}:recovery`

export interface PendingSaleItem {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
}

export type PendingSaleOperation = {
  id: string
  kind: 'cash-sale' | 'student-sale'
  saleId: string
  idempotencyKey: string
  cashRegisterId?: string
  totalAmount: number
  items: PendingSaleItem[]
  studentId?: string
  deviceId?: string
  createdAt: string
  attempts: number
  lastError?: string
}

export type OutboxStorage = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>

export const LEGACY_PENDING_SALE_ERROR = 'Venta pendiente anterior sin caja asignada. Requiere revisión manual antes de sincronizar.'

export function pendingSaleValidationError(operation: PendingSaleOperation) {
  return operation.cashRegisterId ? null : LEGACY_PENDING_SALE_ERROR
}

function parsePendingSales(raw: string | null) {
  if (!raw) return { valid: true, operations: [] as PendingSaleOperation[] }
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? { valid: true, operations: parsed as PendingSaleOperation[] }
      : { valid: false, operations: [] as PendingSaleOperation[] }
  } catch { return { valid: false, operations: [] as PendingSaleOperation[] } }
}

function uniquePendingSales(operations: PendingSaleOperation[]) {
  const seen = new Set<string>()
  return operations.filter((operation) => {
    const key = operation.idempotencyKey || operation.id
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function readPendingSales(storage: OutboxStorage | null): PendingSaleOperation[] {
  if (!storage) return []
  const raw = storage.getItem(OUTBOX_KEY)
  const primary = parsePendingSales(raw)
  if (!primary.valid && raw && !storage.getItem(OUTBOX_RECOVERY_KEY)) {
    storage.setItem(OUTBOX_RECOVERY_KEY, raw)
  }
  const recovery = parsePendingSales(storage.getItem(OUTBOX_RECOVERY_KEY))
  return uniquePendingSales([
    ...(primary.valid ? primary.operations : []),
    ...(recovery.valid ? recovery.operations : []),
  ])
}

export function writePendingSales(storage: OutboxStorage | null, operations: PendingSaleOperation[]) {
  if (!storage) return
  const unique = uniquePendingSales(operations)
  storage.setItem(OUTBOX_KEY, JSON.stringify(unique))

  const recoveryRaw = storage.getItem(OUTBOX_RECOVERY_KEY)
  const recovery = parsePendingSales(recoveryRaw)
  if (!recoveryRaw || !recovery.valid) return
  const recoveryKeys = new Set(recovery.operations.map((operation) => operation.idempotencyKey || operation.id))
  const stillPending = unique.filter((operation) => recoveryKeys.has(operation.idempotencyKey || operation.id))
  if (stillPending.length > 0) storage.setItem(OUTBOX_RECOVERY_KEY, JSON.stringify(stillPending))
  else storage.removeItem?.(OUTBOX_RECOVERY_KEY)
}

export function enqueuePendingSale(storage: OutboxStorage | null, operation: PendingSaleOperation) {
  const pending = readPendingSales(storage)
  if (pending.some((item) => item.id === operation.id || item.idempotencyKey === operation.idempotencyKey)) return false
  writePendingSales(storage, [...pending, operation])
  return true
}

export function pendingProductQuantities(storage: OutboxStorage | null, cashRegisterId: string) {
  const quantities = new Map<string, number>()
  for (const operation of readPendingSales(storage)) {
    if (operation.cashRegisterId !== cashRegisterId) continue
    for (const item of operation.items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
    }
  }
  return quantities
}

export async function drainPendingSales(
  storage: OutboxStorage | null,
  send: (operation: PendingSaleOperation) => Promise<void>,
) {
  let synced = 0
  let failed = 0
  for (const operation of readPendingSales(storage)) {
    try {
      await send(operation)
      writePendingSales(storage, readPendingSales(storage).filter((item) => item.id !== operation.id))
      synced += 1
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Error de sincronización'
      writePendingSales(storage, readPendingSales(storage).map((item) => item.id === operation.id
        ? { ...item, attempts: item.attempts + 1, lastError: message }
        : item))
      failed += 1
    }
  }
  return { synced, failed, pending: readPendingSales(storage).length }
}
