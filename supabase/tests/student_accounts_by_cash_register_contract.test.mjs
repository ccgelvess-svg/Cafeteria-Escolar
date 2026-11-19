import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../migrations/20261119010000_student_accounts_by_cash_register.sql', import.meta.url), 'utf8')
const rollback = readFileSync(new URL('../maintenance/rollback_20261119010000_student_accounts_by_cash_register.sql', import.meta.url), 'utf8')

test('los saldos se reconstruyen por estudiante y caja sin mezclar movimientos', () => {
  assert.match(migration, /PRIMARY KEY \(student_id, cash_register_id\)/)
  assert.match(migration, /WHERE movement\.cash_register_id IS NOT NULL\s+GROUP BY movement\.student_id, movement\.cash_register_id/)
  assert.match(migration, /p_cash_register_id uuid/)
  assert.match(migration, /v_movement\.cash_register_id IS DISTINCT FROM p_cash_register_id/)
})

test('los movimientos sin caja conservan historial y quedan pendientes', () => {
  assert.match(migration, /student_movements_pending_reconciliation/)
  assert.match(migration, /student_account_reconciliation/)
  assert.match(migration, /pending_balance/)
  assert.match(migration, /WHERE movement\.cash_register_id IS NULL/)
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+public\.(students|student_movements)/i)
  assert.doesNotMatch(migration, /TRUNCATE\s+.*(students|student_movements)/i)
})

test('el rollback retira solo la capa nueva y conserva tablas financieras históricas', () => {
  assert.match(rollback, /DROP TABLE IF EXISTS public\.student_accounts/)
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS public\.(students|student_movements)/)
  assert.doesNotMatch(rollback, /(DELETE|TRUNCATE)\s+/i)
})
