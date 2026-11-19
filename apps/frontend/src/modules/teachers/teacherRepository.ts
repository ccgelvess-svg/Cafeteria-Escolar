import { requireSupabase } from '../../infrastructure/supabase/client'
import { readOfflineSnapshot, writeOfflineSnapshot } from '../../infrastructure/storage/offlineDatabase'
import { enqueuePendingSale, isConnectivityError } from '../../infrastructure/sync/outbox'
import { getDeviceId, normalizeStudentCode } from '../students'
import type { Teacher, TeacherDraft, TeacherMovement, TeacherPaymentDraft, TeacherStatus } from './types'

export const TEACHERS_CHANGED_EVENT = 'cafeteria:teachers-changed'

interface TeacherRow {
  id: string
  cash_register_id: string
  code: string
  first_name: string
  last_name: string
  net_balance: number
  status: Teacher['status']
  created_at: string
  updated_at: string
}

interface TeacherMovementRow {
  id: string
  teacher_id: string
  cash_register_id: string
  occurred_at: string
  type: TeacherMovement['type']
  amount: number
  detail: string
  actor_display_name: string
  device_id: string
  idempotency_key: string
  reverses_movement_id: string | null
}

const teacherColumns = 'id,cash_register_id,code,first_name,last_name,net_balance,status,created_at,updated_at'
const movementColumns = 'id,teacher_id,cash_register_id,occurred_at,type,amount,detail,actor_display_name,device_id,idempotency_key,reverses_movement_id'

function integrationError(error: { code?: string; message?: string }, fallback: string) {
  if (error.code === '42P01' || error.code === 'PGRST202' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
    return new Error('El módulo Profesores está preparado, pero la migración teacher_accounts aún no está aplicada.')
  }
  return new Error(error.message || fallback)
}

function mapTeacher(row: TeacherRow): Teacher {
  return {
    id: row.id, cashRegisterId: row.cash_register_id, code: row.code,
    firstName: row.first_name, lastName: row.last_name, netBalance: row.net_balance,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

function mapMovement(row: TeacherMovementRow): TeacherMovement {
  return {
    id: row.id, teacherId: row.teacher_id, cashRegisterId: row.cash_register_id,
    occurredAt: row.occurred_at, type: row.type, amount: row.amount,
    detail: row.detail, responsible: row.actor_display_name, deviceId: row.device_id,
    idempotencyKey: row.idempotency_key, reversesMovementId: row.reverses_movement_id ?? undefined,
  }
}

function notifyChanged() { window.dispatchEvent(new Event(TEACHERS_CHANGED_EVENT)) }

export async function listTeachers(cashRegisterId: string) {
  if (!cashRegisterId) return []
  const cacheKey = `teachers:${cashRegisterId}`
  const cached = await readOfflineSnapshot<Teacher[]>(cacheKey) ?? []
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (cached.length > 0) return cached
    throw new Error('No hay profesores almacenados para esta caja.')
  }
  const { data, error } = await requireSupabase().from('teachers')
    .select(teacherColumns).eq('cash_register_id', cashRegisterId)
    .order('first_name').order('last_name')
  if (error) {
    if (cached.length > 0) return cached
    throw integrationError(error, 'No fue posible cargar los profesores.')
  }
  const teachers = (data as TeacherRow[]).map(mapTeacher)
  try { await writeOfflineSnapshot(cacheKey, teachers.slice(0, 1000)) } catch { /* keep live data available */ }
  return teachers
}

export async function saveTeacher(draft: TeacherDraft) {
  if (![draft.cashRegisterId, draft.code, draft.firstName, draft.lastName].every((value) => value.trim())) {
    throw new Error('Completa todos los datos obligatorios.')
  }
  const values = {
    cash_register_id: draft.cashRegisterId,
    code: normalizeStudentCode(draft.code),
    first_name: draft.firstName.trim(),
    last_name: draft.lastName.trim(),
    status: draft.status ?? 'active',
  }
  const query = draft.id
    ? requireSupabase().from('teachers').update(values).eq('id', draft.id)
    : requireSupabase().from('teachers').insert(values)
  const { data, error } = await query.select(teacherColumns).single()
  if (error?.code === '23505') throw new Error('Ya existe un profesor con este código en la caja seleccionada.')
  if (error) throw integrationError(error, 'No fue posible guardar el profesor.')
  notifyChanged()
  return mapTeacher(data as TeacherRow)
}

export async function setTeacherStatus(teacherId: string, status: TeacherStatus) {
  const { error } = await requireSupabase().from('teachers').update({ status }).eq('id', teacherId)
  if (error) throw integrationError(error, 'No fue posible cambiar el estado del profesor.')
  notifyChanged()
}

export async function listTeacherMovements(teacherId: string, cashRegisterId: string) {
  const { data, error } = await requireSupabase().from('teacher_movements')
    .select(movementColumns).eq('teacher_id', teacherId).eq('cash_register_id', cashRegisterId)
    .order('occurred_at', { ascending: false })
  if (error) throw integrationError(error, 'No fue posible consultar los movimientos del profesor.')
  return (data as TeacherMovementRow[]).map(mapMovement)
}

export async function registerTeacherPayment(draft: TeacherPaymentDraft) {
  const operation = {
    id: crypto.randomUUID(), kind: 'teacher-movement' as const, teacherId: draft.teacherId,
    cashRegisterId: draft.cashRegisterId, movementType: draft.type, value: draft.value,
    detail: draft.detail.trim(), deviceId: getDeviceId(), idempotencyKey: draft.idempotencyKey,
    createdAt: new Date().toISOString(), attempts: 0,
  }
  const queue = async (lastError?: string) => {
    const added = await enqueuePendingSale(lastError ? { ...operation, lastError } : operation)
    if (added) {
      const cacheKey = `teachers:${draft.cashRegisterId}`
      const cached = await readOfflineSnapshot<Teacher[]>(cacheKey) ?? []
      try { await writeOfflineSnapshot(cacheKey, cached.map((teacher) => teacher.id === draft.teacherId
        ? { ...teacher, netBalance: teacher.netBalance + draft.value, updatedAt: operation.createdAt }
        : teacher)) } catch { /* the durable outbox remains the source of truth */ }
    }
    notifyChanged()
    return null
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return queue()
  const { data, error } = await requireSupabase().rpc('record_teacher_movement', {
    p_teacher_id: draft.teacherId,
    p_type: draft.type,
    p_value: draft.value,
    p_detail: draft.detail.trim(),
    p_device_id: getDeviceId(),
    p_idempotency_key: draft.idempotencyKey,
    p_cash_register_id: draft.cashRegisterId,
  })
  if (error) {
    const cause = integrationError(error, 'No fue posible registrar el abono.')
    if (isConnectivityError(cause)) return queue(cause.message)
    throw cause
  }
  notifyChanged()
  return mapMovement(data as TeacherMovementRow)
}
