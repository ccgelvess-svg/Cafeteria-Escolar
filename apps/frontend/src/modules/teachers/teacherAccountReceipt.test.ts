import assert from 'node:assert/strict'
import test from 'node:test'

import type { TeacherMovement } from './types.ts'
import { scopeTeacherAccountReceiptMovements } from './teacherAccountReceipt.ts'

const movement = (id: string, teacherId: string, cashRegisterId: string): TeacherMovement => ({
  id, teacherId, cashRegisterId, occurredAt: '2026-11-19T12:00:00.000Z', type: 'consumption',
  amount: -2500, detail: id, responsible: 'Prueba', deviceId: 'device', idempotencyKey: id,
})

test('el comprobante docente filtra estrictamente profesor y caja', () => {
  const scoped = scopeTeacherAccountReceiptMovements([
    movement('santo', 'teacher-1', 'santo'),
    movement('cardenal', 'teacher-1', 'cardenal'),
    movement('otro-profesor', 'teacher-2', 'santo'),
  ], 'teacher-1', 'santo')
  assert.deepEqual(scoped.map((item) => item.id), ['santo'])
})
