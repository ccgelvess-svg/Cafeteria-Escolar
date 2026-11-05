import assert from 'node:assert/strict'
import test from 'node:test'

import { canAccessRoute, canUseCashRegister, hasPermission } from './authorization.ts'

test('administrador tiene acceso total', () => {
  assert.equal(canAccessRoute('administrator', 'admin'), true)
  assert.equal(canAccessRoute('administrator', 'pos'), true)
  assert.equal(canAccessRoute('administrator', 'inventory'), true)
})

test('cajero solo accede al POS y operaciones de su caja', () => {
  assert.equal(canAccessRoute('cashier', 'pos'), true)
  assert.equal(canAccessRoute('cashier', 'admin'), false)
  assert.equal(canAccessRoute('cashier', 'inventory'), false)
  assert.equal(hasPermission('cashier', 'cash-register:own'), true)
})

test('inventarios solo accede a productos y existencias', () => {
  assert.equal(canAccessRoute('inventory', 'inventory'), true)
  assert.equal(canAccessRoute('inventory', 'pos'), false)
  assert.equal(canAccessRoute('inventory', 'admin'), false)
})

test('administrador puede elegir cualquier caja y cajero solo la asignada', () => {
  assert.equal(canUseCashRegister('administrator', undefined, 'register-2'), true)
  assert.equal(canUseCashRegister('cashier', 'register-1', 'register-1'), true)
  assert.equal(canUseCashRegister('cashier', 'register-1', 'register-2'), false)
  assert.equal(canUseCashRegister('cashier', undefined, 'register-1'), false)
})
