import assert from 'node:assert/strict'
import test from 'node:test'

import type { OutboxPersistence } from '../storage/offlineDatabase.ts'
import {
  drainPersistentSales,
  migrateLegacyPendingSales,
  persistentProductQuantities,
} from './persistentOutbox.ts'
import { enqueuePendingSale, OUTBOX_KEY, type PendingSaleOperation } from './outboxState.ts'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

class MemoryOutbox implements OutboxPersistence {
  operations = new Map<string, PendingSaleOperation>()
  async list() { return [...this.operations.values()] }
  async add(operation: PendingSaleOperation) {
    if ([...this.operations.values()].some((item) => item.id === operation.id || item.idempotencyKey === operation.idempotencyKey)) return false
    this.operations.set(operation.id, structuredClone(operation))
    return true
  }
  async recordFailure(id: string, message: string) {
    const operation = this.operations.get(id)
    if (operation) this.operations.set(id, { ...operation, attempts: operation.attempts + 1, lastError: message })
  }
  async removeConfirmed(id: string) { this.operations.delete(id) }
}

function sale(overrides: Partial<PendingSaleOperation> = {}): PendingSaleOperation {
  return {
    id: 'operation-1', kind: 'cash-sale', saleId: 'sale-1', idempotencyKey: 'cash:device:1',
    cashRegisterId: 'register-1', totalAmount: 1600,
    items: [{ productId: 'agua', productName: 'Agua', unitPrice: 800, quantity: 2 }],
    createdAt: '2026-11-18T12:00:00.000Z', attempts: 0, ...overrides,
  } as PendingSaleOperation
}

test('migra localStorage a la outbox transaccional sin borrar el respaldo ni duplicar idempotencia', async () => {
  const legacy = new MemoryStorage()
  const database = new MemoryOutbox()
  enqueuePendingSale(legacy, sale())

  assert.deepEqual(await migrateLegacyPendingSales(database, legacy), { found: 1, migrated: 1 })
  assert.deepEqual(await migrateLegacyPendingSales(database, legacy), { found: 1, migrated: 0 })
  assert.equal((await database.list()).length, 1)
  assert.notEqual(legacy.getItem(OUTBOX_KEY), '[]')
})

test('nunca elimina una venta si el servidor no la confirma', async () => {
  const legacy = new MemoryStorage()
  const database = new MemoryOutbox()
  await database.add(sale())

  const result = await drainPersistentSales(database, legacy, async () => { throw new Error('sin confirmación') })

  assert.deepEqual(result, { synced: 0, failed: 1, pending: 1 })
  assert.equal((await database.list())[0]?.attempts, 1)
  assert.equal((await database.list())[0]?.lastError, 'sin confirmación')
})

test('elimina IndexedDB y legado únicamente después de confirmación y conserva aislamiento por caja', async () => {
  const legacy = new MemoryStorage()
  const database = new MemoryOutbox()
  const first = sale()
  const second = sale({ id: 'operation-2', saleId: 'sale-2', idempotencyKey: 'cash:device:2', cashRegisterId: 'register-2' })
  enqueuePendingSale(legacy, first)
  await database.add(second)
  await migrateLegacyPendingSales(database, legacy)

  const reserved = persistentProductQuantities(await database.list(), 'register-1')
  assert.equal(reserved.get('agua'), 2)
  assert.equal(persistentProductQuantities(await database.list(), 'register-2').get('agua'), 2)

  const result = await drainPersistentSales(database, legacy, async () => undefined)
  assert.deepEqual(result, { synced: 2, failed: 0, pending: 0 })
  assert.equal(legacy.getItem(OUTBOX_KEY), '[]')
})

test('sincroniza un abono una sola vez y conserva su clave idempotente', async () => {
  const legacy = new MemoryStorage()
  const database = new MemoryOutbox()
  const payment: PendingSaleOperation = {
    id: 'movement-1', kind: 'student-movement', studentId: 'student-1',
    cashRegisterId: 'register-1',
    movementType: 'debt-payment', value: 5000, detail: 'Abono offline',
    deviceId: 'device-1', idempotencyKey: 'student-payment:device:1',
    createdAt: '2026-11-18T14:00:00.000Z', attempts: 0,
  }
  await database.add(payment)
  await database.add({ ...payment, id: 'movement-duplicate' })
  const sent: PendingSaleOperation[] = []

  const result = await drainPersistentSales(database, legacy, async (operation) => { sent.push(operation) })

  assert.deepEqual(result, { synced: 1, failed: 0, pending: 0 })
  assert.equal(sent[0]?.idempotencyKey, payment.idempotencyKey)
})

test('conserva abonos del mismo estudiante como operaciones independientes por caja', async () => {
  const legacy = new MemoryStorage()
  const database = new MemoryOutbox()
  const base: PendingSaleOperation = {
    id: 'movement-register-1', kind: 'student-movement', studentId: 'student-1',
    cashRegisterId: 'register-1', movementType: 'debt-payment', value: 3000,
    detail: 'Abono caja 1', deviceId: 'device-1', idempotencyKey: 'payment:register-1',
    createdAt: '2026-11-19T12:00:00.000Z', attempts: 0,
  }
  await database.add(base)
  await database.add({ ...base, id: 'movement-register-2', cashRegisterId: 'register-2', idempotencyKey: 'payment:register-2', detail: 'Abono caja 2' })
  await database.add({ ...base, id: 'duplicate' })
  const sent: PendingSaleOperation[] = []

  const result = await drainPersistentSales(database, legacy, async (operation) => { sent.push(operation) })

  assert.deepEqual(result, { synced: 2, failed: 0, pending: 0 })
  assert.deepEqual(sent.map((operation) => operation.cashRegisterId).sort(), ['register-1', 'register-2'])
})
