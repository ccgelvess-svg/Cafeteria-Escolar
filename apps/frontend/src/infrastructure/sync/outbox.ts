import { requireSupabase } from '../supabase/client'
import { getOutboxPersistence } from '../storage/offlineDatabase'
import {
  pendingSaleValidationError,
  type OutboxStorage,
  type PendingSaleOperation,
} from './outboxState'
import { drainPersistentSales, listPersistentSales, persistentProductQuantities } from './persistentOutbox'

export type { PendingSaleItem, PendingSaleOperation } from './outboxState'

export const SYNC_STATUS_EVENT = 'cafeteria:sync-status-changed'

const LAST_SYNC_KEY = 'cafeteria:last-sync-at:v1'
const SYNC_LEASE_KEY = 'cafeteria:sync-lock:v1'
const SYNC_LEASE_MS = 60_000
const persistence = getOutboxPersistence()

function browserStorage(): OutboxStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

function emitChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SYNC_STATUS_EVENT))
}

export function readPendingSales(storage: OutboxStorage | null = browserStorage()) {
  return listPersistentSales(persistence, storage)
}

export async function enqueuePendingSale(operation: PendingSaleOperation) {
  const validationError = pendingSaleValidationError(operation)
  if (validationError) throw new Error(validationError)
  if (!operation.id || !operation.idempotencyKey) throw new Error('La venta offline requiere identificadores idempotentes.')
  const added = await persistence.add(operation)
  if (added) emitChanged()
  return added
}

export async function pendingProductQuantities(cashRegisterId: string, storage: OutboxStorage | null = browserStorage()) {
  return persistentProductQuantities(await readPendingSales(storage), cashRegisterId)
}

export function getLastSyncAt(storage: OutboxStorage | null = browserStorage()) {
  return storage?.getItem(LAST_SYNC_KEY) ?? null
}

let syncInFlight: Promise<void> | null = null

async function withFallbackLease(task: () => Promise<void>) {
  const storage = browserStorage()
  if (!storage) return task()
  const token = crypto.randomUUID()
  const now = Date.now()
  try {
    const current = JSON.parse(storage.getItem(SYNC_LEASE_KEY) ?? 'null') as { token?: string; expiresAt?: number } | null
    if (current?.expiresAt && current.expiresAt > now) return
  } catch { /* an invalid expired lease can be replaced */ }
  storage.setItem(SYNC_LEASE_KEY, JSON.stringify({ token, expiresAt: now + SYNC_LEASE_MS }))
  try {
    const acquired = JSON.parse(storage.getItem(SYNC_LEASE_KEY) ?? 'null') as { token?: string } | null
    if (acquired?.token !== token) return
    await task()
  } finally {
    try {
      const current = JSON.parse(storage.getItem(SYNC_LEASE_KEY) ?? 'null') as { token?: string } | null
      if (current?.token === token) storage.removeItem?.(SYNC_LEASE_KEY)
    } catch { /* the lease expires automatically */ }
  }
}

async function withCrossTabSyncLock(task: () => Promise<void>) {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request('cafeteria-sales-sync', { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (lock) await task()
    })
    return
  }
  await withFallbackLease(task)
}

async function send(operation: PendingSaleOperation) {
  const validationError = pendingSaleValidationError(operation)
  if (validationError) throw new Error(validationError)
  let request: { rpc: string; params: Record<string, unknown> }
  switch (operation.kind) {
    case 'cash-sale':
      request = { rpc: 'record_cash_sale', params: {
        p_sale_id: operation.saleId,
        p_total_amount: operation.totalAmount,
        p_items: operation.items,
        p_idempotency_key: operation.idempotencyKey,
        p_cash_register_id: operation.cashRegisterId,
      } }
      break
    case 'student-sale':
      request = { rpc: 'record_student_sale', params: {
        p_sale_id: operation.saleId,
        p_student_id: operation.studentId,
        p_total_amount: operation.totalAmount,
        p_items: operation.items,
        p_device_id: operation.deviceId,
        p_idempotency_key: operation.idempotencyKey,
        p_cash_register_id: operation.cashRegisterId,
      } }
      break
    case 'teacher-sale':
      request = { rpc: 'record_teacher_sale', params: {
        p_sale_id: operation.saleId,
        p_teacher_id: operation.teacherId,
        p_total_amount: operation.totalAmount,
        p_items: operation.items,
        p_device_id: operation.deviceId,
        p_idempotency_key: operation.idempotencyKey,
        p_cash_register_id: operation.cashRegisterId,
      } }
      break
    case 'student-movement':
      request = { rpc: 'record_student_movement_by_register', params: {
        p_student_id: operation.studentId,
        p_type: operation.movementType,
        p_value: operation.value,
        p_detail: operation.detail,
        p_device_id: operation.deviceId,
        p_idempotency_key: operation.idempotencyKey,
        p_cash_register_id: operation.cashRegisterId,
      } }
      break
    case 'teacher-movement':
      request = { rpc: 'record_teacher_movement', params: {
        p_teacher_id: operation.teacherId,
        p_type: operation.movementType,
        p_value: operation.value,
        p_detail: operation.detail,
        p_device_id: operation.deviceId,
        p_idempotency_key: operation.idempotencyKey,
        p_cash_register_id: operation.cashRegisterId,
      } }
      break
    default: {
      const exhaustive: never = operation
      throw new Error(`Tipo de venta pendiente desconocido: ${String(exhaustive)}`)
    }
  }
  const { error } = await requireSupabase().rpc(request.rpc, request.params)
  if (error) throw new Error(error.message || 'No fue posible sincronizar la venta.')
}

export function syncPendingSales() {
  if (syncInFlight) return syncInFlight
  syncInFlight = withCrossTabSyncLock(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const result = await drainPersistentSales(persistence, browserStorage(), send)
    emitChanged()
    if (result.pending === 0) {
      browserStorage()?.setItem(LAST_SYNC_KEY, new Date().toISOString())
      emitChanged()
    }
  }).finally(() => { syncInFlight = null })
  return syncInFlight
}

export function isConnectivityError(cause: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const message = cause instanceof Error ? cause.message : String(cause)
  return /failed to fetch|network|load failed|fetch failed|offline/i.test(message)
}
