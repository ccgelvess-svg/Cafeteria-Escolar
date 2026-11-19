import type { TeacherMovement } from './types'

export function scopeTeacherAccountReceiptMovements(
  movements: TeacherMovement[],
  teacherId: string,
  cashRegisterId: string,
) {
  return movements.filter((movement) => movement.teacherId === teacherId && movement.cashRegisterId === cashRegisterId)
}
