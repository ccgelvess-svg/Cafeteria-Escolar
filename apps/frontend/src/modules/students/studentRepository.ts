import { requireSupabase } from '../../infrastructure/supabase/client'
import { readOfflineSnapshot, writeOfflineSnapshot } from '../../infrastructure/storage/offlineDatabase'
import { enqueuePendingSale, isConnectivityError } from '../../infrastructure/sync/outbox'
import { isOnlineForDataAccess } from '../../infrastructure/sync/connectivity'
import type { MovementDraft, Student, StudentDraft, StudentMovement } from './types'
import { normalizeStudentCode, validateStudentFields } from './studentRules'

export const STUDENTS_CHANGED_EVENT = 'cafeteria:students-changed'
const STUDENTS_CACHE_KEY = 'students:authorized'

function studentsCacheKey(cashRegisterId?: string) {
  return `${STUDENTS_CACHE_KEY}:${cashRegisterId || 'all'}`
}

function studentMovementsCacheKey(studentId: string, cashRegisterId: string) {
  return `student-movements:${cashRegisterId}:${studentId}`
}

function allStudentMovementsCacheKey(cashRegisterId: string) {
  return `student-movements:${cashRegisterId}:all`
}

interface StudentRow {
  id: string
  code: string
  first_name: string
  last_name: string
  grade: string
  group_name: string
  net_balance: number
  status: Student['status']
  created_at: string
  updated_at: string
  cash_register_id: string | null
}

interface MovementRow {
  id: string
  student_id: string
  occurred_at: string
  type: StudentMovement['type']
  amount: number
  detail: string
  actor_display_name: string
  device_id: string
  idempotency_key: string
  reverses_movement_id: string | null
  cash_register_id: string | null
}

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id, cashRegisterId: row.cash_register_id ?? undefined,
    code: row.code, firstName: row.first_name, lastName: row.last_name,
    grade: row.grade, group: row.group_name, netBalance: row.net_balance, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at, syncStatus: 'synced',
  }
}

function mapMovement(row: MovementRow): StudentMovement {
  return {
    id: row.id, studentId: row.student_id, cashRegisterId: row.cash_register_id ?? undefined,
    occurredAt: row.occurred_at, type: row.type,
    amount: row.amount, detail: row.detail, responsible: row.actor_display_name,
    deviceId: row.device_id, idempotencyKey: row.idempotency_key,
    reversesMovementId: row.reverses_movement_id ?? undefined, syncStatus: 'synced',
  }
}

function notifyChanged() { window.dispatchEvent(new Event(STUDENTS_CHANGED_EVENT)) }
export async function listStudents(cashRegisterId?: string) {
  const cacheKey = studentsCacheKey(cashRegisterId)
  const cached = await readOfflineSnapshot<Student[]>(cacheKey) ?? []
  if (!isOnlineForDataAccess()) {
    if (cached.length > 0) return cached
    throw new Error('No hay estudiantes almacenados para trabajar sin conexión.')
  }
  const { data, error } = await requireSupabase().rpc('list_student_accounts', {
    p_cash_register_id: cashRegisterId || null,
  })
  if (error) {
    if (cached.length > 0) return cached
    throw new Error('No fue posible cargar los estudiantes autorizados.')
  }
  const students = (data as StudentRow[]).map(mapStudent)
  try { await writeOfflineSnapshot(cacheKey, students.slice(0, 2000)) } catch { /* keep live data available */ }
  return students
}

export async function cachePendingStudentConsumption(input: {
  operationId: string
  studentId: string
  cashRegisterId: string
  amount: number
  detail: string
  deviceId: string
  idempotencyKey: string
  createdAt: string
}) {
  const accountKey = studentsCacheKey(input.cashRegisterId)
  const students = await readOfflineSnapshot<Student[]>(accountKey) ?? []
  try { await writeOfflineSnapshot(accountKey, students.map((student) => student.id === input.studentId
    ? { ...student, netBalance: student.netBalance - input.amount, updatedAt: input.createdAt }
    : student)) } catch { /* durable sale outbox remains the source of truth */ }
  const movement: StudentMovement = {
    id: input.operationId, studentId: input.studentId, cashRegisterId: input.cashRegisterId,
    occurredAt: input.createdAt, type: 'consumption', amount: -input.amount,
    detail: input.detail, responsible: 'Pendiente de sincronización', deviceId: input.deviceId,
    idempotencyKey: `sale:${input.idempotencyKey}`, syncStatus: 'pending',
  }
  const movementKey = studentMovementsCacheKey(input.studentId, input.cashRegisterId)
  const movements = await readOfflineSnapshot<StudentMovement[]>(movementKey) ?? []
  try { await writeOfflineSnapshot(movementKey, [movement, ...movements]) } catch { /* outbox remains durable */ }
  const allKey = allStudentMovementsCacheKey(input.cashRegisterId)
  const allMovements = await readOfflineSnapshot<StudentMovement[]>(allKey) ?? []
  try { await writeOfflineSnapshot(allKey, [movement, ...allMovements]) } catch { /* outbox remains durable */ }
}

export async function saveStudent(draft: StudentDraft) {
  validateStudentFields(draft)
  const values = {
    code: normalizeStudentCode(draft.code), first_name: draft.firstName.trim(), last_name: draft.lastName.trim(),
    grade: draft.grade.trim(), group_name: draft.group.trim(), status: draft.status ?? 'active',
  }
  const query = draft.id
    ? requireSupabase().from('students').update(values).eq('id', draft.id)
    : requireSupabase().from('students').insert(values)
  const { data, error } = await query
    .select('id,code,first_name,last_name,grade,group_name,net_balance,status,created_at,updated_at').single()
  if (error?.code === '23505') throw new Error('Ya existe un estudiante con este código único.')
  if (error) throw new Error('No fue posible guardar el estudiante.')
  notifyChanged()
  return mapStudent(data as StudentRow)
}

export async function setStudentStatus(studentId: string, status: Student['status']) {
  const { error } = await requireSupabase().from('students').update({ status }).eq('id', studentId)
  if (error) throw new Error('No fue posible cambiar el estado del estudiante.')
  notifyChanged()
}

export async function registerMovement(draft: MovementDraft) {
  const operation = {
    id: crypto.randomUUID(), kind: 'student-movement' as const, studentId: draft.studentId,
    cashRegisterId: draft.cashRegisterId,
    movementType: draft.type as 'top-up' | 'debt-payment', value: draft.value,
    detail: draft.detail.trim(), deviceId: getDeviceId(), idempotencyKey: draft.idempotencyKey,
    createdAt: new Date().toISOString(), attempts: 0,
  }
  const queue = async (lastError?: string) => {
    const added = await enqueuePendingSale(lastError ? { ...operation, lastError } : operation)
    if (added) {
      const cacheKey = studentsCacheKey(draft.cashRegisterId)
      const cached = await readOfflineSnapshot<Student[]>(cacheKey) ?? []
      try { await writeOfflineSnapshot(cacheKey, cached.map((student) => student.id === draft.studentId
        ? { ...student, netBalance: student.netBalance + draft.value, updatedAt: operation.createdAt }
        : student)) } catch { /* the durable outbox remains the source of truth */ }
      const pendingMovement: StudentMovement = {
        id: operation.id, studentId: draft.studentId, cashRegisterId: draft.cashRegisterId,
        occurredAt: operation.createdAt, type: draft.type, amount: draft.value,
        detail: operation.detail, responsible: draft.responsible, deviceId: operation.deviceId,
        idempotencyKey: operation.idempotencyKey, syncStatus: 'pending',
      }
      const movementKey = studentMovementsCacheKey(draft.studentId, draft.cashRegisterId)
      const movements = await readOfflineSnapshot<StudentMovement[]>(movementKey) ?? []
      try { await writeOfflineSnapshot(movementKey, [pendingMovement, ...movements]) } catch { /* outbox remains durable */ }
      const allKey = allStudentMovementsCacheKey(draft.cashRegisterId)
      const allMovements = await readOfflineSnapshot<StudentMovement[]>(allKey) ?? []
      try { await writeOfflineSnapshot(allKey, [pendingMovement, ...allMovements]) } catch { /* outbox remains durable */ }
    }
    notifyChanged()
    return null
  }
  if (!isOnlineForDataAccess()) return queue()
  const { data, error } = await requireSupabase().rpc('record_student_movement_by_register', {
    p_student_id: draft.studentId,
    p_type: draft.type,
    p_value: draft.value,
    p_detail: draft.detail.trim(),
    p_device_id: getDeviceId(),
    p_idempotency_key: draft.idempotencyKey,
    p_cash_register_id: draft.cashRegisterId,
  })
  if (error) {
    const cause = new Error(error.message || 'No fue posible registrar el movimiento.')
    if (isConnectivityError(cause)) return queue(cause.message)
    throw cause
  }
  notifyChanged()
  return mapMovement(data as MovementRow)
}

export async function listStudentMovements(studentId: string, cashRegisterId: string) {
  const cacheKey = studentMovementsCacheKey(studentId, cashRegisterId)
  const cached = await readOfflineSnapshot<StudentMovement[]>(cacheKey) ?? []
  if (!isOnlineForDataAccess()) return cached
  const { data, error } = await requireSupabase().from('student_movements')
    .select('id,student_id,cash_register_id,occurred_at,type,amount,detail,actor_display_name,device_id,idempotency_key,reverses_movement_id')
    .eq('student_id', studentId).eq('cash_register_id', cashRegisterId)
    .order('occurred_at', { ascending: false })
  if (error) {
    if (cached.length > 0) return cached
    throw new Error('No fue posible consultar los movimientos autorizados.')
  }
  const movements = (data as MovementRow[]).map(mapMovement)
  try { await writeOfflineSnapshot(cacheKey, movements.slice(0, 500)) } catch { /* live history remains available */ }
  return movements
}

export async function listAllStudentMovements(cashRegisterId: string) {
  const cacheKey = allStudentMovementsCacheKey(cashRegisterId)
  const cached = await readOfflineSnapshot<StudentMovement[]>(cacheKey) ?? []
  if (!isOnlineForDataAccess()) return cached
  const pageSize = 1000
  const movements: StudentMovement[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await requireSupabase().from('student_movements')
      .select('id,student_id,cash_register_id,occurred_at,type,amount,detail,actor_display_name,device_id,idempotency_key,reverses_movement_id')
      .eq('cash_register_id', cashRegisterId)
      .order('occurred_at', { ascending: false }).order('id')
      .range(offset, offset + pageSize - 1)
    if (error) {
      if (cached.length > 0) return cached
      throw new Error('No fue posible consultar los movimientos autorizados.')
    }
    const page = (data as MovementRow[]).map(mapMovement)
    movements.push(...page)
    if (page.length < pageSize) {
      try { await writeOfflineSnapshot(cacheKey, movements.slice(0, 2000)) } catch { /* live history remains available */ }
      return movements
    }
  }
}

export async function reverseMovement(studentId: string, movementId: string, _cashRegisterId: string, _responsible: string) {
  const { data, error } = await requireSupabase().rpc('reverse_student_movement', {
    p_student_id: studentId,
    p_movement_id: movementId,
    p_device_id: getDeviceId(),
  })
  if (error) throw new Error(error.message || 'No fue posible reversar el movimiento.')
  notifyChanged()
  return mapMovement(data as MovementRow)
}

export function getDeviceId() {
  const key = 'cafeteria-device-id'
  const current = localStorage.getItem(key)
  if (current) return current
  const created = crypto.randomUUID()
  localStorage.setItem(key, created)
  return created
}

export function createIdempotencyKey(prefix: string) { return `${prefix}:${crypto.randomUUID()}` }
