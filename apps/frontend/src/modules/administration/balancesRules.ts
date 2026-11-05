import type { Student, StudentMovement } from '../students/types'

export type MovementFilter = 'all' | StudentMovement['type']

export function accountTotals(students: Student[], selectedStudentId: string) {
  const selected = students.find((student) => student.id === selectedStudentId)
  const scope = selected ? [selected] : students
  return scope.reduce((totals, student) => ({
    balance: totals.balance + Math.max(0, student.netBalance),
    debt: totals.debt + Math.max(0, -student.netBalance),
  }), { balance: 0, debt: 0 })
}

export function filterAccountMovements(
  movements: StudentMovement[], studentId: string, type: MovementFilter, fromDate: string,
) {
  return movements.filter((movement) =>
    (studentId === 'all' || movement.studentId === studentId)
    && (type === 'all' || movement.type === type)
    && (!fromDate || movement.occurredAt.slice(0, 10) >= fromDate),
  )
}
