import assert from 'node:assert/strict'
import test from 'node:test'

import { applyMovement, isMovementReversible, movementAmount, splitBalance } from './financialRules.ts'

test('un consumo reduce un saldo positivo', () => {
  assert.equal(applyMovement(20_000, movementAmount('consumption', 5_000)), 15_000)
})

test('un consumo sin saldo genera deuda', () => {
  assert.deepEqual(splitBalance(applyMovement(0, movementAmount('consumption', 8_000))), { balance: 0, debt: 8_000 })
})

test('un abono superior a la deuda deja saldo a favor', () => {
  assert.deepEqual(splitBalance(applyMovement(-8_000, movementAmount('debt-payment', 10_000))), { balance: 2_000, debt: 0 })
})

test('rechaza movimientos con valor cero o negativo', () => {
  assert.throws(() => movementAmount('top-up', 0))
  assert.throws(() => movementAmount('debt-payment', -1))
})

test('un reverso restaura exactamente el saldo anterior', () => {
  const original = movementAmount('consumption', 8_000)
  const afterConsumption = applyMovement(5_000, original)
  assert.equal(applyMovement(afterConsumption, -original), 5_000)
})

test('solo permite reversar una vez un movimiento original', () => {
  const original = { id: 'movement-1', type: 'top-up' }
  assert.equal(isMovementReversible(original, []), true)
  assert.equal(isMovementReversible(original, [{ reversesMovementId: 'movement-1' }]), false)
  assert.equal(isMovementReversible({ id: 'reversal-1', type: 'reversal' }, []), false)
})
