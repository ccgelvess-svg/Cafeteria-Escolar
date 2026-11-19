import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.LOCAL_SUPABASE_URL
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY
if (!url || !anonKey || !serviceKey || !url.startsWith('http://127.0.0.1:')) {
  throw new Error('La validación exige credenciales del Supabase local en 127.0.0.1')
}

const suffix = crypto.randomUUID()
const email = `student-accounts-${suffix}@local.test`
const password = `Local-${suffix}-Aa1!`
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const anonymous = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
})
if (createError || !created.user) throw createError ?? new Error('Auth local no creó el usuario ficticio')

const userId = created.user.id
const studentId = crypto.randomUUID()
const { data: registers, error: registerError } = await admin.from('cash_registers').select('id,name').eq('active', true).order('name').limit(2)
if (registerError || !registers || registers.length < 2) throw registerError ?? new Error('El sandbox requiere dos cajas activas')
const [registerOne, registerTwo] = registers

const { error: profileError } = await admin.from('profiles').insert({
  user_id: userId, display_name: 'Administrador ficticio E2E', role: 'administrator', active: true,
})
if (profileError) throw profileError
const { error: studentError } = await admin.from('students').insert({
  id: studentId, code: `E2E-${suffix}`, first_name: 'Estudiante', last_name: 'Ficticio',
  grade: '5', group_name: 'A', status: 'active', created_by: userId,
})
if (studentError) throw studentError

const { data: signedIn, error: signInError } = await anonymous.auth.signInWithPassword({ email, password })
if (signInError || !signedIn.session) throw signInError ?? new Error('Auth local no entregó sesión')

const authenticated = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
})

async function movement(registerId, type, value, idempotencyKey) {
  const { error } = await authenticated.rpc('record_student_movement_by_register', {
    p_student_id: studentId, p_type: type, p_value: value,
    p_detail: `Movimiento ficticio ${idempotencyKey}`, p_device_id: 'local-e2e',
    p_idempotency_key: idempotencyKey, p_cash_register_id: registerId,
  })
  if (error) throw error
}

await movement(registerOne.id, 'debt-payment', 1200, `payment:${suffix}`)
await movement(registerOne.id, 'debt-payment', 1200, `payment:${suffix}`)
await movement(registerTwo.id, 'consumption', 700, `purchase:${suffix}`)

const { data: accounts, error: accountsError } = await authenticated.from('student_accounts')
  .select('cash_register_id,net_balance').eq('student_id', studentId).order('cash_register_id')
if (accountsError) throw accountsError
assert.deepEqual(new Map(accounts.map((row) => [row.cash_register_id, row.net_balance])), new Map([
  [registerOne.id, 1200], [registerTwo.id, -700],
]))

const { count: paymentCount, error: paymentError } = await authenticated.from('student_movements')
  .select('id', { count: 'exact', head: true }).eq('idempotency_key', `payment:${suffix}`)
if (paymentError) throw paymentError
assert.equal(paymentCount, 1)

const { data: historyOne, error: historyOneError } = await authenticated.from('student_movements')
  .select('cash_register_id,type,amount').eq('student_id', studentId).eq('cash_register_id', registerOne.id)
const { data: historyTwo, error: historyTwoError } = await authenticated.from('student_movements')
  .select('cash_register_id,type,amount').eq('student_id', studentId).eq('cash_register_id', registerTwo.id)
if (historyOneError || historyTwoError) throw historyOneError ?? historyTwoError
assert.equal(historyOne.length, 1)
assert.equal(historyTwo.length, 1)

const { data: rpcAccounts, error: rpcError } = await authenticated.rpc('list_student_accounts', { p_cash_register_id: registerOne.id })
if (rpcError) throw rpcError
assert.equal(rpcAccounts.find((row) => row.id === studentId)?.net_balance, 1200)

process.stdout.write(`student accounts Supabase stack validation: PASS (${registerOne.name} / ${registerTwo.name})\n`)
