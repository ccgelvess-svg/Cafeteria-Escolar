import assert from 'node:assert/strict'
import test from 'node:test'

import { matchesStudentSearch, normalizeStudentCode, validateStudentFields } from './studentRules.ts'

test('normaliza el código único antes del registro', () => {
  assert.equal(normalizeStudentCode('  est-009  '), 'EST-009')
})

test('registro exige todos los campos obligatorios', () => {
  assert.doesNotThrow(() => validateStudentFields({ code: 'E1', firstName: 'Ana', lastName: 'López', grade: '5°', group: 'A' }))
  assert.throws(() => validateStudentFields({ code: 'E1', firstName: ' ', lastName: 'López', grade: '5°', group: 'A' }))
})

test('búsqueda encuentra por nombre, código o curso sin depender de tildes', () => {
  const values = ['María López', 'EST-009', '5°', 'A']
  assert.equal(matchesStudentSearch(values, 'maria'), true)
  assert.equal(matchesStudentSearch(values, 'est-009'), true)
  assert.equal(matchesStudentSearch(values, '5° a'), true)
  assert.equal(matchesStudentSearch(values, 'carlos'), false)
})
