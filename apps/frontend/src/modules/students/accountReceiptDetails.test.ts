import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAccountReceiptEntries, type AccountReceiptSale } from './studentAccountReceipt.ts'
import type { StudentMovement } from './types.ts'

const movement = (input: Partial<StudentMovement> & Pick<StudentMovement, 'id' | 'occurredAt' | 'type' | 'amount' | 'idempotencyKey'>): StudentMovement => ({
  studentId: 'student-1', cashRegisterId: 'register-1', detail: input.id,
  responsible: 'Prueba', deviceId: 'device', syncStatus: 'synced', ...input,
})

test('detalla productos reales y calcula el saldo posterior de compras, abonos y recargas', () => {
  const movements = [
    movement({ id: 'top-up', occurredAt: '2026-11-20T15:00:00.000Z', type: 'top-up', amount: 10_000, idempotencyKey: 'top-up-1' }),
    movement({ id: 'payment', occurredAt: '2026-11-20T14:00:00.000Z', type: 'debt-payment', amount: 5_000, idempotencyKey: 'payment-1' }),
    movement({ id: 'purchase', occurredAt: '2026-11-20T13:00:00.000Z', type: 'consumption', amount: -8_000, idempotencyKey: 'sale:sale-key' }),
  ]
  const sales: AccountReceiptSale[] = [{
    id: 'sale-1', occurredAt: '2026-11-20T13:00:00.000Z', totalAmount: 8_000,
    status: 'completed', idempotencyKey: 'sale-key',
    items: [{ productName: 'Producto registrado', quantity: 2, unitPrice: 4_000, lineTotal: 8_000 }],
  }]

  const entries = buildAccountReceiptEntries(7_000, movements, sales)
  assert.deepEqual(entries.map((entry) => [entry.kind, entry.balanceAfter]), [
    ['movement', 7_000], ['movement', -3_000], ['sale', -8_000],
  ])
  const purchase = entries[2]
  assert.equal(purchase?.kind, 'sale')
  if (purchase?.kind === 'sale') assert.deepEqual(purchase.sale.items, sales[0]?.items)
})

test('no convierte el texto de un consumo sin venta vinculada en productos inventados', () => {
  const entries = buildAccountReceiptEntries(-2_500, [
    movement({ id: 'legacy', occurredAt: '2026-11-20T13:00:00.000Z', type: 'consumption', amount: -2_500, idempotencyKey: 'legacy' }),
  ], [])

  assert.equal(entries[0]?.kind, 'movement')
})
