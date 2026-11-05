export const OUTBOX_KEY = 'cafeteria:sync-outbox:v1'

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

export type OutboxStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readPendingSales(storage: OutboxStorage | null): PendingSaleOperation[] {
  if (!storage) return []
  const raw = storage.getItem(OUTBOX_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PendingSaleOperation[] : []
  } catch {
    storage.setItem(`${OUTBOX_KEY}:recovery`, raw)
    return []
  }
}

export function writePendingSales(storage: OutboxStorage | null, operations: PendingSaleOperation[]) {
  if (storage) storage.setItem(OUTBOX_KEY, JSON.stringify(operations))
}

export function enqueuePendingSale(storage: OutboxStorage | null, operation: PendingSaleOperation) {
  const pending = readPendingSales(storage)
  if (pending.some((item) => item.idempotencyKey === operation.idempotencyKey)) return false
  writePendingSales(storage, [...pending, operation])
  return true
}

export function pendingProductQuantities(storage: OutboxStorage | null) {
  const quantities = new Map<string, number>()
  for (const operation of readPendingSales(storage)) {
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
