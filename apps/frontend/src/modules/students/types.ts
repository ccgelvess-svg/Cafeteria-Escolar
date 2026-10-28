export type StudentStatus = 'active' | 'inactive'

export interface Student {
  id: string
  code: string
  firstName: string
  lastName: string
  grade: string
  group: string
  netBalance: number
  status: StudentStatus
  createdAt: string
  updatedAt: string
  syncStatus: 'synced'
}

export type MovementType = 'consumption' | 'top-up' | 'debt-payment' | 'reversal'

export interface StudentMovement {
  id: string
  studentId: string
  occurredAt: string
  type: MovementType
  amount: number
  detail: string
  responsible: string
  deviceId: string
  idempotencyKey: string
  reversesMovementId?: string
  syncStatus: 'synced'
}

export interface StudentDraft {
  id?: string
  code: string
  firstName: string
  lastName: string
  grade: string
  group: string
  status?: StudentStatus
}

export interface MovementDraft {
  studentId: string
  type: Exclude<MovementType, 'reversal'>
  value: number
  detail: string
  responsible: string
  idempotencyKey: string
}
