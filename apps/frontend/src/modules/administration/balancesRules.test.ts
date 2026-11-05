import assert from 'node:assert/strict'
import test from 'node:test'
import { accountTotals, filterAccountMovements } from './balancesRules.ts'
import type { Student, StudentMovement } from '../students/types.ts'

const student = (id: string, netBalance: number): Student => ({
  id, code: id, firstName: '', lastName: '', grade: '', group: '', netBalance,
  status: 'active', createdAt: '', updatedAt: '', syncStatus: 'synced',
})
const movement = (id: string, studentId: string, type: StudentMovement['type'], occurredAt: string): StudentMovement => ({
  id, studentId, type, occurredAt, amount: 100, detail: '', responsible: '',
  deviceId: '', idempotencyKey: id, syncStatus: 'synced',
})

test('las cuentas vacías muestran cero y los saldos positivos y negativos no se compensan', () => {
  assert.deepEqual(accountTotals([], 'all'), { balance: 0, debt: 0 })
  const students = [student('a', 20000), student('b', -3000)]
  assert.deepEqual(accountTotals(students, 'all'), { balance: 20000, debt: 3000 })
  assert.deepEqual(accountTotals(students, 'b'), { balance: 0, debt: 3000 })
})

test('la consulta filtra por estudiante, tipo y fecha y queda vacía sin movimientos', () => {
  const movements = [movement('m1', 'a', 'top-up', '2026-10-11T10:00:00Z'), movement('m2', 'b', 'consumption', '2026-10-01T10:00:00Z')]
  assert.deepEqual(filterAccountMovements(movements, 'a', 'top-up', '2026-10-10').map(({ id }) => id), ['m1'])
  assert.deepEqual(filterAccountMovements([], 'all', 'all', ''), [])
})
