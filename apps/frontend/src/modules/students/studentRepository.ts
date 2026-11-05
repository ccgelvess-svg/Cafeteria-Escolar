import { requireSupabase } from '../../infrastructure/supabase/client'
import type { MovementDraft, Student, StudentDraft, StudentMovement } from './types'
import { normalizeStudentCode, validateStudentFields } from './studentRules'

export const STUDENTS_CHANGED_EVENT = 'cafeteria:students-changed'

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
}

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id, code: row.code, firstName: row.first_name, lastName: row.last_name,
    grade: row.grade, group: row.group_name, netBalance: row.net_balance, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at, syncStatus: 'synced',
  }
}

function mapMovement(row: MovementRow): StudentMovement {
  return {
    id: row.id, studentId: row.student_id, occurredAt: row.occurred_at, type: row.type,
    amount: row.amount, detail: row.detail, responsible: row.actor_display_name,
    deviceId: row.device_id, idempotencyKey: row.idempotency_key,
    reversesMovementId: row.reverses_movement_id ?? undefined, syncStatus: 'synced',
  }
}

function notifyChanged() { window.dispatchEvent(new Event(STUDENTS_CHANGED_EVENT)) }
export async function listStudents() {
  const { data, error } = await requireSupabase().from('students')
    .select('id,code,first_name,last_name,grade,group_name,net_balance,status,created_at,updated_at')
    .order('first_name').order('last_name')
  if (error) throw new Error('No fue posible cargar los estudiantes autorizados.')
  return (data as StudentRow[]).map(mapStudent)
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
  const { data, error } = await requireSupabase().rpc('record_student_movement', {
    p_student_id: draft.studentId,
    p_type: draft.type,
    p_value: draft.value,
    p_detail: draft.detail.trim(),
    p_device_id: getDeviceId(),
    p_idempotency_key: draft.idempotencyKey,
  })
  if (error) throw new Error(error.message || 'No fue posible registrar el movimiento.')
  notifyChanged()
  return mapMovement(data as MovementRow)
}

export async function listStudentMovements(studentId: string) {
  const { data, error } = await requireSupabase().from('student_movements')
    .select('id,student_id,occurred_at,type,amount,detail,actor_display_name,device_id,idempotency_key,reverses_movement_id')
    .eq('student_id', studentId).order('occurred_at', { ascending: false })
  if (error) throw new Error('No fue posible consultar los movimientos autorizados.')
  return (data as MovementRow[]).map(mapMovement)
}

export async function listAllStudentMovements() {
  const pageSize = 1000
  const movements: StudentMovement[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await requireSupabase().from('student_movements')
      .select('id,student_id,occurred_at,type,amount,detail,actor_display_name,device_id,idempotency_key,reverses_movement_id')
      .order('occurred_at', { ascending: false }).order('id')
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error('No fue posible consultar los movimientos autorizados.')
    const page = (data as MovementRow[]).map(mapMovement)
    movements.push(...page)
    if (page.length < pageSize) return movements
  }
}

export async function reverseMovement(studentId: string, movementId: string, _responsible: string) {
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
