import { createClient } from '@supabase/supabase-js'

const url = process.env.LOCAL_SUPABASE_URL
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY
if (!url || !anonKey || !serviceKey || !url.startsWith('http://127.0.0.1:')) throw new Error('Fixture permitido solo contra Supabase local')

export const email = 'pos-student-accounts@local.test'
export const password = 'Local-Sandbox-2026!'
const studentId = 'd0000000-0000-4000-8000-000000000019'
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (usersError) throw usersError
let user = users.users.find((candidate) => candidate.email === email)
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('No se creó el usuario ficticio')
  user = data.user
} else {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true })
  if (error) throw error
}

const { error: profileError } = await admin.from('profiles').upsert({
  user_id: user.id, display_name: 'Administrador POS Sandbox', role: 'administrator', active: true,
})
if (profileError) throw profileError
const { error: studentError } = await admin.from('students').upsert({
  id: studentId, code: 'POS-SANDBOX-001', first_name: 'Estudiante', last_name: 'Sandbox',
  grade: '5', group_name: 'A', status: 'active', created_by: user.id,
})
if (studentError) throw studentError

const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
const { error: signInError } = await client.auth.signInWithPassword({ email, password })
if (signInError) throw signInError

const { data: registers, error: registersError } = await admin.from('cash_registers').select('id,name').eq('active', true)
if (registersError) throw registersError
const santo = registers.find((register) => register.name === 'Col. Santo Ángel')
const cardenal = registers.find((register) => register.name === 'Cardenal Sancha')
if (!santo || !cardenal) throw new Error('Faltan las dos cajas del sandbox')

for (const movement of [
  [santo.id, 'top-up', 10_000, 'Abono sandbox Santo Ángel', 'pos-fixture:santo:payment'],
  [santo.id, 'consumption', 2_500, 'Compra sandbox Santo Ángel', 'pos-fixture:santo:purchase'],
  [cardenal.id, 'top-up', 5_000, 'Abono sandbox Cardenal Sancha', 'pos-fixture:cardenal:payment'],
  [cardenal.id, 'consumption', 8_000, 'Compra sandbox Cardenal Sancha', 'pos-fixture:cardenal:purchase'],
]) {
  const [cashRegisterId, type, value, detail, idempotencyKey] = movement
  const { error } = await client.rpc('record_student_movement_by_register', {
    p_student_id: studentId, p_type: type, p_value: value, p_detail: detail,
    p_device_id: 'pos-sandbox-fixture', p_idempotency_key: idempotencyKey,
    p_cash_register_id: cashRegisterId,
  })
  if (error) throw error
}

process.stdout.write('POS student accounts fixture: READY\n')
