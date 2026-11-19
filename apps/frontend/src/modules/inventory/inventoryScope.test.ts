import assert from 'node:assert/strict'
import test from 'node:test'

import { selectCashRegisterInventory, type ScopedInventoryProduct } from './inventoryScope.ts'

const common = {
  id: 'shared-product', name: 'Agua', categoryId: 'drinks', categoryName: 'Bebidas',
  categorySlug: 'bebidas', subcategory: 'Agua', cost: 300, minimumStock: 2,
  active: true, updatedAt: '2026-11-05T00:00:00Z',
}

const rows: ScopedInventoryProduct[] = [
  { ...common, cashRegisterId: 'principal', price: 800, stockQuantity: 9 },
  { ...common, cashRegisterId: 'cardenal', price: 1200, stockQuantity: 4 },
]

test('un producto compartido conserva precio y existencia independientes por caja', () => {
  const principal = selectCashRegisterInventory(rows, 'principal', new Map([['shared-product', 2]]))
  const cardenal = selectCashRegisterInventory(rows, 'cardenal', new Map([['shared-product', 1]]))
  assert.deepEqual(principal.map(({ price, stockQuantity }) => ({ price, stockQuantity })), [{ price: 800, stockQuantity: 7 }])
  assert.deepEqual(cardenal.map(({ price, stockQuantity }) => ({ price, stockQuantity })), [{ price: 1200, stockQuantity: 3 }])
  assert.equal(rows[0]?.stockQuantity, 9)
  assert.equal(rows[1]?.stockQuantity, 4)
})

test('una caja sin ofertas no hereda los productos de otra caja', () => {
  assert.deepEqual(selectCashRegisterInventory(rows, 'tercera', new Map()), [])
  assert.deepEqual(selectCashRegisterInventory(rows, '', new Map()), [])
})
