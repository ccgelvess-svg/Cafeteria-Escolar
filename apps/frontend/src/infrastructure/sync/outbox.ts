import { requireSupabase } from '../supabase/client'
import {
  drainPendingSales,
  enqueuePendingSale as enqueueStoredSale,
  pendingProductQuantities as storedProductQuantities,
  readPendingSales as readStoredSales,
  type OutboxStorage,
  type PendingSaleOperation,
} from './outboxState'

export type { PendingSaleItem, PendingSaleOperation } from './outboxState'

export const SYNC_STATUS_EVENT = 'cafeteria:sync-status-changed'

const LAST_SYNC_KEY = 'cafeteria:last-sync-at:v1'

function browserStorage(): OutboxStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

function emitChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SYNC_STATUS_EVENT))
}

export function readPendingSales(storage: OutboxStorage | null = browserStorage()) {
  return readStoredSales(storage)
}

export function enqueuePendingSale(operation: PendingSaleOperation, storage: OutboxStorage | null = browserStorage()) {
  const added = enqueueStoredSale(storage, operation)
  if (added) emitChanged()
  return added
}

export function pendingProductQuantities(storage: OutboxStorage | null = browserStorage()) {
  return storedProductQuantities(storage)
}

export function getLastSyncAt(storage: OutboxStorage | null = browserStorage()) {
  return storage?.getItem(LAST_SYNC_KEY) ?? null
}

let syncInFlight: Promise<void> | null = null

async function send(operation: PendingSaleOperation) {
  const rpc = operation.kind === 'cash-sale' ? 'record_cash_sale' : 'record_student_sale'
  const params = operation.kind === 'cash-sale'
    ? {
        p_sale_id: operation.saleId,
        p_total_amount: operation.totalAmount,
        p_items: operation.items,
        p_idempotency_key: operation.idempotencyKey,
      }
    : {
        p_sale_id: operation.saleId,
        p_student_id: operation.studentId,
        p_total_amount: operation.totalAmount,
        p_items: operation.items,
        p_device_id: operation.deviceId,
        p_idempotency_key: operation.idempotencyKey,
      }
  const { error } = await requireSupabase().rpc(rpc, params)
  if (error) throw new Error(error.message || 'No fue posible sincronizar la venta.')
}

export function syncPendingSales() {
  if (syncInFlight) return syncInFlight
  syncInFlight = (async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const result = await drainPendingSales(browserStorage(), send)
    emitChanged()
    if (result.pending === 0) {
      browserStorage()?.setItem(LAST_SYNC_KEY, new Date().toISOString())
      emitChanged()
    }
  })().finally(() => { syncInFlight = null })
  return syncInFlight
}

export function isConnectivityError(cause: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const message = cause instanceof Error ? cause.message : String(cause)
  return /failed to fetch|network|load failed|fetch failed|offline/i.test(message)
}
