import type { StudentMovement } from './types'
import { splitBalance } from './financialRules.ts'

export function scopeStudentAccountReceiptMovements(
  movements: StudentMovement[],
  studentId: string,
  cashRegisterId: string,
) {
  return movements.filter((movement) => movement.studentId === studentId && movement.cashRegisterId === cashRegisterId)
}

export function summarizeStudentAccountReceipt(netBalance: number, movements: Array<Pick<StudentMovement, 'type' | 'amount'>>) {
  const split = splitBalance(netBalance)
  return {
    purchases: movements.reduce((total, movement) => movement.type === 'consumption' && movement.amount < 0
      ? total + Math.abs(movement.amount) : total, 0),
    payments: movements.reduce((total, movement) => (movement.type === 'top-up' || movement.type === 'debt-payment') && movement.amount > 0
      ? total + movement.amount : total, 0),
    balance: split.balance,
    debt: split.debt,
  }
}
