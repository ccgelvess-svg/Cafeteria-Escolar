import type { PendingSaleOperation } from '../sync/outboxState'

const DATABASE_NAME = 'cafeteria-escolar-offline'
const DATABASE_VERSION = 1
const OUTBOX_STORE = 'sales-outbox'
const SNAPSHOT_STORE = 'register-snapshots'
const IDEMPOTENCY_INDEX = 'idempotency-key'
const MAX_OPERATION_BYTES = 256 * 1024
const MAX_OUTBOX_BYTES = 5 * 1024 * 1024
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024

interface SnapshotRecord {
  key: string
  value: unknown
  updatedAt: string
  byteSize: number
}

export interface OutboxPersistence {
  list(): Promise<PendingSaleOperation[]>
  add(operation: PendingSaleOperation): Promise<boolean>
  recordFailure(id: string, message: string): Promise<void>
  removeConfirmed(id: string): Promise<void>
}

function serializedBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

function quotaError() {
  return new Error('El almacenamiento offline está lleno. Conecta el equipo para sincronizar las ventas pendientes.')
}

function normalizeStorageError(cause: unknown): never {
  if (cause instanceof DOMException && (cause.name === 'QuotaExceededError' || cause.name === 'UnknownError')) {
    throw quotaError()
  }
  throw cause
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true })
    transaction.addEventListener('error', () => reject(transaction.error), { once: true })
  })
}

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase() {
  if (databasePromise) return databasePromise
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB no está disponible en este dispositivo.'))
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = database.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
        outbox.createIndex(IDEMPOTENCY_INDEX, 'idempotencyKey', { unique: true })
      }
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'key' })
      }
    })
    request.addEventListener('success', () => {
      const database = request.result
      database.addEventListener('versionchange', () => database.close())
      resolve(database)
    }, { once: true })
    request.addEventListener('error', () => {
      databasePromise = null
      reject(request.error)
    }, { once: true })
    request.addEventListener('blocked', () => {
      databasePromise = null
      reject(new Error('Otra pestaña impide actualizar el almacenamiento offline.'))
    }, { once: true })
  })
  return databasePromise
}

async function checkBrowserQuota(additionalBytes: number) {
  const estimate = await navigator.storage?.estimate?.()
  if (estimate?.quota && estimate.usage && estimate.usage + additionalBytes > estimate.quota * 0.95) throw quotaError()
}

class IndexedDbOutbox implements OutboxPersistence {
  async list() {
    const database = await openDatabase()
    const transaction = database.transaction(OUTBOX_STORE, 'readonly')
    const operations = await requestResult(transaction.objectStore(OUTBOX_STORE).getAll()) as PendingSaleOperation[]
    await transactionDone(transaction)
    return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async add(operation: PendingSaleOperation) {
    const operationBytes = serializedBytes(operation)
    if (operationBytes > MAX_OPERATION_BYTES) throw new Error('La venta excede el tamaño máximo permitido para almacenamiento offline.')
    await checkBrowserQuota(operationBytes)
    const database = await openDatabase()
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite')
    try {
      const store = transaction.objectStore(OUTBOX_STORE)
      const existingId = await requestResult(store.get(operation.id))
      const existingKey = await requestResult(store.index(IDEMPOTENCY_INDEX).get(operation.idempotencyKey))
      if (existingId || existingKey) {
        transaction.abort()
        try { await transactionDone(transaction) } catch { /* duplicate: no changes */ }
        return false
      }
      const pending = await requestResult(store.getAll()) as PendingSaleOperation[]
      const totalBytes = pending.reduce((total, item) => total + serializedBytes(item), operationBytes)
      if (totalBytes > MAX_OUTBOX_BYTES) {
        transaction.abort()
        try { await transactionDone(transaction) } catch { /* quota guard */ }
        throw quotaError()
      }
      store.add(operation)
      await transactionDone(transaction)
      return true
    } catch (cause) {
      try { transaction.abort() } catch { /* transaction already completed or aborted */ }
      return normalizeStorageError(cause)
    }
  }

  async recordFailure(id: string, message: string) {
    const database = await openDatabase()
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite')
    try {
      const store = transaction.objectStore(OUTBOX_STORE)
      const operation = await requestResult(store.get(id)) as PendingSaleOperation | undefined
      if (operation) store.put({ ...operation, attempts: operation.attempts + 1, lastError: message })
      await transactionDone(transaction)
    } catch (cause) { return normalizeStorageError(cause) }
  }

  async removeConfirmed(id: string) {
    const database = await openDatabase()
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite')
    transaction.objectStore(OUTBOX_STORE).delete(id)
    try { await transactionDone(transaction) } catch (cause) { return normalizeStorageError(cause) }
  }
}

const browserOutbox = new IndexedDbOutbox()
export function getOutboxPersistence(): OutboxPersistence { return browserOutbox }

export async function readOfflineSnapshot<T>(key: string): Promise<T | null> {
  try {
    const database = await openDatabase()
    const transaction = database.transaction(SNAPSHOT_STORE, 'readonly')
    const record = await requestResult(transaction.objectStore(SNAPSHOT_STORE).get(key)) as SnapshotRecord | undefined
    await transactionDone(transaction)
    return record?.value as T ?? null
  } catch { return null }
}

export async function writeOfflineSnapshot(key: string, value: unknown) {
  const byteSize = serializedBytes(value)
  if (byteSize > MAX_SNAPSHOT_BYTES) throw new Error('Los datos de esta caja exceden el tamaño máximo de caché offline.')
  await checkBrowserQuota(byteSize)
  const database = await openDatabase()
  const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite')
  transaction.objectStore(SNAPSHOT_STORE).put({ key, value, byteSize, updatedAt: new Date().toISOString() } satisfies SnapshotRecord)
  try { await transactionDone(transaction) } catch (cause) { return normalizeStorageError(cause) }
}
