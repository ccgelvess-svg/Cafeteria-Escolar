import assert from 'node:assert/strict'
import test from 'node:test'

import type { StudentMovement } from './types.ts'
import { scopeStudentAccountReceiptMovements, summarizeStudentAccountReceipt } from './studentAccountReceipt.ts'

const movement = (id: string, studentId: string, cashRegisterId: string, type: StudentMovement['type'], amount: number): StudentMovement => ({
  id, studentId, cashRegisterId, type, amount, occurredAt: '2026-11-19T12:00:00.000Z',
  detail: id, responsible: 'Prueba', deviceId: 'device', idempotencyKey: id, syncStatus: 'synced',
})

test('el comprobante filtra estrictamente estudiante y caja', () => {
  const scoped = scopeStudentAccountReceiptMovements([
    movement('santo-compra', 'student-1', 'santo', 'consumption', -2500),
    movement('cardenal-abono', 'student-1', 'cardenal', 'debt-payment', 5000),
    movement('otro-estudiante', 'student-2', 'santo', 'top-up', 10000),
  ], 'student-1', 'santo')
  assert.deepEqual(scoped.map((item) => item.id), ['santo-compra'])
})

test('el resumen calcula compras, abonos, saldo y deuda con movimientos reales de la caja', () => {
  const summary = summarizeStudentAccountReceipt(-3000, [
    movement('compra', 'student-1', 'cardenal', 'consumption', -8000),
    movement('abono', 'student-1', 'cardenal', 'debt-payment', 5000),
  ])
  assert.deepEqual(summary, { purchases: 8000, payments: 5000, balance: 0, debt: 3000 })
})
