import assert from 'node:assert/strict'
import test from 'node:test'

import { cashSaleSignature, prepareCashPaymentAttempt, studentSaleSignature } from './cashPayment.ts'

test('la firma de venta no depende del orden del carrito', () => {
  assert.equal(
    cashSaleSignature('register-1', [{ productId: 'b', quantity: 2 }, { productId: 'a', quantity: 1 }]),
    cashSaleSignature('register-1', [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 2 }]),
  )
  assert.notEqual(
    cashSaleSignature('register-1', [{ productId: 'a', quantity: 1 }]),
    cashSaleSignature('register-2', [{ productId: 'a', quantity: 1 }]),
  )
})

test('un reintento conserva la misma clave idempotente', () => {
  let created = 0
  const createKey = () => `key-${++created}`
  const first = prepareCashPaymentAttempt(null, 'cash:a:1', createKey)
  const retry = prepareCashPaymentAttempt(first, 'cash:a:1', createKey)
  const changed = prepareCashPaymentAttempt(retry, 'cash:a:2', createKey)
  assert.equal(first.idempotencyKey, retry.idempotencyKey)
  assert.notEqual(retry.idempotencyKey, changed.idempotencyKey)
  assert.equal(created, 2)
})

test('la firma de consumo identifica estudiante y no depende del orden del carrito', () => {
  const lines = [{ productId: 'agua', quantity: 2 }, { productId: 'pan', quantity: 1 }]
  assert.equal(studentSaleSignature('register-1', 'student-1', lines), studentSaleSignature('register-1', 'student-1', [...lines].reverse()))
  assert.notEqual(studentSaleSignature('register-1', 'student-1', lines), studentSaleSignature('register-1', 'student-2', lines))
  assert.notEqual(studentSaleSignature('register-1', 'student-1', lines), studentSaleSignature('register-2', 'student-1', lines))
})

test('un reintento de consumo conserva la misma clave idempotente', () => {
  const signature = studentSaleSignature('register-1', 'student-1', [{ productId: 'agua', quantity: 1 }])
  const first = prepareCashPaymentAttempt(null, signature, () => 'student-key-1')
  const retry = prepareCashPaymentAttempt(first, signature, () => 'student-key-2')
  assert.equal(retry.idempotencyKey, 'student-key-1')
})
