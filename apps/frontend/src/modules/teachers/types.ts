export type TeacherStatus = 'active' | 'inactive'
export type TeacherMovementType = 'consumption' | 'top-up' | 'debt-payment' | 'reversal'

export interface Teacher {
  id: string
  cashRegisterId: string
  code: string
  firstName: string
  lastName: string
  netBalance: number
  status: TeacherStatus
  createdAt: string
  updatedAt: string
}

export interface TeacherDraft {
  id?: string
  cashRegisterId: string
  code: string
  firstName: string
  lastName: string
  status?: TeacherStatus
}

export interface TeacherMovement {
  id: string
  teacherId: string
  cashRegisterId: string
  occurredAt: string
  type: TeacherMovementType
  amount: number
  detail: string
  responsible: string
  deviceId: string
  idempotencyKey: string
  reversesMovementId?: string
}

export interface TeacherPaymentDraft {
  teacherId: string
  cashRegisterId: string
  type: 'top-up' | 'debt-payment'
  value: number
  detail: string
  idempotencyKey: string
}
