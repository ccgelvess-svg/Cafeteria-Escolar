import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeAuthEmail, signInErrorMessage } from './authErrors.ts'

test('normaliza el correo antes de autenticar', () => {
  assert.equal(normalizeAuthEmail('  AlfaYomegaMovil19@GMAIL.COM  '), 'alfayomegamovil19@gmail.com')
})

test('conserva el código seguro de credenciales inválidas', () => {
  assert.match(signInErrorMessage('invalid_credentials'), /invalid_credentials/)
})

test('distingue correo sin confirmar y límites de intentos', () => {
  assert.match(signInErrorMessage('email_not_confirmed'), /email_not_confirmed/)
  assert.match(signInErrorMessage('over_request_rate_limit'), /demasiados intentos/i)
})
