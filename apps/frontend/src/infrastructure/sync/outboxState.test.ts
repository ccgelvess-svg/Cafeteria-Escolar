import assert from 'node:assert/strict'
import test from 'node:test'

import {
  drainPendingSales,
  enqueuePendingSale,
  OUTBOX_KEY,
  pendingProductQuantities,
  readPendingSales,
  type PendingSaleOperation,
} from './outboxState.ts'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  snapshot() { return new Map(this.values) }
  restore(values: Map<string, string>) { this.values = new Map(values) }
}

function sale(overrides: Partial<PendingSaleOperation> = {}): PendingSaleOperation {
  return {
    id: 'operation-1', kind: 'cash-sale', saleId: 'sale-1', idempotencyKey: 'cash:device:1',
    totalAmount: 1600, items: [{ productId: 'agua-bolsa', productName: 'Agua bolsa', unitPrice: 800, quantity: 2 }],
    createdAt: '2026-10-13T12:00:00.000Z', attempts: 0, ...overrides,
  }
}

test('la venta offline persiste entre recargas y conserva sus datos', () => {
  const storage = new MemoryStorage()
  assert.equal(enqueuePendingSale(storage, sale()), true)
  const reloaded = new MemoryStorage()
  reloaded.restore(storage.snapshot())
  assert.deepEqual(readPendingSales(reloaded), [sale()])
})

test('la clave idempotente evita encolar la misma venta dos veces', () => {
  const storage = new MemoryStorage()
  assert.equal(enqueuePendingSale(storage, sale()), true)
  assert.equal(enqueuePendingSale(storage, sale({ id: 'operation-2', saleId: 'sale-2' })), false)
  assert.equal(readPendingSales(storage).length, 1)
})

test('al reconectar elimina solo ventas confirmadas y conserva fallos para reintento', async () => {
  const storage = new MemoryStorage()
  enqueuePendingSale(storage, sale())
  enqueuePendingSale(storage, sale({ id: 'operation-2', saleId: 'sale-2', idempotencyKey: 'cash:device:2' }))

  const firstSync = await drainPendingSales(storage, async (operation) => {
    if (operation.id === 'operation-2') throw new Error('red temporalmente no disponible')
  })
  assert.deepEqual(firstSync, { synced: 1, failed: 1, pending: 1 })
  assert.equal(readPendingSales(storage)[0]?.attempts, 1)

  const retry = await drainPendingSales(storage, async () => undefined)
  assert.deepEqual(retry, { synced: 1, failed: 0, pending: 0 })
  assert.equal(storage.getItem(OUTBOX_KEY), '[]')
})

test('el stock reservado incluye todas las ventas aún pendientes', () => {
  const storage = new MemoryStorage()
  enqueuePendingSale(storage, sale())
  enqueuePendingSale(storage, sale({
    id: 'operation-2', saleId: 'sale-2', idempotencyKey: 'cash:device:2',
    items: [{ productId: 'agua-bolsa', productName: 'Agua bolsa', unitPrice: 800, quantity: 3 }],
  }))
  assert.equal(pendingProductQuantities(storage).get('agua-bolsa'), 5)
})

test('el consumo estudiantil offline conserva cuenta, dispositivo e idempotencia al sincronizar', async () => {
  const storage = new MemoryStorage()
  const studentSale = sale({
    kind: 'student-sale', studentId: 'student-1', deviceId: 'device-1',
    idempotencyKey: 'student:device-1:1',
  })
  enqueuePendingSale(storage, studentSale)
  enqueuePendingSale(storage, { ...studentSale, id: 'operation-duplicate', saleId: 'sale-duplicate' })

  const sent: PendingSaleOperation[] = []
  const result = await drainPendingSales(storage, async (operation) => { sent.push(operation) })

  assert.deepEqual(result, { synced: 1, failed: 0, pending: 0 })
  assert.equal(sent.length, 1)
  assert.equal(sent[0]?.studentId, 'student-1')
  assert.equal(sent[0]?.deviceId, 'device-1')
  assert.equal(sent[0]?.idempotencyKey, 'student:device-1:1')
})
