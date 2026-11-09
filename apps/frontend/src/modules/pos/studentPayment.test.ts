import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareCashPaymentAttempt } from './cashPayment.ts'
import { parseStudentPaymentValue, studentPaymentSignature } from './studentPayment.ts'

test('un reintento del mismo abono conserva la clave idempotente', () => {
  const signature = studentPaymentSignature('student-1', 'debt-payment', 4000)
  const first = prepareCashPaymentAttempt(null, signature, () => 'payment-key-1')
  const retry = prepareCashPaymentAttempt(first, signature, () => 'payment-key-2')
  assert.equal(retry.idempotencyKey, 'payment-key-1')
})

test('un estudiante, tipo o valor diferente crea otro intento', () => {
  const first = prepareCashPaymentAttempt(null, studentPaymentSignature('student-1', 'top-up', 4000), () => 'key-1')
  const changed = prepareCashPaymentAttempt(first, studentPaymentSignature('student-1', 'top-up', 5000), () => 'key-2')
  assert.equal(changed.idempotencyKey, 'key-2')
})

test('solo acepta valores enteros positivos', () => {
  assert.equal(parseStudentPaymentValue('4000'), 4000)
  assert.equal(parseStudentPaymentValue('0'), 0)
  assert.equal(parseStudentPaymentValue('-1'), 0)
  assert.equal(parseStudentPaymentValue('1.5'), 0)
})
