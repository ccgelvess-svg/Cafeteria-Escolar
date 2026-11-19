import assert from 'node:assert/strict'
import test from 'node:test'

import {
  drainPendingSales,
  enqueuePendingSale,
  OUTBOX_KEY,
  pendingProductQuantities,
  pendingSaleValidationError,
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

function sale(overrides: Record<string, unknown> = {}): PendingSaleOperation {
  return {
    id: 'operation-1', kind: 'cash-sale', saleId: 'sale-1', idempotencyKey: 'cash:device:1',
    cashRegisterId: 'register-1', totalAmount: 1600, items: [{ productId: 'agua-bolsa', productName: 'Agua bolsa', unitPrice: 800, quantity: 2 }],
    createdAt: '2026-10-13T12:00:00.000Z', attempts: 0, ...overrides,
  } as PendingSaleOperation
}

test('la venta offline persiste entre recargas y conserva sus datos', () => {
  const storage = new MemoryStorage()
  assert.equal(enqueuePendingSale(storage, sale()), true)
  const reloaded = new MemoryStorage()
  reloaded.restore(storage.snapshot())
  assert.deepEqual(readPendingSales(reloaded), [sale()])
})

test('una venta pendiente anterior se conserva pero exige revisión manual de caja', () => {
  const storage = new MemoryStorage()
  const legacySale = sale({ cashRegisterId: undefined })
  assert.equal(enqueuePendingSale(storage, legacySale), true)
  assert.equal(readPendingSales(storage)[0]?.cashRegisterId, undefined)
  assert.match(pendingSaleValidationError(readPendingSales(storage)[0]!), /revisión manual/)
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

test('el stock reservado incluye únicamente las ventas pendientes de la caja', () => {
  const storage = new MemoryStorage()
  enqueuePendingSale(storage, sale())
  enqueuePendingSale(storage, sale({
    id: 'operation-2', saleId: 'sale-2', idempotencyKey: 'cash:device:2',
    items: [{ productId: 'agua-bolsa', productName: 'Agua bolsa', unitPrice: 800, quantity: 3 }],
  }))
  enqueuePendingSale(storage, sale({
    id: 'operation-3', saleId: 'sale-3', idempotencyKey: 'cash:device:3', cashRegisterId: 'register-2',
    items: [{ productId: 'agua-bolsa', productName: 'Agua bolsa', unitPrice: 900, quantity: 4 }],
  }))
  assert.equal(pendingProductQuantities(storage, 'register-1').get('agua-bolsa'), 5)
  assert.equal(pendingProductQuantities(storage, 'register-2').get('agua-bolsa'), 4)
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
  assert.equal(sent[0]?.cashRegisterId, 'register-1')
  assert.equal(sent[0]?.deviceId, 'device-1')
  assert.equal(sent[0]?.idempotencyKey, 'student:device-1:1')
})

test('la venta docente offline conserva solo la cuenta docente, caja, dispositivo e idempotencia', async () => {
  const storage = new MemoryStorage()
  const teacherSale = sale({
    kind: 'teacher-sale', teacherId: 'teacher-1', deviceId: 'device-1',
    idempotencyKey: 'teacher:device-1:1',
  })
  assert.equal(pendingSaleValidationError(teacherSale), null)
  enqueuePendingSale(storage, teacherSale)

  const sent: PendingSaleOperation[] = []
  const result = await drainPendingSales(storage, async (operation) => { sent.push(operation) })

  assert.deepEqual(result, { synced: 1, failed: 0, pending: 0 })
  assert.equal(sent[0]?.kind, 'teacher-sale')
  assert.equal(sent[0]?.teacherId, 'teacher-1')
  assert.equal(sent[0]?.studentId, undefined)
  assert.equal(sent[0]?.cashRegisterId, 'register-1')
  assert.equal(sent[0]?.deviceId, 'device-1')
  assert.equal(sent[0]?.idempotencyKey, 'teacher:device-1:1')
})

test('el outbox rechaza tipos desconocidos y cuentas estudiantil/docente cruzadas', () => {
  const crossedTeacher = sale({ kind: 'teacher-sale', teacherId: 'teacher-1', studentId: 'student-1' })
  const crossedStudent = sale({ kind: 'student-sale', studentId: 'student-1', teacherId: 'teacher-1' })
  const unknown = sale({ kind: 'legacy-sale' })

  assert.match(pendingSaleValidationError(crossedTeacher), /estudiante cruzado/)
  assert.match(pendingSaleValidationError(crossedStudent), /profesor cruzado/)
  assert.match(pendingSaleValidationError(unknown), /tipo desconocido/)
})
