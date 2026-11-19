import type { OutboxPersistence } from '../storage/offlineDatabase.ts'
import {
  pendingSaleValidationError,
  readPendingSales as readLegacyPendingSales,
  writePendingSales as writeLegacyPendingSales,
  type OutboxStorage,
  type PendingSaleOperation,
} from './outboxState.ts'

export async function migrateLegacyPendingSales(
  persistence: OutboxPersistence,
  legacyStorage: OutboxStorage | null,
) {
  const legacy = readLegacyPendingSales(legacyStorage)
  let migrated = 0
  for (const operation of legacy) {
    if (await persistence.add(operation)) migrated += 1
  }
  return { found: legacy.length, migrated }
}

export async function listPersistentSales(
  persistence: OutboxPersistence,
  legacyStorage: OutboxStorage | null,
) {
  await migrateLegacyPendingSales(persistence, legacyStorage)
  return persistence.list()
}

function removeConfirmedLegacySale(storage: OutboxStorage | null, operation: PendingSaleOperation) {
  const pending = readLegacyPendingSales(storage).filter((item) => (
    item.id !== operation.id && item.idempotencyKey !== operation.idempotencyKey
  ))
  writeLegacyPendingSales(storage, pending)
}

export async function drainPersistentSales(
  persistence: OutboxPersistence,
  legacyStorage: OutboxStorage | null,
  send: (operation: PendingSaleOperation) => Promise<void>,
) {
  let synced = 0
  let failed = 0
  const operations = await listPersistentSales(persistence, legacyStorage)
  for (const operation of operations) {
    const validationError = pendingSaleValidationError(operation)
    if (validationError) {
      await persistence.recordFailure(operation.id, validationError)
      failed += 1
      continue
    }
    try {
      await send(operation)
      // A sale is removed only after its RPC resolves without an error.
      await persistence.removeConfirmed(operation.id)
      removeConfirmedLegacySale(legacyStorage, operation)
      synced += 1
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Error de sincronización'
      await persistence.recordFailure(operation.id, message)
      failed += 1
    }
  }
  return { synced, failed, pending: (await persistence.list()).length }
}

export function persistentProductQuantities(operations: PendingSaleOperation[], cashRegisterId: string) {
  const quantities = new Map<string, number>()
  for (const operation of operations) {
    if (operation.cashRegisterId !== cashRegisterId) continue
    for (const item of operation.items ?? []) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
    }
  }
  return quantities
}
